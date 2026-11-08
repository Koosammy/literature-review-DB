import React from 'react';
import { Avatar, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  Download as DownloadIcon,
  LocalHospital as HealthIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { ProjectSummary } from '../types';

const logoUrl = `${process.env.PUBLIC_URL || ''}/images/school-logo.jpeg`;

const ProjectCard: React.FC<{ project: ProjectSummary }> = ({ project }) => (
  <Card
    component="article"
    elevation={0}
    sx={{
      width: '100%',
      maxWidth: 320,
      height: '100%',
      mx: { xs: 'auto', sm: 0 },
      borderRadius: '18px',
      border: '1px solid #dce8e2',
      boxShadow: '0 4px 14px rgba(6, 78, 59, 0.07)',
      transition: 'border-color 180ms ease, box-shadow 180ms ease',
      '&:hover': {
        borderColor: '#a8ccbb',
        boxShadow: '0 8px 20px rgba(6, 78, 59, 0.12)'
      }
    }}
  >
    <CardActionArea
      component={Link}
      to={`/projects/${project.slug}`}
      aria-label={`View ${project.title}`}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        '&.Mui-focusVisible': { outline: '2px solid #0f766e', outlineOffset: '-3px' }
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Avatar
            src={logoUrl}
            alt=""
            variant="rounded"
            sx={{
              width: 40,
              height: 40,
              p: '5px',
              flexShrink: 0,
              borderRadius: '12px',
              bgcolor: '#eff7f2',
              color: '#0f766e',
              '& img': { objectFit: 'contain' }
            }}
          >
            <HealthIcon aria-hidden="true" fontSize="small" />
          </Avatar>
          <Typography
            component="h3"
            sx={{
              color: '#064e3b',
              fontSize: '0.95rem',
              fontWeight: 750,
              lineHeight: 1.3,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {project.title}
          </Typography>
        </Stack>

        <Typography variant="body2" noWrap sx={{ mt: 1.25, color: '#334155', fontWeight: 650 }}>
          {project.author_name}
        </Typography>
        {project.institution && (
          <Typography variant="caption" component="p" noWrap sx={{ color: '#526477' }}>
            {project.institution}
          </Typography>
        )}
        {project.degree_type && (
          <Chip
            label={project.degree_type}
            size="small"
            sx={{ mt: 0.75, maxWidth: '100%', height: 20, bgcolor: '#eff7f2', color: '#064e3b', fontWeight: 650 }}
          />
        )}
      </CardContent>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1, borderTop: '1px solid #e7efe9', bgcolor: '#f7faf8' }}
      >
        <Stack direction="row" spacing={1.5} sx={{ color: '#526477' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ViewIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" title="Views">{project.view_count || 0}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <DownloadIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" title="Downloads">{project.download_count || 0}</Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#0f766e' }}>
          <Typography variant="body2" fontWeight={750}>View</Typography>
          <ArrowIcon sx={{ fontSize: 16 }} />
        </Stack>
      </Stack>
    </CardActionArea>
  </Card>
);

export default ProjectCard;
