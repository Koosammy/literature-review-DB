import { cleanBaseUrl } from '../config/api';

export interface ProjectImage {
  id: number;
  project_id: number;
  filename: string;
  content_type: string;
  image_size?: number;
  order_index: number;
  is_featured: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  abstract?: string;
  keywords?: string;
  research_area?: string;
  degree_type?: string;
  academic_year?: string;
  institution?: string;
  department?: string;
  supervisor?: string;
  author_name: string;
  author_email?: string;
  meta_description?: string;
  meta_keywords?: string;
  is_published: boolean;
  publication_date: string;
  view_count: number;
  download_count: number;
  
  // Legacy fields (for backward compatibility)
  images?: string[];
  featured_image_index?: number;
  
  // New image records
  image_records?: ProjectImage[];  // Made optional for API compatibility
  
  // Document fields
  document_url?: string;  // Keep for backward compatibility
  document_filename?: string;
  document_size?: number;
  document_content_type?: string;
  document_storage?: string;
  
  // Metadata
  created_by_id?: number;
  created_at: string;
  updated_at?: string;
}

export interface ProjectSummary {
  id: number;
  title: string;
  slug: string;
  abstract?: string;
  research_area?: string;
  degree_type?: string;
  institution?: string;
  author_name: string;
  publication_date: string;
  view_count?: number;        // Made optional for API compatibility
  download_count?: number;    // Made optional for API compatibility
  is_published?: boolean;     // Made optional for API compatibility
  
  // Include image records for summary views
  image_records?: ProjectImage[];
  
  // Include featured image info
  images?: string[];
  featured_image_index?: number;
}

export interface SearchFilters {
  query?: string;
  research_area?: string;
  degree_type?: string;
  institution?: string;
  academic_year?: string;
}

export interface SearchResponse {
  projects: ProjectSummary[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  filters: SearchFilters;
}

export interface SiteStats {
  total_projects: number;
  total_institutions: number;
  total_research_areas: number;
  total_downloads: number;
}

// Additional types for better type safety
export interface ApiError {
  message: string;
  status?: number;
  detail?: string | Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface DownloadResponse {
  download_url: string;
  filename: string;
}

// Helper type for image URL computation
export interface ImageWithUrl extends ProjectImage {
  computed_url?: string;
}

// Constants for the application
export const IMAGE_CONSTANTS = {
  MAX_IMAGES_PER_PROJECT: 20,
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// Helper function to get image URL
export function getProjectImageUrl(projectId: number, imageId: number): string {
  // Check if baseUrl already contains /api
  if (cleanBaseUrl.includes('/api')) {
    return `${cleanBaseUrl}/projects/${projectId}/images/${imageId}`;
  }
  
  // Otherwise add /api
  return `${cleanBaseUrl}/api/projects/${projectId}/images/${imageId}`;
}

// Helper function to get featured image URL
export function getFeaturedImageUrl(project: Project | ProjectSummary): string | null {
  if (project.image_records && project.image_records.length > 0) {
    // Find featured image from image_records
    const featuredImage = project.image_records.find(img => img.is_featured);
    if (featuredImage) {
      return getProjectImageUrl(project.id, featuredImage.id);
    }
    // If no featured image, return first image
    return getProjectImageUrl(project.id, project.image_records[0].id);
  }
  
  // Fallback to legacy images array
  if (project.images && project.images.length > 0) {
    const index = project.featured_image_index || 0;
    const imageUrl = project.images[index] || project.images[0];
    
    // If it's already a full URL, return it
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // Otherwise, prepend the base URL
    // If the image URL already starts with /api, don't add base URL's /api
    if (imageUrl.startsWith('/api') && cleanBaseUrl.includes('/api')) {
      return cleanBaseUrl.replace('/api', '') + imageUrl;
    }
    
    return cleanBaseUrl + imageUrl;
  }
  
  return null;
}

// Helper function to check if project has images
export function projectHasImages(project: Project | ProjectSummary): boolean {
  return (project.image_records && project.image_records.length > 0) || 
         (project.images && project.images.length > 0) || 
         false;
}
