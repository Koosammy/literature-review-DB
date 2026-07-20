import axios from 'axios';
import { cleanBaseUrl } from '../config/api';
// Import ALL types from the central types file
import { 
  Project, 
  ProjectSummary, 
  SiteStats, 
  ProjectImage,
  SearchFilters,
  SearchResponse,
  getProjectImageUrl,
  getFeaturedImageUrl
} from '../types';


class ApiService {
  private api = axios.create({
    baseURL: cleanBaseUrl,
    timeout: 30000, // Increased timeout for file operations
  });

  constructor() {
    // Add request interceptor to log requests in development
    if (process.env.NODE_ENV === 'development') {
      this.api.interceptors.request.use(request => {
        console.log('Starting Request:', request.url);
        return request;
      });
    }
  }

  async getProjects(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    research_area?: string;
    degree_type?: string;
  }): Promise<Project[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.research_area) queryParams.append('research_area', params.research_area);
      if (params?.degree_type) queryParams.append('degree_type', params.degree_type);

      const response = await this.api.get(`/api/projects/?${queryParams}`);
      if (!Array.isArray(response.data)) {
        throw new Error('Projects API returned an invalid response');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      throw new Error('Failed to fetch projects');
    }
  }

  async getProjectBySlug(slug: string): Promise<Project> {
    try {
      const response = await this.api.get(`/api/projects/${slug}`);
      const project = response.data;
      
      // Log the response to debug
      if (process.env.NODE_ENV === 'development') {
        console.log('Project API response:', project);
        console.log('Has image_records:', !!project.image_records);
        console.log('Image records count:', project.image_records?.length || 0);
      }
      
      return project;
    } catch (error) {
      console.error('Failed to fetch project:', error);
      throw new Error('Failed to fetch project');
    }
  }

  async getFeaturedProjects(limit: number = 6): Promise<Project[]> {
    try {
      const response = await this.api.get(`/api/projects/featured?limit=${limit}`);
      if (!Array.isArray(response.data)) {
        throw new Error('Featured projects API returned an invalid response');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to fetch featured projects:', error);
      throw new Error('Failed to fetch featured projects');
    }
  }

  async getSiteStats(): Promise<SiteStats> {
    try {
      const response = await this.api.get('/api/projects/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch site stats:', error);
      throw new Error('Failed to fetch site stats');
    }
  }

  async getResearchAreas(): Promise<string[]> {
    try {
      const response = await this.api.get('/api/projects/research-areas/list');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch research areas:', error);
      throw new Error('Failed to fetch research areas');
    }
  }

  async getInstitutions(): Promise<string[]> {
    try {
      const response = await this.api.get('/api/projects/institutions/list');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
      throw new Error('Failed to fetch institutions');
    }
  }

  async downloadProject(slug: string): Promise<void> {
    try {
      const response = await this.api.get(`/api/projects/${slug}/download`, {
        responseType: 'blob'
      });
      
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from content-disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'document.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download project:', error);
      throw new Error('Failed to download project');
    }
  }

  // Add the downloadProjectById method if needed
  async downloadProjectById(projectId: number): Promise<void> {
    try {
      const response = await this.api.get(`/api/projects/${projectId}/download`, {
        responseType: 'blob'
      });
      
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from content-disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'document.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download project:', error);
      throw new Error('Failed to download project');
    }
  }

  async incrementProjectView(slug: string): Promise<void> {
    try {
      await this.api.patch(`/api/projects/${slug}/increment-view`);
    } catch (error) {
      console.error('Failed to increment view:', error);
      throw new Error('Failed to increment view');
    }
  }

  // Legacy methods for backward compatibility
  async searchProjects(filters: SearchFilters, page: number = 1, perPage: number = 12): Promise<SearchResponse> {
    try {
      const params = {
        skip: (page - 1) * perPage,
        limit: perPage,
        search: filters.query,
        research_area: filters.research_area,
        degree_type: filters.degree_type
      };

      const projects = await this.getProjects(params);
      const total = projects.length; // You might want to add total count from backend
      
      return {
        projects: projects as ProjectSummary[],
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
        filters
      };
    } catch (error) {
      console.error('Failed to search projects:', error);
      return {
        projects: [],
        total: 0,
        page: 1,
        per_page: perPage,
        total_pages: 0,
        filters
      };
    }
  }

  // Document viewing methods
  getDocumentViewUrl(slug: string): string {
    return `${cleanBaseUrl}/api/projects/${slug}/view-document`;
  }

  viewDocument(slug: string): void {
    const viewUrl = this.getDocumentViewUrl(slug);
    window.open(viewUrl, '_blank');
  }

  // File info method
  async getFileInfo(slug: string): Promise<any> {
    try {
      const response = await this.api.get(`/api/projects/${slug}/file-info`);
      return response.data;
    } catch (error) {
      console.error('Failed to get file info:', error);
      return { available: false };
    }
  }
}

export const apiService = new ApiService();
export default apiService;

// Export the clean base URL for use in other components
export { cleanBaseUrl };

// Re-export the helper functions from types
export { getProjectImageUrl, getFeaturedImageUrl };
