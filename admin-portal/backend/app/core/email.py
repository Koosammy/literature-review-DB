import logging
import secrets
import string

import httpx
from pydantic import EmailStr

from .config import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3"
MAIL_FROM = settings.MAIL_FROM.strip()
MAIL_FROM_NAME = settings.MAIL_FROM_NAME
FRONTEND_URL = settings.FRONTEND_URL
EMAIL_CONFIGURED = bool(settings.BREVO_API_KEY.get_secret_value().strip() and MAIL_FROM)

if not EMAIL_CONFIGURED:
    logger.warning("Brevo email requires BREVO_API_KEY and MAIL_FROM")


def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def _brevo_request(method: str, path: str, **kwargs) -> httpx.Response:
    async with httpx.AsyncClient(
        base_url=BREVO_API_URL,
        headers={
            "api-key": settings.BREVO_API_KEY.get_secret_value().strip(),
            "Accept": "application/json",
        },
        timeout=20.0,
    ) as client:
        response = await client.request(method, path, **kwargs)
        response.raise_for_status()
        return response


def _brevo_error(exc: httpx.HTTPError) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in (401, 403):
            return f"Brevo returned HTTP {status}. Check the API key, permissions, and IP authorization."
        if status == 429:
            return "Brevo returned HTTP 429. Check sending limits and API rate limits."
        return f"Brevo rejected the request with HTTP {status}."
    if isinstance(exc, httpx.TimeoutException):
        return "The Brevo request timed out."
    return f"The Brevo request failed: {type(exc).__name__}."


async def send_email_brevo(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str,
) -> bool:
    """Submit a transactional email through Brevo's HTTPS API."""
    if not EMAIL_CONFIGURED:
        logger.error("Email is unavailable. Set BREVO_API_KEY and MAIL_FROM.")
        return False

    recipient = {"email": to_email}
    if to_name:
        recipient["name"] = to_name

    try:
        response = await _brevo_request(
            "POST",
            "/smtp/email",
            json={
                "sender": {"name": MAIL_FROM_NAME, "email": MAIL_FROM},
                "to": [recipient],
                "subject": subject,
                "htmlContent": html_content,
            },
        )
        message_id = response.json()["messageId"]
    except httpx.HTTPError as exc:
        logger.error("Email submission failed: %s", _brevo_error(exc))
        return False
    except (ValueError, TypeError, KeyError):
        logger.error("Brevo returned an invalid email submission response.")
        return False

    if not isinstance(message_id, str) or not message_id:
        logger.error("Brevo did not return a message ID for the email.")
        return False

    logger.info("Brevo accepted email (message ID %s)", message_id)
    return True


async def send_password_reset_email(email: EmailStr, username: str, reset_url: str) -> bool:
    """Send password reset email"""

    logger.info(f"=" * 50)
    logger.info(f"Password Reset Email Request")
    logger.info(f"  To: {email}")
    logger.info(f"  Username: {username}")
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

    success = await send_email_brevo(
        to_email=email,
        to_name=username,
        subject="🔐 Password Reset Request - UHAS Research Hub",
        html_content=html
    )

    if not success:
        logger.error(f"Failed to send password reset email to {email}")

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

    return await send_email_brevo(
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

    success = await send_email_brevo(
        to_email=email,
        to_name=full_name,
        subject=("Finish setting up your account" if is_resend else "Welcome to UHAS Research Hub") + " - UHAS Research Hub",
        html_content=html
    )

    if not success:
        logger.error(f"Failed to send welcome email to {email}")

    return success


async def test_email_connection() -> dict:
    """Check the Brevo credentials and sender without sending an email."""
    result = {
        "provider": "Brevo (HTTPS)",
        "configured": EMAIL_CONFIGURED,
        "mail_from": MAIL_FROM,
    }
    if not EMAIL_CONFIGURED:
        return {**result, "status": "Set BREVO_API_KEY and MAIL_FROM."}

    try:
        response = await _brevo_request("GET", "/senders")
        senders = response.json()["senders"]
        active_sender = any(
            sender["active"] and sender["email"].casefold() == MAIL_FROM.casefold()
            for sender in senders
        )
    except httpx.HTTPError as exc:
        return {**result, "status": _brevo_error(exc)}
    except (ValueError, TypeError, KeyError, AttributeError):
        return {**result, "status": "Brevo returned an invalid sender list."}

    result["status"] = (
        "Brevo authenticated and sender is active."
        if active_sender
        else "Brevo authenticated, but MAIL_FROM is missing or inactive in Brevo."
    )
    return result
