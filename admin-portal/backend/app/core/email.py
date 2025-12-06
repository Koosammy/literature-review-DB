from typing import Optional
from pydantic import EmailStr
import secrets
import string
import logging
import os
import ssl

logger = logging.getLogger(__name__)

def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Get email settings directly from environment
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", "") or MAIL_USERNAME
MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://research-hub-admin-portal.onrender.com")

# Log configuration (hide password)
logger.info("=" * 50)
logger.info("Email Configuration:")
logger.info(f"  MAIL_USERNAME: {MAIL_USERNAME if MAIL_USERNAME else 'NOT SET'}")
logger.info(f"  MAIL_PASSWORD: {'SET (' + str(len(MAIL_PASSWORD)) + ' chars)' if MAIL_PASSWORD else 'NOT SET'}")
logger.info(f"  MAIL_FROM: {MAIL_FROM if MAIL_FROM else 'NOT SET'}")
logger.info(f"  MAIL_SERVER: {MAIL_SERVER}")
logger.info(f"  MAIL_PORT: {MAIL_PORT}")
logger.info(f"  FRONTEND_URL: {FRONTEND_URL}")
logger.info("=" * 50)

# Check if credentials are available
EMAIL_CONFIGURED = bool(MAIL_USERNAME and MAIL_PASSWORD)

if not EMAIL_CONFIGURED:
    logger.error("⚠️ EMAIL NOT CONFIGURED!")
    logger.error("Please set MAIL_USERNAME and MAIL_PASSWORD environment variables")
    logger.error("For Gmail, you need an App Password (not your regular password)")


async def send_email_smtp(
    to_email: str,
    subject: str,
    html_body: str
) -> bool:
    """Send email using aiosmtplib directly"""
    import aiosmtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    if not EMAIL_CONFIGURED:
        logger.error("Cannot send email - credentials not configured")
        return False
    
    try:
        logger.info(f"Preparing to send email to: {to_email}")
        logger.info(f"Using SMTP server: {MAIL_SERVER}:{MAIL_PORT}")
        
        # Create message
        message = MIMEMultipart("alternative")
        message["From"] = f"UHAS Research Hub <{MAIL_FROM}>"
        message["To"] = to_email
        message["Subject"] = subject
        
        # Attach HTML body
        html_part = MIMEText(html_body, "html")
        message.attach(html_part)
        
        logger.info("Connecting to SMTP server...")
        
        # Create SMTP client and send
        smtp_client = aiosmtplib.SMTP(
            hostname=MAIL_SERVER,
            port=MAIL_PORT,
            use_tls=False,  # We'll use STARTTLS
            start_tls=True,
            username=MAIL_USERNAME,
            password=MAIL_PASSWORD,
            timeout=30
        )
        
        async with smtp_client:
            logger.info("Connected! Sending message...")
            await smtp_client.send_message(message)
        
        logger.info(f"✅ Email sent successfully to {to_email}")
        return True
        
    except aiosmtplib.SMTPAuthenticationError as e:
        logger.error(f"❌ SMTP Authentication Failed: {e}")
        logger.error("Check your MAIL_USERNAME and MAIL_PASSWORD")
        logger.error("For Gmail, make sure you're using an App Password")
        return False
        
    except aiosmtplib.SMTPConnectError as e:
        logger.error(f"❌ SMTP Connection Failed: {e}")
        logger.error(f"Cannot connect to {MAIL_SERVER}:{MAIL_PORT}")
        return False
        
    except aiosmtplib.SMTPException as e:
        logger.error(f"❌ SMTP Error: {type(e).__name__}: {e}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Unexpected error sending email: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


async def send_password_reset_email(email: EmailStr, username: str, reset_url: str) -> bool:
    """Send password reset email"""
    token = reset_url.split('token=')[-1] if 'token=' in reset_url else ''
    
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
                Your password will remain unchanged.
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
        subject="🔐 Password Reset Request - UHAS Research Hub",
        html_body=html
    )
    
    if not success:
        logger.error(f"Failed to send password reset email to {email}")
        logger.info(f"📋 MANUAL RESET LINK: {reset_url}")
    
    return success


async def send_password_reset_confirmation(email: EmailStr, username: str) -> bool:
    """Send confirmation after password reset"""
    logger.info(f"Sending password reset confirmation to {email}")
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
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
        subject="✅ Password Reset Successful - UHAS Research Hub",
        html_body=html
    )


async def send_reset_password_email(email: EmailStr, token: str, username: str):
    """Legacy function for backward compatibility"""
    reset_url = f"{FRONTEND_URL}/#/reset-password?token={token}"
    await send_password_reset_email(email, username, reset_url)


async def test_email_connection() -> dict:
    """Test email connection - useful for debugging"""
    import aiosmtplib
    
    result = {
        "configured": EMAIL_CONFIGURED,
        "server": MAIL_SERVER,
        "port": MAIL_PORT,
        "username": MAIL_USERNAME,
        "connection": False,
        "auth": False,
        "error": None
    }
    
    if not EMAIL_CONFIGURED:
        result["error"] = "Email credentials not configured"
        return result
    
    try:
        smtp = aiosmtplib.SMTP(
            hostname=MAIL_SERVER,
            port=MAIL_PORT,
            use_tls=False,
            start_tls=True,
            timeout=10
        )
        
        await smtp.connect()
        result["connection"] = True
        
        await smtp.login(MAIL_USERNAME, MAIL_PASSWORD)
        result["auth"] = True
        
        await smtp.quit()
        
    except aiosmtplib.SMTPAuthenticationError as e:
        result["error"] = f"Authentication failed: {str(e)}"
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)}"
    
    return result
