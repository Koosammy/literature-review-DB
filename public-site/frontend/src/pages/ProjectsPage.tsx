import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Pagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  InputAdornment,
  CircularProgress,
  Breadcrumbs,
  Link,
  Avatar,
  Fade,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  Collapse,
  SwipeableDrawer,
  Skeleton,
  Zoom
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  ArrowForward as ArrowIcon,
  FilterList as FilterIcon,
  LocalHospital as HealthIcon,
  Science as ResearchIcon,
  School as SchoolIcon,
  Public as PublicIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TouchApp as TouchIcon,
  Tune as TuneIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { ProjectSummary, SearchFilters, SearchResponse } from '../types';
import SEOHead from '../components/SEOHead';

// FilterForm Component - Outside of ProjectsPage
const FilterForm: React.FC<{
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  handleSearch: () => void;
  clearFilters: () => void;
  researchAreas: string[];
  institutions: string[];
  degreeTypes: string[];
  academicYears: string[];
  isMobile: boolean;
  isTablet: boolean;
  isExtraSmall: boolean;
}> = ({ 
  filters, 
  setFilters, 
  handleSearch, 
  clearFilters, 
  researchAreas, 
  institutions, 
  degreeTypes, 
  academicYears,
  isMobile,
  isTablet,
  isExtraSmall
}) => {
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    advanced: !isMobile
});
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <Box>
      <Grid container spacing={{ xs: 1, sm: 1.5, md: 2 }}>
        {/* Search Query */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Search Research Projects"
            placeholder={
              isExtraSmall 
                ? "Search..." 
                : isMobile 
                  ? "Keywords, author..." 
                  : "Keywords, author, health topics..."
            }
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            size={isExtraSmall ? "small" : isMobile ? "medium" : "medium"}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ 
                    color: '#2e7d32',
                    fontSize: { xs: 18, sm: 20, md: 24 }
                  }} />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: { xs: 2, sm: 3 },
                '& fieldset': { 
                  borderColor: '#c8e6c9', 
                  borderWidth: { xs: 1, sm: 1.5, md: 2 }
                },
                '&:hover fieldset': { borderColor: '#2e7d32' },
                '&.Mui-focused fieldset': { borderColor: '#1b5e20' }
              },
              '& .MuiInputLabel-root': { 
                color: '#2e7d32',
                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem' }
              },
              '& .MuiInputLabel-root.Mui-focused': { color: '#1b5e20' }
            }}
          />
        </Grid>

        {/* Research Area - Always visible */}
        <Grid item xs={12}>
          <FormControl fullWidth size={isExtraSmall ? "small" : isMobile ? "medium" : "medium"}>
            <InputLabel sx={{ 
              color: '#2e7d32', 
              '&.Mui-focused': { color: '#1b5e20' },
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem' }
            }}>
              Public Health Area
            </InputLabel>
            <Select
              value={filters.research_area}
              label="Public Health Area"
              onChange={(e) => setFilters({ ...filters, research_area: e.target.value })}
              sx={{
                borderRadius: { xs: 2, sm: 3 },
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#c8e6c9', 
                  borderWidth: { xs: 1, sm: 1.5, md: 2 }
                },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1b5e20' }
              }}
            >
              <MenuItem value="">All Health Areas</MenuItem>
              {researchAreas.map((area) => (
                <MenuItem key={area} value={area}>{area}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Advanced Filters Toggle for Mobile */}
        {isMobile && (
          <Grid item xs={12}>
            <Button
              fullWidth
              onClick={() => toggleSection('advanced')}
              endIcon={expandedSections.advanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{
                justifyContent: 'space-between',
                color: '#2e7d32',
                textTransform: 'none',
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                py: { xs: 0.75, sm: 1 },
                borderRadius: 2,
                border: '1px solid #e8f5e9',
                '&:hover': {
                  bgcolor: '#f5f5f5'
                }
              }}
            >
              {isExtraSmall ? 'More Filters' : 'Advanced Filters'}
            </Button>
          </Grid>
        )}

        {/* Advanced Filters */}
        <Grid item xs={12}>
          <Collapse in={expandedSections.advanced || !isMobile}>
            <Grid container spacing={{ xs: 1, sm: 1.5, md: 2 }}>
              {/* Degree Type */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size={isExtraSmall ? "small" : isMobile ? "medium" : "medium"}>
                  <InputLabel sx={{ 
                    color: '#2e7d32', 
                    '&.Mui-focused': { color: '#1b5e20' },
                    fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem' }
                  }}>
                    Degree Level
                  </InputLabel>
                  <Select
                    value={filters.degree_type}
                    label="Degree Level"
                    onChange={(e) => setFilters({ ...filters, degree_type: e.target.value })}
                    sx={{
                      borderRadius: { xs: 2, sm: 3 },
                      '& .MuiOutlinedInput-notchedOutline': { 
                        borderColor: '#c8e6c9', 
                        borderWidth: { xs: 1, sm: 1.5, md: 2 }
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1b5e20' }
                    }}
                  >
                    <MenuItem value="">All Levels</MenuItem>
                    {degreeTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Institution */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size={isExtraSmall ? "small" : isMobile ? "medium" : "medium"}>
                  <InputLabel sx={{ 
                    color: '#2e7d32', 
                    '&.Mui-focused': { color: '#1b5e20' },
                    fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem' }
                  }}>
                    Institution
                  </InputLabel>
                  <Select
                    value={filters.institution}
                    label="Institution"
                    onChange={(e) => setFilters({ ...filters, institution: e.target.value })}
                    sx={{
                      borderRadius: { xs: 2, sm: 3 },
                      '& .MuiOutlinedInput-notchedOutline': { 
                        borderColor: '#c8e6c9', 
                        borderWidth: { xs: 1, sm: 1.5, md: 2 }
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1b5e20' }
                    }}
                  >
                    <MenuItem value="">All Institutions</MenuItem>
                    {institutions.map((institution) => (
                      <MenuItem key={institution} value={institution}>{institution}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Academic Year */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size={isExtraSmall ? "small" : isMobile ? "medium" : "medium"}>
                  <InputLabel sx={{ 
                    color: '#2e7d32', 
                    '&.Mui-focused': { color: '#1b5e20' },
                    fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem' }
                  }}>
                    Academic Year
                  </InputLabel>
                  <Select
                    value={filters.academic_year}
                    label="Academic Year"
                    onChange={(e) => setFilters({ ...filters, academic_year: e.target.value })}
                    sx={{
                      borderRadius: { xs: 2, sm: 3 },
                      '& .MuiOutlinedInput-notchedOutline': { 
                        borderColor: '#c8e6c9', 
                        borderWidth: { xs: 1, sm: 1.5, md: 2 }
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1b5e20' }
                    }}
                  >
                    <MenuItem value="">All Years</MenuItem>
                    {academicYears.map((year) => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Collapse>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 1, sm: 1.5, md: 2 }, 
            flexDirection: isMobile ? 'column' : 'row' 
          }}>
            <Button
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              size={isExtraSmall ? "medium" : isMobile ? "large" : "large"}
              fullWidth={isMobile}
              sx={{
                bgcolor: '#1b5e20',
                color: 'white',
                px: { xs: 2, sm: 3, md: 4 },
                py: { xs: 1, sm: 1.25, md: 1.5 },
                borderRadius: { xs: 2, sm: 3 },
                textTransform: 'none',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(27, 94, 32, 0.3)',
                '&:hover': {
                  bgcolor: '#0d4715',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(27, 94, 32, 0.4)'
                },
                '&:active': {
                  transform: 'scale(0.98)'
                }
              }}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              onClick={clearFilters}
              size={isExtraSmall ? "medium" : isMobile ? "large" : "large"}
              fullWidth={isMobile}
              sx={{
                borderColor: '#2e7d32',
                color: '#2e7d32',
                px: { xs: 2, sm: 3, md: 4 },
                py: { xs: 1, sm: 1.25, md: 1.5 },
                borderRadius: { xs: 2, sm: 3 },
                textTransform: 'none',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
                fontWeight: 'bold',
                borderWidth: { xs: 1, sm: 1.5, md: 2 },
                '&:hover': {
                  borderColor: '#1b5e20',
                  bgcolor: '#e8f5e9',
                  borderWidth: { xs: 1, sm: 1.5, md: 2 }
                },
                '&:active': {
                  transform: 'scale(0.98)'
                }
              }}
            >
              {isExtraSmall ? 'Clear' : 'Clear Filters'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// Main ProjectsPage Component
const ProjectsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isExtraSmall = useMediaQuery(theme.breakpoints.down(400));
  
  const [searchResponse, setSearchResponse] = useState<SearchResponse>({
    projects: [],
    total: 0,
    page: 1,
    per_page: 12,
    total_pages: 0,
    filters: {}
  });
  const [loading, setLoading] = useState(true);
  const [researchAreas, setResearchAreas] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  
  // Form state
  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get('search') || '',
    research_area: searchParams.get('research_area') || '',
    degree_type: searchParams.get('degree_type') || '',
    institution: searchParams.get('institution') || '',
    academic_year: searchParams.get('academic_year') || ''
  });

  const degreeTypes = ["Bachelor's", "Master's", "PhD", "Diploma", "Certificate"];
  const academicYears = ["2024-2025", "2023-2024", "2022-2023", "2021-2022", "2020-2021"];

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartY) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    
    // Pull to refresh gesture
    if (diff < -100 && window.scrollY === 0) {
      searchProjects(1);
    }
    
    setTouchStartY(null);
  };
  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1');
    searchProjects(page);
  }, [searchParams]);

  const loadFilterOptions = async () => {
    try {
      const [areasData, institutionsData] = await Promise.all([
        apiService.getResearchAreas(),
        apiService.getInstitutions()
      ]);
      setResearchAreas(areasData);
      setInstitutions(institutionsData);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const searchProjects = async (page: number = 1) => {
    setLoading(true);
    try {
      const currentFilters = {
        query: searchParams.get('search') || '',
        research_area: searchParams.get('research_area') || '',
        degree_type: searchParams.get('degree_type') || '',
        institution: searchParams.get('institution') || '',
        academic_year: searchParams.get('academic_year') || ''
      };
      
      const response = await apiService.searchProjects(currentFilters, page);
      setSearchResponse(response);
    } catch (error) {
      console.error('Failed to search projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    
    if (filters.query) params.set('search', filters.query);
    if (filters.research_area) params.set('research_area', filters.research_area);
    if (filters.degree_type) params.set('degree_type', filters.degree_type);
    if (filters.institution) params.set('institution', filters.institution);
    if (filters.academic_year) params.set('academic_year', filters.academic_year);
    
    params.set('page', '1');
    setSearchParams(params);
    setMobileFilterOpen(false);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      research_area: '',
      degree_type: '',
      institution: '',
      academic_year: ''
    });
    setSearchParams(new URLSearchParams());
    setMobileFilterOpen(false);
  };

  // Get search query for dynamic SEO
  const searchQuery = searchParams.get('search');

  return (
    <Box 
      sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* SEO Head */}
      {searchQuery ? (
        <SEOHead 
          title={`Public Health Research: "${searchQuery}" - School of Public Health`}
          description={`Discover public health research projects related to "${searchQuery}". Explore evidence-based studies, theses, and dissertations advancing health equity and population health.`}
          keywords={`${searchQuery}, public health research, health equity, population health, epidemiology, health policy`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
        />
      ) : (
        <SEOHead 
          title="Public Health Research Database - School of Public Health"
          description="Explore comprehensive public health research projects, theses, and dissertations. Discover evidence-based studies advancing health equity, population health, and global health outcomes."
          keywords="public health research, health equity, population health, epidemiology, global health, community health, health policy, evidence-based practice"
          url={typeof window !== 'undefined' ? window.location.href : ''}
        />
      )}

      {/* Header - REDESIGNED FOR MOBILE */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #0d4715 0%, #1b5e20 50%, #2e7d32 100%)',
        color: 'white', 
        py: { xs: 3, sm: 3, md: 4, lg: 6 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          zIndex: 1
        }
      }}>
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
          <Breadcrumbs 
            sx={{ 
              mb: { xs: 1.5, sm: 2 }, 
              '& .MuiBreadcrumbs-separator': { color: '#c8e6c9' },
              '& a, & p': { 
                color: '#e8f5e9', 
                fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem', lg: '1rem' } 
              }
            }}
          >
            <Link 
              color="inherit" 
              onClick={() => navigate('/')} 
              sx={{ 
                cursor: 'pointer',
                textDecoration: 'none',
                '&:hover': { color: 'white' }
              }}
            >
              Home
            </Link>
            <Typography color="inherit" sx={{ fontWeight: 600 }}>
              Research Projects
            </Typography>
          </Breadcrumbs>
          
          {/* Mobile Layout with Image */}
          {(isMobile || isTablet) ? (
            <Box>
              {/* Mobile Header with integrated image */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: { xs: 2, sm: 2.5 }
              }}>
                {/* Circular Image Container for Mobile */}
                <Box
                  sx={{
                    width: { xs: 100, sm: 120, md: 140 },
                    height: { xs: 100, sm: 120, md: 140 },
                    borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'white',
                    mx: 'auto',
                    mb: 1
                  }}
                >
                  <img
                    src="/images/student-research.jpeg" 
                    alt="Public Health Research"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      // Fallback if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.style.background = 'rgba(255,255,255,0.2)';
                        parent.style.backdropFilter = 'blur(10px)';
                        parent.innerHTML = `
                          <div style="
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                          ">
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          </div>
                        `;
                      }
                    }}
                  />
                </Box>

                {/* Title and Description */}
                <Box>
                  <Typography 
                    variant="h2" 
                    component="h1" 
                    gutterBottom 
                    sx={{ 
                      fontWeight: 'bold',
                      textShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      fontSize: { 
                        xs: isExtraSmall ? '1.5rem' : '1.75rem', 
                        sm: '2rem', 
                        md: '2.5rem'
                      },
                      lineHeight: 1.2,
                      mb: { xs: 1, sm: 1.5 }
                    }}
                  >
                    Public Health Research
                  </Typography>
                  
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      opacity: 0.95,
                      textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      lineHeight: 1.4,
                      fontSize: { 
                        xs: isExtraSmall ? '0.85rem' : '0.95rem', 
                        sm: '1.05rem', 
                        md: '1.15rem'
                      },
                      px: { xs: 2, sm: 3 },
                      maxWidth: { xs: '100%', sm: '500px', md: '600px' },
                      mx: 'auto'
                    }}
                  >
                    Discover evidence-based research advancing health equity and improving population health outcomes worldwide
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            // Desktop Layout (original)
            <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} alignItems="center">
              {/* Left side content */}
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 3 }, mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      width: { xs: 40, sm: 50, md: 60, lg: 80 },
                      height: { xs: 40, sm: 50, md: 60, lg: 80 },
                      border: '3px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    <ResearchIcon sx={{ 
                      fontSize: { xs: 20, sm: 24, md: 30, lg: 40 }, 
                      color: 'white' 
                    }} />
                  </Avatar>
                  <Box>
                    <Typography 
                      variant="h2" 
                      component="h1" 
                      gutterBottom 
                      sx={{ 
                        fontWeight: 'bold',
                        textShadow: '0 4px 8px rgba(0,0,0,0.3)',
                        fontSize: { 
                          xs: isExtraSmall ? '1.25rem' : '1.5rem', 
                          sm: '1.75rem', 
                          md: '2.25rem', 
                          lg: '3rem' 
                        },
                        lineHeight: 1.2,
                        mb: { xs: 0.5, sm: 1 }
                      }}
                    >
                      Public Health Research
                    </Typography>
                  </Box>
                </Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    opacity: 0.95,
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    lineHeight: 1.4,
                    fontSize: { 
                      xs: isExtraSmall ? '0.8rem' : '0.875rem', 
                      sm: '1rem', 
                      md: '1.1rem', 
                      lg: '1.25rem' 
                    },
                    px: { xs: 0, sm: 0 },
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  Discover evidence-based research advancing health equity and improving population health outcomes worldwide
                </Typography>
              </Grid>

              {/* Right side - Desktop image */}
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Box
                    sx={{
                      width: { md: 150, lg: 200 },
                      height: { md: 150, lg: 200 },
                      borderRadius: '50%',
                      border: '4px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                      overflow: 'hidden',
                      position: 'relative',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src="/images/student-research.jpeg" 
                      alt="Public Health Student with Telescope"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        // Fallback if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.background = 'rgba(255,255,255,0.2)';
                          parent.style.backdropFilter = 'blur(10px)';
                          parent.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"><svg width="60" height="60" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>';
                        }
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ 
        py: { xs: 2, sm: 3, md: 4 },
        px: { xs: 1.5, sm: 2, md: 3 },
        pb: { xs: isMobile ? 10 : 2, sm: isMobile ? 12 : 3, md: 4 }
      }}>
        {/* Mobile Filter Button */}
        {isMobile && (
          <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<TuneIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />}
              onClick={() => setMobileFilterOpen(true)}
              sx={{
                bgcolor: '#1b5e20',
                color: 'white',
                py: { xs: 1, sm: 1.25 },
                borderRadius: 2,
                textTransform: 'none',
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(27, 94, 32, 0.3)',
                '&:hover': {
                  bgcolor: '#0d4715'
                },
                '&:active': {
                  transform: 'scale(0.98)'
                }
              }}
            >
              {isExtraSmall ? 'Search & Filter' : 'Search & Filter Projects'}
            </Button>
          </Box>
        )}

        {/* Desktop Search and Filters */}
        {!isMobile && (
          <Paper sx={{ 
            p: { sm: 2.5, md: 3, lg: 4 }, 
            mb: { sm: 3, md: 4 }, 
            borderRadius: { sm: 3, md: 4 },
            border: '2px solid #c8e6c9',
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)',
            boxShadow: '0 8px 32px rgba(27, 94, 32, 0.1)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { sm: 1.5, md: 2 }, mb: { sm: 2.5, md: 3 } }}>
              <Avatar sx={{ bgcolor: '#1b5e20', width: 40, height: 40 }}>
                <FilterIcon />
              </Avatar>
              <Typography variant="h5" sx={{ 
                color: '#1b5e20', 
                fontWeight: 'bold',
                fontSize: { sm: '1.1rem', md: '1.25rem', lg: '1.5rem' }
              }}>
                Search & Filter Research Projects
              </Typography>
            </Box>
            
            <FilterForm 
              filters={filters}
              setFilters={setFilters}
              handleSearch={handleSearch}
              clearFilters={clearFilters}
              researchAreas={researchAreas}
              institutions={institutions}
              degreeTypes={degreeTypes}
              academicYears={academicYears}
              isMobile={isMobile}
              isTablet={isTablet}
              isExtraSmall={isExtraSmall}
            />
          </Paper>
        )}

        {/* Mobile Filter Drawer */}
        <SwipeableDrawer
          anchor="bottom"
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          onOpen={() => setMobileFilterOpen(true)}
          disableSwipeToOpen={false}
          sx={{
            '& .MuiDrawer-paper': {
              borderTopLeftRadius: { xs: 12, sm: 16 },
              borderTopRightRadius: { xs: 12, sm: 16 },
              maxHeight: '90vh',
              pb: { xs: 1.5, sm: 2 }
            }
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            {/* Drag Handle */}
            <Box
              sx={{
                width: 40,
                height: 4,
                bgcolor: '#e0e0e0',
                borderRadius: 2,
                mx: 'auto',
                mb: 2
              }}
            />
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: { xs: 1.5, sm: 2 },
              pb: { xs: 1.5, sm: 2 },
              borderBottom: '1px solid #e0e0e0'
            }}>
              <Typography variant="h6" sx={{ 
                color: '#1b5e20', 
                fontWeight: 'bold', 
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}>
                Search & Filter
              </Typography>
              <IconButton 
                onClick={() => setMobileFilterOpen(false)} 
                size="small"
                sx={{
                  bgcolor: '#f5f5f5',
                  '&:hover': { bgcolor: '#e0e0e0' }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            
            <FilterForm 
              filters={filters}
              setFilters={setFilters}
              handleSearch={handleSearch}
              clearFilters={clearFilters}
              researchAreas={researchAreas}
              institutions={institutions}
              degreeTypes={degreeTypes}
              academicYears={academicYears}
              isMobile={isMobile}
              isTablet={isTablet}
              isExtraSmall={isExtraSmall}
            />
          </Box>
        </SwipeableDrawer>

        {/* Results Header */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          gap: { xs: 1, sm: 1.5, md: 2 },
          mb: { xs: 2, sm: 3, md: 4 },
          p: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
          bgcolor: 'rgba(27, 94, 32, 0.05)',
          borderRadius: { xs: 2, sm: 3 },
          border: '1px solid #c8e6c9'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
            <Avatar sx={{ 
              bgcolor: '#2e7d32', 
              width: { xs: 28, sm: 32, md: 36, lg: 40 }, 
              height: { xs: 28, sm: 32, md: 36, lg: 40 } 
            }}>
              <PublicIcon sx={{ fontSize: { xs: 16, sm: 18, md: 20, lg: 24 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  color: '#1b5e20', 
                  fontWeight: 'bold',
                  fontSize: { 
                    xs: isExtraSmall ? '0.8rem' : '0.875rem', 
                    sm: '1rem', 
                    md: '1.25rem', 
                    lg: '1.5rem' 
                  },
                  lineHeight: 1.2
                }}
              >
                {loading ? 'Searching Database...' : `${searchResponse.total} Research Projects Found`}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#2e7d32',
                  fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.8rem', lg: '0.875rem' },
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                Evidence-based studies advancing public health knowledge
              </Typography>
            </Box>
          </Box>
          {searchResponse.total > 0 && (
            <Chip
              label={`Page ${searchResponse.page} of ${searchResponse.total_pages}`}
              size="small"
              sx={{
                bgcolor: '#1b5e20',
                color: 'white',
                fontWeight: 'bold',
                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.8rem', lg: '0.875rem' },
                height: { xs: 20, sm: 24, md: 28 }
              }}
            />
          )}
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            py: { xs: 4, sm: 6, md: 8, lg: 12 },
            flexDirection: 'column',
            gap: { xs: 1.5, sm: 2, md: 3 }
          }}>
            <CircularProgress 
              sx={{ 
                color: '#1b5e20',
                width: { xs: 40, sm: 50, md: 60, lg: 80 },
                height: { xs: 40, sm: 50, md: 60, lg: 80 },
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }} 
            />
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#2e7d32', 
                fontWeight: 600,
                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem', lg: '1.25rem' },
                textAlign: 'center'
              }}
            >
              Searching Public Health Research Database...
            </Typography>
            {isMobile && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <TouchIcon sx={{ fontSize: 14 }} />
                Pull down to refresh
              </Typography>
            )}
          </Box>
        )}
        {/* Projects Grid */}
        {!loading && searchResponse.projects.length > 0 && (
          <>
            <Grid container spacing={{ xs: 1, sm: 1.5, md: 2, lg: 3 }}>
              {searchResponse.projects.map((project, index) => (
                <Grid item xs={12} sm={6} md={4} lg={4} key={project.id}>
                  <Zoom in timeout={300 + index * 50}>
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        borderRadius: { xs: 2, sm: 3, md: 4 },
                        border: '2px solid #c8e6c9',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f9fbe7 100%)',
                        boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          transform: { xs: 'none', sm: 'translateY(-4px)', md: 'translateY(-8px)' },
                          boxShadow: '0 16px 48px rgba(27, 94, 32, 0.2)',
                          border: '2px solid #2e7d32'
                        },
                        '&:active': {
                          transform: { xs: 'scale(0.98)', sm: 'translateY(-4px) scale(0.98)', md: 'translateY(-8px) scale(0.98)' }
                        }
                      }}
                      onClick={() => navigate(`/projects/${project.slug}`)}
                    >
                      {/* Touch Ripple Effect for Mobile */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'transparent',
                          zIndex: 1,
                          pointerEvents: 'none'
                        }}
                      />
                      
                      <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1.5, sm: 2 }, mb: 2 }}>
                          <Avatar
                            sx={{
                              bgcolor: '#1b5e20',
                              width: { xs: 28, sm: 32, md: 36, lg: 40 },
                              height: { xs: 28, sm: 32, md: 36, lg: 40 },
                              flexShrink: 0
                            }}
                          >
                            <HealthIcon sx={{ fontSize: { xs: 14, sm: 16, md: 18, lg: 20 } }} />
                          </Avatar>
                          <Typography 
                            variant="h6" 
                            component="h3" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: '#1b5e20',
                              display: '-webkit-box',
                              WebkitLineClamp: { xs: 2, sm: 2 },
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.3,
                              fontSize: { 
                                xs: isExtraSmall ? '0.8rem' : '0.875rem', 
                                sm: '0.95rem', 
                                md: '1.1rem', 
                                lg: '1.25rem' 
                              }
                            }}
                          >
                            {project.title}
                          </Typography>
                        </Box>
                        
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            mb: { xs: 1.5, sm: 2, md: 3 },
                            color: '#2e7d32',
                            display: '-webkit-box',
                            WebkitLineClamp: { xs: 2, sm: 3 },
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.6,
                            fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem', lg: '1rem' }
                          }}
                        >
                          {project.abstract || 'Research abstract not available. This study contributes to advancing public health knowledge and evidence-based practice.'}
                        </Typography>
                        
                        <Box sx={{ mb: { xs: 1.5, sm: 2, md: 3 } }}>
                          {project.research_area && (
                            <Chip 
                              label={project.research_area} 
                              size="small"
                              icon={<HealthIcon />}
                              sx={{
                                mr: 0.5, 
                                mb: 0.5,
                                bgcolor: '#1b5e20',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem', lg: '0.75rem' },
                                height: { xs: 20, sm: 24, md: 28 },
                                '& .MuiChip-icon': { 
                                  color: 'white',
                                  fontSize: { xs: 12, sm: 14, md: 16 }
                                }
                              }}
                            />
                          )}
                          {project.degree_type && (
                            <Chip 
                              label={project.degree_type} 
                              size="small"
                              icon={<SchoolIcon />}
                              sx={{
                                mr: 0.5, 
                                mb: 0.5,
                                bgcolor: '#2e7d32',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem', lg: '0.75rem' },
                                height: { xs: 20, sm: 24, md: 28 },
                                '& .MuiChip-icon': { 
                                  color: 'white',
                                  fontSize: { xs: 12, sm: 14, md: 16 }
                                }
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ 
                          p: { xs: 1, sm: 1.25, md: 1.5, lg: 2 }, 
                          bgcolor: 'rgba(27, 94, 32, 0.05)', 
                          borderRadius: { xs: 1.5, sm: 2 },
                          border: '1px solid #e8f5e9'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 } }}>
                            <PersonIcon sx={{ fontSize: { xs: 10, sm: 12, md: 14, lg: 16 }, color: '#2e7d32' }} />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: '#1b5e20', 
                                fontWeight: 600,
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.75rem', lg: '0.875rem' },
                                lineHeight: 1.2
                              }}
                            >
                              {project.author_name}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                            <SchoolIcon sx={{ fontSize: { xs: 10, sm: 12, md: 14, lg: 16 }, color: '#2e7d32' }} />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: '#2e7d32', 
                                fontWeight: 500,
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.75rem', lg: '0.875rem' },
                                lineHeight: 1.2,
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {project.institution}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                      
                      <CardActions sx={{ 
                        p: { xs: 1.25, sm: 1.5, md: 2, lg: 3 }, 
                        pt: 0, 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        minHeight: { xs: 40, sm: 48, md: 56 }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ViewIcon sx={{ fontSize: { xs: 10, sm: 12, md: 14, lg: 16 }, color: '#2e7d32' }} />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: '#2e7d32', 
                                fontWeight: 600,
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.75rem', lg: '0.875rem' }
                              }}
                            >
                              {project.view_count}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <DownloadIcon sx={{ fontSize: { xs: 10, sm: 12, md: 14, lg: 16 }, color: '#2e7d32' }} />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: '#2e7d32', 
                                fontWeight: 600,
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.75rem', lg: '0.875rem' }
                              }}
                            >
                              {project.download_count}
                            </Typography>
                          </Box>
                        </Box>
                        <Button
                          size="small"
                          endIcon={<ArrowIcon sx={{ fontSize: { xs: 12, sm: 14, md: 16 } }} />}
                          sx={{ 
                            textTransform: 'none',
                            color: '#1b5e20',
                            fontWeight: 'bold',
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem', lg: '1rem' },
                            px: { xs: 0.75, sm: 1, md: 1.5 },
                            py: { xs: 0.25, sm: 0.5, md: 0.75 },
                            borderRadius: { xs: 1.5, sm: 2 },
                            '&:hover': {
                              bgcolor: '#e8f5e9'
                            }
                          }}
                        >
                          {isExtraSmall ? 'View' : 'View'}
                        </Button>
                      </CardActions>
                    </Card>
                  </Zoom>
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            {searchResponse.total_pages > 1 && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mt: { xs: 2, sm: 3, md: 4, lg: 6 } 
              }}>
                <Paper sx={{ 
                  p: { xs: 0.5, sm: 0.75, md: 1, lg: 2 }, 
                  borderRadius: { xs: 2, sm: 3 },
                  border: '2px solid #c8e6c9',
                  boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)'
                }}>
                  <Pagination
                    count={searchResponse.total_pages}
                    page={searchResponse.page}
                    onChange={handlePageChange}
                    size={isExtraSmall ? "small" : isMobile ? "medium" : isTablet ? "medium" : "large"}
                    showFirstButton={!isMobile}
                    showLastButton={!isMobile}
                    siblingCount={isExtraSmall ? 0 : isMobile ? 0 : 1}
                    boundaryCount={isExtraSmall ? 1 : isMobile ? 1 : 2}
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: '#2e7d32',
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem', lg: '1rem' },
                        minWidth: { xs: 24, sm: 28, md: 32, lg: 40 },
                        height: { xs: 24, sm: 28, md: 32, lg: 40 },
                        '&:hover': {
                          bgcolor: '#e8f5e9'
                        },
                        '&.Mui-selected': {
                          bgcolor: '#1b5e20',
                          color: 'white',
                          '&:hover': {
                            bgcolor: '#0d4715'
                          }
                        }
                      }
                    }}
                  />
                </Paper>
              </Box>
            )}
          </>
        )}

        {/* No Results */}
        {!loading && searchResponse.projects.length === 0 && (
          <Paper sx={{ 
            p: { xs: 2, sm: 3, md: 4, lg: 6 }, 
            textAlign: 'center',
            borderRadius: { xs: 2, sm: 3, md: 4 },
            border: '2px solid #c8e6c9',
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)',
            boxShadow: '0 8px 32px rgba(27, 94, 32, 0.1)'
          }}>
            <Avatar
              sx={{
                bgcolor: '#2e7d32',
                width: { xs: 40, sm: 50, md: 60, lg: 80 },
                height: { xs: 40, sm: 50, md: 60, lg: 80 },
                mx: 'auto',
                mb: { xs: 2, sm: 3 }
              }}
            >
              <ResearchIcon sx={{ fontSize: { xs: 20, sm: 24, md: 30, lg: 40 } }} />
            </Avatar>
            <Typography 
              variant="h4" 
              gutterBottom 
              sx={{ 
                color: '#1b5e20', 
                fontWeight: 'bold',
                fontSize: { 
                  xs: isExtraSmall ? '1.1rem' : '1.25rem', 
                  sm: '1.4rem', 
                  md: '1.75rem', 
                  lg: '2.125rem' 
                }
              }}
            >
              No Research Projects Found
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#2e7d32', 
                mb: { xs: 3, sm: 4 }, 
                maxWidth: { xs: '100%', sm: '400px', md: '500px' }, 
                mx: 'auto',
                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem' },
                lineHeight: 1.6,
                px: { xs: 1, sm: 0 }
              }}
            >
              We couldn't find any public health research matching your criteria. 
              Try adjusting your search terms or explore our complete research database.
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: { xs: 1, sm: 1.5, md: 2 }, 
              justifyContent: 'center', 
              flexDirection: { xs: 'column', sm: 'row' },
              px: { xs: 1, sm: 0 }
            }}>
              <Button
                variant="contained"
                onClick={clearFilters}
                size={isExtraSmall ? "medium" : isMobile ? "large" : "large"}
                fullWidth={isMobile}
                sx={{
                  bgcolor: '#1b5e20',
                  color: 'white',
                  px: { xs: 2.5, sm: 3, md: 4 },
                  py: { xs: 1, sm: 1.5 },
                  borderRadius: { xs: 2, sm: 3 },
                  textTransform: 'none',
                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem', lg: '1.1rem' },
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: '#0d4715'
                  },
                  '&:active': {
                    transform: 'scale(0.98)'
                  }
                }}
              >
                Clear All Filters
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/')}
                size={isExtraSmall ? "medium" : isMobile ? "large" : "large"}
                fullWidth={isMobile}
                sx={{
                  borderColor: '#2e7d32',
                  color: '#2e7d32',
                  px: { xs: 2.5, sm: 3, md: 4 },
                  py: { xs: 1, sm: 1.5 },
                  borderRadius: { xs: 2, sm: 3 },
                  textTransform: 'none',
                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '1rem', lg: '1.1rem' },
                  fontWeight: 'bold',
                  borderWidth: { xs: 1.5, sm: 2 },
                  '&:hover': {
                    borderColor: '#1b5e20',
                    bgcolor: '#e8f5e9',
                    borderWidth: { xs: 1.5, sm: 2 }
                  },
                  '&:active': {
                    transform: 'scale(0.98)'
                  }
                }}
              >
                Back to Home
              </Button>
            </Box>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default ProjectsPage;
