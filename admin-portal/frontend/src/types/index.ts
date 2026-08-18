export interface ProjectImage {
  id: number;
  project_id: number;
  filename: string;
  content_type: string;
  image_size?: number;
  order_index: number;
  is_featured: boolean;
  created_at: string;
  image_url?: string;  // Make it optional since we'll compute it if not provided
}

export interface SupervisorBrief {
  id: number;
  title?: string;
  full_name: string;
  institution?: string;
  profile_image?: string;
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
  supervisors?: SupervisorBrief[];
  author_name: string;
  author_email?: string;
  meta_description?: string;
  meta_keywords?: string;
  is_published: boolean;
  publication_date: string;
  view_count: number;
  download_count: number;
  
  // Legacy image fields (for backward compatibility)
  images?: string[];
  featured_image_index?: number;
  
  // New database image records
  image_records?: ProjectImage[];
  
  // Document fields
  document_url?: string;
  document_filename?: string;
  document_size?: number;
  document_content_type?: string;
  document_public_id?: string;
  document_storage?: string;
  
  // Metadata
  created_by_id?: number;
  created_at: string;
  updated_at: string;
}

export interface FormConstants {
  research_areas: string[];
  degree_types: string[];
  academic_years: string[];
  institutions: string[];
}

export interface ProjectFormData {
  title: string;
  abstract?: string;
  keywords?: string;
  research_area?: string;
  custom_research_area?: string;
  degree_type?: string;
  custom_degree_type?: string;
  academic_year?: string;
  institution?: string;
  custom_institution?: string;
  department?: string;
  supervisor?: string;
  author_name: string;
  author_email?: string;
  meta_description?: string;
  meta_keywords?: string;
  is_published?: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  title?: string;
  institution?: string;
  department?: string;
  phone?: string;
  about?: string;        // Added
  disciplines?: string;  // Added
  role: string;
  is_active: boolean;
  must_set_password?: boolean;
  created_at: string;
  profile_image?: string;
}

export interface DashboardStats {
  total_projects: number;
  published_projects: number;
  draft_projects: number;
  total_users: number;
  active_users: number;
  inactive_users: number;
  total_downloads: number;
  total_views: number;
  recent_projects: Array<{
    id: number;
    title: string;
    author_name: string;
    created_at: string;
    is_published: boolean;
  }>;
  research_areas: Array<{
    name: string;
    count: number;
  }>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: string;
    institution?: string;
    department?: string;
    about?: string;        // Added
    disciplines?: string;  // Added
  };
}

// Password Reset Types
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface PasswordResetResponse {
  message: string;
}

export interface TokenVerificationResponse {
  valid: boolean;
  email: string;
  username: string;
}

// Change Password Types
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// File Info Types
export interface ProjectFileInfo {
  filename?: string;
  size?: number;
  content_type?: string;
  storage?: string;
  download_count: number;
  view_count: number;
  available: boolean;
}

export interface ApiError {
  detail: string | Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
  message?: string;
}

// Form Validation Types
export interface ValidationError {
  field: string;
  message: string;
}

// Pagination Types
export interface PaginationParams {
  skip?: number;
  limit?: number;
}

// Search and Filter Types
export interface ProjectFilters extends PaginationParams {
  search?: string;
  research_area?: string;
  degree_type?: string;
  is_published?: boolean;
}

export interface UserFilters extends PaginationParams {
  search?: string;
  role?: string;
  is_active?: boolean;
}
