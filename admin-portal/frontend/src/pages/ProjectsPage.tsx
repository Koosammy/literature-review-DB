import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Grid,
  FormControlLabel,
  Switch,
  Input,
  Card,
  CardContent,
  Avatar,
  alpha,
  useTheme,
  Fade,
  Skeleton,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Article as ArticleIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  TrendingUp as TrendingIcon,
  Download as DownloadIcon,
  AttachFile as AttachFileIcon,
  FilterList as FilterIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { Project, FormConstants } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ResearchAreaSelect } from '../components/ResearchAreaSelect';

interface ProjectFormData {
  title: string;
  abstract: string;
  keywords: string;
  research_area: string;
  degree_type: string;
  academic_year: string;
  institution: string;
  department: string;
  supervisor: string;
  author_name: string;
  author_email: string;
  meta_description: string;
  meta_keywords: string;
  is_published: boolean;
  file?: File;
}

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    abstract: '',
    keywords: '',
    research_area: '',
    degree_type: '',
    academic_year: '',
    institution: '',
    department: '',
    supervisor: '',
    author_name: '',
    author_email: '',
    meta_description: '',
    meta_keywords: '',
    is_published: true,
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublished, setFilterPublished] = useState<boolean | undefined>(undefined);
  const [researchAreas, setResearchAreas] = useState<string[]>([]);
  const [degreeTypes, setDegreeTypes] = useState<string[]>([]);
  const { user: currentUser } = useAuth();
  const theme = useTheme();

  // Add these new state variables
  const [formConstants, setFormConstants] = useState<FormConstants>({
    research_areas: [],
    degree_types: [],
    academic_years: [],
    institutions: []
  });

  const [customFields, setCustomFields] = useState({
    custom_research_area: '',
    custom_degree_type: '',
    custom_institution: ''
  });

  useEffect(() => {
    loadProjects();
    loadFilterOptions();
    fetchFormConstants();
  }, [searchTerm, filterPublished]);

  const fetchFormConstants = async () => {
    try {
      const constants = await adminApi.getFormConstants();
      setFormConstants(constants);
    } catch (error) {
      console.error('Failed to fetch form constants:', error);
      // Fallback to empty arrays if API fails
    }
  };

  const loadProjects = async () => {
    try {
      const data = await adminApi.getProjects({
        search: searchTerm || undefined,
        is_published: filterPublished,
      });
      setProjects(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [areas, types] = await Promise.all([
        adminApi.getResearchAreas(),
        adminApi.getDegreeTypes(),
      ]);
      setResearchAreas(areas);
      setDegreeTypes(types);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        title: project.title,
        abstract: project.abstract || '',
        keywords: project.keywords || '',
        research_area: project.research_area || '',
        degree_type: project.degree_type || '',
        academic_year: project.academic_year || '',
        institution: project.institution || '',
        department: project.department || '',
        supervisor: project.supervisor || '',
        author_name: project.author_name,
        author_email: project.author_email || '',
        meta_description: project.meta_description || '',
        meta_keywords: project.meta_keywords || '',
        is_published: project.is_published,
      });
    } else {
      setEditingProject(null);
      setFormData({
        title: '',
        abstract: '',
        keywords: '',
        research_area: '',
        degree_type: '',
        academic_year: '',
        institution: currentUser?.institution || '',
        department: currentUser?.department || '',
        supervisor: '',
        author_name: '',
        author_email: '',
        meta_description: '',
        meta_keywords: '',
        is_published: true,
      });
    }
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProject(null);
    setFormError('');
    setCustomFields({
      custom_research_area: '',
      custom_degree_type: '',
      custom_institution: ''
    });
  };

  const handleSubmit = async () => {
    setFormError('');
    setSubmitting(true);

    // Client-side validation
    if (!formData.title.trim()) {
      setFormError('Title is required');
      setSubmitting(false);
      return;
    }

    if (!formData.author_name.trim()) {
      setFormError('Author name is required');
      setSubmitting(false);
      return;
    }

    try {
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('abstract', formData.abstract);
      submitData.append('keywords', formData.keywords);
      submitData.append('research_area', formData.research_area || '');
      submitData.append('degree_type', formData.degree_type || '');
      submitData.append('academic_year', formData.academic_year);
      submitData.append('institution', formData.institution || '');
      submitData.append('department', formData.department);
      submitData.append('supervisor', formData.supervisor);
      submitData.append('author_name', formData.author_name);
      submitData.append('author_email', formData.author_email);
      submitData.append('meta_description', formData.meta_description);
      submitData.append('meta_keywords', formData.meta_keywords);
      submitData.append('is_published', formData.is_published.toString());

      // Add custom fields if "Others" is selected
      if (formData.research_area === 'Others') {
        submitData.append('custom_research_area', customFields.custom_research_area);
      }
      if (formData.degree_type === 'Others') {
        submitData.append('custom_degree_type', customFields.custom_degree_type);
      }
      if (formData.institution === 'Others') {
        submitData.append('custom_institution', customFields.custom_institution);
      }

      if (formData.file) {
        submitData.append('file', formData.file);
      }

      if (editingProject) {
        await adminApi.updateProject(editingProject.id, submitData);
      } else {
        await adminApi.createProject(submitData);
      }

      await loadProjects();
      handleCloseDialog();
    } catch (err: any) {
      let errorMessage = 'Failed to save project';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      }
      
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await adminApi.deleteProject(projectId);
        await loadProjects();
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to delete project');
      }
    }
  };

  const handleToggleStatus = async (projectId: number) => {
    try {
      await adminApi.toggleProjectStatus(projectId);
      await loadProjects();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle project status');
    }
  };

  const handleInputChange = (field: keyof ProjectFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    if (field === 'file') {
      setFormData(prev => ({
        ...prev,
        [field]: event.target.files[0]
      }));
    } else if (field === 'is_published') {
      setFormData(prev => ({
        ...prev,
        [field]: event.target.checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: event.target.value
      }));
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadProjects();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setFilterPublished(undefined);
  };

  // Stats calculation
  const stats = {
    total: projects.length,
    published: projects.filter(p => p.is_published).length,
    drafts: projects.filter(p => !p.is_published).length,
    totalViews: projects.reduce((sum, p) => sum + (p.view_count || 0), 0),
    totalDownloads: projects.reduce((sum, p) => sum + (p.download_count || 0), 0)
  };

  if (loading && projects.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 3, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mb: 3, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 800,
                  color: '#0a4f3c',
                  mb: 1,
                  fontSize: { xs: '2rem', md: '2.5rem' }
                }}
              >
                Projects Management
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: '1.1rem'
                }}
              >
                Manage research projects, publications, and academic content
              </Typography>
            </Box>
            
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
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
              Add New Project
            </Button>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[
              { 
                title: 'Total Projects', 
                value: stats.total, 
                icon: ArticleIcon, 
                color: '#0a4f3c',
                gradient: 'linear-gradient(135deg, #0a4f3c 0%, #1a7a5e 100%)'
              },
              { 
                title: 'Published', 
                value: stats.published, 
                icon: VisibilityIcon, 
                color: '#1a7a5e',
                gradient: 'linear-gradient(135deg, #1a7a5e 0%, #2a9d7f 100%)'
              },
              { 
                title: 'Total Views', 
                value: stats.totalViews, 
                icon: TrendingIcon, 
                color: '#2a9d7f',
                gradient: 'linear-gradient(135deg, #2a9d7f 0%, #3ac0a0 100%)'
              },
              { 
                title: 'Downloads', 
                value: stats.totalDownloads, 
                icon: DownloadIcon, 
                color: '#3ac0a0',
                gradient: 'linear-gradient(135deg, #3ac0a0 0%, #4ae3c1 100%)'
              }
            ].map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card
                    elevation={0}
                    sx={{
                                            background: 'white',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: alpha(stat.color, 0.1),
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 12px 24px ${alpha(stat.color, 0.15)}`
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color, mb: 0.5 }}>
                            {stat.value.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {stat.title}
                          </Typography>
                        </Box>
                        <Avatar
                          sx={{
                            width: 48,
                            height: 48,
                            background: stat.gradient,
                            boxShadow: `0 8px 16px ${alpha(stat.color, 0.3)}`
                          }}
                        >
                          <stat.icon sx={{ color: 'white', fontSize: 24 }} />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Card
          elevation={0}
          sx={{
            mb: 4,
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: '#0a4f3c', width: 40, height: 40 }}>
                <FilterIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c' }}>
                  Search & Filter
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Find specific projects and filter by status
                </Typography>
              </Box>
            </Box>
          </Box>

          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  placeholder="Search by title, author, or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#0a4f3c' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      '&:hover fieldset': {
                        borderColor: '#2a9d7f',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#0a4f3c',
                      },
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Publication Status</InputLabel>
                  <Select
                    value={filterPublished === undefined ? '' : filterPublished.toString()}
                    label="Publication Status"
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilterPublished(value === '' ? undefined : value === 'true');
                    }}
                    sx={{
                      borderRadius: 3,
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0a4f3c',
                      },
                    }}
                  >
                    <MenuItem value="">All Projects</MenuItem>
                    <MenuItem value="true">Published Only</MenuItem>
                    <MenuItem value="false">Drafts Only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleSearch}
                    startIcon={<SearchIcon />}
                    sx={{
                      borderRadius: 3,
                      bgcolor: '#0a4f3c',
                      '&:hover': { bgcolor: '#063d2f' }
                    }}
                  >
                    Search
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleClearSearch}
                    startIcon={<ClearIcon />}
                    sx={{
                      borderRadius: 3,
                      borderColor: '#0a4f3c',
                      color: '#0a4f3c',
                      '&:hover': {
                        borderColor: '#063d2f',
                        bgcolor: alpha('#0a4f3c', 0.04)
                      }
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 3,
                '& .MuiAlert-icon': { fontSize: 24 }
              }} 
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects Table */}
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
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#0a4f3c' }}>Project Details</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#0a4f3c' }}>Author & Institution</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#0a4f3c' }}>Research Info</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#0a4f3c' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#0a4f3c' }}>Analytics</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#0a4f3c' }}>Created</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#0a4f3c' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence>
                  {projects.map((project, index) => (
                    <TableRow
                      key={project.id}
                      component={motion.tr}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      sx={{
                        '&:hover': {
                          bgcolor: alpha('#0a4f3c', 0.02)
                        }
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: 600, 
                              color: '#0a4f3c',
                              mb: 0.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {project.title}
                          </Typography>
                          {project.document_filename && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                              <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {project.document_filename}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <PersonIcon sx={{ fontSize: 16, color: '#0a4f3c' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {project.author_name}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SchoolIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {project.institution || 'No institution'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Box>
                          {project.research_area && (
                            <Chip
                              label={project.research_area}
                              size="small"
                              sx={{
                                bgcolor: alpha('#0a4f3c', 0.1),
                                color: '#0a4f3c',
                                fontWeight: 600,
                                mb: 0.5
                              }}
                            />
                          )}
                          {project.degree_type && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {project.degree_type}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Chip
                          label={project.is_published ? 'Published' : 'Draft'}
                          size="small"
                          sx={{
                            bgcolor: project.is_published ? alpha('#4caf50', 0.1) : alpha('#ff9800', 0.1),
                            color: project.is_published ? '#4caf50' : '#ff9800',
                            fontWeight: 600,
                            border: 'none'
                          }}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption">{project.view_count || 0} views</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DownloadIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption">{project.download_count || 0} downloads</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(project.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="Edit Project">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(project)}
                              sx={{
                                bgcolor: alpha('#0a4f3c', 0.1),
                                color: '#0a4f3c',
                                '&:hover': {
                                  bgcolor: alpha('#0a4f3c', 0.2)
                                }
                              }}
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title={project.is_published ? 'Unpublish' : 'Publish'}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleStatus(project.id)}
                              sx={{
                                bgcolor: alpha('#2a9d7f', 0.1),
                                color: '#2a9d7f',
                                '&:hover': {
                                  bgcolor: alpha('#2a9d7f', 0.2)
                                }
                              }}
                            >
                              {project.is_published ? 
                                <VisibilityOffIcon sx={{ fontSize: 18 }} /> : 
                                <VisibilityIcon sx={{ fontSize: 18 }} />
                              }
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Delete Project">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteProject(project.id)}
                              sx={{
                                bgcolor: alpha('#f44336', 0.1),
                                color: '#f44336',
                                '&:hover': {
                                  bgcolor: alpha('#f44336', 0.2)
                                }
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </TableContainer>

          {projects.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: alpha('#0a4f3c', 0.1),
                                    mx: 'auto',
                  mb: 3
                }}
              >
                <ArticleIcon sx={{ fontSize: 40, color: '#0a4f3c' }} />
              </Avatar>
              <Typography variant="h6" sx={{ color: '#0a4f3c', mb: 1, fontWeight: 600 }}>
                No projects found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm ? 'Try adjusting your search criteria' : 'Create your first project to get started'}
              </Typography>
              {!searchTerm && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                  sx={{
                    borderRadius: 3,
                    bgcolor: '#0a4f3c',
                    '&:hover': { bgcolor: '#063d2f' }
                  }}
                >
                  Add First Project
                </Button>
              )}
            </Box>
          )}
        </Card>
      </motion.div>

      {/* Enhanced Project Form Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  bgcolor: '#0a4f3c',
                  width: 48,
                  height: 48
                }}
              >
                {editingProject ? <EditIcon /> : <AddIcon />}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0a4f3c' }}>
                  {editingProject ? 'Edit Project' : 'Add New Project'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {editingProject ? 'Update project information and settings' : 'Create a new research project entry'}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={handleCloseDialog} sx={{ color: 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3 }}>
          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3,
                    borderRadius: 3,
                    '& .MuiAlert-icon': { fontSize: 24 }
                  }}
                >
                  {formError}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Box sx={{ mt: 2 }}>
            {/* Basic Information Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.08)',
                bgcolor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c', mb: 2 }}>
                Basic Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    autoFocus
                    label="Project Title"
                    fullWidth
                    variant="outlined"
                    value={formData.title}
                    onChange={handleInputChange('title')}
                    required
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
                
                <Grid item xs={12}>
                  <TextField
                    label="Abstract"
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    value={formData.abstract}
                    onChange={handleInputChange('abstract')}
                    placeholder="Provide a detailed abstract of the research project..."
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
                
                <Grid item xs={12}>
                  <TextField
                    label="Keywords"
                    fullWidth
                    variant="outlined"
                    value={formData.keywords}
                    onChange={handleInputChange('keywords')}
                    placeholder="research, public health, epidemiology, data analysis"
                    helperText="Separate keywords with commas"
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
            </Paper>

            {/* Author Information Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.08)',
                bgcolor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c', mb: 2 }}>
                Author Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Author Name"
                    fullWidth
                    variant="outlined"
                    value={formData.author_name}
                    onChange={handleInputChange('author_name')}
                    required
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
                    label="Author Email"
                    type="email"
                    fullWidth
                    variant="outlined"
                    value={formData.author_email}
                    onChange={handleInputChange('author_email')}
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
                  <ResearchAreaSelect
                    value={formData.institution || ''}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, institution: value }));
                      if (value !== 'Others' || !value) {
                        setCustomFields(prev => ({ ...prev, custom_institution: '' }));
                      } else {
                        setCustomFields(prev => ({ ...prev, custom_institution: value }));
                      }
                    }}
                    options={formConstants.institutions}
                    error={false}
                    helperText=""
                    required
                    label="Institution"
                    customLabel="Specify Institution"
                    customPlaceholder="e.g., University of Cape Coast"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Department"
                    fullWidth
                    variant="outlined"
                    value={formData.department}
                    onChange={handleInputChange('department')}
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
                
                <Grid item xs={12}>
                  <TextField
                    label="Supervisor"
                    fullWidth
                    variant="outlined"
                    value={formData.supervisor}
                    onChange={handleInputChange('supervisor')}
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
            </Paper>

            {/* Academic Information Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.08)',
                bgcolor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c', mb: 2 }}>
                Academic Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <ResearchAreaSelect
                    value={formData.research_area || ''}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, research_area: value }));
                      if (value !== 'Others' || !value) {
                        setCustomFields(prev => ({ ...prev, custom_research_area: '' }));
                      } else {
                        setCustomFields(prev => ({ ...prev, custom_research_area: value }));
                      }
                    }}
                    options={formConstants.research_areas}
                    error={false}
                    helperText=""
                    required
                    label="Research Area"
                    customLabel="Specify Research Area"
                    customPlaceholder="e.g., Tropical Medicine, Health Informatics"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <ResearchAreaSelect
                    value={formData.degree_type || ''}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, degree_type: value }));
                      if (value !== 'Others' || !value) {
                        setCustomFields(prev => ({ ...prev, custom_degree_type: '' }));
                      } else {
                        setCustomFields(prev => ({ ...prev, custom_degree_type: value }));
                      }
                    }}
                    options={formConstants.degree_types}
                    error={false}
                    helperText=""
                    required
                    label="Degree Type"
                    customLabel="Specify Degree Type"
                    customPlaceholder="e.g., PGDip, DNP"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    select
                    fullWidth
                    label="Academic Year"
                    name="academic_year"
                    value={formData.academic_year || ''}
                    onChange={handleInputChange('academic_year')}
                    error={false}
                    helperText=""
                    required
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
                  >
                    {formConstants.academic_years.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Paper>

            {/* SEO Information Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.08)',
                bgcolor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c', mb: 2 }}>
                SEO & Metadata
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    label="Meta Description"
                    fullWidth
                    multiline
                    rows={2}
                    variant="outlined"
                    value={formData.meta_description}
                    onChange={handleInputChange('meta_description')}
                    placeholder="Brief description for search engines (150-160 characters)"
                    helperText={`${formData.meta_description.length}/160 characters`}
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
                
                <Grid item xs={12}>
                  <TextField
                    label="Meta Keywords"
                    fullWidth
                    variant="outlined"
                    value={formData.meta_keywords}
                    onChange={handleInputChange('meta_keywords')}
                    placeholder="SEO keywords separated by commas"
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
            </Paper>

            {/* File Management Section */}
                        <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.08)',
                bgcolor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c', mb: 2 }}>
                Document Management
              </Typography>
              
              {editingProject?.document_filename && (
                <Box sx={{ mb: 3, p: 3, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <AttachFileIcon sx={{ color: '#0a4f3c' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Current Document: {editingProject.document_filename}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this file?')) {
                        try {
                          await adminApi.deleteProjectFile(editingProject.id);
                          setFormError('');
                          await loadProjects();
                          handleCloseDialog();
                        } catch (err: any) {
                          setFormError(err.response?.data?.detail || 'Failed to delete file');
                        }
                      }
                    }}
                    sx={{ borderRadius: 2 }}
                  >
                    Delete Current File
                  </Button>
                </Box>
              )}
              
              <Box
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: 3,
                  p: 4,
                  textAlign: 'center',
                  bgcolor: 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: '#0a4f3c',
                    bgcolor: alpha('#0a4f3c', 0.02)
                  }
                }}
              >
                <UploadIcon sx={{ fontSize: 48, color: '#0a4f3c', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#0a4f3c', mb: 1 }}>
                  Upload Document
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Supported formats: PDF, DOC, DOCX, TXT, RTF (Max 10MB)
                </Typography>
                <Input
                  type="file"
                  onChange={handleInputChange('file')}
                  inputProps={{
                    accept: '.pdf,.doc,.docx,.txt,.rtf'
                  }}
                  sx={{
                    '& input': {
                      padding: '12px 16px',
                      borderRadius: 2,
                      border: '1px solid #ccc',
                      '&:focus': {
                        borderColor: '#0a4f3c',
                        outline: 'none'
                      }
                    }
                  }}
                />
                {formData.file && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: alpha('#0a4f3c', 0.1), borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: '#0a4f3c', fontWeight: 600 }}>
                      Selected: {formData.file.name}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Publication Settings */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.08)',
                bgcolor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0a4f3c', mb: 2 }}>
                Publication Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_published}
                    onChange={handleInputChange('is_published')}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#0a4f3c',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#0a4f3c',
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      Publish immediately
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Make this project visible to the public
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Button 
            onClick={handleCloseDialog}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha('#000', 0.04)
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : (editingProject ? <EditIcon /> : <AddIcon />)}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1,
              background: 'linear-gradient(135deg, #0a4f3c 0%, #2a9d7f 100%)',
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(10,79,60,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #063d2f 0%, #1a7a5e 100%)',
                boxShadow: '0 6px 16px rgba(10,79,60,0.4)',
              },
              '&:disabled': {
                background: alpha('#0a4f3c', 0.6),
                color: 'white'
              }
            }}
          >
            {submitting ? 'Saving...' : (editingProject ? 'Update Project' : 'Create Project')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
