import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableRow } from '@mui/material';

interface TopicCountsProps {
  apiUrl: string;
}

interface TopicCounts {
  telemetry: number;
  alarms: number;
}

const TopicCounts: React.FC<TopicCountsProps> = ({ apiUrl }) => {
  const [counts, setCounts] = useState<TopicCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/topic-counts`);
      const data = await response.json();
      if (response.ok) {
        setCounts(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch topic counts');
      }
    } catch (err) {
      setError('Failed to connect to the server');
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [apiUrl]);

  if (!counts && !error) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Topic Message Counts
      </Typography>
      {error ? (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell component="th">Telemetry Messages</TableCell>
                <TableCell align="right">{counts?.telemetry || 0}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th">Alarm Messages</TableCell>
                <TableCell align="right">{counts?.alarms || 0}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default TopicCounts; 