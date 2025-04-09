import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button,
  Box,
  TextField,
  Alert,
  Snackbar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import MessageConfig, { MessageType } from './MessageConfig';

interface TestConfigProps {
  brokerType: string;
}

const TestConfig: React.FC<TestConfigProps> = ({ brokerType }) => {
  const [messageType, setMessageType] = useState<MessageType>('telemetry');
  const [messagesPerSecond, setMessagesPerSecond] = useState<number>(10);
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleStartTest = async () => {
    if (messagesPerSecond <= 0) {
      setNotification({ type: 'error', message: 'Messages per second must be greater than 0' });
      return;
    }
    if (durationSeconds <= 0) {
      setNotification({ type: 'error', message: 'Duration must be greater than 0' });
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/start-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messagesPerSecond,
          durationSeconds,
          brokerType,
          messageConfig: {
            type: messageType
          }
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setNotification({ type: 'success', message: data.message });
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to start test' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to connect to the server' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Test Configuration
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="broker-type-label">Broker Type</InputLabel>
                <Select
                  labelId="broker-type-label"
                  value={brokerType}
                  disabled
                  label="Broker Type"
                >
                  <MenuItem value="redpanda">Redpanda</MenuItem>
                  <MenuItem value="confluent">Confluent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Messages per Second"
                type="number"
                value={messagesPerSecond}
                onChange={(e) => setMessagesPerSecond(Number(e.target.value))}
                fullWidth
                helperText="Rate at which messages will be sent"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Duration (seconds)"
                type="number"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                fullWidth
                helperText="How long the test will run"
              />
            </Grid>
          </Grid>

          <Divider />

          <MessageConfig
            messageType={messageType}
            onMessageTypeChange={setMessageType}
          />

          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleStartTest}
            disabled={isLoading}
            sx={{ mt: 2 }}
          >
            {isLoading ? 'Starting Test...' : 'Start Test'}
          </Button>
        </Box>
      </CardContent>
      <Snackbar 
        open={!!notification} 
        autoHideDuration={6000} 
        onClose={() => setNotification(null)}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity={notification?.type} 
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default TestConfig; 