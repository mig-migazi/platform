import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemIcon, ListItemText, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';

interface HealthStatusProps {
  health: {
    status: 'healthy' | 'error';
    kafka: 'connected' | 'disconnected';
    broker: string;
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

  const getBrokerName = (type: string | undefined) => {
    if (!type) return 'Unknown';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

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
              {health.kafka === 'connected' ? (
                <CheckCircleIcon sx={{ color: 'success.main' }} />
              ) : (
                <ErrorIcon sx={{ color: 'error.main' }} />
              )}
            </ListItemIcon>
            <ListItemText 
              primary="Message Broker"
              secondary={`${health.kafka === 'connected' ? 'Connected' : 'Disconnected'} (${getBrokerName(health.broker)})`}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

export default HealthStatus; 