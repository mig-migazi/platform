import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemIcon, ListItemText, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import StorageIcon from '@mui/icons-material/Storage';

interface HealthStatusProps {
  health: {
    status: 'healthy' | 'error';
    database: 'connected' | 'disconnected';
  } | null;
  error: string | null;
}

const HealthStatus: React.FC<HealthStatusProps> = ({ health, error }) => {
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!health) {
    return <CircularProgress />;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          System Health
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              {health.status === 'healthy' ? (
                <CheckCircleIcon sx={{ color: 'success.main' }} />
              ) : (
                <ErrorIcon sx={{ color: 'error.main' }} />
              )}
            </ListItemIcon>
            <ListItemText 
              primary="Backend Service" 
              secondary={health.status === 'healthy' ? 'Connected' : 'Error'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              {health.database === 'connected' ? (
                <CheckCircleIcon sx={{ color: 'success.main' }} />
              ) : (
                <ErrorIcon sx={{ color: 'error.main' }} />
              )}
            </ListItemIcon>
            <ListItemText 
              primary="TimescaleDB"
              secondary={health.database === 'connected' ? 'Connected' : 'Disconnected'}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

export default HealthStatus; 