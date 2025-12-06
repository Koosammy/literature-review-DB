import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { adminApi } from '../services/adminApi';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        // Validate token before making API call
        try {
          const userData = await adminApi.getCurrentUser();
          setUser(userData);
          // Update localStorage with fresh user data
          localStorage.setItem('admin_user', JSON.stringify(userData));
        } catch (apiError) {
          // If token is invalid, clear it
          console.error('Invalid token:', apiError);
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await adminApi.login({ username, password });
      
      // Check if response contains the expected data
      if (!response || !response.access_token) {
        throw new Error('Invalid response from server');
      }
      
      localStorage.setItem('admin_token', response.access_token);
      
      // The login response now includes complete user data
      const userData = response.user as User;
      if (!userData) {
        throw new Error('User data not received from server');
      }
      
      setUser(userData);
      localStorage.setItem('admin_user', JSON.stringify(userData));
    } catch (error) {
      // Ensure we're not throwing an error that might cause navigation issues
      // Just re-throw the error to be handled by the calling component
      throw error;
    }
  };

  const logout = () => {
    // Don't wait for logout API call to complete
    adminApi.logout().catch(console.error);
    
    // Clear user state immediately
    setUser(null);
    
    // Clear localStorage
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      
      // Merge the new data with existing user data
      const updatedUser = { ...prevUser, ...userData };
      
      // Update localStorage with the new user data
      localStorage.setItem('admin_user', JSON.stringify(updatedUser));
      
      // Return the updated user
      return updatedUser;
    });
  };

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
