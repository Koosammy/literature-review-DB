import axios, { AxiosResponse } from 'axios';
import { User, Project, DashboardStats, LoginRequest, AuthResponse, FormConstants } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

// Password Reset Types
interface PasswordResetResponse {
  message: string;
}

interface TokenVerificationResponse {
  valid: boolean;
  email: string;
  username: string;
}

// Profile Update Interface
interface ProfileUpdateData {
  full_name: string;
  email: string;
  institution: string;
  department: string;
  phone: string;
  about: string;
  disciplines: string;
}

class AdminApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120000, // Default timeout for most requests
  });

  // Create a separate axios instance for long-running operations
  private apiLongRunning = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120000, // 120 seconds for file uploads and processing
  });

  constructor() {
    // Configure both axios instances
    [this.api, this.apiLongRunning].forEach(instance => {
      // Add auth token to requests
      instance.interceptors.request.use((config) => {
        const token = localStorage.getItem('admin_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Don't override Content-Type if it's already set (like for multipart/form-data)
        if (config.method === 'post' && !config.headers['Content-Type'] && !(config.data instanceof FormData)) {
          config.headers['Content-Type'] = 'application/json';
        }
        
        return config;
      });

      // Handle auth errors and format error messages
      instance.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response?.status === 401) {
            // Check if we're not already on the login page to prevent redirect loops
            const currentPath = window.location.hash;
            const isOnLoginPage = currentPath === '#/login' || currentPath === '#/login/';
            
            if (!isOnLoginPage) {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_user');
              
              // ✅ FIXED: Use hash-based URL for HashRouter compatibility
              // This ensures the URL stays in format: example.com/#/login
              // instead of breaking to: example.com/login
              window.location.href = window.location.origin + window.location.pathname + '#/login';
            }
          }
          
          // Format error message for better display
          if (error.response?.data) {
            const errorData = error.response.data;
            
            // Handle FastAPI validation errors
            if (Array.isArray(errorData.detail)) {
              const messages = errorData.detail.map((err: any) => {
                if (typeof err === 'object' && err.msg) {
                  return `${err.loc?.join(' → ') || 'Field'}: ${err.msg}`;
                }
                return err.toString();
              });
              error.message = messages.join(', ');
            } else if (typeof errorData.detail === 'string') {
              error.message = errorData.detail;
            } else if (errorData.message) {
              error.message = errorData.message;
            }
          }
          
          // Handle timeout errors specifically
          if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
            error.message = 'Request timed out. The operation may still be processing in the background.';
          }
          
          return Promise.reject(error);
        }
      );
    });
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      
      console.log('Attempting login with:', credentials.username);
      
      const response = await this.api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Login response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await this.api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    });
    return response.data;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      console.log('Sending email:', email); // Debug log
      
      const formData = new FormData();
      formData.append('email', email);
      
      const response = await this.api.post('/auth/forgot-password', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResponse> {
    const response = await this.api.post('/auth/reset-password', { 
      token, 
      new_password: newPassword 
    });
    return response.data;
  }

  async verifyResetToken(token: string): Promise<TokenVerificationResponse> {
    const response = await this.api.get('/auth/verify-reset-token', {
      params: { token },
      timeout: 1200000 // 30 second timeout for this specific request
    });
    return response.data;
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.api.get('/dashboard/stats');
    return response.data;
  }

  // Users
  async getUsers(): Promise<User[]> {
    const response = await this.api.get('/users/');
    return response.data;
  }

  async createUser(userData: any): Promise<User> {
    const response = await this.api.post('/users/', userData);
    return response.data;
  }

  async updateUser(userId: number, userData: any): Promise<User> {
    const response = await this.api.put(`/users/${userId}`, userData);
    return response.data;
  }

  async deleteUser(userId: number): Promise<void> {
    await this.api.delete(`/users/${userId}`);
  }

  async toggleUserStatus(userId: number): Promise<void> {
    await this.api.patch(`/users/${userId}/toggle-status`);
  }

  // Projects
  async getProjects(params?: {
    search?: string;
    research_area?: string;
    degree_type?: string;
    is_published?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<Project[]> {
    const response = await this.api.get('/projects/', {
      params: {
        ...(params?.search && { search: params.search }),
        ...(params?.research_area && { research_area: params.research_area }),
        ...(params?.degree_type && { degree_type: params.degree_type }),
        ...(params?.is_published !== undefined && { is_published: params.is_published }),
        ...(params?.skip && { skip: params.skip }),
        ...(params?.limit && { limit: params.limit }),
      }
    });
    return response.data;
  }

  async getProject(projectId: number): Promise<Project> {
    const response = await this.api.get(`/projects/${projectId}`);
    return response.data;
  }

  async createProject(projectData: FormData): Promise<Project> {
    try {
      // Use long-running API instance for project creation with file upload
      const response = await this.apiLongRunning.post('/projects/', projectData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Optional: Add progress tracking
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${percentCompleted}%`);
          }
        },
      });
      return response.data;
    } catch (error: any) {
      // If it's a timeout error, provide a more helpful message
      if (error.code === 'ECONNABORTED') {
        error.message = 'The project creation is taking longer than expected. It may still be processing. Please check the projects list in a moment.';
      }
      throw error;
    }
  }

  async updateProject(projectId: number, projectData: FormData): Promise<Project> {
    try {
      // Use long-running API instance for project updates with file upload
      const response = await this.apiLongRunning.put(`/projects/${projectId}`, projectData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Optional: Add progress tracking
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Update progress: ${percentCompleted}%`);
          }
        },
      });
      return response.data;
    } catch (error: any) {
      // If it's a timeout error, provide a more helpful message
      if (error.code === 'ECONNABORTED') {
        error.message = 'The project update is taking longer than expected. It may still be processing. Please check the projects list in a moment.';
      }
      throw error;
    }
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.api.delete(`/projects/${projectId}`);
  }

  async toggleProjectStatus(projectId: number): Promise<void> {
    await this.api.patch(`/projects/${projectId}/toggle-publish`);
  }

  async getResearchAreas(): Promise<string[]> {
    const response = await this.api.get('/projects/research-areas/list');
    return response.data;
  }

  async getDegreeTypes(): Promise<string[]> {
    const response = await this.api.get('/projects/degree-types/list');
    return response.data;
  }

  async deleteProjectFile(projectId: number): Promise<void> {
    await this.api.delete(`/projects/${projectId}/file`);
  }

  // Project Image Methods (Updated for database storage)
  async uploadProjectImages(projectId: number, files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    const response = await this.apiLongRunning.post(`/projects/${projectId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  async deleteProjectImage(projectId: number, imageId: number): Promise<any> {
    const response = await this.api.delete(`/projects/${projectId}/images/${imageId}`);
    return response.data;
  }

  async setFeaturedImage(projectId: number, imageId: number): Promise<any> {
    const response = await this.api.put(`/projects/${projectId}/featured-image`, { 
      image_id: imageId 
    });
    return response.data;
  }

  async reorderProjectImages(projectId: number, imageIds: number[]): Promise<any> {
    const response = await this.api.put(`/projects/${projectId}/images/reorder`, { 
      image_ids: imageIds 
    });
    return response.data;
  }

  // Updated extractProjectImages method with table extraction parameter
  async extractProjectImages(projectId: number, extractTables: boolean = true): Promise<any> {
    const response = await this.apiLongRunning.post(
      `/projects/${projectId}/extract-images`,
      null,
      {
        params: { extract_tables: extractTables }
      }
    );
    return response.data;
  }

  // Profile Methods
  async uploadProfileImage(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post('/profile/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  async deleteProfileImage(): Promise<any> {
    const response = await this.api.delete('/profile/image');
    return response.data;
  }

  async updateProfile(data: ProfileUpdateData): Promise<User> {
    const response = await this.api.put('/profile', data);
    return response.data;
  }

  // Utilities
  async getFormConstants(): Promise<FormConstants> {
    const response = await this.api.get('/utils/constants');
    return response.data;
  }

  async getPredefinedResearchAreas(): Promise<string[]> {
    const response = await this.api.get('/utils/research-areas');
    return response.data.research_areas;
  }

  async getPredefinedDegreeTypes(): Promise<string[]> {
    const response = await this.api.get('/utils/degree-types');
    return response.data.degree_types;
  }

  async getAcademicYears(): Promise<string[]> {
    const response = await this.api.get('/utils/academic-years');
    return response.data.academic_years;
  }

  async getInstitutions(): Promise<string[]> {
    const response = await this.api.get('/utils/institutions');
    return response.data.institutions;
  }

  // Additional helper methods for better error handling
  private handleApiError(error: any): never {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await this.api.get('/health');
    return response.data;
  }

  // Project statistics
  async getProjectStats(projectId: number): Promise<any> {
    const response = await this.api.get(`/projects/${projectId}/stats`);
    return response.data;
  }

  async getProjectsSummary(): Promise<any> {
    const response = await this.api.get('/projects/stats/summary');
    return response.data;
  }

  // Batch operations
  async batchPublishProjects(projectIds: number[]): Promise<any> {
    const response = await this.api.post('/projects/batch/publish', projectIds);
    return response.data;
  }

  async batchUnpublishProjects(projectIds: number[]): Promise<any> {
    const response = await this.api.post('/projects/batch/unpublish', projectIds);
    return response.data;
  }

  async batchDeleteProjects(projectIds: number[]): Promise<any> {
    const response = await this.api.post('/projects/batch/delete', projectIds);
    return response.data;
  }

  // Export
  async exportProjectsCSV(): Promise<Blob> {
    const response = await this.api.get('/projects/export/csv', {
      responseType: 'blob'
    });
    return response.data;
  }

  // Advanced search
  async advancedSearchProjects(params: {
    title?: string;
    author?: string;
    supervisor?: string;
    institution?: string;
    department?: string;
    research_area?: string;
    degree_type?: string;
    academic_year?: string;
    keywords?: string;
    has_document?: boolean;
    has_images?: boolean;
    is_published?: boolean;
    created_after?: string;
    created_before?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ total: number; projects: Project[] }> {
    const response = await this.api.get('/projects/search/advanced', { params });
    return response.data;
  }
}

export const adminApi = new AdminApiService();

// Export types for use in components
export type { PasswordResetResponse, TokenVerificationResponse, ProfileUpdateData };
