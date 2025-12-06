import httpx
import os
import logging
from typing import Optional
from pydantic import EmailStr
import secrets
import string

logger = logging.getLogger(__name__)

# Brevo API Configuration
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
MAIL_FROM = os.getenv("MAIL_FROM", "koosammyboats@gmail.com")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "UHAS Research Hub")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://research-hub-admin-portal.onrender.com")

EMAIL_CONFIGURED = bool(BREVO_API_KEY)

logger.info("=" * 50)
logger.info("Email Configuration (Brevo HTTP API):")
logger.info(f"  BREVO_API_KEY: {'SET' if BREVO_API_KEY else 'NOT SET'}")
logger.info(f"  MAIL_FROM: {MAIL_FROM}")
logger.info(f"  FRONTEND_URL: {FRONTEND_URL}")
logger.info("=" * 50)

if not EMAIL_CONFIGURED:
    logger.warning("⚠️ BREVO_API_KEY not set - emails will not be sent")


def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def send_email_brevo(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str
) -> bool:
    """Send email using Brevo HTTP API"""
    
    if not EMAIL_CONFIGURED:
        logger.error("❌ Brevo API key not configured")
        return False
    
    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    payload = {
        "sender": {
            "name": MAIL_FROM_NAME,
            "email": MAIL_FROM
        },
        "to": [
            {
                "email": to_email,
                "name": to_name
            }
        ],
        "subject": subject,
        "htmlContent": html_content
    }
    
    try:
        logger.info(f"📧 Sending email via Brevo API to {to_email}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code == 201:
                logger.info(f"✅ Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"❌ Brevo API error: {response.status_code} - {response.text}")
                return False
                
    except httpx.TimeoutException:
        logger.error("❌ Brevo API request timed out")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to send email: {type(e).__name__}: {e}")
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
    
    success = await send_email_brevo(
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


async def test_email_connection() -> dict:
    """Test Brevo API connection"""
    
    result = {
        "provider": "Brevo HTTP API",
        "configured": EMAIL_CONFIGURED,
        "mail_from": MAIL_FROM,
        "api_key_set": bool(BREVO_API_KEY),
        "smtp_blocked": "Yes - Using HTTP API instead"
    }
    
    if EMAIL_CONFIGURED:
        # Test API connectivity
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.brevo.com/v3/account",
                    headers={"api-key": BREVO_API_KEY}
                )
                if response.status_code == 200:
                    account = response.json()
                    result["api_status"] = "✅ Connected"
                    result["email_credits"] = account.get("plan", [{}])[0].get("credits", "N/A")
                else:
                    result["api_status"] = f"❌ Error: {response.status_code}"
        except Exception as e:
            result["api_status"] = f"❌ {type(e).__name__}: {str(e)}"
    
    return result
