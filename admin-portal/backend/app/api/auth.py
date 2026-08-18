from fastapi import APIRouter, Depends, HTTPException, status, Form, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
from jose import JWTError, jwt
import secrets
import string
import logging

from ..database import get_db
from ..models.user import User
from ..core.security import verify_password, get_password_hash, create_access_token, verify_token
from ..core.config import settings
from ..core.email import send_password_reset_email

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str = Field(..., description="Username or email")
    password: str = Field(..., min_length=1)

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=32, max_length=32)
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class PasswordResetResponse(BaseModel):
    message: str
    # Populated on a successful /reset-password so the frontend can log the
    # user straight in afterward -- most useful for the activation flow,
    # where this doubles as "account activated, here's your session".
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    user: Optional[Dict[str, Any]] = None

class TokenVerificationResponse(BaseModel):
    valid: bool
    email: str
    username: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class UserInfo(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    title: Optional[str] = None
    role: str
    institution: Optional[str]
    department: Optional[str]
    profile_image: Optional[str] = None
    is_active: bool
    must_set_password: bool = False
    created_at: datetime

# Helper functions
def generate_reset_token() -> str:
    """Generate a secure random token for password reset"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(32))

# Authentication dependency functions
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        username = verify_token(credentials.credentials)
        if username is None:
            logger.warning("Invalid token - no username extracted")
            raise credentials_exception
    except JWTError as e:
        logger.warning(f"JWT validation error: {str(e)}")
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        logger.warning(f"User not found: {username}")
        raise credentials_exception
    
    if not user.is_active:
        logger.warning(f"Inactive user attempted access: {username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user is active"""
    return current_user

async def require_main_coordinator(current_user: User = Depends(get_current_active_user)) -> User:
    """Require main coordinator role"""
    if not current_user.is_main_coordinator:
        logger.warning(f"Unauthorized access attempt by {current_user.username} to coordinator-only resource")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Main coordinator access required."
        )
    return current_user

# Authentication endpoints
@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login endpoint that accepts form data.
    Username field can be either username or email.
    """
    logger.info(f"Login attempt for: {form_data.username}")
    
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    # Check user exists and password is correct
    if not user:
        logger.warning(f"Login failed - user not found: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Accounts created via admin invite / bulk import have an unusable
    # placeholder password until activation, so this would fail anyway --
    # checked first purely to give a clearer, actionable error message.
    if user.must_set_password:
        logger.info(f"Login blocked - account not yet activated: {user.username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please activate your account using the link emailed to you before signing in."
        )

    if not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Login failed - incorrect password for user: {user.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        logger.warning(f"Login failed - inactive user: {user.username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact an administrator."
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.username})

    logger.info(f"Login successful for user: {user.username}")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "title": user.title,
            "role": user.role,
            "institution": user.institution,
            "department": user.department,
            "profile_image": user.profile_image,
            "is_active": user.is_active,
            "must_set_password": user.must_set_password,
            "is_main_coordinator": user.is_main_coordinator
        }
    )

@router.post("/forgot-password", response_model=PasswordResetResponse, status_code=status.HTTP_200_OK)
async def forgot_password(
    background_tasks: BackgroundTasks,
    email: str = Form(..., regex=r'^[\w\.-]+@[\w\.-]+\.\w+$'),
    db: Session = Depends(get_db)
):
    """
    Request password reset token - accepts FormData and sends email.
    Always returns success to prevent email enumeration.
    """
    logger.info(f"Password reset requested for email: {email}")
    
    # Find user by email
    user = db.query(User).filter(User.email == email).first()
    
    # Always return success message to prevent email enumeration
    if not user:
        logger.info(f"Password reset requested for non-existent email: {email}")
        return PasswordResetResponse(
            message="If the email exists in our system, you will receive a password reset email shortly."
        )
    
    # Generate reset token
    reset_token = generate_reset_token()
    
    # Save token and expiration to database
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=30)
    
    try:
        db.commit()
        logger.info(f"Reset token generated for user: {user.username}")
    except Exception as e:
        logger.error(f"Failed to save reset token: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )

    # Generate the reset URL with hash routing
    reset_url = f"{settings.FRONTEND_URL}/#/reset-password?token={reset_token}"
    
    logger.info(f"Reset URL generated: {reset_url}")
    
    # Send email in background
    try:
        background_tasks.add_task(
            send_password_reset_email,
            email=user.email,
            username=user.username,
            reset_url=reset_url
        )
        logger.info(f"Password reset email queued for: {user.email}")
    except Exception as e:
        logger.error(f"Failed to queue password reset email: {str(e)}")
        # Don't reveal email sending errors to the user

    return PasswordResetResponse(
        message="If the email exists in our system, you will receive a password reset email shortly."
    )

@router.post("/reset-password", response_model=PasswordResetResponse, status_code=status.HTTP_200_OK)
async def reset_password(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using token"""
    logger.info(f"Password reset attempt with token: {request.token[:8]}...")
    
    # Find user by reset token
    user = db.query(User).filter(User.reset_token == request.token).first()
    
    if not user:
        logger.warning(f"Invalid reset token: {request.token[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check if token has expired
    if user.has_reset_token_expired():
        logger.warning(f"Expired reset token for user: {user.username}")
        user.clear_reset_token()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )
    
    # Update password
    try:
        was_activation = user.must_set_password
        user.hashed_password = get_password_hash(request.new_password)
        user.must_set_password = False
        user.clear_reset_token()
        db.commit()
        logger.info(f"Password reset successful for user: {user.username}")
    except Exception as e:
        logger.error(f"Failed to reset password: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )

    # Log the user straight in -- for the activation flow, the frontend
    # uses this token immediately to upload the (mandatory) profile photo
    # without making the user log in a second time right after setting up.
    access_token = create_access_token(data={"sub": user.username})

    return PasswordResetResponse(
        message=(
            "Your account is now active."
            if was_activation
            else "Password has been successfully reset. You can now login with your new password."
        ),
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "title": user.title,
            "role": user.role,
            "institution": user.institution,
            "department": user.department,
            "profile_image": user.profile_image,
            "is_active": user.is_active,
            "must_set_password": user.must_set_password,
            "is_main_coordinator": user.is_main_coordinator,
        },
    )

@router.get("/verify-reset-token", response_model=TokenVerificationResponse, status_code=status.HTTP_200_OK)
async def verify_reset_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Verify if a reset token is valid"""
    logger.info(f"Verifying reset token: {token[:8]}...")
    
    # Validate token format
    if len(token) != 32:
        logger.warning(f"Invalid token format: {token[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token format"
        )
    
    # Find user by token
    user = db.query(User).filter(User.reset_token == token).first()
    
    if not user:
        logger.warning(f"Token not found: {token[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    # Check expiration
    if user.has_reset_token_expired():
        logger.warning(f"Expired token for user: {user.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    
    logger.info(f"Valid token for user: {user.username}")
    
    return TokenVerificationResponse(
        valid=True,
        email=user.email,
        username=user.username
    )

@router.get("/me", response_model=UserInfo, status_code=status.HTTP_200_OK)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user information"""
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        title=current_user.title,
        role=current_user.role,
        institution=current_user.institution,
        department=current_user.department,
        profile_image=current_user.profile_image,
        is_active=current_user.is_active,
        must_set_password=current_user.must_set_password,
        created_at=current_user.created_at
    )

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: User = Depends(get_current_active_user)
):
    """
    Logout endpoint.
    Note: With JWT tokens, logout is typically handled client-side by removing the token.
    This endpoint can be used for logging purposes or future session management.
    """
    logger.info(f"User logged out: {current_user.username}")
    return {"message": "Successfully logged out"}

@router.post("/change-password", response_model=PasswordResetResponse, status_code=status.HTTP_200_OK)
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change current user's password"""
    logger.info(f"Password change requested by user: {current_user.username}")
    
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        logger.warning(f"Password change failed - incorrect current password for user: {current_user.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check if new password is same as current
    if verify_password(request.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Update password
    try:
        current_user.hashed_password = get_password_hash(request.new_password)
        db.commit()
        logger.info(f"Password changed successfully for user: {current_user.username}")
    except Exception as e:
        logger.error(f"Failed to change password: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )
    
    return PasswordResetResponse(
        message="Password updated successfully"
    )

@router.get("/check-auth", status_code=status.HTTP_200_OK)
async def check_authentication(
    current_user: User = Depends(get_current_active_user)
):
    """Check if current authentication is valid"""
    return {
        "authenticated": True,
        "username": current_user.username,
        "role": current_user.role
    }

# Error handler for authentication errors
@router.get("/protected", status_code=status.HTTP_200_OK)
async def protected_route(
    current_user: User = Depends(get_current_active_user)
):
    """Example protected route"""
    return {
        "message": f"Hello {current_user.username}, this is a protected route!",
        "user_role": current_user.role,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/admin-only", status_code=status.HTTP_200_OK)
async def admin_only_route(
    current_user: User = Depends(require_main_coordinator)
):
    """Example admin-only route"""
    return {
        "message": f"Hello {current_user.username}, you have main coordinator access!",
        "user_role": current_user.role,
        "is_main_coordinator": current_user.is_main_coordinator,
        "timestamp": datetime.utcnow().isoformat()
    }

# Health check for auth service
@router.get("/health", status_code=status.HTTP_200_OK)
async def auth_health_check():
    """Check auth service health"""
    return {
        "service": "auth",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }
