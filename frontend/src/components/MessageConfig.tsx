import React from 'react';
import { Typography, Box, Button, Paper } from '@mui/material';

export type MessageType = 'telemetry' | 'alarm';

export interface TelemetryConfig {
  minTemperature: number;
  maxTemperature: number;
  minHumidity: number;
  maxHumidity: number;
  minPressure: number;
  maxPressure: number;
  minBattery: number;
  maxBattery: number;
}

export interface AlarmConfig {
  minSeverity: number;
  maxSeverity: number;
  minCode: number;
  maxCode: number;
}

interface MessageConfigProps {
  messageType: MessageType;
  onMessageTypeChange: (type: MessageType) => void;
}

const MessageConfig = ({
  messageType,
  onMessageTypeChange,
}: MessageConfigProps) => {
  const telemetryRanges = {
    Temperature: '20-30°C',
    Humidity: '40-60%',
    Pressure: '1000-1020 hPa',
    Battery: '80-100%'
  };

  const alarmRanges = {
    Severity: '1-3',
    'Error Code': '100-200'
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant={messageType === 'telemetry' ? 'contained' : 'outlined'}
          onClick={() => onMessageTypeChange('telemetry')}
        >
          Telemetry
        </Button>
        <Button
          variant={messageType === 'alarm' ? 'contained' : 'outlined'}
          onClick={() => onMessageTypeChange('alarm')}
        >
          Alarm
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {messageType === 'telemetry' ? 'Telemetry Ranges' : 'Alarm Ranges'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {Object.entries(messageType === 'telemetry' ? telemetryRanges : alarmRanges).map(([key, value]) => (
            <Box key={key} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {key}:
              </Typography>
              <Typography variant="body2">
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default MessageConfig; 