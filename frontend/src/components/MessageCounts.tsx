import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Grid, Box } from '@mui/material';
import QueryStatsIcon from '@mui/icons-material/QueryStats';

interface MessageCountsProps {
  apiUrl: string;
}

interface Counts {
  kafka: {
    iot: number;
    alarms: number;
  };
  database: {
    iot: number;
    alarms: number;
  };
}

const MessageCounts: React.FC<MessageCountsProps> = ({ apiUrl }) => {
  const [counts, setCounts] = useState<Counts>({
    kafka: { iot: 0, alarms: 0 },
    database: { iot: 0, alarms: 0 }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [kafkaResponse, databaseResponse] = await Promise.all([
          fetch(`${apiUrl}/api/topic-counts`),
          fetch(`${apiUrl}/api/database-counts`)
        ]);

        if (!kafkaResponse.ok || !databaseResponse.ok) {
          throw new Error('Failed to fetch counts');
        }

        const kafkaData = await kafkaResponse.json();
        const databaseData = await databaseResponse.json();

        setCounts({
          kafka: {
            iot: kafkaData.telemetry || 0,
            alarms: kafkaData.alarms || 0
          },
          database: {
            iot: databaseData.telemetry || 0,
            alarms: databaseData.alarms || 0
          }
        });
        setError(null);
      } catch (err) {
        console.error('Failed to fetch counts:', err);
        setError('Failed to fetch counts');
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
          <QueryStatsIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Message Counts</Typography>
        </Box>
        
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Kafka Topics
              </Typography>
              <CountItem label="IoT Messages" value={counts.kafka.iot} />
              <CountItem label="Alarm Messages" value={counts.kafka.alarms} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Database Tables
              </Typography>
              <CountItem label="IoT Messages" value={counts.database.iot} />
              <CountItem label="Alarm Messages" value={counts.database.alarms} />
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

export default MessageCounts; 