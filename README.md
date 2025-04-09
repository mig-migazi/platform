# IoT Telemetry Testing Platform

A platform for testing IoT telemetry message production using either Redpanda or Confluent Kafka.

## Features

- React-based UI for test configuration and monitoring
- Real-time test progress visualization
- Support for both Redpanda and Confluent Kafka
- Telemetry and alarm message simulation
- Topic message count monitoring
- Docker-based deployment

## Prerequisites

- Docker
- Docker Compose

## Components

### 1. Frontend (React)
- Material-UI components
- Real-time updates using Server-Sent Events
- Test configuration and monitoring interface
- Topic message count display

### 2. Backend (Node.js)
- Express server
- KafkaJS for Kafka integration
- Message generation and publishing
- Topic management

### 3. Message Brokers
#### Redpanda
A lightweight, Kafka-compatible streaming platform.
- Configuration: `docker-compose.redpanda.yml`
- Environment: `redpanda-config.env`
- Topic management: `manage-redpanda-topics.sh`

#### Confluent Platform (Kafka)
A full-featured Kafka distribution with KRaft mode.
- Configuration: `docker-compose.confluent.yml`
- Environment: `confluent-config.env`
- Topic management: `manage-confluent-topics.sh`

## Setup and Usage

1. Choose your message broker:

```bash
# For Redpanda
docker-compose -f docker-compose.redpanda.yml up -d

# For Confluent Kafka
docker-compose -f docker-compose.confluent.yml up -d
```

2. Create required topics:

```bash
# For Redpanda
./manage-redpanda-topics.sh create

# For Confluent Kafka
./manage-confluent-topics.sh create
```

3. Start the backend:

```bash
docker run -d --name iot-platform-backend \
  --network platform_kafka-network \
  -p 3001:3001 \
  -e BROKER_TYPE=confluent \
  iot-platform-backend
```

4. Start the frontend:

```bash
docker run -d --name iot-platform-frontend \
  --network platform_kafka-network \
  -p 3000:3000 \
  -e REACT_APP_API_URL=http://your-host:3001 \
  iot-platform-frontend
```

5. Access the UI at `http://localhost:3000`

## Test Configuration

The platform supports two types of test messages:

### 1. Telemetry Messages
- Temperature: 20-30°C
- Humidity: 40-60%
- Pressure: 1000-1020 hPa
- Battery: 80-100%

### 2. Alarm Messages
- Severity: 1-3
- Error Code: 100-200

## Topic Management

Use the management scripts to:
- Create topics: `./manage-*-topics.sh create`
- List topics: `./manage-*-topics.sh list`
- Delete topics: `./manage-*-topics.sh delete`

## Development

### Building the Images

```bash
# Build frontend
cd frontend && docker build -t iot-platform-frontend .

# Build backend
cd backend && docker build -t iot-platform-backend .
```

### Environment Variables

#### Backend
- `BROKER_TYPE`: Type of broker ('redpanda' or 'confluent')
- `PORT`: Server port (default: 3001)

#### Frontend
- `REACT_APP_API_URL`: Backend API URL

## Networking

All components use Docker's `platform_kafka-network` network for communication. The frontend communicates with the backend using the configured API URL, and the backend communicates with the message broker using the appropriate configuration for the selected broker type.
