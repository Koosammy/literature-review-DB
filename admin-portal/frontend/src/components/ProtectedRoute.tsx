import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, sessionCheckFailed, checkAuthStatus } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (sessionCheckFailed) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
        <Alert severity="warning" action={<Button color="inherit" onClick={checkAuthStatus}>Retry</Button>}>
          The admin backend could not verify your session. Try again when it is available.
        </Alert>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
