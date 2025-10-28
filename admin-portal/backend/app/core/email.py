from typing import Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import secrets
import string
from datetime import datetime, timedelta
import logging
import os

from .config import settings

logger = logging.getLogger(__name__)

def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Initialize FastMail based on configuration
fm = None
if settings.is_email_configured:
    try:
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
        logger.info("✅ Email service configured successfully")
    except Exception as e:
        logger.error(f"❌ Failed to configure email service: {e}")
        fm = None
else:
    logger.warning("⚠️ Email service is disabled or not configured properly")
    logger.info(f"Email configuration status: {settings.get_email_config_status() if hasattr(settings, 'get_email_config_status') else 'Unknown'}")

async def send_password_reset_email(email: EmailStr, username: str, reset_url: str):
    """Send password reset email with the complete reset URL"""
    # Extract token from URL for display
    token = reset_url.split('token=')[-1] if 'token=' in reset_url else ''
    
    # Always log the reset URL for debugging
    logger.info(f"Password reset requested for {email}")
    logger.info(f"Reset URL: {reset_url}")
    
    # If email is not configured, return with the URL
    if not fm:
        logger.warning(f"📧 Email service not available. Manual reset link: {reset_url}")
        # Don't raise an error - the endpoint should still work
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
            }}
            .token-box {{
                background-color: #e8f5e9;
                border: 2px solid #0a4f3c;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
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
            
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            
            <div style="text-align: center;">
                <a href="{reset_url}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 30 minutes.
            </div>
            
            <p>If the button doesn't work, copy and paste this link:</p>
            <div class="token-box">{reset_url}</div>
        </div>
    </body>
    </html>
    """
    
    try:
        message = MessageSchema(
            subject="Password Reset Request - Research Hub Admin Portal",
            recipients=[email],
            body=html,
            subtype=MessageType.html
        )
        
        await fm.send_message(message)
        logger.info(f"✅ Password reset email sent to {email}")
        
    except Exception as e:
        logger.error(f"❌ Failed to send email to {email}: {e}")
        logger.info(f"📋 Manual reset link for {email}: {reset_url}")
        # Don't raise the exception - let the password reset work even if email fails

async def send_reset_password_email(email: EmailStr, token: str, username: str):
    """Legacy function - redirects to new function for backward compatibility"""
    reset_url = f"{settings.FRONTEND_URL}/#/reset-password?token={token}"
    await send_password_reset_email(email, username, reset_url)

async def send_password_reset_confirmation(email: EmailStr, username: str):
    """Send confirmation email after successful password reset"""
    if not fm:
        logger.info(f"Password reset confirmed for {username} ({email}) - email notification skipped")
        return
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #e8f5e9; border: 2px solid #4caf50; padding: 20px; border-radius: 5px; text-align: center;">
            <h2 style="color: #0a4f3c;">Password Reset Successful!</h2>
        </div>
        
        <p>Hello {username},</p>
        <p>Your password has been successfully reset. You can now log in with your new password.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{settings.FRONTEND_URL}/#/login" style="background: #0a4f3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                Go to Login
            </a>
        </div>
        
        <p style="color: #666; font-size: 12px;">If you didn't make this change, please contact support immediately.</p>
    </body>
    </html>
    """
    
    try:
        message = MessageSchema(
            subject="Password Reset Successful - Research Hub Admin Portal",
            recipients=[email],
            body=html,
            subtype=MessageType.html
        )
        
        await fm.send_message(message)
        logger.info(f"✅ Confirmation email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")
