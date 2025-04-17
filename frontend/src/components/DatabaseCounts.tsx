import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';

interface DatabaseCountsProps {
  apiUrl: string;
}

interface Counts {
  iot: number;
  alarms: number;
}

const DatabaseCounts: React.FC<DatabaseCountsProps> = ({ apiUrl }) => {
  const [counts, setCounts] = useState<Counts>({ iot: 0, alarms: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/database-counts`);
        if (!response.ok) {
          throw new Error('Failed to fetch database counts');
        }
        const data = await response.json();
        setCounts({
          iot: data.telemetry || 0,
          alarms: data.alarms || 0
        });
        setError(null);
      } catch (err) {
        console.error('Failed to fetch database counts:', err);
        setError('Failed to fetch database counts');
      }
    };

    const interval = setInterval(fetchCounts, 5000);
    fetchCounts();

    return () => clearInterval(interval);
  }, [apiUrl]);

  const CountItem = ({ label, value }: { label: string; value: number }) => (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
      py: 1
    }}>
      <Typography variant="body1" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">
        {value.toLocaleString()}
      </Typography>
    </Box>
  );

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <StorageIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Database Counts</Typography>
        </Box>
        
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Box>
            <CountItem label="IoT Messages" value={counts.iot} />
            <CountItem label="Alarm Messages" value={counts.alarms} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseCounts; 