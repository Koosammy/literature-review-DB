import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  alpha,
  useTheme,
  Link
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  Person as PersonIcon,
  Visibility,
  VisibilityOff,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      // Navigate to dashboard on success
      // Explicitly use the hash format for navigation to ensure consistency
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      // Stay on the same page and show error
      // We're not navigating on error to prevent the 404 issue
      // The user will stay on the login page with the hash in the URL
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      // Always set loading to false, whether login succeeds or fails
      setLoading(false);
    }
  };
  
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    setForgotPasswordOpen(true);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a4f3c 0%, #1a7a5e 30%, #2a9d7f 70%, #3ac0a0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <CssBaseline />
      
      {/* Animated Background Elements */}
      <Box
        component={motion.div}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        sx={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }}
      />
      
      <Box
        component={motion.div}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.05, 0.15, 0.05]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        sx={{
          position: 'absolute',
          bottom: -150,
          right: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }}
      />

      <Container component="main" maxWidth="sm" sx={{ position: 'relative', zIndex: 2 }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Header Section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Box
                sx={{
                  position: 'relative',
                  mb: 4,
                  textAlign: 'center'
                }}
              >
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255,255,255,0.2)',
                    mx: 'auto',
                    mb: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                  }}
                >
                  <AdminIcon sx={{ fontSize: 40, color: 'white' }} />
                </Avatar>
                
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    color: 'white',
                    mb: 1,
                    textShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    fontSize: { xs: '2rem', md: '2.5rem' }
                  }}
                >
                  Admin Portal
                </Typography>
                
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 300,
                    letterSpacing: 1
                  }}
                >
                   FRED N. BINKA School of Public Health Research Hub
                </Typography>
              </Box>
            </motion.div>

            {/* Login Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{ width: '100%' }}
            >
              <Card
                elevation={0}
                sx={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 5 } }}>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Alert 
                        severity="error" 
                        sx={{ 
                          mb: 3,
                          borderRadius: 3,
                          '& .MuiAlert-icon': {
                            fontSize: 24
                          }
                        }}
                      >
                        {error}
                      </Alert>
                    </motion.div>
                  )}

                  <Box component="form" onSubmit={handleSubmit}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    >
                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        autoFocus
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon sx={{ color: '#0a4f3c' }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          mb: 2,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                            '&:hover fieldset': {
                              borderColor: '#2a9d7f',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#0a4f3c',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#0a4f3c',
                          },
                        }}
                      />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                    >
                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon sx={{ color: '#0a4f3c' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={handleTogglePasswordVisibility}
                                edge="end"
                                sx={{ color: '#0a4f3c' }}
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          mb: 2,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                            '&:hover fieldset': {
                              borderColor: '#2a9d7f',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#0a4f3c',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#0a4f3c',
                          },
                        }}
                      />
                    </motion.div>

                    {/* Forgot Password Link */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.75 }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                        <Link
                          component="button"
                          type="button"
                          onClick={handleForgotPassword}
                          sx={{
                            color: '#0a4f3c',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            '&:hover': {
                              textDecoration: 'underline',
                              color: '#063d2f'
                            },
                            cursor: 'pointer'
                          }}
                        >
                          Forgot your password?
                        </Link>
                      </Box>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        disabled={loading}
                        sx={{
                          py: 2,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          textTransform: 'none',
                          boxShadow: '0 8px 24px rgba(10,79,60,0.3)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #063d2f 0%, #1a7a5e 100%)',
                            boxShadow: '0 12px 32px rgba(10,79,60,0.4)',
                            transform: 'translateY(-2px)'
                          },
                          '&:disabled': {
                            background: alpha('#0a4f3c', 0.6),
                            color: 'white'
                          },
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {loading ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <SecurityIcon />
                            </motion.div>
                            Authenticating...
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <SecurityIcon />
                            Sign In to Dashboard
                          </Box>
                        )}
                      </Button>
                    </motion.div>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Box>
        </motion.div>
      </Container>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />
    </Box>
  );
};

export default LoginPage;
