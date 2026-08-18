import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Avatar,
  CssBaseline,
  InputAdornment,
  IconButton,
  LinearProgress,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  Visibility,
  VisibilityOff,
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
  PersonOutline as PersonIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { useAuth } from '../contexts/AuthContext';

const STEPS = ['Set password', 'Add your photo'];

const ActivateAccountPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession, updateUser } = useAuth();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; username: string } | null>(null);
  const [error, setError] = useState('');

  const [activeStep, setActiveStep] = useState(0);

  // Step 1: password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  // Step 2: mandatory photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid activation link. No token provided.');
        setVerifying(false);
        return;
      }
      try {
        const response = await adminApi.verifyResetToken(token);
        setTokenValid(true);
        setUserInfo(response);
      } catch (err: any) {
        setError(err.message || 'This activation link is invalid or has expired.');
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    };
    verifyToken();
  }, [token]);

  const getPasswordStrength = (value: string) => {
    let strength = 0;
    if (value.length >= 8) strength += 25;
    if (/[A-Z]/.test(value)) strength += 25;
    if (/[a-z]/.test(value)) strength += 25;
    if (/[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value)) strength += 25;
    return strength;
  };
  const getStrengthColor = (s: number) => (s < 50 ? '#f44336' : s < 75 ? '#ff9800' : '#4caf50');
  const getStrengthText = (s: number) => (s < 25 ? 'Very Weak' : s < 50 ? 'Weak' : s < 75 ? 'Good' : 'Strong');

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSettingPassword(true);
    try {
      const result = await adminApi.resetPassword(token!, password);
      if (result.access_token && result.user) {
        // Activation flow: /reset-password logs the user straight in, so
        // the photo step below can call the authenticated upload endpoint
        // without a separate login.
        setSession(result.access_token, result.user);
      }
      setActiveStep(1);
    } catch (err: any) {
      setError(err.message || 'Failed to set your password.');
    } finally {
      setSettingPassword(false);
    }
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoSubmit = async () => {
    if (!photoFile) {
      setPhotoError('Please choose a photo -- it appears next to your supervised work on the public site.');
      return;
    }
    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const result = await adminApi.uploadProfileImage(photoFile);
      updateUser({ profile_image: result.path });
      navigate('/dashboard');
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload photo. Please try a different image.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (verifying) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a4f3c 0%, #1a7a5e 30%, #2a9d7f 70%, #3ac0a0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
          <Typography>Verifying activation link...</Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a4f3c 0%, #1a7a5e 30%, #2a9d7f 70%, #3ac0a0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <CssBaseline />
      <Container component="main" maxWidth="sm" sx={{ position: 'relative', zIndex: 2 }}>
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '2px solid rgba(255,255,255,0.2)', mx: 'auto', mb: 3 }}>
                <LockIcon sx={{ fontSize: 40, color: 'white' }} />
              </Avatar>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 1 }}>
                Welcome to UHAS Research Hub
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 300 }}>
                {userInfo ? `Set up your account for ${userInfo.email}` : 'Set up your account'}
              </Typography>
            </Box>

            <Card elevation={0} sx={{ width: '100%', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
              <CardContent sx={{ p: { xs: 3, md: 5 } }}>
                {!tokenValid ? (
                  <Alert severity="error" sx={{ borderRadius: 3 }}>
                    {error}
                    <Button onClick={() => navigate('/login')} sx={{ mt: 2, display: 'block' }} variant="outlined">
                      Back to Login
                    </Button>
                  </Alert>
                ) : (
                  <>
                    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                      {STEPS.map((label) => (
                        <Step key={label}>
                          <StepLabel>{label}</StepLabel>
                        </Step>
                      ))}
                    </Stepper>

                    {activeStep === 0 && (
                      <>
                        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}
                        <Box component="form" onSubmit={handleSetPassword}>
                          <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Choose a Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#0a4f3c' }} /></InputAdornment>,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#0a4f3c' }}>
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          />

                          {password && (
                            <Box sx={{ mb: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">Password Strength</Typography>
                                <Typography variant="caption" sx={{ color: getStrengthColor(getPasswordStrength(password)) }}>
                                  {getStrengthText(getPasswordStrength(password))}
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={getPasswordStrength(password)}
                                sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', '& .MuiLinearProgress-bar': { backgroundColor: getStrengthColor(getPasswordStrength(password)), borderRadius: 3 } }}
                              />
                            </Box>
                          )}

                          <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Confirm Password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#0a4f3c' }} /></InputAdornment>,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: '#0a4f3c' }}>
                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          />

                          <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={settingPassword || !password || !confirmPassword}
                            sx={{
                              py: 2, borderRadius: 3, background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
                              fontSize: '1.1rem', fontWeight: 600, textTransform: 'none',
                              '&:hover': { background: 'linear-gradient(135deg, #063d2f 0%, #1a7a5e 100%)' },
                            }}
                          >
                            {settingPassword ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><SecurityIcon />Setting Password...</Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><SecurityIcon />Continue</Box>
                            )}
                          </Button>
                        </Box>
                      </>
                    )}

                    {activeStep === 1 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                          <CheckIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                          <Typography variant="body1" color="text.secondary">
                            Password set. Last step: add a profile photo so your face shows up next to the work you supervise.
                          </Typography>
                        </Box>

                        {photoError && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{photoError}</Alert>}

                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Avatar
                            src={photoPreview || undefined}
                            sx={{ width: 120, height: 120, bgcolor: '#e8f5e9', border: '3px solid #0a4f3c' }}
                          >
                            {!photoPreview && <PersonIcon sx={{ fontSize: 60, color: '#0a4f3c' }} />}
                          </Avatar>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            onChange={handlePhotoSelected}
                          />
                          <Button
                            variant="outlined"
                            startIcon={<UploadIcon />}
                            onClick={() => fileInputRef.current?.click()}
                            sx={{ borderRadius: 3, borderColor: '#0a4f3c', color: '#0a4f3c' }}
                          >
                            {photoFile ? 'Choose a Different Photo' : 'Choose Photo'}
                          </Button>

                          <Button
                            fullWidth
                            variant="contained"
                            disabled={!photoFile || uploadingPhoto}
                            onClick={handlePhotoSubmit}
                            sx={{
                              mt: 1, py: 2, borderRadius: 3, background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
                              fontSize: '1.1rem', fontWeight: 600, textTransform: 'none',
                              '&:hover': { background: 'linear-gradient(135deg, #063d2f 0%, #1a7a5e 100%)' },
                            }}
                          >
                            {uploadingPhoto ? 'Uploading...' : 'Finish Setting Up My Account'}
                          </Button>
                        </Box>
                      </motion.div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default ActivateAccountPage;
