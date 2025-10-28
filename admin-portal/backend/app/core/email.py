from typing import Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import secrets
import string
import logging
import aiosmtplib
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger(__name__)

def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Initialize FastMail
fm: Optional[FastMail] = None

# Configure email service
if settings.is_email_configured:
    try:
        logger.info("Attempting to configure email service...")
        logger.info(f"Using: {settings.MAIL_SERVER}:{settings.MAIL_PORT}")
        logger.info(f"From: {settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>")
        
        conf = ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=settings.MAIL_FROM,
            MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_STARTTLS=settings.MAIL_STARTTLS,
            MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
            USE_CREDENTIALS=settings.USE_CREDENTIALS,
            VALIDATE_CERTS=settings.VALIDATE_CERTS,
            TEMPLATE_FOLDER='app/templates/email'
        )
        fm = FastMail(conf)
        logger.info("✅ Email service configured successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to configure email service: {e}")
        fm = None
else:
    logger.warning("⚠️ Email service is disabled or not configured properly")
    logger.warning("Please set the following environment variables:")
    logger.warning("  - MAIL_ENABLED=true")
    logger.warning("  - MAIL_USERNAME=your-email@gmail.com")
    logger.warning("  - MAIL_PASSWORD=your-app-password")
    logger.warning("  - MAIL_FROM=your-email@gmail.com")

async def send_password_reset_email(email: EmailStr, username: str, reset_url: str):
    """Send password reset email with the complete reset URL"""
    token = reset_url.split('token=')[-1] if 'token=' in reset_url else ''
    
    logger.info(f"Password reset requested for {email} (user: {username})")
    logger.info(f"Reset URL generated: {reset_url}")
    
    if not fm:
        logger.error("❌ Cannot send email: FastMail not initialized")
        logger.info(f"📋 Manual reset link for {email}: {reset_url}")
        logger.info(f"📋 Reset token: {token}")
        # Return without error so the API call succeeds
        return
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .container {{
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%);
                color: white;
                padding: 20px;
                border-radius: 10px 10px 0 0;
                text-align: center;
                margin: -30px -30px 30px -30px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%);
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
                box-shadow: 0 4px 15px rgba(10, 79, 60, 0.3);
            }}
            .token-box {{
                background-color: #e8f5e9;
                border: 2px solid #0a4f3c;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 14px;
                text-align: center;
                margin: 20px 0;
                word-break: break-all;
            }}
            .warning {{
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            
            <p>Hello {username},</p>
            
            <p>We received a request to reset your password for the Research Hub Admin Portal.</p>
            
            <div style="text-align: center;">
                <a href="{reset_url}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 30 minutes.
            </div>
            
            <p><strong>Your reset token:</strong></p>
            <div class="token-box">{token}</div>
            
            <p>Or copy this link:</p>
            <div class="token-box" style="font-size: 12px;">{reset_url}</div>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If you didn't request this reset, please ignore this email.
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        logger.info(f"Attempting to send email to {email}...")
        
        message = MessageSchema(
            subject="Password Reset Request - Research Hub Admin Portal",
            recipients=[email],
            body=html,
            subtype=MessageType.html
        )
        
        await fm.send_message(message)
        logger.info(f"✅ Password reset email successfully sent to {email}")
        
    except aiosmtplib.errors.SMTPConnectTimeoutError as e:
        logger.error(f"❌ SMTP Timeout: {e}")
        logger.info("Trying fallback email method...")
        success = await send_email_fallback(email, "Password Reset Request", html)
        if not success:
            logger.error(f"📋 Manual reset link for {email}: {reset_url}")
            
    except Exception as e:
        logger.error(f"❌ Failed to send email: {type(e).__name__}: {e}")
        logger.info(f"📋 Manual reset link for {email}: {reset_url}")

async def send_email_fallback(to_email: str, subject: str, html_content: str) -> bool:
    """Fallback email sender using aiosmtplib directly"""
    if not settings.is_email_configured:
        return False
    
    try:
        logger.info(f"Attempting fallback email to {to_email}...")
        
        message = EmailMessage()
        message["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(html_content, subtype="html")
        
        await aiosmtplib.send(
            message,
            hostname=settings.MAIL_SERVER,
            port=settings.MAIL_PORT,
            username=settings.MAIL_USERNAME,
            password=settings.MAIL_PASSWORD,
            start_tls=settings.MAIL_STARTTLS,
            timeout=settings.MAIL_TIMEOUT
        )
        logger.info(f"✅ Fallback email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Fallback email also failed: {e}")
        return False

async def send_reset_password_email(email: EmailStr, token: str, username: str):
    """Legacy function for backward compatibility"""
    reset_url = f"{settings.FRONTEND_URL}/#/reset-password?token={token}"
    await send_password_reset_email(email, username, reset_url)

async def send_password_reset_confirmation(email: EmailStr, username: str):
    """Send confirmation after password reset"""
    if not fm:
        logger.info(f"Password reset confirmed for {username} - email skipped (not configured)")
        return
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0a4f3c;">Password Reset Successful!</h2>
        <p>Hello {username},</p>
        <p>Your password has been successfully reset.</p>
        <a href="{settings.FRONTEND_URL}/#/login" style="display: inline-block; margin: 20px 0; padding: 12px 30px; background: #0a4f3c; color: white; text-decoration: none; border-radius: 5px;">Login Now</a>
    </body>
    </html>
    """
    
    try:
        message = MessageSchema(
            subject="Password Reset Successful",
            recipients=[email],
            body=html,
            subtype=MessageType.html
        )
        await fm.send_message(message)
        logger.info(f"✅ Confirmation email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send confirmation: {e}")

# Test function
async def test_email_configuration():
    """Test if email is properly configured"""
    logger.info("Testing email configuration...")
    logger.info(f"Email configured: {settings.is_email_configured}")
    logger.info(f"FastMail initialized: {fm is not None}")
    if settings.is_email_configured and fm:
        try:
            test_email = settings.MAIL_FROM
            await send_password_reset_email(
                test_email,
                "Test User",
                f"{settings.FRONTEND_URL}/#/reset-password?token=TEST_TOKEN_12345"
            )
            return True
        except Exception as e:
            logger.error(f"Email test failed: {e}")
            return False
    return False
