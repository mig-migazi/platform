import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  LinearProgress, 
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Stack
} from '@mui/material';

interface TestProgressProps {
  apiUrl: string;
}

interface TestState {
  status: 'idle' | 'running' | 'completed' | 'error';
  messagesSent: number;
  progress: number;
  timeElapsed: number;
  error?: string;
  config?: {
    messagesPerSecond: number;
    durationSeconds: number;
  };
  metrics?: {
    currentRate: number;
    averageRate: number;
    expectedTotal: number;
  };
}

const TestProgress: React.FC<TestProgressProps> = ({ apiUrl }) => {
  const [testState, setTestState] = useState<TestState>({
    status: 'idle',
    messagesSent: 0,
    progress: 0,
    timeElapsed: 0
  });

  useEffect(() => {
    const eventSource = new EventSource(`${apiUrl}/api/test-progress`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'testStarted':
          setTestState(prev => ({
            ...prev,
            status: 'running',
            messagesSent: 0,
            progress: 0,
            timeElapsed: 0,
            config: data.config,
            metrics: {
              currentRate: 0,
              averageRate: 0,
              expectedTotal: data.config.messagesPerSecond * data.config.durationSeconds
            },
            error: undefined
          }));
          break;

        case 'progress':
          const currentRate = data.messagesSent / (data.timeElapsed || 1);
          const averageRate = data.messagesSent / (data.timeElapsed || 1);
          const expectedTotal = testState.config?.messagesPerSecond && testState.config?.durationSeconds
            ? testState.config.messagesPerSecond * testState.config.durationSeconds
            : 0;
          
          setTestState(prev => ({
            ...prev,
            messagesSent: data.messagesSent,
            progress: (data.timeElapsed / (prev.config?.durationSeconds || 1)) * 100,
            timeElapsed: data.timeElapsed,
            metrics: {
              currentRate,
              averageRate,
              expectedTotal
            }
          }));
          break;

        case 'testCompleted':
          const finalExpectedTotal = testState.config?.messagesPerSecond && testState.config?.durationSeconds
            ? testState.config.messagesPerSecond * testState.config.durationSeconds
            : 0;
          
          setTestState(prev => ({
            ...prev,
            status: 'completed',
            messagesSent: data.messagesSent,
            progress: 100,
            timeElapsed: data.duration,
            metrics: {
              currentRate: 0,
              averageRate: data.messagesSent / data.duration,
              expectedTotal: finalExpectedTotal
            }
          }));
          break;

        case 'error':
          setTestState(prev => ({
            ...prev,
            status: 'error',
            error: data.error
          }));
          break;

        case 'testStopped':
          setTestState(prev => ({
            ...prev,
            status: 'idle',
            messagesSent: 0,
            progress: 0,
            timeElapsed: 0,
            config: undefined,
            metrics: undefined,
            error: undefined
          }));
          break;
      }
    };

    return () => {
      eventSource.close();
    };
  }, [apiUrl]);

  if (testState.status === 'idle') {
    return null;
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Test Progress
      </Typography>
      
      {testState.error ? (
        <Typography color="error">
          Error: {testState.error}
        </Typography>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={testState.progress} 
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Stack sx={{ width: '50%' }}>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th">Status</TableCell>
                      <TableCell>
                        {testState.status.charAt(0).toUpperCase() + testState.status.slice(1)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th">Time Elapsed</TableCell>
                      <TableCell>{testState.timeElapsed.toFixed(1)}s / {testState.config?.durationSeconds}s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th">Messages Sent</TableCell>
                      <TableCell>
                        {testState.messagesSent}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
            <Stack sx={{ width: '50%' }}>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th">Current Rate</TableCell>
                      <TableCell>{testState.metrics?.currentRate.toFixed(1)} msg/s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th">Average Rate</TableCell>
                      <TableCell>{testState.metrics?.averageRate.toFixed(1)} msg/s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th">Target Rate</TableCell>
                      <TableCell>{testState.config?.messagesPerSecond} msg/s</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </Stack>
        </>
      )}
    </Paper>
  );
};

export default TestProgress; 