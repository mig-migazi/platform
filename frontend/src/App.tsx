import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import TestConfig from './components/TestConfig';
import HealthStatus from './components/HealthStatus';
import TestProgress from './components/TestProgress';
import MessageCounts from './components/MessageCounts';

interface IHealthStatus {
  status: 'healthy' | 'error';
  kafka: 'connected' | 'disconnected';
  database: 'connected' | 'disconnected';
  broker: string;
  testRunning: boolean;
}

function App() {
  const [health, setHealth] = useState<IHealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/health`);
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        console.error('Health check failed:', err);
        setError('Failed to connect to the server. Please make sure the backend is running.');
        setHealth(null);
      }
    };

    const interval = setInterval(checkHealth, 5000);
    checkHealth();

    return () => clearInterval(interval);
  }, [apiUrl]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          IoT Telemetry Testing Platform
        </Typography>

        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: 'flex-start'
        }}>
          <Box sx={{ flex: 1, width: '100%' }}>
            <Paper sx={{ p: 3 }}>
              <TestConfig />
            </Paper>
          </Box>
          <Box sx={{ flex: 1, width: '100%' }}>
            <Paper sx={{ p: 3, mb: 2 }}>
              <HealthStatus health={health} error={error} />
            </Paper>
            <Paper sx={{ p: 3 }}>
              <TestProgress apiUrl={apiUrl} />
            </Paper>
            <MessageCounts apiUrl={apiUrl} />
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default App;
