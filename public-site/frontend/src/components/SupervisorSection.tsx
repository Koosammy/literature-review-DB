import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Dialog,
  DialogContent,
  IconButton,
  CircularProgress,
  Alert,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Divider,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  School as SchoolIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';
import { SupervisorBrief, SupervisorProfile } from '../types';
import { apiService } from '../services/api';

interface SupervisorSectionProps {
  supervisors: SupervisorBrief[];
  /** Legacy free-text supervisor names, shown as plain text only when no
      linked supervisor accounts exist yet for this project. */
  legacyText?: string;
}

const SupervisorAvatar: React.FC<{ supervisor: SupervisorBrief; onClick: () => void }> = ({ supervisor, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: 96,
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'transform 0.2s ease',
      '&:hover': { transform: 'translateY(-2px)' },
    }}
  >
    <Avatar
      src={supervisor.profile_image}
      sx={{ width: 64, height: 64, mb: 1, bgcolor: '#0a4f3c', border: '2px solid #e8f5e9' }}
    >
      {supervisor.full_name.charAt(0)}
    </Avatar>
    <Typography variant="caption" sx={{ fontWeight: 600, color: '#2e7d32', lineHeight: 1.2 }}>
      {[supervisor.title, supervisor.full_name].filter(Boolean).join(' ')}
    </Typography>
  </Box>
);

const SupervisorSection: React.FC<SupervisorSectionProps> = ({ supervisors, legacyText }) => {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<number | null>(null);
  const [profile, setProfile] = useState<SupervisorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = async (id: number) => {
    setOpenId(id);
    setProfile(null);
    setError('');
    setLoading(true);
    try {
      const data = await apiService.getSupervisorProfile(id);
      setProfile(data);
    } catch (err) {
      setError('Could not load this supervisor\'s profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpenId(null);
    setProfile(null);
    setError('');
  };

  if (!supervisors.length) {
    if (!legacyText) return null;
    return (
      <Box sx={{
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'rgba(76, 175, 80, 0.05)',
        borderRadius: 2,
        border: '1px solid #e8f5e9'
      }}>
        <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
          Research Supervisor(s)
        </Typography>
        <Typography variant="body1" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          {legacyText}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      p: { xs: 1.5, sm: 2 },
      bgcolor: 'rgba(76, 175, 80, 0.05)',
      borderRadius: 2,
      border: '1px solid #e8f5e9'
    }}>
      <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
        Research Supervisor{supervisors.length > 1 ? 's' : ''}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {supervisors.map((s) => (
          <SupervisorAvatar key={s.id} supervisor={s} onClick={() => handleOpen(s.id)} />
        ))}
      </Box>

      <Dialog open={openId !== null} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <IconButton
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary', zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#0a4f3c' }} />
            </Box>
          )}
          {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
          {profile && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
                <Avatar
                  src={profile.profile_image}
                  sx={{ width: 100, height: 100, mb: 2, bgcolor: '#0a4f3c', border: '3px solid #e8f5e9' }}
                >
                  {profile.full_name.charAt(0)}
                </Avatar>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0a4f3c' }}>
                  {[profile.title, profile.full_name].filter(Boolean).join(' ')}
                </Typography>
                {profile.institution && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: 'text.secondary' }}>
                    <SchoolIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">{profile.institution}</Typography>
                  </Box>
                )}
                <Chip
                  size="small"
                  label={`${profile.works_count} supervised work${profile.works_count === 1 ? '' : 's'}`}
                  sx={{ mt: 1.5, bgcolor: 'rgba(10,79,60,0.1)', color: '#0a4f3c', fontWeight: 600 }}
                />
              </Box>

              {profile.about && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, textAlign: 'center' }}>
                  {profile.about}
                </Typography>
              )}

              {profile.works.length > 0 && (
                <>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0a4f3c', mt: 2, mb: 1 }}>
                    Supervised Work
                  </Typography>
                  <List dense>
                    {profile.works.map((work) => (
                      <ListItemButton
                        key={work.id}
                        onClick={() => navigate(`/projects/${work.slug}`)}
                        sx={{ borderRadius: 2, mb: 0.5 }}
                      >
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <ArticleIcon sx={{ color: '#2a9d7f' }} />
                        </ListItemAvatar>
                        <ListItemText
                          primary={work.title}
                          secondary={[work.degree_type, work.academic_year].filter(Boolean).join(' · ')}
                          primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SupervisorSection;
