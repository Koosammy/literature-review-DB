import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { cleanBaseUrl } from '../config/api';

interface ErrorBoundaryState {
  hasError: boolean;
}

function reportClientError(payload: Record<string, unknown>) {
  const body = JSON.stringify({
    source: 'public-frontend',
    level: 'error',
    url: window.location.href,
    user_agent: navigator.userAgent,
    ...payload,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(`${cleanBaseUrl}/api/diagnostics/client-error`, blob);
    return;
  }

  fetch(`${cleanBaseUrl}/api/diagnostics/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportClientError({
      message: error.message,
      stack: error.stack,
      component_stack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom>Something went wrong</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              The issue has been logged for troubleshooting. Please refresh the page and try again.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
export { reportClientError };
