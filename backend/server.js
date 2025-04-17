const express = require('express');
const cors = require('cors');
const { Kafka, logLevel } = require('kafkajs');
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry');
const { Pool } = require('pg');
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
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send an initial message
  const initialMessage = { type: 'connected' };
  res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);

  // Add client to the set
  clients.add(res);

  // Remove client when connection closes
  req.on('close', () => {
    clients.delete(res);
  });

  // Handle errors
  req.on('error', (error) => {
    console.error('SSE connection error:', error);
    clients.delete(res);
  });
});

// POST endpoint to start a test
app.post('/api/test-progress', async (req, res) => {
  try {
    const { messagesPerSecond, durationSeconds, messageConfig } = req.body;
    
    if (!messagesPerSecond || !durationSeconds || !messageConfig) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Start the test in the background
    generateTestData(messagesPerSecond, durationSeconds, messageConfig)
      .catch(error => {
        console.error('Error in test generation:', error);
        sendTestUpdate({ type: 'error', message: error.message });
      });

    // Return immediately
    res.json({ status: 'test_started' });
  } catch (error) {
    console.error('Error starting test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function to send updates to all connected clients
function sendTestUpdate(data) {
  try {
    const eventData = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
      try {
        client.write(eventData);
      } catch (error) {
        console.error('Error sending update to client:', error);
        clients.delete(client);
      }
    });
  } catch (error) {
    console.error('Error sending test update:', error);
  }
}

// Kafka configuration
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: [config.kafka.bootstrapServers],
  logLevel: logLevel.DEBUG,
  retry: {
    initialRetryTime: 100,
    maxRetryTime: 30000,
    retries: 10
  }
});

// Schema Registry configuration
const registry = new SchemaRegistry({ host: config.kafka.schemaRegistry });

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: config.kafka.clientId + '-consumer' });
const admin = kafka.admin();

let isConnected = false;
let currentTest = null;
let telemetrySchemaId = null;
let alarmSchemaId = null;

// Configure PostgreSQL connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'timescaledb',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'iot_platform',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
});

// Test database connection
let isDatabaseConnected = false;
async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    isDatabaseConnected = true;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    isDatabaseConnected = false;
    return false;
  }
}

// Check database connection periodically
setInterval(checkDatabaseConnection, 30000);
checkDatabaseConnection();

// Data generation functions
function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTelemetryData() {
  return {
    timestamp: Date.now(),
    id: 'device001',
    temperature: generateRandomNumber(20, 30),
    humidity: generateRandomNumber(40, 60),
    pressure: generateRandomNumber(1000, 1020),
    battery: generateRandomNumber(80, 100),
    metadata: {}
  };
}

function generateAlarmData() {
  return {
    timestamp: Date.now(),
    id: 'device001',
    severity: Math.floor(Math.random() * 3) + 1, // 1-3
    errorCode: Math.floor(Math.random() * 900) + 100 // 100-999
  };
}

// Function to get schema ID by version
async function getSchemaIdByVersion(subject, targetVersion) {
  try {
    const schemaId = await registry.getLatestSchemaId(subject);
    return schemaId;
  } catch (error) {
    console.error(`Error getting schema ID for ${subject}:`, error);
    throw error;
  }
}

// Connect to Kafka on startup
async function connectToKafka(retryCount = 0, maxRetries = 10) {
  try {
    console.log(`Connecting to ${config.kafka.brokerType}... (attempt ${retryCount + 1}/${maxRetries})`);
    
    // Clean disconnect if already connected
    if (isConnected) {
      await disconnectFromKafka();
    }
    
    // Connect to Kafka
    await producer.connect();
    await consumer.connect();
    await admin.connect();
    
    // Get schema IDs for v1 versions
    try {
      console.log('Retrieving schema IDs...');
      telemetrySchemaId = await getSchemaIdByVersion('iot_messages-value', 'v1');
      alarmSchemaId = await getSchemaIdByVersion('iot_alarms-value', 'v1');
      console.log('Schema IDs retrieved:', { telemetrySchemaId, alarmSchemaId });
    } catch (schemaError) {
      console.error('Error getting schema IDs:', schemaError);
      throw schemaError;
    }
    
    // Subscribe to topics
    await consumer.subscribe({ topic: config.kafka.topics.telemetry });
    
    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const decodedMessage = await registry.decode(message.value);
          console.log('Received message:', decodedMessage);
          // Notify connected clients
          sendTestUpdate({ type: 'message', data: decodedMessage });
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
    });

    isConnected = true;
    console.log('Successfully connected to Kafka');
    return true;
  } catch (error) {
    console.error('Kafka connection error:', error);
    
    if (retryCount < maxRetries) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff with max 30s
      console.log(`Retrying in ${retryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return connectToKafka(retryCount + 1, maxRetries);
    }
    
    isConnected = false;
    throw error;
  }
}

// Graceful disconnect function
async function disconnectFromKafka() {
  try {
    if (consumer) {
      await consumer.disconnect();
    }
    if (producer) {
      await producer.disconnect();
    }
    if (admin) {
      await admin.disconnect();
    }
    isConnected = false;
    console.log('Disconnected from Kafka');
  } catch (error) {
    console.error('Error disconnecting from Kafka:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Cleaning up...');
  await disconnectFromKafka();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Cleaning up...');
  await disconnectFromKafka();
  process.exit(0);
});

// Initial connection
connectToKafka().catch(error => {
  console.error('Failed to connect to Kafka:', error);
});

// Get topic message counts
app.get('/api/topic-counts', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const [telemetryOffsets, alarmOffsets] = await Promise.all([
      admin.fetchTopicOffsets(config.kafka.topics.telemetry),
      admin.fetchTopicOffsets(config.kafka.topics.alarms)
    ]);

    const counts = {
      telemetry: telemetryOffsets.reduce((sum, partition) => sum + parseInt(partition.high), 0),
      alarms: alarmOffsets.reduce((sum, partition) => sum + parseInt(partition.high), 0)
    };

    res.json(counts);
  } catch (error) {
    console.error('Error getting topic counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get telemetry messages
app.get('/api/telemetry-messages', async (req, res) => {
  try {
    const messages = [];
    const consumer = kafka.consumer({ groupId: 'telemetry-api-consumer' });
    
    await consumer.connect();
    await consumer.subscribe({ topic: config.kafka.topics.telemetry, fromBeginning: true });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const decodedMessage = await registry.decode(message.value);
        messages.push(decodedMessage);
      }
    });

    // Give it a second to consume messages
    await new Promise(resolve => setTimeout(resolve, 1000));
    await consumer.disconnect();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching telemetry messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get alarm messages
app.get('/api/alarm-messages', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const messages = [];
    const consumer = kafka.consumer({ groupId: 'alarms-consumer-' + Date.now() });
    
    await consumer.connect();
    await consumer.subscribe({ topic: config.kafka.topics.alarms, fromBeginning: true });
    
    const messagePromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const decodedMessage = await registry.decode(message.value);
          messages.push(decodedMessage);
        }
      });
      setTimeout(resolve, 2000);
    });

    await messagePromise;
    await consumer.disconnect();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching alarms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({ 
    status: isConnected && isDatabaseConnected ? 'healthy' : 'error',
    kafka: isConnected ? 'connected' : 'disconnected',
    database: isDatabaseConnected ? 'connected' : 'disconnected',
    broker: config.kafka.brokerType,
    testRunning: currentTest !== null
  });
});

// Get database record counts
app.get('/api/database-counts', async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      throw new Error('Not connected to database');
    }

    const client = await pool.connect();
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM iot_messages) as telemetry_count,
        (SELECT COUNT(*) FROM alarms) as alarms_count
    `);
    client.release();

    res.json({
      telemetry: parseInt(result.rows[0].telemetry_count),
      alarms: parseInt(result.rows[0].alarms_count)
    });
  } catch (error) {
    console.error('Failed to get database counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function to send test messages
async function sendTestMessages(messagesPerSecond, durationSeconds, messageConfig = {}) {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);
    const interval = 1000 / messagesPerSecond;

    const sendMessage = async () => {
      if (Date.now() >= endTime) {
        clearInterval(timer);
        sendTestUpdate({ type: 'complete' });
        return;
      }

      try {
        const telemetryData = {
          ...generateTelemetryData(),
          ...messageConfig
        };

        const encodedTelemetry = await registry.encode(telemetrySchemaId, telemetryData);
        await producer.send({
          topic: config.kafka.topics.telemetry,
          messages: [{ value: encodedTelemetry }]
        });

        // Generate and send alarm data
        const alarmData = generateAlarmData();
        const encodedAlarm = await registry.encode(alarmSchemaId, alarmData);
        await producer.send({
          topic: config.kafka.topics.alarms,
          messages: [{ value: encodedAlarm }]
        });

        sendTestUpdate({
          type: 'progress',
          data: telemetryData
        });
      } catch (error) {
        console.error('Error sending message:', error);
        sendTestUpdate({
          type: 'error',
          error: error.message
        });
      }
    };

    const timer = setInterval(sendMessage, interval);
    currentTest = timer;

    return { status: 'started' };
  } catch (error) {
    console.error('Error starting test:', error);
    throw error;
  }
}

// Start test endpoint
app.post('/api/start-test', async (req, res) => {
  try {
    console.log('Received test parameters:', req.body);
    const { messagesPerSecond, durationSeconds, messageConfig } = req.body;

    // Validate input
    if (!messagesPerSecond || !durationSeconds || !messageConfig) {
      console.log('Missing parameters. Required:', { messagesPerSecond, durationSeconds, messageConfig });
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

    // Get schema IDs before starting the test
    try {
      console.log('Getting schema IDs before starting test...');
      if (messageConfig.type === 'telemetry') {
        telemetrySchemaId = await registry.getLatestSchemaId('iot_messages-value');
        console.log('Using telemetry schema ID:', telemetrySchemaId);
      } else {
        alarmSchemaId = await registry.getLatestSchemaId('iot_alarms-value');
        console.log('Using alarm schema ID:', alarmSchemaId);
      }
    } catch (schemaError) {
      console.error('Failed to get schema IDs:', schemaError);
      return res.status(500).json({ error: `Schema error: ${schemaError.message}` });
    }

    // Start sending messages
    currentTest = {
      interval: setInterval(async () => {
        try {
          const data = messageConfig.type === 'telemetry' ? generateTelemetryData() : generateAlarmData();
          const schemaId = messageConfig.type === 'telemetry' ? telemetrySchemaId : alarmSchemaId;
          
          if (!schemaId) {
            throw new Error(`No schema ID available for ${messageConfig.type}`);
          }

          // Send testStarted event when the test begins
          if (messagesSent === 0) {
            sendTestUpdate({
              type: 'testStarted',
              config: {
                messagesPerSecond,
                durationSeconds
              }
            });
          }

          // Encode the message using Avro
          const encodedMessage = await registry.encode(schemaId, data);
          
          // Send message to Kafka
          await producer.send({
            topic: config.kafka.topics[messageConfig.type],
            messages: [
              { value: encodedMessage }
            ]
          });

          messagesSent++;
          const currentTime = Date.now();
          
          // Send progress update every second
          if (currentTime - lastUpdateTime >= 1000) {
            sendTestUpdate({
              type: 'progress',
              messagesSent,
              timeElapsed: Math.floor((currentTime - startTime) / 1000),
              progress: (Math.floor((currentTime - startTime) / 1000) / durationSeconds) * 100
            });
            lastUpdateTime = currentTime;
          }

          // Check if we've reached the duration
          if (currentTime - startTime >= durationSeconds * 1000) {
            clearInterval(currentTest.interval);
            currentTest = null;
            sendTestUpdate({
              type: 'testCompleted',
              messagesSent,
              duration: durationSeconds,
              progress: 100
            });
          }
        } catch (error) {
          console.error('Error sending message:', error);
          clearInterval(currentTest.interval);
          currentTest = null;
          sendTestUpdate({
            type: 'error',
            error: error.message
          });
        }
      }, delayMs)
    };

    res.json({ status: 'started' });
  } catch (error) {
    console.error('Error starting test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to send an alarm
app.post('/api/test-alarm', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const alarm = {
      timestamp: Date.now(),
      id: 'device001',
      severity: 2,
      errorCode: 1001
    };

    try {
      // Get the schema ID for v1
      console.log('Getting v1 schema ID for iot_alarms-value...');
      const schemaId = await getSchemaIdByVersion('iot_alarms-value', 'v1');
      console.log('Using schema ID:', schemaId);
      
      console.log('Encoding alarm with schema...');
      const encodedMessage = await registry.encode(schemaId, alarm);
      
      console.log('Sending alarm to Kafka...');
      await producer.send({
        topic: config.kafka.topics.alarms,
        messages: [{ value: encodedMessage }]
      });

      res.json({ status: 'success', message: 'Alarm sent' });
    } catch (schemaError) {
      console.error('Schema-related error:', schemaError);
      res.status(500).json({ error: `Schema error: ${schemaError.message}` });
    }
  } catch (error) {
    console.error('Failed to send alarm:', error);
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
      timestamp: Date.now(),
      id: 'device001',
      temperature: 25.5,
      humidity: 60.2,
      pressure: 1013.25,
      battery: 98.5,
      metadata: {
        "location": "room1",
        "device_type": "sensor"
      }
    };

    try {
      // Get the schema ID and encode the message
      console.log('Getting schema ID for iot_messages-value...');
      const versions = await registry.getVersions('iot_messages-value');
      let schemaId = null;
      
      for (const version of versions) {
        const schema = await registry.getSchemaByVersion('iot_messages-value', version);
        if (schema.metadata && schema.metadata.version === '1') {
          schemaId = schema.id;
          break;
        }
      }
      
      if (!schemaId) {
        throw new Error('Could not find version 1 schema for iot_messages');
      }
      
      console.log('Using schema ID:', schemaId);
      
      console.log('Encoding message with schema...');
      const encodedMessage = await registry.encode(schemaId, message);
      
      console.log('Sending message to Kafka...');
      await producer.send({
        topic: config.kafka.topics.telemetry,
        messages: [{ value: encodedMessage }]
      });

      res.json({ status: 'success', message: 'Message sent' });
    } catch (schemaError) {
      console.error('Schema-related error:', schemaError);
      res.status(500).json({ error: `Schema error: ${schemaError.message}` });
    }
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: error.message });
  }
});

// API Routes
// Get IoT message counts from database
app.get('/api/iot-message-counts', async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      throw new Error('Not connected to database');
    }

    const client = await pool.connect();
    const result = await client.query('SELECT COUNT(*) FROM iot_messages');
    client.release();

    res.json({
      messages: parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Error getting IoT message counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get alarm counts from database
app.get('/api/alarm-counts', async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      throw new Error('Not connected to database');
    }

    const client = await pool.connect();
    const result = await client.query('SELECT COUNT(*) FROM alarms');
    client.release();

    res.json({
      alarms: parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Error getting alarm counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get IoT messages from Kafka
app.get('/api/iot-messages', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const messages = [];
    const consumer = kafka.consumer({ groupId: 'iot-messages-consumer-' + Date.now() });
    
    await consumer.connect();
    await consumer.subscribe({ topic: config.kafka.topics.telemetry, fromBeginning: true });
    
    const messagePromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const decodedMessage = await registry.decode(message.value);
          messages.push(decodedMessage);
        }
      });
      setTimeout(resolve, 2000);
    });

    await messagePromise;
    await consumer.disconnect();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching IoT messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get alarm messages from Kafka
app.get('/api/alarm-messages', async (req, res) => {
  try {
    if (!isConnected) {
      throw new Error('Not connected to Kafka');
    }

    const messages = [];
    const consumer = kafka.consumer({ groupId: 'alarms-consumer-' + Date.now() });
    
    await consumer.connect();
    await consumer.subscribe({ topic: config.kafka.topics.alarms, fromBeginning: true });
    
    const messagePromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const decodedMessage = await registry.decode(message.value);
          messages.push(decodedMessage);
        }
      });
      setTimeout(resolve, 2000);
    });

    await messagePromise;
    await consumer.disconnect();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching alarms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});

async function generateTestData(messagesPerSecond, durationSeconds, messageConfig) {
  const startTime = Date.now();
  const endTime = startTime + (durationSeconds * 1000);
  const interval = 1000 / messagesPerSecond;
  let messageCount = 0;

  while (Date.now() < endTime) {
    // Generate data based on message type without merging config
    const data = messageConfig.type === 'telemetry' ? generateTelemetryData() : generateAlarmData();
    try {
      // Encode the message using the Schema Registry
      const schemaId = messageConfig.type === 'telemetry' ? telemetrySchemaId : alarmSchemaId;
      const encodedMessage = await registry.encode(schemaId, data);
      
      await producer.send({
        topic: config.kafka.topics[messageConfig.type],
        messages: [
          {
            key: Buffer.from(data.id),
            value: encodedMessage
          }
        ]
      });
      messageCount++;
      console.log(`Sent message ${messageCount}:`, data);
    } catch (error) {
      console.error('Error sending message:', error);
    }

    const nextMessageTime = startTime + (messageCount * interval);
    const delay = Math.max(0, nextMessageTime - Date.now());
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return messageCount;
} 