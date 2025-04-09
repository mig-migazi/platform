const express = require('express');
const cors = require('cors');
const { Kafka, logLevel } = require('kafkajs');
const path = require('path');
const config = require('./config');

const app = express();
const port = process.env.PORT || 3001;

// Configure CORS to allow requests from the frontend
app.use(cors());
app.use(express.json());

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, '../frontend/build')));

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    console.error('Stack:', error.stack);
});

// Keep track of connected SSE clients
const clients = new Set();

// SSE endpoint for test progress
app.get('/api/test-progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send an initial message
  res.write('data: {"type":"connected"}\n\n');

  // Add client to the set
  clients.add(res);

  // Remove client when connection closes
  req.on('close', () => {
    clients.delete(res);
  });
});

// Function to send updates to all connected clients
function sendTestUpdate(data) {
  const eventData = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    client.write(eventData);
  });
}

// Kafka configuration
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: [config.kafka.bootstrapServers],
  logLevel: logLevel.INFO
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: config.kafka.clientId + '-consumer' });
const admin = kafka.admin();

let isConnected = false;
let currentTest = null;

// Data generation functions
function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTelemetryData() {
  return {
    temperature: generateRandomNumber(20, 30),
    humidity: generateRandomNumber(40, 60),
    pressure: generateRandomNumber(1000, 1020),
    battery: generateRandomNumber(80, 100)
  };
}

function generateAlarmData() {
  return {
    severity: generateRandomNumber(1, 3),
    code: generateRandomNumber(100, 200),
    message: `Test alarm message ${Date.now()}`
  };
}

// Connect to Kafka on startup
async function connectToKafka() {
  try {
    console.log(`Connecting to ${config.kafka.brokerType}...`);
    await producer.connect();
    await consumer.connect();
    await admin.connect();
    await consumer.subscribe({ topic: config.kafka.topics.telemetry });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log('Received:', message.value.toString());
      },
    });

    isConnected = true;
    console.log('Connected to Kafka successfully');
    return true;
  } catch (error) {
    console.error('Kafka connection error:', error);
    isConnected = false;
    return false;
  }
}

// Get topic message counts
app.get('/api/topic-counts', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const topicOffsets = await Promise.all([
      admin.fetchTopicOffsets(config.kafka.topics.telemetry),
      admin.fetchTopicOffsets(config.kafka.topics.alarms)
    ]);

    const counts = {
      telemetry: topicOffsets[0].reduce((sum, partition) => sum + parseInt(partition.high), 0),
      alarms: topicOffsets[1].reduce((sum, partition) => sum + parseInt(partition.high), 0)
    };

    res.json(counts);
  } catch (error) {
    console.error('Failed to get topic counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({ 
    status: isConnected ? 'healthy' : 'error',
    kafka: isConnected ? 'connected' : 'disconnected',
    broker: config.kafka.brokerType,
    currentTest: currentTest
  });
});

// Start test endpoint
app.post('/api/start-test', async (req, res) => {
  try {
    const { messagesPerSecond, durationSeconds, brokerType, messageConfig } = req.body;

    // Validate input
    if (!messagesPerSecond || !durationSeconds || !brokerType || !messageConfig) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (messagesPerSecond <= 0 || durationSeconds <= 0) {
      return res.status(400).json({ error: 'Messages per second and duration must be positive numbers' });
    }

    if (currentTest && currentTest.interval) {
      return res.status(400).json({ error: 'A test is already running' });
    }

    // Calculate delay between messages in milliseconds
    const delayMs = 1000 / messagesPerSecond;
    const startTime = Date.now();
    let messagesSent = 0;
    let lastUpdateTime = startTime;

    currentTest = {
      startTime,
      interval: null,
      messagesSent: 0
    };

    // Send initial test started event
    sendTestUpdate({ 
      type: 'testStarted',
      config: {
        messagesPerSecond,
        durationSeconds
      }
    });

    currentTest.interval = setInterval(async () => {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - startTime) / 1000;

      // Check if test duration has been reached
      if (elapsedTime >= durationSeconds) {
        clearInterval(currentTest.interval);
        currentTest.interval = null;
        sendTestUpdate({ 
          type: 'testCompleted',
          messagesSent,
          duration: elapsedTime
        });
        return;
      }

      try {
        const message = messageConfig.type === 'telemetry' ? 
          generateTelemetryData() : 
          generateAlarmData();

        const topic = messageConfig.type === 'telemetry' ? 
          config.kafka.topics.telemetry : 
          config.kafka.topics.alarms;

        await producer.send({
          topic,
          messages: [{ 
            value: JSON.stringify({
              id: messagesSent + 1,
              deviceId: 'test-device-001',
              timestamp: new Date().toISOString(),
              ...message
            })
          }]
        });

        messagesSent++;
        currentTest.messagesSent = messagesSent;

        // Calculate current rate and send progress update every second
        if (currentTime - lastUpdateTime >= 1000) {
          const currentRate = messagesSent / elapsedTime;
          sendTestUpdate({ 
            type: 'progress', 
            messagesSent,
            timeElapsed: elapsedTime,
            currentRate,
            config: {
              messagesPerSecond,
              durationSeconds
            }
          });
          lastUpdateTime = currentTime;
        }
      } catch (error) {
        console.error('Error sending message:', error);
        sendTestUpdate({ type: 'error', error: error.message });
      }
    }, delayMs);

    res.json({ 
      status: 'success', 
      message: `Started test: sending ${messagesPerSecond} messages/second for ${durationSeconds} seconds` 
    });
  } catch (error) {
    console.error('Failed to start test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to send a message
app.post('/api/test-message', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const message = {
      type: 'test',
      timestamp: new Date().toISOString(),
      message: 'Test message'
    };

    await producer.send({
      topic: config.kafka.topics.telemetry,
      messages: [{ value: JSON.stringify(message) }]
    });

    res.json({ status: 'success', message: 'Message sent' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Connect to Kafka and start server
connectToKafka()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch(error => {
    console.error('Failed to start:', error);
    process.exit(1);
  });

// Cleanup on exit
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await consumer.disconnect();
  await producer.disconnect();
  process.exit(0);
}); 