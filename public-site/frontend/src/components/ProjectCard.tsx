import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography
} from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  Download as DownloadIcon,
  LocalHospital as HealthIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { ProjectSummary } from '../types';

interface ProjectCardProps {
  project: ProjectSummary;
  index?: number;
  onClick: () => void;
  compact?: boolean;
}

const CARD_GRADIENTS = [
  ['#064e3b', '#0f766e'],
  ['#14532d', '#15803d'],
  ['#0f3f3a', '#2a9d8f'],
  ['#0b4f6c', '#0f766e']
];

const logoUrl = `${process.env.PUBLIC_URL || ''}/images/school-logo.jpeg`;

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index = 0, onClick, compact = false }) => {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: { xs: 3, md: 4 },
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid rgba(6, 78, 59, 0.12)',
        boxShadow: '0 18px 45px rgba(15, 63, 58, 0.10)',
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
        '&:hover': {
          transform: { xs: 'none', md: 'translateY(-8px)' },
          borderColor: 'rgba(42, 157, 143, 0.45)',
          boxShadow: '0 26px 60px rgba(15, 63, 58, 0.18)',
          '& .project-card-cta': { transform: 'translateX(3px)' }
        },
        '&:active': {
          transform: { xs: 'scale(0.985)', md: 'translateY(-6px) scale(0.99)' }
        }
      }}
    >
      <Box
        sx={{
          height: compact ? { xs: 84, sm: 92, md: 100 } : { xs: 92, sm: 100, md: 112 },
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`
        }}
      >
        <Chip
          label={project.research_area || 'Research'}
          size="small"
          sx={{
            position: 'absolute',
            top: { xs: 10, md: 12 },
            right: { xs: 10, md: 12 },
            maxWidth: '55%',
            bgcolor: 'rgba(255,255,255,0.92)',
            color: gradient[0],
            fontWeight: 800,
            letterSpacing: 0.2,
            boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
            '& .MuiChip-label': { px: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }
          }}
        />

        <Avatar
          src={logoUrl}
          variant="rounded"
          sx={{
            width: { xs: 52, md: 60 },
            height: { xs: 52, md: 60 },
            bgcolor: 'white',
            p: 0.7,
            border: '3px solid rgba(255,255,255,0.6)',
            boxShadow: '0 10px 24px rgba(6, 78, 59, 0.24)'
          }}
        >
          <HealthIcon />
        </Avatar>
      </Box>

      <CardContent sx={{ flexGrow: 1, pt: { xs: 2, md: 2.5 }, px: { xs: 2.2, md: 3 }, pb: 2 }}>
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontWeight: 900,
            color: '#064e3b',
            letterSpacing: '-0.02em',
            lineHeight: 1.22,
            fontSize: compact ? { xs: '1rem', md: '1.12rem' } : { xs: '1.05rem', md: '1.22rem' },
            mb: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {project.title}
        </Typography>


        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          {project.degree_type && <Chip label={project.degree_type} size="small" icon={<SchoolIcon />} sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 800, border: '1px solid #bbf7d0' }} />}
        </Stack>

        <Box sx={{ p: 1.35, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PersonIcon sx={{ color: '#0f766e', fontSize: 18, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.author_name}{project.institution ? ` • ${project.institution}` : ''}
            </Typography>
          </Stack>
        </Box>
      </CardContent>

      <CardActions sx={{ px: { xs: 2.2, md: 3 }, py: 2, borderTop: '1px solid #eef2f7', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2.2} alignItems="center" sx={{ color: '#64748b' }}>
          <Stack direction="row" spacing={0.5} alignItems="center"><ViewIcon sx={{ fontSize: 18 }} /><Typography variant="body2" fontWeight={700}>{project.view_count || 0}</Typography></Stack>
          <Stack direction="row" spacing={0.5} alignItems="center"><DownloadIcon sx={{ fontSize: 18 }} /><Typography variant="body2" fontWeight={700}>{project.download_count || 0}</Typography></Stack>
        </Stack>
        <Button className="project-card-cta" endIcon={<ArrowIcon />} sx={{ color: '#0f766e', fontWeight: 900, textTransform: 'none', transition: 'transform 180ms ease' }}>View</Button>
      </CardActions>
    </Card>
  );
};

export default ProjectCard;
