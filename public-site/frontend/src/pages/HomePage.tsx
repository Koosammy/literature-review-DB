import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  InputAdornment,
  Paper,
  Avatar,
  Fade,
  Slide,
  IconButton,
  useTheme,
  useMediaQuery,
  Skeleton,
  Divider,
  Zoom,
  Grow
} from '@mui/material';
import {
  Search as SearchIcon,
  School as SchoolIcon,
  LocalHospital as HealthIcon,
  People as PeopleIcon,
  TrendingUp as TrendingIcon,
  ArrowForward as ArrowIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Public as PublicIcon,
  Science as ResearchIcon,
  EmojiObjects as InnovationIcon,
  Favorite as HeartIcon,
  Groups as CommunityIcon,
  TouchApp as TouchIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { ProjectSummary, SiteStats } from '../types';
import SEOHead from '../components/SEOHead';
import { motion } from 'framer-motion';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredProjects, setFeaturedProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isExtraSmall = useMediaQuery(theme.breakpoints.down(400));

  useEffect(() => {
    loadData();
  }, []);

  // Add touch gesture handling for better mobile experience
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartY) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    
    // If swipe up is detected and we're at the top, show a subtle hint
    if (diff > 50 && window.scrollY < 100) {
      // Could add a subtle animation or hint here
    }
    
    setTouchStartY(null);
  };

  useEffect(() => {
    // Add homepage structured data
    const homepageSchema = {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      "name": "School of Public Health",
      "url": window.location.origin,
      "description": "Leading institution in public health education, research, and community engagement. Advancing health equity and improving population health outcomes worldwide.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${window.location.origin}/projects?search={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      },
      "publisher": {
        "@type": "Organization",
        "name": "School of Public Health",
        "url": window.location.origin
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(homepageSchema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[type="application/ld+json"]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, statsData] = await Promise.all([
        apiService.getFeaturedProjects(),
        apiService.getSiteStats()
      ]);
      
      setFeaturedProjects(projectsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setFeaturedProjects([]);
      setStats({
        total_projects: 0,
        total_institutions: 0,
        total_research_areas: 0,
        total_downloads: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/projects?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/projects');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box 
      sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SEOHead 
        title="School of Public Health - Advancing Health Equity and Population Health"
        description="Leading institution in public health education, research, and community engagement. Discover our programs, research initiatives, and commitment to improving global health outcomes."
        keywords="public health, health equity, population health, epidemiology, health policy, global health, community health, public health education, health research"
        type="website"
      />
      
      {/* Modern Hero Section - Mobile Optimized */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 'calc(100vh - 60px)', sm: '100vh', md: '100vh' },
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0d4715 100%, #1a7a5e 50%, #2a9d7f 100%)',
          pb: { xs: isMobile ? 12 : 8, md: 0 }
        }}
      >
        {/* Animated Background Pattern */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        <Container maxWidth="lg" sx={{ 
          position: 'relative', 
          zIndex: 2, 
          px: { xs: 1.5, sm: 2, md: 3 },
          py: { xs: 2, sm: 0 }
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
              <Grid item xs={12} md={7}>
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 800,
                    fontSize: { 
                      xs: isExtraSmall ? '1.75rem' : '2rem', 
                      sm: '2.5rem', 
                      md: '3.5rem', 
                      lg: '4.5rem' 
                    },
                    color: 'white',
                    mb: { xs: 2, md: 3 },
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  Transforming Public Health
                  <Box component="span" sx={{ color: '#a7ffeb' }}> Together</Box>
                </Typography>
                
                <Typography
                  variant="h5"
                  sx={{
                    mb: { xs: 3, md: 4 },
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: { 
                      xs: isExtraSmall ? '0.875rem' : '1rem', 
                      sm: '1.1rem', 
                      md: '1.3rem', 
                      lg: '1.4rem' 
                    },
                    lineHeight: 1.6,
                    fontWeight: 300,
                    textAlign: { xs: 'center', md: 'left' },
                    px: { xs: 1, md: 0 }
                  }}
                >
                  Leading the way in health equity, innovative research, and community-driven solutions 
                  for a healthier tomorrow.
                </Typography>

                {/* Modern Search Bar - Mobile Optimized */}
                <Box sx={{ 
                  width: '100%', 
                  maxWidth: { xs: '100%', sm: 500, md: 600 },
                  mx: { xs: 'auto', md: 0 },
                  mb: { xs: 3, md: 4 }
                }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 1, sm: 1.5 },
                      borderRadius: { xs: 2, sm: '50px' },
                      bgcolor: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: { xs: 1, sm: 1.5 }
                    }}>
                      <SearchIcon sx={{ 
                        color: '#0a4f3c', 
                        ml: { xs: 1, sm: 2 },
                        fontSize: { xs: 22, sm: 24 },
                        flexShrink: 0
                      }} />
                      
                      <TextField
                        fullWidth
                        placeholder={isExtraSmall ? "Search projects..." : "Search research projects..."}
                        variant="standard"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: { xs: '0.9rem', sm: '1rem' },
                            fontWeight: 500,
                            color: '#333',
                            '&::placeholder': {
                              color: 'rgba(0,0,0,0.5)',
                              opacity: 1
                            }
                          }
                        }}
                        sx={{
                          '& input': {
                            py: { xs: 1.2, sm: 1.5 },
                            '&::placeholder': {
                              color: 'rgba(0,0,0,0.5)',
                              opacity: 1
                            }
                          }
                        }}
                      />
                      
                      <Button
                        variant="contained"
                        onClick={handleSearch}
                        sx={{
                          borderRadius: { xs: 1.5, sm: '50px' },
                          px: { xs: 2.5, sm: 3, md: 4 },
                          py: { xs: 1, sm: 1.25 },
                          minWidth: { xs: 'auto', sm: 100 },
                          bgcolor: '#0a4f3c',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          boxShadow: 'none',
                          flexShrink: 0,
                          '&:hover': {
                            bgcolor: '#063d2f',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 4px 20px rgba(10,79,60,0.3)'
                          },
                          '&:active': {
                            transform: 'translateY(0)'
                          }
                        }}
                      >
                        {isMobile ? 'Go' : 'Search'}
                      </Button>
                    </Box>
                  </Paper>
                </Box>

                {/* Quick Stats - Mobile Optimized */}
                <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ justifyContent: { xs: 'center', md: 'flex-start' } }}>
                  {[
                    { number: '12+', label: 'Years of Excellence' },
                    { number: '10K+', label: 'Alumni Worldwide' },
                  ].map((stat, index) => (
                    <Grid item xs={6} key={index}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                      >
                        <Box sx={{ 
                          textAlign: { xs: 'center', md: 'left' },
                          p: { xs: 1, sm: 1.5 },
                          borderRadius: 2,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          <Typography 
                            variant="h4" 
                            sx={{ 
                              color: '#a7ffeb', 
                              fontWeight: 700,
                              fontSize: { 
                                xs: isExtraSmall ? '1.5rem' : '1.8rem', 
                                sm: '2rem', 
                                md: '2.5rem' 
                              },
                              mb: 0.5
                            }}
                          >
                            {stat.number}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
                              fontWeight: 500
                            }}
                          >
                            {stat.label}
                          </Typography>
                        </Box>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              
              {/* Hero Illustration - Mobile Optimized */}
              <Grid item xs={12} md={5}>
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      height: { xs: 200, sm: 300, md: 500 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mt: { xs: 2, sm: 0 }
                    }}
                  >
                    {/* Mobile-optimized animated circles */}
                    <Box
                      sx={{
                        position: 'absolute',
                        width: { xs: 150, sm: 250, md: 400 },
                        height: { xs: 150, sm: 250, md: 400 },
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        animation: 'pulse 4s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            transform: 'scale(1)',
                            opacity: 0.3
                          },
                          '50%': {
                            transform: 'scale(1.1)',
                            opacity: 0.5
                          }
                        }
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        width: { xs: 120, sm: 200, md: 300 },
                        height: { xs: 120, sm: 200, md: 300 },
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.4)',
                        animation: 'pulse 4s ease-in-out infinite 1s',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            transform: 'scale(1)',
                            opacity: 0.2
                          },
                          '50%': {
                            transform: 'scale(1.15)',
                            opacity: 0.4
                          }
                        }
                      }}
                    />
                    <PublicIcon sx={{ 
                      fontSize: { xs: 60, sm: 80, md: 120 }, 
                      color: 'rgba(255,255,255,0.9)',
                      zIndex: 1
                    }} />
                  </Box>
                </motion.div>
              </Grid>
            </Grid>
          </motion.div>
        </Container>

        {/* Scroll Indicator - Hidden on mobile */}
        {!isTablet && (
          <Box
            component={motion.div}
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            sx={{
              position: 'absolute',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              opacity: 0.7
            }}
          >
            <Typography variant="caption">Scroll to explore</Typography>
          </Box>
        )}

        {/* Mobile Swipe Hint */}
        {isMobile && (
          <Box
            component={motion.div}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            sx={{
              position: 'absolute',
              bottom: { xs: 80, sm: 30 },
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              opacity: 0.6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <TouchIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
            <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Swipe to explore
            </Typography>
          </Box>
        )}
      </Box>

      {/* Modern Stats Section - Mobile Optimized */}
      <Container maxWidth="lg" sx={{ 
        py: { xs: 4, sm: 6, md: 8, lg: 10 }, 
        mt: { xs: -4, sm: -6, md: -8, lg: -10 }, 
        position: 'relative', 
        zIndex: 10,
        px: { xs: 1.5, sm: 2, md: 3 }
      }}>
        <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
          {[
            { 
              icon: ResearchIcon, 
              number: stats?.total_projects || 75, 
              label: 'Active Research Projects',
              color: '#0a4f3c',
              gradient: 'linear-gradient(135deg, #0a4f3c 0%, #1a7a5e 100%)'
            },
            { 
              icon: SchoolIcon, 
              number: 5, 
              label: 'Academic Departments',
              color: '#1a7a5e',
              gradient: 'linear-gradient(135deg, #1a7a5e 0%, #2a9d7f 100%)'
            },
            { 
              icon: PeopleIcon, 
              number: 2500, 
              label: 'Students & Alumni',
              color: '#2a9d7f',
              gradient: 'linear-gradient(135deg, #2a9d7f 0%, #3ac0a0 100%)'
            },
            { 
              icon: PublicIcon, 
              number: 16, 
              label: 'Regions Impacted',
              color: '#3ac0a0',
              gradient: 'linear-gradient(135deg, #3ac0a0 0%, #4ae3c1 100%)'
            }
          ].map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card
                  elevation={0}
                  sx={{
                    p: { xs: 1.5, sm: 2, md: 3 },
                    height: '100%',
                    background: 'white',
                    borderRadius: { xs: 3, md: 4 },
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    border: '1px solid rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: { xs: 'none', md: 'translateY(-8px)' },
                      boxShadow: { xs: 'none', md: '0 20px 40px rgba(0,0,0,0.1)' },
                      '& .stat-icon': {
                        transform: { xs: 'none', md: 'scale(1.1) rotate(5deg)' }
                      }
                    },
                    '&:active': {
                      transform: { xs: 'scale(0.98)', md: 'translateY(-8px) scale(0.98)' }
                    }
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      width: { xs: 60, sm: 80, md: 100 },
                      height: { xs: 60, sm: 80, md: 100 },
                      borderRadius: '50%',
                      background: stat.gradient,
                      opacity: 0.1
                    }}
                  />
                  <Box sx={{ position: 'relative', textAlign: 'center' }}>
                    <Box
                      className="stat-icon"
                      sx={{
                        width: { xs: 40, sm: 50, md: 60 },
                        height: { xs: 40, sm: 50, md: 60 },
                        borderRadius: { xs: 2, md: 3 },
                        background: stat.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: { xs: 1.5, md: 2 },
                        transition: 'transform 0.3s ease',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                      }}
                    >
                      <stat.icon sx={{ 
                        color: 'white', 
                        fontSize: { xs: 20, sm: 24, md: 28 } 
                      }} />
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 700,
                        color: stat.color,
                        mb: 0.5,
                        fontSize: { 
                          xs: isExtraSmall ? '1.5rem' : '1.8rem', 
                          sm: '2rem', 
                          md: '2.2rem',
                          lg: '2.5rem' 
                        }
                      }}
                    >
                      {loading ? (
                        <Skeleton sx={{ width: { xs: 60, sm: 80 }, mx: 'auto' }} />
                      ) : (
                        `${stat.number.toLocaleString()}${stat.number >= 1000 ? '+' : ''}`
                      )}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary', 
                        fontWeight: 500,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' },
                        lineHeight: 1.3,
                        px: { xs: 0.5, sm: 0 }
                      }}
                    >
                      {stat.label}
                    </Typography>
                  </Box>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Modern Dean's Message Section - Mobile Optimized */}
      <Box sx={{ bgcolor: 'white', py: { xs: 4, sm: 6, md: 8, lg: 10 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Grid container spacing={{ xs: 3, sm: 4, md: 6 }} alignItems="center">
              <Grid item xs={12} md={5}>
                <Box sx={{ position: 'relative' }}>
                  <Box
                    sx={{
                      width: { 
                        xs: isExtraSmall ? 150 : 180, 
                        sm: 220, 
                        md: 300, 
                        lg: 350 
                      },
                      height: { 
                        xs: isExtraSmall ? 150 : 180, 
                        sm: 220, 
                        md: 300, 
                        lg: 350 
                      },
                      mx: 'auto',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: { xs: -10, sm: -15, md: -20 },
                        left: { xs: -10, sm: -15, md: -20 },
                        right: { xs: 10, sm: 15, md: 20 },
                        bottom: { xs: 10, sm: 15, md: 20 },
                        background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
                        borderRadius: '50%',
                        opacity: 0.1
                      }
                    }}
                  >
                    <Box
                      component="img"
                      src="/images/dean.jpeg"
                      alt="Dean of School of Public Health"
                      sx={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        boxShadow: { 
                          xs: '0 10px 30px rgba(0,0,0,0.15)', 
                          md: '0 20px 60px rgba(0,0,0,0.15)' 
                        }
                      }}
                    />
                  </Box>
                  <Box sx={{ textAlign: 'center', mt: { xs: 2, sm: 3 } }}>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#0a4f3c',
                        fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.4rem', lg: '1.5rem' }
                      }}
                    >
                      Prof. Frank Baiden
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      color: 'text.secondary',
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }}>
                      Dean, School of Public Health
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={7}>
                <Typography
                  variant="overline"
                  sx={{
                    color: '#2a9d7f',
                    fontWeight: 600,
                    letterSpacing: 2,
                    mb: 2,
                    display: 'block',
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' },
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  MESSAGE FROM THE DEAN
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    color: '#0a4f3c',
                    mb: 3,
                    fontSize: { 
                      xs: isExtraSmall ? '1.25rem' : '1.5rem', 
                      sm: '1.75rem', 
                      md: '2.25rem', 
                      lg: '2.5rem' 
                    },
                    textAlign: { xs: 'center', md: 'left' },
                    lineHeight: 1.2
                  }}
                >
                  Building a Healthier Future Together
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.8,
                    mb: 3,
                    fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  Welcome to our School of Public Health, where innovation meets compassion. 
                  We are dedicated to training the next generation of public health leaders 
                  who will tackle the world's most pressing health challenges with evidence-based 
                  solutions and unwavering commitment to equity.
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.8,
                    mb: 4,
                    fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
                    display: { xs: 'none', sm: 'block' },
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  Our interdisciplinary approach, cutting-edge research facilities, and global 
                  partnerships position us at the forefront of public health education and practice. 
                  Join us in our mission to create healthier, more equitable communities worldwide.
                </Typography>
                <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                  <Button
                    variant="contained"
                    size={isMobile ? "medium" : "large"}
                    endIcon={<ArrowIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                    component="a"
                    href="https://uhas.edu.gh/uhas/"
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth={isMobile}
                    sx={{
                      bgcolor: '#0a4f3c',
                      px: { xs: 3, sm: 4, md: 5 },
                      py: { xs: 1.25, sm: 1.5 },
                      borderRadius: 3,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', sm: '1rem' },
                      boxShadow: 'none',
                      maxWidth: { xs: '100%', sm: 280 },
                      '&:hover': {
                        bgcolor: '#063d2f',
                        boxShadow: '0 10px 30px rgba(10,79,60,0.2)'
                      },
                      '&:active': {
                        transform: 'scale(0.98)'
                      }
                    }}
                  >
                    Learn More About Us
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* Featured Research Section - Mobile Optimized */}
      <Box sx={{ bgcolor: '#f8f9fa', py: { xs: 4, sm: 6, md: 8, lg: 10 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 8 } }}>
            <Typography
              variant="overline"
              sx={{
                color: '#2a9d7f',
                fontWeight: 600,
                letterSpacing: 2,
                mb: 2,
                display: 'block',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' }
              }}
            >
              RESEARCH EXCELLENCE
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: '#0a4f3c',
                mb: 2,
                fontSize: { 
                  xs: isExtraSmall ? '1.5rem' : '1.75rem', 
                  sm: '2rem', 
                  md: '2.5rem', 
                  lg: '3rem' 
                },
                lineHeight: 1.2,
                px: { xs: 1, sm: 0 }
              }}
            >
              Featured Research Projects
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                maxWidth: { xs: '100%', sm: 500, md: 600 },
                mx: 'auto',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                px: { xs: 1, sm: 0 }
              }}
            >
              Discover groundbreaking research that's shaping the future of public health
            </Typography>
          </Box>

          {loading ? (
            <Grid container spacing={{ xs: 1.5, sm: 2, md: 3, lg: 4 }}>
              {[1, 2, 3].map((item) => (
                <Grid item xs={12} sm={6} lg={4} key={item}>
                  <Skeleton 
                    variant="rectangular" 
                    sx={{ 
                      height: { xs: 300, sm: 350, md: 400 },
                      borderRadius: { xs: 3, md: 4 } 
                    }} 
                  />
                </Grid>
              ))}
            </Grid>
          ) : featuredProjects.length > 0 ? (
            <Grid container spacing={{ xs: 1.5, sm: 2, md: 3, lg: 4 }}>
              {featuredProjects.slice(0, isMobile ? 3 : 6).map((project, index) => (
                <Grid item xs={12} sm={6} lg={4} key={project.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Card
                      elevation={0}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: { xs: 3, md: 4 },
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,0.08)',
                        position: 'relative',
                        '&:hover': {
                          transform: { xs: 'none', md: 'translateY(-8px)' },
                          boxShadow: { xs: '0 4px 20px rgba(0,0,0,0.08)', md: '0 20px 40px rgba(0,0,0,0.1)' },
                          '& .project-image': {
                            transform: { xs: 'none', md: 'scale(1.05)' },
                            '& .school-logo': {
                              transform: { xs: 'none', md: 'rotate(360deg) scale(1.1)' }
                            }
                          }
                        },
                        '&:active': {
                          transform: { xs: 'scale(0.98)', md: 'translateY(-8px) scale(0.98)' }
                        }
                      }}
                      onClick={() => navigate(`/projects/${project.slug}`)}
                    >
                      {/* REDESIGNED Project Image/Gradient Header with School Logo */}
                      <Box
                        className="project-image"
                        sx={{
                          height: { xs: 120, sm: 150, md: 180, lg: 200 },
                          background: `linear-gradient(135deg, ${
                            ['#0a4f3c', '#1a7a5e', '#2a9d7f'][index % 3]
                          } 0%, ${
                            ['#1a7a5e', '#2a9d7f', '#3ac0a0'][index % 3]
                          } 100%)`,
                          position: 'relative',
                          transition: 'transform 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)',
                            opacity: 0.5
                          }
                        }}
                      >
                        {/* School Logo Container */}
                        <Box
                          className="school-logo"
                          sx={{
                            width: { xs: 60, sm: 70, md: 80, lg: 90 },
                            height: { xs: 60, sm: 70, md: 80, lg: 90 },
                            borderRadius: '50%',
                            bgcolor: 'rgba(255,255,255,0.95)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 1,
                            transition: 'transform 0.6s ease',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                            border: '3px solid rgba(255,255,255,0.3)',
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              inset: -8,
                              borderRadius: '50%',
                              border: '2px solid rgba(255,255,255,0.2)',
                              animation: 'pulse 2s ease-in-out infinite'
                            }
                          }}
                        >
                          <Box
                            component="img"
                            src="/images/logo.jpeg"
                            alt="School of Public Health Logo"
                            sx={{
                              width: { xs: '70%', sm: '75%', md: '80%' },
                              height: { xs: '70%', sm: '75%', md: '80%' },
                              objectFit: 'contain',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                            }}
                            onError={(e) => {
                              // Fallback to SchoolIcon if logo fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <svg width="40" height="40" viewBox="0 0 24 24" fill="#0a4f3c">
                                    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                                  </svg>
                                `;
                              }
                            }}
                          />
                        </Box>

                        {/* Decorative Elements */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: { xs: -20, sm: -30, md: -40 },
                            left: { xs: -20, sm: -30, md: -40 },
                            width: { xs: 60, sm: 80, md: 100 },
                            height: { xs: 60, sm: 80, md: 100 },
                            borderRadius: '50%',
                            bgcolor: 'rgba(255,255,255,0.1)',
                            filter: 'blur(20px)'
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: { xs: -20, sm: -30, md: -40 },
                            right: { xs: -20, sm: -30, md: -40 },
                            width: { xs: 80, sm: 100, md: 120 },
                            height: { xs: 80, sm: 100, md: 120 },
                            borderRadius: '50%',
                            bgcolor: 'rgba(0,0,0,0.1)',
                            filter: 'blur(25px)'
                          }}
                        />

                        {/* Research Area Badge */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: { xs: 8, sm: 12, md: 16 },
                            right: { xs: 8, sm: 12, md: 16 },
                            bgcolor: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: 2,
                            px: { xs: 1, sm: 1.5, md: 2 },
                            py: { xs: 0.25, sm: 0.5 },
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        >
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontWeight: 600, 
                              color: '#0a4f3c',
                              fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                              letterSpacing: 0.5
                            }}
                          >
                            {project.research_area || 'Research'}
                          </Typography>
                        </Box>

                        {/* Animated Pulse Effect */}
                        <style>
                          {`
                            @keyframes pulse {
                              0% {
                                transform: scale(1);
                                opacity: 0.5;
                              }
                              50% {
                                transform: scale(1.15);
                                opacity: 0.3;
                              }
                              100% {
                                transform: scale(1);
                                opacity: 0.5;
                              }
                            }
                          `}
                        </style>
                      </Box>

                      <CardContent sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            color: '#0a4f3c',
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem', lg: '1.25rem' },
                            lineHeight: 1.3
                          }}
                        >
                          {project.title}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            mb: { xs: 2, sm: 3 },
                            display: '-webkit-box',
                            WebkitLineClamp: { xs: 2, sm: 3 },
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.6,
                            fontSize: { xs: '0.8rem', sm: '0.875rem' }
                          }}
                        >
                          {project.abstract || 'No abstract available'}
                        </Typography>

                        <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
                          {project.degree_type && (
                            <Chip
                              label={project.degree_type}
                              size="small"
                              sx={{
                                mr: 1,
                                bgcolor: 'rgba(42,157,127,0.1)',
                                color: '#2a9d7f',
                                fontWeight: 600,
                                border: 'none',
                                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                                height: { xs: 20, sm: 24 }
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              flex: 1,
                              mr: 1
                            }}
                          >
                            {project.author_name}{project.institution ? ` • ${project.institution}` : ''}
                          </Typography>
                        </Box>
                      </CardContent>

                      <CardActions sx={{ 
                        p: { xs: 1.5, sm: 2, md: 3 }, 
                        pt: 0, 
                        borderTop: '1px solid rgba(0,0,0,0.08)',
                        minHeight: { xs: 50, sm: 60 }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 }, width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ViewIcon sx={{ fontSize: { xs: 14, sm: 16, md: 18 }, color: 'text.secondary' }} />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'text.secondary',
                                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' }
                              }}
                            >
                              {project.view_count || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <DownloadIcon sx={{ fontSize: { xs: 14, sm: 16, md: 18 }, color: 'text.secondary' }} />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'text.secondary',
                                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' }
                              }}
                            >
                              {project.download_count || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ flexGrow: 1 }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#2a9d7f',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' }
                            }}
                          >
                            {isMobile ? 'View' : 'View Details'}
                            <ArrowIcon sx={{ fontSize: { xs: 12, sm: 14, md: 16 } }} />
                          </Typography>
                        </Box>
                      </CardActions>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ textAlign: 'center', py: { xs: 3, sm: 4, md: 6, lg: 8 } }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
                No featured projects available
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Research projects will appear here once they are published
              </Typography>
            </Box>
          )}

          <Box sx={{ textAlign: 'center', mt: { xs: 4, md: 6 } }}>
            <Button
              onClick={() => navigate('/projects')}
              variant="outlined"
              size={isMobile ? "medium" : "large"}
              endIcon={<ArrowIcon />}
              fullWidth={isMobile}
              sx={{
                px: { xs: 3, sm: 4, md: 5 },
                py: 1.5,
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                borderColor: '#0a4f3c',
                color: '#0a4f3c',
                borderWidth: 2,
                maxWidth: { xs: '100%', sm: 300 },
                '&:hover': {
                  borderWidth: 2,
                  borderColor: '#063d2f',
                  bgcolor: 'rgba(10,79,60,0.04)'
                },
                '&:active': {
                  transform: 'scale(0.98)'
                }
              }}
            >
              Explore All Research
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Modern Features Grid - Mobile Optimized */}
      <Box sx={{ bgcolor: 'white', py: { xs: 4, sm: 6, md: 8, lg: 10 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 8 } }}>
            <Typography
              variant="overline"
              sx={{
                color: '#2a9d7f',
                fontWeight: 600,
                letterSpacing: 2,
                mb: 2,
                display: 'block',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' }
              }}
            >
              WHY CHOOSE US
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: '#0a4f3c',
                mb: 2,
                fontSize: { 
                  xs: isExtraSmall ? '1.5rem' : '1.75rem', 
                  sm: '2rem', 
                  md: '2.5rem', 
                  lg: '3rem' 
                },
                lineHeight: 1.2,
                px: { xs: 1, sm: 0 }
              }}
            >
              Excellence in Public Health Education
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                maxWidth: { xs: '100%', sm: 500, md: 600 },
                mx: 'auto',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                px: { xs: 1, sm: 0 }
              }}
            >
              Our comprehensive approach combines cutting-edge research, practical experience, 
              and global perspectives
            </Typography>
          </Box>

          <Grid container spacing={{ xs: 1.5, sm: 2, md: 3, lg: 4 }}>
            {[
              {
                icon: PublicIcon,
                title: 'Global Impact',
                description: 'Our research reaches communities across all regions, addressing health challenges at local and global scales.',
                color: '#0a4f3c'
              },
              {
                icon: InnovationIcon,
                title: 'Innovation Hub',
                description: 'State-of-the-art facilities and interdisciplinary collaboration foster breakthrough discoveries in public health.',
                color: '#1a7a5e'
              },
              {
                icon: CommunityIcon,
                title: 'Community Partnership',
                description: 'Deep engagement with communities ensures our work addresses real-world needs and creates lasting impact.',
                color: '#2a9d7f'
              },
              {
                icon: HeartIcon,
                title: 'Health Equity',
                description: 'Committed to eliminating health disparities and ensuring equitable access to health resources for all populations.',
                color: '#0a4f3c'
              },
              {
                icon: ResearchIcon,
                title: 'Research Excellence',
                description: 'Leading groundbreaking studies that shape health policy.',
                color: '#1a7a5e'
              },
              {
                icon: AssessmentIcon, 
                title: 'Data-Driven Solutions',
                description: 'Using advanced analytics and evidence-based approaches to solve complex health challenges effectively.',
                color: '#2a9d7f'
              }
    
              
            ].slice(0, isMobile ? 4 : 6).map((feature, index) => (
              <Grid item xs={12} sm={6} lg={4} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Box
                    sx={{
                      p: { xs: 2, sm: 3, md: 4 },
                      height: '100%',
                      borderRadius: { xs: 3, md: 4 },
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      minHeight: { xs: 140, sm: 160, md: 180 },
                      '&:hover': {
                        bgcolor: '#f8f9fa',
                        transform: { xs: 'none', md: 'translateY(-4px)' },
                        '& .feature-icon': {
                          transform: { xs: 'none', md: 'scale(1.1) rotate(5deg)' },
                          bgcolor: feature.color
                        }
                      },
                      '&:active': {
                        transform: { xs: 'scale(0.98)', md: 'translateY(-4px) scale(0.98)' }
                      }
                    }}
                  >
                    <Box
                      className="feature-icon"
                      sx={{
                        width: { xs: 48, sm: 56, md: 64, lg: 70 },
                        height: { xs: 48, sm: 56, md: 64, lg: 70 },
                        borderRadius: 3,
                        bgcolor: '#f0f7f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: { xs: 2, sm: 2.5, md: 3 },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <feature.icon sx={{ 
                        fontSize: { xs: 24, sm: 28, md: 30, lg: 32 }, 
                        color: feature.color 
                      }} />
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: '#0a4f3c',
                        mb: { xs: 1.5, sm: 2 },
                        fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem', lg: '1.25rem' },
                        lineHeight: 1.3,
                        textAlign: 'center'
                      }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        lineHeight: 1.7,
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        textAlign: 'center'
                      }}
                    >
                      {feature.description}
                    </Typography>
                  </Box>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

    </Box>
  );
};

export default HomePage;
