import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Backdrop,
  Fade,
  IconButton,
  Dialog,
  DialogContent,
  Skeleton,
  Zoom,
  alpha,
  Tooltip,
  Badge,
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
  Image as ImageIcon,
  ZoomIn as ZoomInIcon,
  Star as StarIcon,
  Collections as CollectionsIcon,
  Fullscreen as FullscreenIcon,
  GridView as GridViewIcon,
  ViewCarousel as ViewCarouselIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import DocumentViewer from '../components/DocumentViewer';
import SEOHead from '../components/SEOHead';
import StructuredData from '../components/StructuredData';

// Update the Project interface
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

// Add helper function for image URLs
const getImageUrl = (projectId: number, imageId: number): string => {
  return `${process.env.REACT_APP_API_URL}/projects/${projectId}/images/${imageId}`;
};

// Enhanced Modern Image Gallery Component
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
  const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid');
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Sort images by order_index, with featured images first
  const sortedImages = [...imageRecords].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return a.order_index - b.order_index;
  });

  // Grid columns based on screen size
  const getGridColumns = () => {
    if (isMobile) return 2;
    if (isTablet) return 3;
    return 4;
  };

  const handleImageClick = (image: ProjectImage, index: number) => {
    setSelectedImage(image);
    setSelectedImageIndex(index);
  };

  const handleCloseImageDialog = () => {
    setSelectedImage(null);
    setSelectedImageIndex(null);
    setIsFullscreen(false);
  };

  const handleImageError = (imageId: number) => {
    console.error(`Failed to load image with id: ${imageId}`);
    setImageErrors(prev => ({ ...prev, [imageId]: true }));
    setImageLoading(prev => ({ ...prev, [imageId]: false }));
  };

  const handleImageLoad = (imageId: number) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }));
  };

  const handlePrevious = useCallback(() => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      const newIndex = selectedImageIndex - 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(sortedImages[newIndex]);
    }
  }, [selectedImageIndex, sortedImages]);

  const handleNext = useCallback(() => {
    if (selectedImageIndex !== null && selectedImageIndex < sortedImages.length - 1) {
      const newIndex = selectedImageIndex + 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(sortedImages[newIndex]);
    }
  }, [selectedImageIndex, sortedImages]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent | KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      handleCloseImageDialog();
    }
  }, [handlePrevious, handleNext]);

  const handleDownloadImage = (image: ProjectImage) => {
    const link = document.createElement('a');
    link.href = getImageUrl(projectId, image.id);
    link.download = image.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Initialize loading states
  useEffect(() => {
    const loadingStates: { [key: number]: boolean } = {};
    sortedImages.forEach(img => {
      loadingStates[img.id] = true;
    });
    setImageLoading(loadingStates);
  }, [imageRecords]);

  // Carousel navigation
  const handleCarouselPrevious = () => {
    setCarouselIndex(prev => prev > 0 ? prev - 1 : sortedImages.length - 1);
  };

  const handleCarouselNext = () => {
    setCarouselIndex(prev => prev < sortedImages.length - 1 ? prev + 1 : 0);
  };

  return (
    <>
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 2, sm: 3, md: 4 },
          mb: 3,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha('#1b5e20', 0.02)} 0%, ${alpha('#2e7d32', 0.05)} 100%)`,
          border: `2px solid ${alpha('#2e7d32', 0.15)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #1b5e20, #2e7d32, #388e3c)',
          }
        }}
      >
        {/* Header Section */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: { xs: 40, sm: 48 },
              height: { xs: 40, sm: 48 },
              borderRadius: 2,
              background: 'linear-gradient(135deg, #1b5e20, #0d4715)',
              boxShadow: '0 4px 12px rgba(27, 94, 32, 0.3)',
            }}>
              <CollectionsIcon sx={{ color: 'white', fontSize: { xs: 20, sm: 24 } }} />
            </Box>
            <Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700,
                  color: '#1b5e20',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  letterSpacing: '-0.02em'
                }}
              >
                Figures & Images
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#2e7d32',
                  mt: 0.5,
                  fontWeight: 500
                }}
              >
                {sortedImages.length} {sortedImages.length === 1 ? 'image' : 'images'} available
              </Typography>
            </Box>
          </Box>

          {/* View Mode Toggle */}
          <Box sx={{ display: 'flex', gap: 1, bgcolor: alpha('#1b5e20', 0.05), borderRadius: 2, p: 0.5 }}>
            <Tooltip title="Grid View">
              <IconButton
                onClick={() => setViewMode('grid')}
                sx={{
                  bgcolor: viewMode === 'grid' ? '#1b5e20' : 'transparent',
                  color: viewMode === 'grid' ? 'white' : '#2e7d32',
                  borderRadius: 1.5,
                  '&:hover': {
                    bgcolor: viewMode === 'grid' 
                      ? '#0d4715' 
                      : alpha('#1b5e20', 0.1)
                  }
                }}
              >
                <GridViewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Carousel View">
              <IconButton
                onClick={() => setViewMode('carousel')}
                sx={{
                  bgcolor: viewMode === 'carousel' ? '#1b5e20' : 'transparent',
                  color: viewMode === 'carousel' ? 'white' : '#2e7d32',
                  borderRadius: 1.5,
                  '&:hover': {
                    bgcolor: viewMode === 'carousel' 
                      ? '#0d4715' 
                      : alpha('#1b5e20', 0.1)
                  }
                }}
              >
                <ViewCarouselIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Images Grid/Carousel */}
        {viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)`,
              gap: { xs: 1.5, sm: 2, md: 2.5 },
              width: '100%',
            }}
          >
            {sortedImages.map((image, index) => (
              <Zoom in={true} key={image.id} style={{ transitionDelay: `${index * 50}ms` }}>
                <Box
                  sx={{
                    position: 'relative',
                    paddingTop: '100%',
                    borderRadius: 2.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: '#f5f5f5',
                    border: `2px solid ${image.is_featured 
                      ? '#ffa726' 
                      : alpha('#c8e6c9', 0.8)}`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    '&:hover': {
                      transform: 'translateY(-6px) scale(1.03)',
                      boxShadow: '0 16px 32px rgba(27, 94, 32, 0.2)',
                      borderColor: '#1b5e20',
                      '& .image-overlay': {
                        opacity: 1,
                      },
                      '& img': {
                        transform: 'scale(1.1)',
                      }
                    }
                  }}
                  onClick={() => handleImageClick(image, index)}
                  onMouseEnter={() => setHoveredImage(image.id)}
                  onMouseLeave={() => setHoveredImage(null)}
                >
                  {/* Featured Badge */}
                  {image.is_featured && (
                    <Chip
                      icon={<StarIcon sx={{ fontSize: 14 }} />}
                      label="Featured"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 2,
                        bgcolor: '#ffa726',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        height: 22,
                        boxShadow: '0 2px 8px rgba(255, 167, 38, 0.4)',
                        '& .MuiChip-icon': {
                          color: 'white',
                        }
                      }}
                    />
                  )}

                  {/* Image Number Badge */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 2,
                      bgcolor: alpha('#000', 0.6),
                      backdropFilter: 'blur(8px)',
                      color: 'white',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}/{sortedImages.length}
                  </Box>

                  {/* Loading Skeleton */}
                  {imageLoading[image.id] && (
                    <Skeleton
                      variant="rectangular"
                      animation="wave"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        bgcolor: alpha('#1b5e20', 0.1)
                      }}
                    />
                  )}

                  {/* Error State */}
                  {imageErrors[image.id] ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#f5f5f5',
                        color: '#666',
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                      <Typography variant="caption">Image unavailable</Typography>
                    </Box>
                  ) : (
                    <>
                      <img
                        src={getImageUrl(projectId, image.id)}
                        alt={image.filename}
                        loading="lazy"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onLoad={() => handleImageLoad(image.id)}
                        onError={() => handleImageError(image.id)}
                      />

                      {/* Hover Overlay */}
                      <Box
                        className="image-overlay"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: 2,
                          opacity: 0,
                          transition: 'opacity 0.3s ease-in-out',
                        }}
                      >
                        <Box sx={{ color: 'white', width: '100%' }}>
                          <Typography variant="caption" sx={{ 
                            fontWeight: 600,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5
                          }}>
                            {image.filename}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ZoomInIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.9 }}>
                              Click to expand
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </>
                  )}
                </Box>
              </Zoom>
            ))}
          </Box>
        ) : (
          // Carousel View
          <Box sx={{ 
            position: 'relative',
            width: '100%',
            height: { xs: 300, sm: 400, md: 500 },
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: '#f5f5f5',
            boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)',
          }}>
            {sortedImages.map((image, index) => (
              <Fade in={carouselIndex === index} key={image.id}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: carouselIndex === index ? 'flex' : 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    bgcolor: '#fafafa',
                  }}
                  onClick={() => handleImageClick(image, index)}
                >
                  {imageErrors[image.id] ? (
                    <Box sx={{ textAlign: 'center', color: '#666' }}>
                      <CollectionsIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                      <Typography>Image unavailable</Typography>
                    </Box>
                  ) : (
                    <img
                      src={getImageUrl(projectId, image.id)}
                      alt={image.filename}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                      onError={() => handleImageError(image.id)}
                    />
                  )}
                </Box>
              </Fade>
            ))}

            {/* Carousel Navigation */}
            <IconButton
              onClick={handleCarouselPrevious}
              sx={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: alpha('#000', 0.5),
                color: 'white',
                '&:hover': {
                  bgcolor: alpha('#000', 0.7),
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>

            <IconButton
              onClick={handleCarouselNext}
              sx={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: alpha('#000', 0.5),
                color: 'white',
                '&:hover': {
                  bgcolor: alpha('#000', 0.7),
                }
              }}
            >
              <ChevronRightIcon />
            </IconButton>

            {/* Carousel Indicators */}
            <Box sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
              p: 1,
              borderRadius: 2,
              bgcolor: alpha('#000', 0.3),
              backdropFilter: 'blur(8px)',
            }}>
              {sortedImages.map((_, index) => (
                <Box
                  key={index}
                  onClick={() => setCarouselIndex(index)}
                  sx={{
                    width: carouselIndex === index ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    bgcolor: carouselIndex === index ? 'white' : alpha('#fff', 0.5),
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      bgcolor: carouselIndex === index ? 'white' : alpha('#fff', 0.7),
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Enhanced Lightbox Dialog */}
      <Dialog
        open={selectedImage !== null}
        onClose={handleCloseImageDialog}
        maxWidth={isFullscreen ? false : 'lg'}
        fullWidth
        fullScreen={isFullscreen}
        onKeyDown={handleKeyDown}
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: isFullscreen ? 'black' : 'background.paper',
            borderRadius: isFullscreen ? 0 : 3,
          }
        }}
      >
        <DialogContent 
          sx={{ 
            position: 'relative',
            p: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isFullscreen ? 'black' : '#fafafa',
            minHeight: { xs: 400, sm: 500, md: 600 },
          }}
        >
          {/* Top Controls Bar */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
              zIndex: 2,
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'white',
                fontWeight: 600,
                px: 2,
                py: 1,
                bgcolor: alpha('#000', 0.5),
                borderRadius: 2,
                backdropFilter: 'blur(8px)',
              }}
            >
              {selectedImageIndex !== null && `${selectedImageIndex + 1} / ${sortedImages.length}`}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedImage && (
                <Tooltip title="Download">
                  <IconButton
                    onClick={() => handleDownloadImage(selectedImage)}
                    sx={{
                      bgcolor: alpha('#fff', 0.1),
                      color: 'white',
                      backdropFilter: 'blur(8px)',
                      '&:hover': {
                        bgcolor: alpha('#fff', 0.2),
                      }
                    }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                <IconButton
                  onClick={toggleFullscreen}
                  sx={{
                    bgcolor: alpha('#fff', 0.1),
                    color: 'white',
                    backdropFilter: 'blur(8px)',
                    '&:hover': {
                      bgcolor: alpha('#fff', 0.2),
                    }
                  }}
                >
                  <FullscreenIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Close">
                <IconButton
                  onClick={handleCloseImageDialog}
                  sx={{
                    bgcolor: alpha('#fff', 0.1),
                    color: 'white',
                    backdropFilter: 'blur(8px)',
                    '&:hover': {
                      bgcolor: alpha('#fff', 0.2),
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          {/* Navigation Buttons */}
          {selectedImageIndex !== null && selectedImageIndex > 0 && (
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: 'absolute',
                left: { xs: 8, sm: 24 },
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: alpha('#000', 0.5),
                color: 'white',
                zIndex: 2,
                backdropFilter: 'blur(8px)',
                '&:hover': {
                  bgcolor: alpha('#000', 0.7),
                  transform: 'translateY(-50%) scale(1.1)',
                }
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: { xs: 24, sm: 32 } }} />
            </IconButton>
          )}

          {selectedImageIndex !== null && selectedImageIndex < sortedImages.length - 1 && (
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: { xs: 8, sm: 24 },
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: alpha('#000', 0.5),
                color: 'white',
                zIndex: 2,
                backdropFilter: 'blur(8px)',
                '&:hover': {
                  bgcolor: alpha('#000', 0.7),
                  transform: 'translateY(-50%) scale(1.1)',
                }
              }}
            >
              <ChevronRightIcon sx={{ fontSize: { xs: 24, sm: 32 } }} />
            </IconButton>
          )}

          {/* Image Display */}
          {selectedImage && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                p: isFullscreen ? 0 : { xs: 2, sm: 4 },
              }}
            >
              {imageErrors[selectedImage.id] ? (
                <Box sx={{ 
                  textAlign: 'center',
                  color: isFullscreen ? 'white' : '#666' 
                }}>
                  <CollectionsIcon sx={{ fontSize: 80, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6">Image unavailable</Typography>
                </Box>
              ) : (
                <img
                  src={getImageUrl(projectId, selectedImage.id)}
                  alt={selectedImage.filename}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: isFullscreen ? 0 : 12,
                    boxShadow: isFullscreen ? 'none' : '0 8px 32px rgba(0,0,0,0.2)',
                  }}
                  onError={() => handleImageError(selectedImage.id)}
                />
              )}
            </Box>
          )}

          {/* Bottom Information Bar */}
          {selectedImage && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                p: 2,
                background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'white',
                  textAlign: 'center',
                  fontWeight: 500,
                  px: 2,
                  py: 1,
                  bgcolor: alpha('#000', 0.5),
                  borderRadius: 2,
                  backdropFilter: 'blur(8px)',
                }}
              >
                {selectedImage.filename}
              </Typography>
            </Box>
          )}

          {/* Thumbnail Strip */}
          {!isFullscreen && sortedImages.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 60,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 1,
                p: 1,
                maxWidth: '90%',
                overflowX: 'auto',
                bgcolor: alpha('#000', 0.7),
                borderRadius: 2,
                backdropFilter: 'blur(12px)',
                '&::-webkit-scrollbar': {
                  height: 4,
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: alpha('#fff', 0.1),
                  borderRadius: 2,
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: alpha('#fff', 0.3),
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: alpha('#fff', 0.5),
                  }
                },
              }}
            >
              {sortedImages.map((image, index) => (
                <Box
                  key={image.id}
                  onClick={() => {
                    setSelectedImage(image);
                    setSelectedImageIndex(index);
                  }}
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedImageIndex === index 
                      ? '2px solid #1b5e20'
                      : '2px solid transparent',
                    opacity: selectedImageIndex === index ? 1 : 0.6,
                    transition: 'all 0.3s',
                    flexShrink: 0,
                    '&:hover': {
                      opacity: 1,
                      transform: 'scale(1.1)',
                      borderColor: '#2e7d32',
                    }
                  }}
                >
                  {imageErrors[image.id] ? (
                    <Box sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#333',
                    }}>
                      <ImageIcon sx={{ fontSize: 20, color: '#666' }} />
                    </Box>
                  ) : (
                    <img
                      src={getImageUrl(projectId, image.id)}
                      alt={image.filename}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={() => handleImageError(image.id)}
                    />
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
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
      console.log('Loaded project data:', data);
      console.log('Project image_records:', data?.image_records);
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
        <SEOHead title="Loading Research Project..." />
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
            sx={{ 
              color: '#1b5e20',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              }
            }} 
          />
          <Typography variant={isMobile ? "body1" : "h6"} sx={{ color: '#2e7d32', textAlign: 'center' }}>
            Loading Research Project...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !project) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        <SEOHead 
          title="Research Project Not Found - School of Public Health"
          description="The requested research project could not be found in our public health database."
        />
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 3,
            border: '2px solid #d32f2f',
            '& .MuiAlert-icon': {
              color: '#d32f2f'
            }
          }}
        >
          {error || 'Research project not found'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/projects')}
          variant="contained"
          fullWidth={isMobile}
          sx={{
            bgcolor: '#1b5e20',
            color: 'white',
            px: { xs: 2, sm: 3 },
            py: { xs: 1, sm: 1.5 },
            borderRadius: 3,
            textTransform: 'none',
            fontSize: { xs: '0.9rem', sm: '1rem' },
            fontWeight: 'bold',
            boxShadow: '0 4px 16px rgba(27, 94, 32, 0.3)',
            '&:hover': {
              bgcolor: '#0d4715',
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(27, 94, 32, 0.4)'
            }
          }}
        >
          Back to Research Projects
        </Button>
      </Container>
    );
  }

  // Generate SEO-friendly description
  const seoDescription = project.abstract 
    ? `${project.abstract.substring(0, 155)}...`
    : `Public health research project by ${project.author_name} from ${project.institution}. ${project.research_area ? `Research area: ${project.research_area}.` : ''} ${project.degree_type ? `Degree type: ${project.degree_type}.` : ''}`;

  const keywords = [
    'public health research',
    project.research_area,
    project.degree_type,
    project.institution,
    project.author_name,
    'health equity',
    'population health',
    ...(project.keywords ? project.keywords.split(',').map(k => k.trim()) : [])
  ].filter(Boolean).join(', ');

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        {/* SEO Components */}
        <SEOHead
          title={`${project.title} - School of Public Health Research`}
          description={seoDescription}
          keywords={keywords}
          author={project.author_name}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          type="article"
          publishedTime={project.publication_date}
          modifiedTime={project.updated_at || project.created_at}
          section={project.research_area}
          tags={project.keywords ? project.keywords.split(',').map(k => k.trim()) : []}
          canonicalUrl={typeof window !== 'undefined' ? window.location.href : ''}
        />
        <StructuredData 
          project={project} 
          type={project.degree_type?.toLowerCase().includes('phd') ? 'thesis' : 'article'} 
        />

        {/* Back Button */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/projects')}
          variant="outlined"
          size={isMobile ? "small" : "medium"}
          sx={{ 
            mb: { xs: 2, sm: 4 },
            borderColor: '#1b5e20',
            color: '#1b5e20',
            px: { xs: 2, sm: 3 },
            py: { xs: 0.5, sm: 1 },
            borderRadius: 3,
            textTransform: 'none',
            fontSize: { xs: '0.875rem', sm: '1rem' },
            fontWeight: 600,
            borderWidth: 2,
            '&:hover': {
              borderColor: '#0d4715',
              bgcolor: '#e8f5e9',
              borderWidth: 2,
              transform: 'translateY(-1px)'
            }
          }}
        >
          Back to Research Projects
        </Button>

        {/* Project Header */}
        <Paper sx={{ 
          p: { xs: 2, sm: 4 }, 
          mb: { xs: 2, sm: 4 }, 
          borderRadius: 4,
          border: '2px solid #c8e6c9',
          background: 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)',
          boxShadow: '0 8px 32px rgba(27, 94, 32, 0.1)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: { xs: 2, sm: 3 }, 
            mb: 3,
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <Avatar
              sx={{
                bgcolor: '#1b5e20',
                width: { xs: 48, sm: 60 },
                height: { xs: 48, sm: 60 },
                boxShadow: '0 4px 16px rgba(27, 94, 32, 0.3)'
              }}
            >
              <ResearchIcon sx={{ fontSize: { xs: 24, sm: 30 }, color: 'white' }} />
            </Avatar>
            <Box sx={{ flexGrow: 1, width: '100%' }}>
              <Typography 
                variant={isMobile ? "h5" : "h3"}
                component="h1" 
                gutterBottom
                sx={{ 
                  color: '#1b5e20',
                  fontWeight: 'bold',
                  lineHeight: 1.2,
                  textShadow: '0 2px 4px rgba(27, 94, 32, 0.1)',
                  fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' }
                }}
              >
                {project.title}
              </Typography>
              
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: { xs: 1, sm: 1.5 }, 
                mb: 3 
              }}>
                {project.research_area && (
                  <Chip 
                    icon={<HealthIcon />}
                    label={project.research_area} 
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      bgcolor: '#1b5e20',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      '& .MuiChip-icon': { color: 'white' },
                      boxShadow: '0 2px 8px rgba(27, 94, 32, 0.3)'
                    }}
                  />
                )}
                {project.degree_type && (
                  <Chip 
                    icon={<SchoolIcon />}
                    label={project.degree_type} 
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      bgcolor: '#2e7d32',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      '& .MuiChip-icon': { color: 'white' },
                      boxShadow: '0 2px 8px rgba(46, 125, 50, 0.3)'
                    }}
                  />
                )}
                {project.academic_year && (
                  <Chip 
                    icon={<CalendarIcon />}
                    label={project.academic_year} 
                    variant="outlined"
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      borderColor: '#388e3c',
                      color: '#388e3c',
                      fontWeight: 'bold',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      borderWidth: 2,
                      '& .MuiChip-icon': { color: '#388e3c' }
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 2, sm: 3 }, 
            mb: { xs: 3, sm: 4 }, 
            flexWrap: 'wrap',
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            {project.document_filename && (
              <>
                <Button
                  variant="contained"
                  startIcon={<ViewIcon />}
                  onClick={handleViewDocument}
                  size={isMobile ? "medium" : "large"}
                  fullWidth={isMobile}
                  sx={{
                    bgcolor: '#1b5e20',
                    color: 'white',
                    px: { xs: 3, sm: 4 },
                    py: { xs: 1, sm: 1.5 },
                    borderRadius: 3,
                    textTransform: 'none',
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    fontWeight: 'bold',
                    boxShadow: '0 6px 20px rgba(27, 94, 32, 0.3)',
                    '&:hover': {
                      bgcolor: '#0d4715',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 30px rgba(27, 94, 32, 0.4)'
                    }
                  }}
                >
                  View Document
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  disabled={downloading}
                  size={isMobile ? "medium" : "large"}
                  fullWidth={isMobile}
                  sx={{
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    px: { xs: 3, sm: 4 },
                    py: { xs: 1, sm: 1.5 },
                    borderRadius: 3,
                    textTransform: 'none',
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    fontWeight: 'bold',
                    borderWidth: 2,
                    boxShadow: '0 4px 16px rgba(46, 125, 50, 0.2)',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      bgcolor: '#e8f5e9',
                      borderWidth: 2,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(46, 125, 50, 0.3)'
                    },
                    '&:disabled': {
                      borderColor: '#c8e6c9',
                      color: '#81c784'
                    }
                  }}
                >
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </Button>
              </>
            )}
          </Box>

          {/* Project Stats */}
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 2, sm: 4 }, 
            p: { xs: 2, sm: 3 },
            bgcolor: 'rgba(27, 94, 32, 0.05)',
            borderRadius: 3,
            border: '1px solid #c8e6c9',
            flexDirection: { xs: 'row', sm: 'row' },
            justifyContent: 'space-around'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: '#2e7d32', width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 } }}>
                <ViewIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
              </Avatar>
              <Box>
                <Typography variant={isMobile ? "body1" : "h6"} sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                  {project.view_count}
                </Typography>
                <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  Views
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: '#388e3c', width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 } }}>
                <DownloadIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
              </Avatar>
              <Box>
                <Typography variant={isMobile ? "body1" : "h6"} sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                  {project.download_count}
                </Typography>
                <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  Downloads
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={{ xs: 2, sm: 4 }}>
          {/* Main Content */}
          <Grid item xs={12} md={8}>
            {/* Abstract */}
            {project.abstract && (
              <Paper sx={{ 
                p: { xs: 2, sm: 4 }, 
                mb: { xs: 2, sm: 4 }, 
                borderRadius: 4,
                border: '2px solid #c8e6c9',
                boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)',
                background: 'linear-gradient(135deg, #ffffff 0%, #f9fbe7 100%)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: { xs: 2, sm: 3 } }}>
                  <Avatar sx={{ bgcolor: '#2e7d32', width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 } }}>
                    <CategoryIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                  </Avatar>
                  <Typography variant={isMobile ? "h6" : "h5"} sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                    Abstract
                  </Typography>
                </Box>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    lineHeight: 1.8,
                    color: '#2e7d32',
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    textAlign: 'justify'
                  }}
                >
                  {project.abstract}
                </Typography>
              </Paper>
            )}

            {/* Enhanced Image Gallery */}
            {project.image_records && project.image_records.length > 0 && (
              <ImageGallery 
                imageRecords={project.image_records} 
                projectId={project.id}
                projectTitle={project.title}
              />
            )}

            {/* Keywords */}
            {project.keywords && (
              <Paper sx={{ 
                p: { xs: 2, sm: 4 }, 
                mb: { xs: 2, sm: 4 }, 
                borderRadius: 4,
                border: '2px solid #c8e6c9',
                boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)',
                background: 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: { xs: 2, sm: 3 } }}>
                  <Avatar sx={{ bgcolor: '#388e3c', width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 } }}>
                    <PublicIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                  </Avatar>
                  <Typography variant={isMobile ? "h6" : "h5"} sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                    Research Keywords
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 } }}>
                  {project.keywords.split(',').map((keyword, index) => (
                    <Chip 
                      key={index} 
                      label={keyword.trim()} 
                      size={isMobile ? "small" : "medium"}
                      sx={{
                        bgcolor: '#e8f5e9',
                        color: '#1b5e20',
                        fontWeight: 600,
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        border: '1px solid #c8e6c9',
                        '&:hover': {
                          bgcolor: '#c8e6c9',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(27, 94, 32, 0.2)'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            )}

            {/* Additional Research Information */}
            <Paper sx={{ 
              p: { xs: 2, sm: 4 }, 
              borderRadius: 4,
              border: '2px solid #c8e6c9',
              boxShadow: '0 4px 16px rgba(27, 94, 32, 0.1)',
              background: 'linear-gradient(135deg, #ffffff 0%, #e8f5e9 100%)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: { xs: 2, sm: 3 } }}>
                <Avatar sx={{ bgcolor: '#4caf50', width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 } }}>
                  <HealthIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Typography variant={isMobile ? "h6" : "h5"} sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                  Public Health Impact
                </Typography>
              </Box>
              <Typography 
                variant="body1" 
                sx={{ 
                  lineHeight: 1.7,
                  color: '#2e7d32',
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  fontStyle: 'italic'
                }}
              >
                This research contributes to advancing public health knowledge and practice, 
                supporting evidence-based interventions that improve population health outcomes 
                and promote health equity in communities worldwide.
              </Typography>
            </Paper>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            <Card sx={{
              borderRadius: 4,
              border: '2px solid #c8e6c9',
              boxShadow: '0 8px 32px rgba(27, 94, 32, 0.1)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)'
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: { xs: 2, sm: 3 } }}>
                  <Avatar sx={{ bgcolor: '#1b5e20', width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 } }}>
                    <PersonIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                  </Avatar>
                  <Typography variant={isMobile ? "body1" : "h6"} sx={{ color: '#1b5e20', fontWeight: 'bold' }}>
                    Research Details
                  </Typography>
                </Box>
                <Divider sx={{ mb: { xs: 2, sm: 3 }, borderColor: '#c8e6c9' }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
                  <Box sx={{
                    p: { xs: 1.5, sm: 2 },
                    bgcolor: 'rgba(27, 94, 32, 0.05)',
                    borderRadius: 2,
                    border: '1px solid #e8f5e9'
                  }}>
                    <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      Principal Researcher
                    </Typography>
                    <Typography variant={isMobile ? "body2" : "body1"} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      color: '#1b5e20',
                      fontWeight: 'bold',
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }}>
                      <PersonIcon fontSize="small" />
                      {project.author_name}
                    </Typography>
                  </Box>

                  {project.institution && (
                    <Box sx={{
                      p: { xs: 1.5, sm: 2 },
                      bgcolor: 'rgba(46, 125, 50, 0.05)',
                      borderRadius: 2,
                      border: '1px solid #e8f5e9'
                    }}>
                      <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        Institution
                      </Typography>
                      <Typography variant={isMobile ? "body2" : "body1"} sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        color: '#2e7d32',
                        fontWeight: 600,
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}>
                        <SchoolIcon fontSize="small" />
                        {project.institution}
                      </Typography>
                    </Box>
                  )}

                  {project.department && (
                    <Box sx={{
                      p: { xs: 1.5, sm: 2 },
                      bgcolor: 'rgba(56, 142, 60, 0.05)',
                      borderRadius: 2,
                      border: '1px solid #e8f5e9'
                    }}>
                      <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        Department
                      </Typography>
                      <Typography variant={isMobile ? "body2" : "body1"} sx={{ color: '#2e7d32', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        {project.department}
                      </Typography>
                    </Box>
                  )}

                  {project.supervisor && (
                    <Box sx={{
                      p: { xs: 1.5, sm: 2 },
                      bgcolor: 'rgba(76, 175, 80, 0.05)',
                      borderRadius: 2,
                      border: '1px solid #e8f5e9'
                    }}>
                      <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        Research Supervisor(s)
                      </Typography>
                      <Typography variant={isMobile ? "body2" : "body1"} sx={{ color: '#2e7d32', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        {project.supervisor}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{
                    p: { xs: 1.5, sm: 2 },
                    bgcolor: 'rgba(27, 94, 32, 0.08)',
                    borderRadius: 2,
                    border: '1px solid #c8e6c9'
                  }}>
                    <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      Publication Date
                    </Typography>
                    <Typography variant={isMobile ? "body2" : "body1"} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      color: '#1b5e20',
                      fontWeight: 'bold',
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }}>
                      <CalendarIcon fontSize="small" />
                      {new Date(project.publication_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Typography>
                  </Box>

                  {project.document_filename && (
                    <Box sx={{
                      p: { xs: 1.5, sm: 2 },
                      bgcolor: 'rgba(46, 125, 50, 0.08)',
                      borderRadius: 2,
                      border: '1px solid #c8e6c9'
                    }}>
                      <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 600, mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        Document Information
                      </Typography>
                      <Typography variant={isMobile ? "body2" : "body1"} sx={{ 
                        color: '#2e7d32', 
                        fontWeight: 600, 
                        mb: 1,
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        wordBreak: 'break-word'
                      }}>
                        {project.document_filename}
                      </Typography>
                      {project.document_size && (
                        <Chip
                          label={`${(project.document_size / 1024 / 1024).toFixed(2)} MB`}
                          size="small"
                          sx={{
                            bgcolor: '#c8e6c9',
                            color: '#1b5e20',
                            fontWeight: 'bold',
                            fontSize: { xs: '0.7rem', sm: '0.75rem' }
                          }}
                        />
                      )}
                    </Box>
                  )}
                </Box>

                {/* Call to Action */}
                <Box sx={{ 
                  mt: { xs: 3, sm: 4 }, 
                  p: { xs: 2, sm: 3 }, 
                  bgcolor: '#1b5e20', 
                  borderRadius: 3, 
                  textAlign: 'center' 
                }}>
                  <Typography 
                    variant={isMobile ? "body1" : "h6"} 
                    sx={{ 
                      color: 'white', 
                      fontWeight: 'bold', 
                      mb: { xs: 1, sm: 2 },
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    Advance Public Health Research
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#c8e6c9', 
                      mb: { xs: 1.5, sm: 2 }, 
                      lineHeight: 1.5,
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                  >
                    Explore more research projects that contribute to improving global health outcomes.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/projects')}
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      bgcolor: 'white',
                      color: '#1b5e20',
                      fontWeight: 'bold',
                      textTransform: 'none',
                      borderRadius: 2,
                      px: { xs: 2, sm: 3 },
                      fontSize: { xs: '0.875rem', sm: '1rem' },
                      '&:hover': {
                        bgcolor: '#f1f8e9',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    Browse More Research
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ProjectDetailPage;
