from typing import Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import secrets
import string
import logging
import os
import aiosmtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Get email settings directly from environment
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", MAIL_USERNAME)
MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://research-hub-admin-portal.onrender.com")

# Log what we have
logger.info(f"Email Configuration:")
logger.info(f"  MAIL_USERNAME: {'SET' if MAIL_USERNAME else 'NOT SET'}")
logger.info(f"  MAIL_PASSWORD: {'SET' if MAIL_PASSWORD else 'NOT SET'}")
logger.info(f"  MAIL_FROM: {MAIL_FROM if MAIL_FROM else 'NOT SET'}")
logger.info(f"  MAIL_SERVER: {MAIL_SERVER}")
logger.info(f"  MAIL_PORT: {MAIL_PORT}")

# Initialize FastMail
fm: Optional[FastMail] = None

# Only initialize if we have credentials
if MAIL_USERNAME and MAIL_PASSWORD:
    try:
        logger.info("Initializing FastMail...")
        conf = ConnectionConfig(
            MAIL_USERNAME=MAIL_USERNAME,
            MAIL_PASSWORD=MAIL_PASSWORD,
            MAIL_FROM=MAIL_FROM or MAIL_USERNAME,
            MAIL_FROM_NAME="UHAS Research Hub Admin",
            MAIL_PORT=MAIL_PORT,
            MAIL_SERVER=MAIL_SERVER,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
            TEMPLATE_FOLDER='app/templates/email'
        )
        fm = FastMail(conf)
        logger.info("✅ FastMail initialized successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to initialize FastMail: {e}")
        fm = None
else:
    logger.warning("⚠️ Email credentials not found in environment variables")
    logger.warning("Please set MAIL_USERNAME and MAIL_PASSWORD in Render environment")

async def send_password_reset_email(email: EmailStr, username: str, reset_url: str):
    """Send password reset email with the complete reset URL"""
    token = reset_url.split('token=')[-1] if 'token=' in reset_url else ''
    
    logger.info(f"Password reset requested for {email}")
    logger.info(f"Reset URL: {reset_url}")
    
    # If FastMail not configured, try direct SMTP
    if not fm:
        logger.warning("FastMail not initialized, trying direct SMTP...")
        if await send_email_direct(email, username, reset_url, token):
            logger.info("✅ Email sent via direct SMTP")
            return
        else:
            logger.error("❌ Direct SMTP also failed")
            logger.info(f"📋 Manual reset link: {reset_url}")
            return
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%); color: white; padding: 20px; text-align: center; border-radius: 10px;">
            <h1>Password Reset Request</h1>
        </div>
        
        <div style="padding: 20px;">
            <p>Hello {username},</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" style="display: inline-block; padding: 12px 30px; background: #0a4f3c; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Reset Password
                </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>⚠️ This link expires in 30 minutes</strong>
            </div>
            
            <p>Token: <code style="background: #f0f0f0; padding: 5px; border-radius: 3px;">{token}</code></p>
            
            <details style="margin-top: 20px;">
                <summary>Full Link</summary>
                <p style="word-break: break-all; font-size: 12px; background: #f0f0f0; padding: 10px; border-radius: 5px;">
                    {reset_url}
                </p>
            </details>
        </div>
    </body>
    </html>
    """
    
    try:
        message = MessageSchema(
            subject="Password Reset Request - Research Hub",
            recipients=[email],
            body=html,
            subtype=MessageType.html
        )
        
        await fm.send_message(message)
        logger.info(f"✅ Password reset email sent to {email}")
        
    except Exception as e:
        logger.error(f"❌ FastMail error: {e}")
        # Try direct SMTP as fallback
        if await send_email_direct(email, username, reset_url, token):
            logger.info("✅ Email sent via fallback method")
        else:
            logger.error(f"📋 Manual reset link: {reset_url}")

async def send_email_direct(email: str, username: str, reset_url: str, token: str) -> bool:
    """Send email directly using aiosmtplib"""
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        logger.error("No email credentials available for direct SMTP")
        return False
    
    try:
        logger.info(f"Attempting direct SMTP to {email}...")
        
        html = f"""
        <html>
        <body>
            <h2>Password Reset Request</h2>
            <p>Hello {username},</p>
            <p>Click here to reset your password:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>Token: {token}</p>
            <p>This link expires in 30 minutes.</p>
        </body>
        </html>
        """
        
        message = EmailMessage()
        message["From"] = f"UHAS Research Hub <{MAIL_FROM}>"
        message["To"] = email
        message["Subject"] = "Password Reset Request"
        message.set_content(html, subtype="html")
        
        # Send with explicit settings
        await aiosmtplib.send(
            message,
            hostname=MAIL_SERVER,
            port=MAIL_PORT,
            username=MAIL_USERNAME,
            password=MAIL_PASSWORD,
            start_tls=True,
            timeout=60
        )
        
        logger.info(f"✅ Direct SMTP email sent to {email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Direct SMTP failed: {e}")
        return False

async def send_reset_password_email(email: EmailStr, token: str, username: str):
    """Legacy function for backward compatibility"""
    reset_url = f"{FRONTEND_URL}/#/reset-password?token={token}"
    await send_password_reset_email(email, username, reset_url)

async def send_password_reset_confirmation(email: EmailStr, username: str):
    """Send confirmation after password reset"""
    if not fm and not (MAIL_USERNAME and MAIL_PASSWORD):
        logger.info(f"Password reset confirmed for {username} - no email sent")
        return
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0a4f3c;">Password Reset Successful!</h2>
        <p>Hello {username},</p>
        <p>Your password has been successfully reset.</p>
        <a href="{FRONTEND_URL}/#/login" style="display: inline-block; padding: 12px 30px; background: #0a4f3c; color: white; text-decoration: none; border-radius: 5px;">Login Now</a>
    </body>
    </html>
    """
    
    try:
        if fm:
            message = MessageSchema(
                subject="Password Reset Successful",
                recipients=[email],
                body=html,
                subtype=MessageType.html
            )
            await fm.send_message(message)
        else:
            # Use direct SMTP
            message = EmailMessage()
            message["From"] = f"UHAS Research Hub <{MAIL_FROM}>"
            message["To"] = email
            message["Subject"] = "Password Reset Successful"
            message.set_content(html, subtype="html")
            
            await aiosmtplib.send(
                message,
                hostname=MAIL_SERVER,
                port=MAIL_PORT,
                username=MAIL_USERNAME,
                password=MAIL_PASSWORD,
                start_tls=True,
                timeout=60
            )
        
        logger.info(f"✅ Confirmation email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send confirmation: {e}")
