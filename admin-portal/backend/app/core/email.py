from typing import List, Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import secrets
import string
from datetime import datetime, timedelta
import logging
import aiosmtplib
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger(__name__)

# Check if email is properly configured
def is_email_configured() -> bool:
    """Check if email service is properly configured"""
    return bool(
        settings.MAIL_ENABLED and
        settings.MAIL_USERNAME and
        settings.MAIL_PASSWORD and
        settings.MAIL_SERVER
    )

# Email configuration with error handling
def get_mail_config() -> Optional[ConnectionConfig]:
    """Get mail configuration if email is enabled"""
    if not is_email_configured():
        logger.warning("Email service is not configured. Emails will not be sent.")
        return None
    
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
            TEMPLATE_FOLDER='app/templates/email',
            TIMEOUT=280  
        )
        return conf
    except Exception as e:
        logger.error(f"Failed to create email configuration: {e}")
        return None

# Initialize FastMail instance only if configured
mail_conf = get_mail_config()
fm = FastMail(mail_conf) if mail_conf else None

def generate_reset_token(length: int = 32) -> str:
    """Generate a secure alphanumeric token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

async def send_password_reset_email(email: EmailStr, username: str, reset_url: str):
    """Send password reset email with the complete reset URL"""
    # Extract token from URL for display
    token = reset_url.split('token=')[-1] if 'token=' in reset_url else ''
    
    # If email is not configured, log the reset URL
    if not is_email_configured() or not fm:
        logger.warning(f"Email service not configured. Reset link for {email}: {reset_url}")
        logger.info(f"Reset token for {username}: {token}")
        return {
            "status": "logged",
            "message": "Email service not configured. Reset link logged.",
            "reset_url": reset_url
        }
    
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
                transition: all 0.3s ease;
            }}
            .button:hover {{
                box-shadow: 0 6px 20px rgba(10, 79, 60, 0.4);
                transform: translateY(-2px);
            }}
            .token-box {{
                background-color: #e8f5e9;
                border: 2px solid #0a4f3c;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 16px;
                text-align: center;
                margin: 20px 0;
                letter-spacing: 1px;
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
            .footer {{
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #666;
                text-align: center;
            }}
            .url-box {{
                background-color: #f0f0f0;
                padding: 10px;
                border-radius: 5px;
                word-break: break-all;
                font-size: 12px;
                margin: 10px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            
            <p>Hello {username},</p>
            
            <p>We received a request to reset your password for the Research Hub Admin Portal. 
            If you didn't make this request, you can safely ignore this email.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <div style="text-align: center;">
                <a href="{reset_url}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 30 minutes for security reasons.
            </div>
            
            <p><strong>Your password reset token is:</strong></p>
            
            <div class="token-box">
                {token}
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            
            <div class="url-box">
                {reset_url}
            </div>
            
            <p><strong>Security Notes:</strong></p>
            <ul>
                <li>This link can only be used once</li>
                <li>Your password won't change until you create a new one</li>
                <li>If you didn't request this reset, please ignore this email</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated email from Research Hub Admin Portal.</p>
                <p>Please do not reply to this email.</p>
                <p>&copy; 2025 Research Hub. All rights reserved.</p>
            </div>
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
        logger.info(f"Password reset email sent successfully to {email}")
        return {"status": "sent", "message": "Password reset email sent successfully"}
        
    except aiosmtplib.errors.SMTPConnectTimeoutError as e:
        logger.error(f"SMTP connection timeout for {email}: {e}")
        logger.info(f"Manual reset link for {email}: {reset_url}")
        # Try fallback method
        if await send_email_fallback(
            email, 
            "Password Reset Request - Research Hub Admin Portal",
            html
        ):
            return {"status": "sent", "message": "Password reset email sent (fallback)"}
        return {
            "status": "failed",
            "message": "Email service temporarily unavailable. Please contact support.",
            "reset_url": reset_url,
            "error": "timeout"
        }
        
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {e}")
        logger.info(f"Manual reset link for {email}: {reset_url}")
        return {
            "status": "failed",
            "message": "Failed to send email. Please contact support.",
            "reset_url": reset_url,
            "error": str(e)
        }

async def send_reset_password_email(email: EmailStr, token: str, username: str):
    """Legacy function - redirects to new function for backward compatibility"""
    reset_url = f"{settings.FRONTEND_URL}/#/reset-password?token={token}"
    await send_password_reset_email(email, username, reset_url)

async def send_password_reset_confirmation(email: EmailStr, username: str):
    """Send confirmation email after successful password reset"""
    
    # If email is not configured, just log
    if not is_email_configured() or not fm:
        logger.info(f"Password reset confirmation for {username} ({email}) - email not sent (service disabled)")
        return {"status": "logged", "message": "Email service not configured"}
    
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
                text-align: center;
                border-radius: 10px 10px 0 0;
                margin: -30px -30px 30px -30px;
            }}
            .success {{
                background-color: #e8f5e9;
                border: 2px solid #4caf50;
                padding: 20px;
                border-radius: 5px;
                text-align: center;
                margin: 20px 0;
            }}
            .success-icon {{
                font-size: 48px;
                color: #4caf50;
                margin-bottom: 10px;
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
            .footer {{
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #666;
                text-align: center;
            }}
            .security-tips {{
                background-color: #f0f8ff;
                border-left: 4px solid #0a4f3c;
                padding: 15px;
                margin: 20px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Successful</h1>
            </div>
            
            <p>Hello {username},</p>
            
            <div class="success">
                <div class="success-icon">✓</div>
                <h2 style="color: #0a4f3c; margin: 0;">Your password has been successfully reset!</h2>
            </div>
            
            <p>You can now log in to the Research Hub Admin Portal with your new password.</p>
            
            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/#/login" class="button">Go to Login</a>
            </div>
            
            <div class="security-tips">
                <p><strong>🔒 Security Tips:</strong></p>
                <ul style="margin: 10px 0;">
                    <li>Keep your password secure and don't share it with anyone</li>
                    <li>Use a unique password for this account</li>
                    <li>Consider using a password manager</li>
                    <li>Enable two-factor authentication if available</li>
                </ul>
            </div>
            
            <p>If you didn't make this change, please contact the administrator immediately.</p>
            
            <div class="footer">
                <p>This is an automated email from Research Hub Admin Portal.</p>
                <p>Please do not reply to this email.</p>
                <p>&copy; 2025 Research Hub. All rights reserved.</p>
            </div>
        </div>
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
        logger.info(f"Password reset confirmation sent to {email}")
        return {"status": "sent", "message": "Confirmation email sent successfully"}
        
    except Exception as e:
        logger.error(f"Failed to send confirmation email to {email}: {e}")
        # Not critical if confirmation email fails
        return {"status": "failed", "message": "Confirmation email failed", "error": str(e)}

async def send_email_fallback(to_email: str, subject: str, html_content: str) -> bool:
    """Fallback email sender using aiosmtplib directly"""
    if not is_email_configured():
        logger.warning(f"Email not configured. Would send: {subject} to {to_email}")
        return False
    
    try:
        message = EmailMessage()
        message["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(html_content, subtype="html")
        
        # Use aiosmtplib directly with custom timeout
        await aiosmtplib.send(
            message,
            hostname=settings.MAIL_SERVER,
            port=settings.MAIL_PORT,
            username=settings.MAIL_USERNAME if settings.USE_CREDENTIALS else None,
            password=settings.MAIL_PASSWORD if settings.USE_CREDENTIALS else None,
            start_tls=settings.MAIL_STARTTLS,
            timeout=60  # 60 second timeout
        )
        logger.info(f"Fallback email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Fallback email failed for {to_email}: {e}")
        return False

# Test email function for debugging
async def test_email_connection() -> dict:
    """Test email connection and configuration"""
    if not is_email_configured():
        return {
            "status": "disabled",
            "message": "Email service is not configured",
            "configured": False
        }
    
    try:
        # Try to create a connection
        test_message = EmailMessage()
        test_message["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        test_message["To"] = settings.MAIL_FROM
        test_message["Subject"] = "Test Connection"
        test_message.set_content("This is a test email connection.")
        
        # Just test the connection, don't actually send
        async with aiosmtplib.SMTP(
            hostname=settings.MAIL_SERVER,
            port=settings.MAIL_PORT,
            timeout=10,
            start_tls=settings.MAIL_STARTTLS
        ) as smtp:
            if settings.USE_CREDENTIALS:
                await smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            
        return {
            "status": "success",
            "message": "Email connection successful",
            "configured": True,
            "server": settings.MAIL_SERVER,
            "port": settings.MAIL_PORT
        }
    except Exception as e:
        logger.error(f"Email connection test failed: {e}")
        return {
            "status": "failed",
            "message": f"Email connection failed: {str(e)}",
            "configured": True,
            "error": str(e)
        }
