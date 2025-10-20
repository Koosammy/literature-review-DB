import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Avatar,
  useTheme,
  useMediaQuery,
  ImageList,
  ImageListItem,
  IconButton,
  Dialog,
  DialogContent,
  Fade,
  Skeleton
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  LocalHospital as HealthIcon,
  Science as ResearchIcon,
  Public as PublicIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ZoomIn as ZoomInIcon,
  Collections as CollectionsIcon
} from '@mui/icons-material';

// Interfaces
interface ProjectImage {
  id: number;
  filename: string;
  content_type: string;
  image_size?: number;
  order_index: number;
  is_featured: boolean;
}

interface Project {
  id: number;
  title: string;
  slug: string;
  author_name: string;
  institution?: string;
  department?: string;
  supervisor?: string;
  abstract?: string;
  keywords?: string;
  research_area?: string;
  degree_type?: string;
  academic_year?: string;
  publication_date: string;
  document_filename?: string;
  document_size?: number;
  view_count: number;
  download_count: number;
  created_at?: string;
  updated_at?: string;
  featured_image_index?: number;
  image_records?: ProjectImage[];
}

// Helper function for image URLs
const getImageUrl = (projectId: number, imageId: number): string => {
  return `${process.env.REACT_APP_API_URL}/projects/${projectId}/images/${imageId}`;
};

// Enhanced Image Gallery Component
const ImageGallery: React.FC<{ 
  imageRecords: ProjectImage[];
  projectId: number;
  projectTitle: string;
}> = ({ imageRecords, projectId, projectTitle }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>({});
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);

  const sortedImages = [...imageRecords].sort((a, b) => a.order_index - b.order_index);

  const handleImageClick = (image: ProjectImage, index: number) => {
    setSelectedImage(image);
    setSelectedImageIndex(index);
  };

  const handleCloseImageDialog = () => {
    setSelectedImage(null);
    setSelectedImageIndex(null);
  };

  const handleImageError = (imageId: number) => {
    console.error(`Failed to load image with id: ${imageId}`);
    setImageErrors(prev => ({ ...prev, [imageId]: true }));
    setImageLoading(prev => ({ ...prev, [imageId]: false }));
  };

  const handleImageLoad = (imageId: number) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }));
  };

  const handlePrevious = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      const newIndex = selectedImageIndex - 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(sortedImages[newIndex]);
    }
  };

  const handleNext = () => {
    if (selectedImageIndex !== null && selectedImageIndex < sortedImages.length - 1) {
      const newIndex = selectedImageIndex + 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(sortedImages[newIndex]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      handleCloseImageDialog();
    }
  };

  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <>
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 3, sm: 4 }, 
          mb: 3, 
          borderRadius: 4,
          border: '2px solid #c8e6c9',
          boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar sx={{ bgcolor: '#2e7d32', width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 } }}>
            <CollectionsIcon sx={{ fontSize: { xs: 22, sm: 26 } }} />
          </Avatar>
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 700, color: '#1b5e20' }}>
              Figures & Images
            </Typography>
            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 500 }}>
              {sortedImages.length} {sortedImages.length === 1 ? 'Image' : 'Images'}
            </Typography>
          </Box>
        </Box>

        <ImageList 
          sx={{ 
            width: '100%', 
            minHeight: isMobile ? 300 : 450,
            overflow: 'hidden'
          }} 
          cols={cols} 
          gap={16}
          rowHeight={isMobile ? 200 : 220}
        >
          {sortedImages.map((image, index) => (
            <ImageListItem 
              key={image.id}
              sx={{ 
                cursor: 'pointer',
                position: 'relative',
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hoveredImage === image.id ? 'scale(1.03)' : 'scale(1)',
                zIndex: hoveredImage === image.id ? 2 : 1,
                boxShadow: hoveredImage === image.id 
                  ? '0 12px 40px rgba(27, 94, 32, 0.25)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.08)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6))',
                  opacity: hoveredImage === image.id ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  zIndex: 1,
                  pointerEvents: 'none'
                }
              }}
              onClick={() => handleImageClick(image, index)}
              onMouseEnter={() => setHoveredImage(image.id)}
              onMouseLeave={() => setHoveredImage(null)}
            >
              {imageErrors[image.id] ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f5f5f5',
                    color: '#999',
                    borderRadius: 2
                  }}
                >
                  <CollectionsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                  <Typography variant="caption">Image unavailable</Typography>
                </Box>
              ) : (
                <>
                  {imageLoading[image.id] !== false && (
                    <Skeleton 
                      variant="rectangular" 
                      width="100%" 
                      height="100%" 
                      animation="wave"
                      sx={{ position: 'absolute', borderRadius: 2 }}
                    />
                  )}
                  <img
                    src={getImageUrl(projectId, image.id)}
                    alt={image.filename}
                    loading="lazy"
                    style={{ 
                      height: '100%',
                      width: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform 0.3s ease'
                    }}
                    onError={() => handleImageError(image.id)}
                    onLoad={() => handleImageLoad(image.id)}
                  />
                  
                  {/* Featured Badge */}
                  {image.is_featured && (
                    <Chip
                      label="Featured"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        bgcolor: '#1976d2',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        zIndex: 2,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                    />
                  )}

                  {/* Hover Overlay */}
                  <Fade in={hoveredImage === image.id}>
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'white',
                          fontWeight: 600,
                          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                          fontSize: '0.75rem'
                        }}
                      >
                        Image {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.9)',
                          '&:hover': { bgcolor: 'white' },
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                      >
                        <ZoomInIcon sx={{ fontSize: 18, color: '#1b5e20' }} />
                      </IconButton>
                    </Box>
                  </Fade>
                </>
              )}
            </ImageListItem>
          ))}
        </ImageList>
      </Paper>

      {/* Enhanced Image Dialog */}
      <Dialog
        open={selectedImage !== null}
        onClose={handleCloseImageDialog}
        maxWidth="lg"
        fullWidth
        onKeyDown={handleKeyDown}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: '#000',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
          }
        }}
      >
        <DialogContent sx={{ position: 'relative', p: 0, bgcolor: '#000' }}>
          <IconButton
            onClick={handleCloseImageDialog}
            sx={{
              position: 'absolute',
              right: 16,
              top: 16,
              bgcolor: 'rgba(255,255,255,0.95)',
              zIndex: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              '&:hover': {
                bgcolor: 'white',
                transform: 'scale(1.1)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
          
          {/* Navigation Buttons */}
          {selectedImageIndex !== null && selectedImageIndex > 0 && (
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                color: '#1b5e20',
                zIndex: 3,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                '&:hover': {
                  bgcolor: 'white',
                  transform: 'translateY(-50%) scale(1.1)'
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}

          {selectedImageIndex !== null && selectedImageIndex < sortedImages.length - 1 && (
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                color: '#1b5e20',
                zIndex: 3,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                '&:hover': {
                  bgcolor: 'white',
                  transform: 'translateY(-50%) scale(1.1)'
                }
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          )}

          {selectedImage && (
            <>
              {imageErrors[selectedImage.id] ? (
                <Box
                  sx={{
                    width: '100%',
                    height: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#1a1a1a',
                    color: '#999'
                  }}
                >
                  <CollectionsIcon sx={{ fontSize: 80, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6">Image unavailable</Typography>
                </Box>
              ) : (
                <Box sx={{ position: 'relative', minHeight: 400 }}>
                  <img
                    src={getImageUrl(projectId, selectedImage.id)}
                    alt={selectedImage.filename}
                    style={{ 
                      width: '100%', 
                      height: 'auto',
                      display: 'block',
                      maxHeight: '85vh',
                      objectFit: 'contain'
                    }}
                    onError={() => handleImageError(selectedImage.id)}
                  />
                </Box>
              )}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  p: 3,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Chip
                  label={`${selectedImageIndex !== null ? selectedImageIndex + 1 : ''} of ${sortedImages.length}`}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.95)',
                    color: '#1b5e20',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    px: 2,
                    py: 2.5
                  }}
                />
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// Mock API Service (replace with your actual API service)
const apiService = {
  getProjectBySlug: async (slug: string) => {
    // This is a mock - replace with your actual API call
    return null;
  },
  downloadProject: async (slug: string) => {
    // This is a mock - replace with your actual API call
  }
};

const ProjectDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (slug) {
      loadProject(slug);
    }
  }, [slug]);

  const loadProject = async (projectSlug: string) => {
    try {
      const data = await apiService.getProjectBySlug(projectSlug);
      if (data) {
        setProject(data);
      } else {
        setError('Research project not found');
      }
    } catch (err) {
      console.error('Error loading project:', err);
      setError('Failed to load research project');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!project?.slug) return;
    
    setDownloading(true);
    try {
      await apiService.downloadProject(project.slug);
    } catch (err) {
      setError('Failed to download document');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewDocument = () => {
    if (!project) return;
    
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const cleanBaseUrl = API_BASE_URL.endsWith('/api') 
      ? API_BASE_URL.slice(0, -4) 
      : API_BASE_URL.replace(/\/$/, '');
    
    const viewUrl = `${cleanBaseUrl}/api/projects/${project.slug}/view-document`;
    window.open(viewUrl, '_blank');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: { xs: 300, sm: 400 },
          flexDirection: 'column',
          gap: 2
        }}>
          <CircularProgress 
            size={isMobile ? 40 : 60} 
            sx={{ color: '#1b5e20' }} 
          />
          <Typography variant={isMobile ? "body1" : "h6"} sx={{ color: '#2e7d32' }}>
            Loading Research Project...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !project) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Research project not found'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/projects')}
          variant="contained"
          sx={{ bgcolor: '#1b5e20' }}
        >
          Back to Research Projects
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/projects')}
          variant="outlined"
          sx={{ mb: 3, borderColor: '#1b5e20', color: '#1b5e20' }}
        >
          Back to Research Projects
        </Button>

        {/* Abstract Section - Fixed typo */}
        {project.abstract && (
          <Paper sx={{ p: 4, mb: 4, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ bgcolor: '#2e7d32' }}>
                <CategoryIcon />
              </Avatar>
              <Typography variant="h5" sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                Abstract
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ lineHeight: 1.8, color: '#2e7d32' }}>
              {project.abstract}
            </Typography>
          </Paper>
        )}

        {/* Image Gallery with Enhanced Design */}
        {project.image_records && project.image_records.length > 0 && (
          <ImageGallery 
            imageRecords={project.image_records} 
            projectId={project.id}
            projectTitle={project.title}
          />
        )}
      </Container>
    </Box>
  );
};

export default ProjectDetailPage;
