import logging
import secrets
import string

import httpx
from pydantic import EmailStr

from .config import settings
from ..templates.email import render_letterhead

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
    """Send the link for choosing a new password."""
    html = render_letterhead(
        name=username,
        title="Reset your password",
        message=(
            "We received a request to reset the password for your Research Hub account. "
            "Use the link below to choose a new password."
        ),
        action="Reset password",
        url=reset_url,
        expiry="Link expires in 30 minutes",
        note="If you did not request a reset, you can ignore this email.",
    )
    success = await send_email_brevo(
        to_email=email,
        to_name=username,
        subject="Reset your UHAS Research Hub password",
        html_content=html,
    )
    if not success:
        logger.error("Failed to send password reset email to %s", email)
    return success


async def send_password_reset_confirmation(email: EmailStr, username: str) -> bool:
    """Send confirmation after password reset."""
    html = render_letterhead(
        name=username,
        title="Password changed",
        message="Your Research Hub password has been updated. You can now sign in with your new password.",
        action="Sign in",
        url=f"{FRONTEND_URL}/#/login",
        note="If you did not make this change, contact the Research Hub administrator immediately.",
    )
    return await send_email_brevo(
        to_email=email,
        to_name=username,
        subject="Your UHAS Research Hub password was changed",
        html_content=html,
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
    """Send the account-activation email for admin-created and imported users."""
    if is_resend:
        subject = "New activation link for your UHAS Research Hub account"
        title = "New account activation link"
        message = (
            "A new link is available to activate your Research Hub account. "
            "Use it to set your password and upload your profile photo."
        )
    else:
        subject = "Activate your UHAS Research Hub account"
        title = "Activate your account"
        message = (
            "An account has been created for you on the UHAS Research Hub Admin Portal. "
            "Activate it to set your password and upload your profile photo."
        )

    html = render_letterhead(
        name=full_name,
        title=title,
        message=message,
        action="Activate account",
        url=activation_url,
        expiry="Link expires in 7 days",
        note="If you were not expecting this invitation, you can ignore this email.",
    )
    success = await send_email_brevo(
        to_email=email,
        to_name=full_name,
        subject=subject,
        html_content=html,
    )
    if not success:
        logger.error("Failed to send welcome email to %s", email)
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
