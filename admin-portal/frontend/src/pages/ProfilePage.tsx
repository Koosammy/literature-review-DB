import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  Avatar,
  Card,
  CardContent,
  Chip,
  alpha,
  LinearProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Email as EmailIcon,
  School as SchoolIcon,
  Phone as PhoneIcon,
  Badge as BadgeIcon,
  CalendarToday as CalendarIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../services/adminApi';

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    institution: user?.institution || '',
    department: user?.department || '',
    phone: user?.phone || '',
    about: user?.about || '',
    disciplines: user?.disciplines || ''
  });

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const result = await adminApi.changeProfileImage(file);
      updateUser({ profile_image: result.image_url });
    } catch (error: any) {
      setPhotoError(error.message || 'Could not change your profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setProfileData({
      full_name: user?.full_name || '',
      email: user?.email || '',
      institution: user?.institution || '',
      department: user?.department || '',
      phone: user?.phone || '',
      about: user?.about || '',
      disciplines: user?.disciplines || ''
    });
  };

  const handleSave = async () => {
    try {
      const response = await adminApi.updateProfile({
        full_name: profileData.full_name,
        email: profileData.email,
        institution: profileData.institution,
        department: profileData.department,
        phone: profileData.phone,
        about: profileData.about,
        disciplines: profileData.disciplines
      });
      
      updateUser(response);
      
      setProfileData({
        full_name: response.full_name || '',
        email: response.email || '',
        institution: response.institution || '',
        department: response.department || '',
        phone: response.phone || '',
        about: response.about || '',
        disciplines: response.disciplines || ''
      });
         
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };
  
  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setProfileData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const profileCompletion = () => {
    const fields = [user?.full_name, user?.email, user?.institution, user?.department, user?.phone];
    const filledFields = fields.filter(field => field && field.trim() !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  return (
    <Box>
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 800,
              color: '#0a4f3c',
              mb: 1,
              fontSize: { xs: '2rem', md: '2.5rem' }
            }}
          >
            Profile Settings
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '1.1rem'
            }}
          >
            Manage your account information
          </Typography>
        </Box>
      </motion.div>

      {photoError && <Alert severity="error" sx={{ mb: 3 }}>{photoError}</Alert>}

      <Grid container spacing={4}>
        {/* Profile Header Card */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card
              elevation={0}
              sx={{
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                  {/* Profile Avatar and replacement control */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      src={user?.profile_image || undefined}
                      sx={{
                        width: 100,
                        height: 100,
                        background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        boxShadow: '0 8px 32px rgba(10,79,60,0.3)'
                      }}
                    >
                      {user?.full_name?.charAt(0) || 'U'}
                    </Avatar>
                    <Button
                      component="label"
                      size="small"
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      disabled={uploadingPhoto}
                      sx={{ borderRadius: 2, textTransform: 'none', color: '#0a4f3c', borderColor: '#0a4f3c' }}
                    >
                      {uploadingPhoto ? 'Uploading…' : user?.profile_image ? 'Change Photo' : 'Add Photo'}
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoChange}
                      />
                    </Button>
                  </Box>

                  {/* Profile Info */}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          fontWeight: 700,
                          color: '#0a4f3c',
                          fontSize: { xs: '1.5rem', md: '2rem' }
                        }}
                      >
                        {user?.full_name || 'User Name'}
                      </Typography>
                      {user?.is_active && (
                        <VerifiedIcon sx={{ color: '#4caf50', fontSize: 28 }} />
                      )}
                    </Box>
                    
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        color: 'text.secondary',
                        mb: 2,
                        fontSize: '1.1rem'
                      }}
                    >
                      @{user?.username}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
                      <Chip
                        icon={<BadgeIcon />}
                        label={user?.role === 'main_coordinator' ? 'Main Coordinator' : 'Faculty Member'}
                        sx={{
                          bgcolor: alpha('#0a4f3c', 0.1),
                          color: '#0a4f3c',
                          fontWeight: 600,
                          '& .MuiChip-icon': {
                            color: '#0a4f3c'
                          }
                        }}
                      />
                      <Chip
                        icon={<SecurityIcon />}
                        label={user?.is_active ? 'Active Account' : 'Inactive'}
                        sx={{
                          bgcolor: user?.is_active ? alpha('#4caf50', 0.1) : alpha('#f44336', 0.1),
                          color: user?.is_active ? '#4caf50' : '#f44336',
                          fontWeight: 600,
                          '& .MuiChip-icon': {
                            color: user?.is_active ? '#4caf50' : '#f44336'
                          }
                        }}
                      />
                    </Box>

                    {/* Profile Completion */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0a4f3c' }}>
                          Profile Completion
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0a4f3c' }}>
                          {profileCompletion()}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={profileCompletion()}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: alpha('#0a4f3c', 0.1),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            background: 'linear-gradient(90deg, #0a4f3c 0%, #2a9d7f 100%)'
                          }
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Action Buttons */}
                  <Box>
                    <AnimatePresence mode="wait">
                      {!editing ? (
                        <motion.div
                          key="edit"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Button
                            variant="contained"
                            size="large"
                            startIcon={<EditIcon />}
                            onClick={handleEdit}
                            sx={{
                              px: 4,
                              py: 1.5,
                              borderRadius: 3,
                              background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
                              textTransform: 'none',
                              fontWeight: 600,
                              boxShadow: '0 8px 24px rgba(10,79,60,0.3)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #063d2f 0%, #1a7a5e 100%)',
                                boxShadow: '0 12px 32px rgba(10,79,60,0.4)',
                                transform: 'translateY(-2px)'
                              },
                              transition: 'all 0.3s ease'
                            }}
                          >
                            Edit Profile
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="save-cancel"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Button
                              variant="contained"
                              startIcon={<SaveIcon />}
                              onClick={handleSave}
                              sx={{
                                borderRadius: 3,
                                background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #388e3c 0%, #4caf50 100%)'
                                }
                              }}
                            >
                              Save Changes
                            </Button>
                            <Button
                              variant="outlined"
                              startIcon={<CancelIcon />}
                              onClick={handleCancel}
                              sx={{
                                borderRadius: 3,
                                borderColor: '#f44336',
                                color: '#f44336',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': {
                                  borderColor: '#d32f2f',
                                  bgcolor: alpha('#f44336', 0.04)
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Personal Information */}
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card
              elevation={0}
              sx={{
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  p: 3,
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  borderBottom: '1px solid rgba(0,0,0,0.08)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: '#0a4f3c',
                      width: 48,
                      height: 48
                    }}
                  >
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c' }}>
                      Personal Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Update your personal details and contact information
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <CardContent sx={{ p: 4 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Full Name"
                      fullWidth
                      value={profileData.full_name}
                      onChange={handleInputChange('full_name')}
                      disabled={!editing}
                      InputProps={{
                        startAdornment: (
                          <PersonIcon sx={{ color: '#0a4f3c', mr: 1 }} />
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Email Address"
                      fullWidth
                      value={profileData.email}
                      onChange={handleInputChange('email')}
                      disabled={!editing}
                      InputProps={{
                        startAdornment: (
                          <EmailIcon sx={{ color: '#0a4f3c', mr: 1 }} />
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                         '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Institution"
                      fullWidth
                      value={profileData.institution}
                      onChange={handleInputChange('institution')}
                      disabled={!editing}
                      InputProps={{
                        startAdornment: (
                          <SchoolIcon sx={{ color: '#0a4f3c', mr: 1 }} />
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Department"
                      fullWidth
                      value={profileData.department}
                      onChange={handleInputChange('department')}
                      disabled={!editing}
                      InputProps={{
                        startAdornment: (
                          <SchoolIcon sx={{ color: '#0a4f3c', mr: 1 }} />
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Phone Number"
                      fullWidth
                      value={profileData.phone}
                      onChange={handleInputChange('phone')}
                      disabled={!editing}
                      InputProps={{
                        startAdornment: (
                          <PhoneIcon sx={{ color: '#0a4f3c', mr: 1 }} />
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Username"
                      fullWidth
                      value={user?.username || ''}
                      disabled
                      helperText="Username cannot be changed"
                      InputProps={{
                        startAdornment: (
                          <BadgeIcon sx={{ color: 'text.secondary', mr: 1 }} />
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          bgcolor: alpha('#000', 0.02)
                        },
                      }}
                    />
                  </Grid>

                  {/* About Section */}
                  <Grid item xs={12}>
                    <TextField
                      label="About"
                      fullWidth
                      multiline
                      rows={4}
                      value={profileData.about || ''}
                      onChange={handleInputChange('about')}
                      disabled={!editing}
                      placeholder="Tell us about yourself, your research interests, and professional background..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>

                  {/* Disciplines Section */}
                  <Grid item xs={12}>
                    <TextField
                      label="Disciplines"
                      fullWidth
                      multiline
                      rows={3}
                      value={profileData.disciplines || ''}
                      onChange={handleInputChange('disciplines')}
                      disabled={!editing}
                      placeholder="List your areas of expertise and research disciplines (e.g., Computer Science, Machine Learning, Data Science)..."
                      helperText="Separate multiple disciplines with commas"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&.Mui-focused fieldset': {
                            borderColor: '#0a4f3c',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#0a4f3c',
                        },
                      }}
                    />
                  </Grid>
                </Grid>

                <AnimatePresence>
                  {editing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Alert 
                        severity="info" 
                        sx={{ 
                          mt: 3,
                          borderRadius: 3,
                          '& .MuiAlert-icon': { fontSize: 24 }
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Save Your Changes
                        </Typography>
                        Don't forget to click "Save Changes" to update your profile information.
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Account Statistics */}
        <Grid item xs={12} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card
              elevation={0}
              sx={{
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  p: 3,
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  borderBottom: '1px solid rgba(0,0,0,0.08)'
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c' }}>
                  Account Information
                </Typography>
              </Box>
              
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: alpha('#0a4f3c', 0.05),
                      border: '1px solid',
                      borderColor: alpha('#0a4f3c', 0.1)
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <CalendarIcon sx={{ color: '#0a4f3c', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0a4f3c' }}>
                        Member Since
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c' }}>
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </Typography>
                  </Box>
                  
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: alpha('#1a7a5e', 0.05),
                      border: '1px solid',
                      borderColor: alpha('#1a7a5e', 0.1)
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <BadgeIcon sx={{ color: '#1a7a5e', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a7a5e' }}>
                        Account Role
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a7a5e' }}>
                      {user?.role === 'main_coordinator' ? 'Main Coordinator' : 'Faculty Member'}
                    </Typography>
                  </Box>
                  
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: user?.is_active ? alpha('#4caf50', 0.05) : alpha('#f44336', 0.05),
                      border: '1px solid',
                      borderColor: user?.is_active ? alpha('#4caf50', 0.1) : alpha('#f44336', 0.1)
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <SecurityIcon sx={{ 
                        color: user?.is_active ? '#4caf50' : '#f44336', 
                        fontSize: 20 
                      }} />
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        color: user?.is_active ? '#4caf50' : '#f44336'
                      }}>
                        Account Status
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      color: user?.is_active ? '#4caf50' : '#f44336'
                    }}>
                      {user?.is_active ? 'Active & Verified' : 'Inactive'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
