import asyncio
import base64
import logging
import secrets
import socket
import string
from contextlib import contextmanager
from email.message import EmailMessage
from typing import Optional

import aiosmtplib
import httpx
from pydantic import EmailStr

from .config import settings

logger = logging.getLogger(__name__)

_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """Filter DNS results down to IPv4. Some hosts (e.g. Render) have
    unroutable outbound IPv6 -- when smtp.gmail.com resolves to an IPv6
    address first, the connection attempt hangs until the full timeout
    instead of falling back to IPv4, producing SMTPConnectTimeoutError
    even though the server is reachable over IPv4."""
    results = _orig_getaddrinfo(host, port, family, type, proto, flags)
    ipv4_results = [r for r in results if r[0] == socket.AF_INET]
    return ipv4_results or results


@contextmanager
def _force_ipv4_dns():
    socket.getaddrinfo = _ipv4_only_getaddrinfo
    try:
        yield
    finally:
        socket.getaddrinfo = _orig_getaddrinfo

# Gmail SMTP configuration -- reuses the Settings fields that already exist
# for this (MAIL_USERNAME/MAIL_PASSWORD/MAIL_SERVER/MAIL_PORT/...), which
# were previously unused after an earlier switch to a Brevo HTTP API
# integration. For Gmail: MAIL_USERNAME is the full @gmail.com address,
# MAIL_PASSWORD is a 16-character Google *App Password* (Google Account ->
# Security -> 2-Step Verification -> App passwords) -- your normal Gmail
# password will not work here.
MAIL_FROM = settings.MAIL_FROM or settings.MAIL_USERNAME
MAIL_FROM_NAME = settings.MAIL_FROM_NAME
FRONTEND_URL = settings.FRONTEND_URL

GMAIL_API_CONFIGURED = bool(
    settings.GOOGLE_CLIENT_ID
    and settings.GOOGLE_CLIENT_SECRET
    and settings.GOOGLE_REFRESH_TOKEN
    and MAIL_FROM
)
SMTP_CONFIGURED = bool(settings.MAIL_USERNAME and settings.MAIL_PASSWORD)
EMAIL_CONFIGURED = GMAIL_API_CONFIGURED or SMTP_CONFIGURED

logger.info("=" * 50)
logger.info("Email Configuration:")
logger.info(f"  GMAIL_API: {'CONFIGURED' if GMAIL_API_CONFIGURED else 'NOT SET'}")
logger.info(f"  SMTP_FALLBACK: {'CONFIGURED' if SMTP_CONFIGURED else 'NOT SET'}")
logger.info(f"  MAIL_SERVER: {settings.MAIL_SERVER}:{settings.MAIL_PORT}")
logger.info(f"  MAIL_USERNAME: {'SET' if settings.MAIL_USERNAME else 'NOT SET'}")
logger.info(f"  MAIL_PASSWORD: {'SET' if settings.MAIL_PASSWORD else 'NOT SET'}")
logger.info(f"  MAIL_FROM: {MAIL_FROM}")
logger.info(f"  FRONTEND_URL: {FRONTEND_URL}")
logger.info("=" * 50)

if not EMAIL_CONFIGURED:
    logger.warning("⚠️ Gmail API OAuth credentials and SMTP credentials are not configured")


def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def _gmail_api_access_token() -> str:
    """Exchange the stored OAuth refresh token for a short-lived access token."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": settings.GOOGLE_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
        )
    response.raise_for_status()
    return response.json()["access_token"]


async def _send_email_gmail_api(message: EmailMessage, to_email: str) -> bool:
    """Send a MIME message through Gmail's HTTPS API."""
    try:
        access_token = await _gmail_api_access_token()
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json={"raw": raw},
            )
        response.raise_for_status()
        message_id = response.json().get("id", "unknown")
        logger.info(f"✅ Gmail API sent email to {to_email} (message {message_id})")
        return True
    except httpx.HTTPStatusError as exc:
        logger.error(
            "❌ Gmail API rejected email to %s: HTTP %s: %s",
            to_email,
            exc.response.status_code,
            exc.response.text[:500],
        )
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.error(f"❌ Gmail API failed for {to_email}: {type(exc).__name__}: {exc}")
    return False


async def send_email_smtp(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str
) -> bool:
    """Send email via Gmail SMTP (or any SMTP server configured through
    MAIL_SERVER/MAIL_PORT)."""

    if not EMAIL_CONFIGURED:
        logger.error("❌ Email is not configured")
        return False

    message = EmailMessage()
    message["From"] = f"{MAIL_FROM_NAME} <{MAIL_FROM}>"
    message["To"] = f"{to_name} <{to_email}>" if to_name else to_email
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable email client to view.")
    message.add_alternative(html_content, subtype="html")

    if GMAIL_API_CONFIGURED:
        logger.info(f"📧 Sending email via Gmail HTTPS API to {to_email}")
        return await _send_email_gmail_api(message, to_email)

    # SMTP is retained only as a fallback for environments that permit it.
    # Gmail supports both STARTTLS on 587 and implicit TLS on 465. Some
    # hosting networks block only one of these routes, so try the configured
    # transport first and then the other Gmail transport on connection errors.
    configured = (
        settings.MAIL_PORT,
        settings.MAIL_STARTTLS,
        settings.MAIL_SSL_TLS,
    )
    alternate = (465, False, True) if settings.MAIL_PORT != 465 else (587, True, False)
    transports = [configured]
    if settings.MAIL_SERVER == "smtp.gmail.com" and alternate != configured:
        transports.append(alternate)

    for attempt, (port, start_tls, use_tls) in enumerate(transports, start=1):
        try:
            logger.info(
                f"📧 Sending email via SMTP ({settings.MAIL_SERVER}:{port}) "
                f"to {to_email} (transport {attempt}/{len(transports)})"
            )
            with _force_ipv4_dns():
                await aiosmtplib.send(
                    message,
                    hostname=settings.MAIL_SERVER,
                    port=port,
                    username=settings.MAIL_USERNAME,
                    password=settings.MAIL_PASSWORD,
                    start_tls=start_tls,
                    use_tls=use_tls,
                    validate_certs=settings.VALIDATE_CERTS,
                    timeout=20.0,
                )
            logger.info(f"✅ Email sent successfully to {to_email}")
            return True

        except aiosmtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ Gmail authentication failed: {type(e).__name__}: {e}")
            return False
        except Exception as e:
            logger.error(
                f"❌ Email transport {attempt}/{len(transports)} failed "
                f"({settings.MAIL_SERVER}:{port}): {type(e).__name__}: {e}"
            )

    return False


async def send_password_reset_email(email: EmailStr, username: str, reset_url: str) -> bool:
    """Send password reset email"""

    logger.info(f"=" * 50)
    logger.info(f"Password Reset Email Request")
    logger.info(f"  To: {email}")
    logger.info(f"  Username: {username}")
    logger.info(f"  Reset URL: {reset_url}")
    logger.info(f"=" * 50)

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🔐 Password Reset Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">UHAS Research Hub Admin Portal</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333;">Hello <strong>{username}</strong>,</p>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password:
            </p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}"
                   style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(10,79,60,0.3);">
                    Reset My Password
                </a>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>⏰ This link expires in 30 minutes</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">For security reasons, this password reset link will expire soon.</p>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                    <strong>Can't click the button?</strong> Copy and paste this link into your browser:
                </p>
                <p style="margin: 10px 0 0 0; word-break: break-all; font-size: 12px; color: #0a4f3c; background: #e9ecef; padding: 10px; border-radius: 4px;">
                    {reset_url}
                </p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

            <p style="font-size: 13px; color: #888; text-align: center;">
                If you didn't request this password reset, you can safely ignore this email.
            </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p>© 2024 UHAS Research Hub. All rights reserved.</p>
        </div>
    </body>
    </html>
    """

    success = await send_email_smtp(
        to_email=email,
        to_name=username,
        subject="🔐 Password Reset Request - UHAS Research Hub",
        html_content=html
    )

    if not success:
        logger.error(f"Failed to send password reset email to {email}")
        logger.info(f"📋 MANUAL RESET LINK: {reset_url}")

    return success


async def send_password_reset_confirmation(email: EmailStr, username: str) -> bool:
    """Send confirmation after password reset"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">✅ Password Reset Successful</h1>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p>Hello <strong>{username}</strong>,</p>
            <p>Your password has been successfully reset.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{FRONTEND_URL}/#/login"
                   style="display: inline-block; padding: 15px 40px; background: #0a4f3c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Login Now
                </a>
            </div>

            <p style="color: #888; font-size: 14px;">
                If you didn't make this change, please contact support immediately.
            </p>
        </div>
    </body>
    </html>
    """

    return await send_email_smtp(
        to_email=email,
        to_name=username,
        subject="✅ Password Reset Successful - UHAS Research Hub",
        html_content=html
    )


async def send_reset_password_email(email: EmailStr, token: str, username: str):
    """Legacy function for backward compatibility"""
    reset_url = f"{FRONTEND_URL}/#/reset-password?token={token}"
    await send_password_reset_email(email, username, reset_url)


async def send_welcome_email(
    email: EmailStr,
    full_name: str,
    activation_url: str,
    is_resend: bool = False,
) -> bool:
    """Send the account-activation email for admin-created / bulk-imported
    users -- no password is ever emailed; the link lets them set their own
    and (on the activation page) upload the profile photo shown alongside
    their supervised work on the public site."""

    logger.info("=" * 50)
    logger.info(f"{'Resend welcome' if is_resend else 'Welcome'} email")
    logger.info(f"  To: {email}")
    logger.info(f"  Activation URL: {activation_url}")
    logger.info("=" * 50)

    heading = "You're invited back to finish setting up" if is_resend else "Welcome to UHAS Research Hub"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">👋 {heading}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">UHAS Research Hub Admin Portal</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333;">Hello <strong>{full_name}</strong>,</p>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
                An account has been created for you on the UHAS Research Hub Admin Portal.
                Click the button below to set your password and finish setting up your account.
            </p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{activation_url}"
                   style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(10,79,60,0.3);">
                    Set Up My Account
                </a>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>⏰ This link expires in 7 days</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">You'll be asked to choose a password and upload a profile photo before you can sign in.</p>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                    <strong>Can't click the button?</strong> Copy and paste this link into your browser:
                </p>
                <p style="margin: 10px 0 0 0; word-break: break-all; font-size: 12px; color: #0a4f3c; background: #e9ecef; padding: 10px; border-radius: 4px;">
                    {activation_url}
                </p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

            <p style="font-size: 13px; color: #888; text-align: center;">
                If you weren't expecting this, you can ignore this email.
            </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p>© 2024 UHAS Research Hub. All rights reserved.</p>
        </div>
    </body>
    </html>
    """

    success = await send_email_smtp(
        to_email=email,
        to_name=full_name,
        subject=("Finish setting up your account" if is_resend else "Welcome to UHAS Research Hub") + " - UHAS Research Hub",
        html_content=html
    )

    if not success:
        logger.error(f"Failed to send welcome email to {email}")
        logger.info(f"📋 MANUAL ACTIVATION LINK: {activation_url}")

    return success


async def test_email_connection() -> dict:
    """Test the active email transport without sending a message."""
    result = {
        "provider": "Gmail API (HTTPS)" if GMAIL_API_CONFIGURED else f"SMTP ({settings.MAIL_SERVER}:{settings.MAIL_PORT})",
        "configured": EMAIL_CONFIGURED,
        "mail_from": MAIL_FROM,
        "gmail_api_configured": GMAIL_API_CONFIGURED,
        "smtp_configured": SMTP_CONFIGURED,
    }

    if GMAIL_API_CONFIGURED:
        try:
            await _gmail_api_access_token()
            result["status"] = "✅ Gmail API authenticated"
        except httpx.HTTPStatusError as exc:
            result["status"] = f"❌ Google OAuth HTTP {exc.response.status_code}: {exc.response.text[:300]}"
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            result["status"] = f"❌ {type(exc).__name__}: {str(exc)}"
        return result

    if SMTP_CONFIGURED:
        try:
            with _force_ipv4_dns():
                smtp = aiosmtplib.SMTP(
                    hostname=settings.MAIL_SERVER,
                    port=settings.MAIL_PORT,
                    start_tls=settings.MAIL_STARTTLS,
                    use_tls=settings.MAIL_SSL_TLS,
                    validate_certs=settings.VALIDATE_CERTS,
                    timeout=15.0,
                )
                await smtp.connect()
                await smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                await smtp.quit()
            result["status"] = "✅ SMTP connected and authenticated"
        except Exception as exc:
            result["status"] = f"❌ {type(exc).__name__}: {str(exc)}"
    else:
        result["status"] = "❌ Email is not configured"

    return result
