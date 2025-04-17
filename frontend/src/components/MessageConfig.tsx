import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';

export type MessageType = 'telemetry' | 'alarms';

interface MessageConfigProps {
  messageType: MessageType;
  onMessageTypeChange: (type: MessageType) => void;
}

const MessageConfig: React.FC<MessageConfigProps> = ({ messageType, onMessageTypeChange }) => {
  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Message Type
      </Typography>
      <FormControl fullWidth variant="outlined">
        <InputLabel id="message-type-label">Message Type</InputLabel>
        <Select
          labelId="message-type-label"
          value={messageType}
          onChange={(e) => onMessageTypeChange(e.target.value as MessageType)}
          label="Message Type"
        >
          <MenuItem value="telemetry">Telemetry</MenuItem>
          <MenuItem value="alarms">Alarms</MenuItem>
        </Select>
      </FormControl>
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {messageType === 'telemetry' ? (
            'Telemetry messages include temperature, humidity, pressure, and battery readings.'
          ) : (
            'Alarm messages include severity and error code information.'
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default MessageConfig; 