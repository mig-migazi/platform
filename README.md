# IoT Data Processing Platform

A platform for processing IoT data using Kafka (Redpanda), TimescaleDB, and MinIO.

## System Architecture

This document describes the design and implementation of a distributed system for processing IoT telemetry data. The system is built using .NET Core and consists of several components that work together to collect, process, and store telemetry data from IoT devices.

### Components

The system is designed as a microservices architecture with the following components:

#### IoT Processor Service

The IoT Processor Service is the main component that receives telemetry data from IoT devices and processes it. It is built using ASP.NET Core and provides a REST API for receiving telemetry data.

##### Key Features

- REST API for receiving telemetry data
- Integration with Redpanda for message queuing
- Integration with TimescaleDB for time-series data storage
- Support for processing different types of telemetry data (temperature, humidity, pressure, etc.)
- Alarm generation based on configurable thresholds
- Swagger UI for API documentation in Development mode

##### API Endpoints

The API is documented using Swagger UI, which is available at `http://localhost:5000` when running in Development mode.

Current API Endpoints:

- `GET /api/stats` - Get statistics about the telemetry data including:
  - Number of records in TimescaleDB
  - Latest messages
  - Latest alarms
  - Parquet file information

- `GET /api/messages` - Get the latest telemetry messages (up to 100)

- `GET /api/alarms` - Get the latest alarm messages (up to 100)

- `POST /api/test` - Generate test data with the following configuration:
  ```json
  {
    "durationSeconds": 5,
    "messagesPerSecond": 2,
    "numberOfDevices": 3
  }
  ```

##### Development Mode

To enable Swagger UI and access the API documentation:
1. Set `ASPNETCORE_ENVIRONMENT=Development`
2. Access the API at `http://localhost:5000`
3. The Swagger UI will be available at the root path

#### Test Service

The system includes a test service for running integration tests. The tests verify:
- API connectivity and functionality
- Message processing pipeline
- Data storage and retrieval
- Alarm generation

To run the tests:
```bash
# Run all tests
docker-compose up test

# Rebuild and run tests (when code changes)
docker-compose build --no-cache test && docker-compose up test
```

#### Redpanda Integration

Redpanda is used as a message queue for distributing telemetry data between components. The system uses the following topics:

- `iot_telemetry` - Raw telemetry data from IoT devices
- `iot_alarms` - Alarm messages generated by the system

#### TimescaleDB Integration

TimescaleDB is used for storing time-series data. The system uses the following tables:

- `telemetry` - Stores telemetry data from IoT devices
- `alarms` - Stores alarm messages generated by the system

### Implementation Details

#### Message Processing Pipeline

The system processes messages in the following steps:

1. Test data generation through `/api/test` endpoint
2. Messages are sent to Redpanda topic `iot_telemetry`
3. The consumer service processes messages and:
   - Stores data in TimescaleDB
   - Generates alarms if thresholds are exceeded
   - Stores alarms in TimescaleDB
   - Writes data to Parquet files

#### Data Storage

The system uses TimescaleDB for storing time-series data. The following tables are used:

##### Telemetry Table

```sql
CREATE TABLE telemetry (
    time TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    pressure DOUBLE PRECISION
);

SELECT create_hypertable('telemetry', 'time');
```

##### Alarms Table

```sql
CREATE TABLE alarms (
    time TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    alarm_type TEXT NOT NULL,
    value DOUBLE PRECISION,
    threshold DOUBLE PRECISION
);

SELECT create_hypertable('alarms', 'time');
```

#### Development and Testing

The system includes comprehensive integration tests that verify:
1. API endpoint functionality
2. Message processing pipeline
3. Data storage and retrieval
4. Alarm generation

To run the tests:
```bash
# Start all services
docker-compose up -d

# Run tests
docker-compose up test

# Rebuild and run tests (after code changes)
docker-compose build --no-cache test && docker-compose up test
```

### Testing

The system includes unit tests and integration tests to ensure its reliability and correctness. The tests cover the following areas:

- API endpoints
- Message processing
- Alarm generation
- Database operations
- Redpanda integration

### Deployment

The system can be deployed using Docker containers. The following containers are required:

- IoT Processor Service
- Redpanda
- TimescaleDB

### Monitoring and Logging

The system uses structured logging for monitoring and debugging. The following information is logged:

- API requests and responses
- Message processing
- Alarm generation
- Database operations
- Error conditions

### Security

The system implements the following security measures:

- JWT authentication for API access
- HTTPS for API communication
- Secure communication with Redpanda and TimescaleDB
- Input validation and sanitization

### Future Improvements

The following improvements are planned for future releases:

- Support for more telemetry data types
- Configurable alarm thresholds via API
- Real-time data visualization
- Support for device management
- Integration with more message queues and databases

## Prerequisites

- Docker
- Docker Compose
- .NET 8.0 SDK (for development)
- Node.js 20.x (for web client)

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd platform
   ```

2. Start the services:
   ```bash
   docker-compose up -d
   ```

3. Initialize the database:
   ```bash
   docker exec -i timescaledb psql -U postgres -d iotdb < init-timescaledb.sql
   ```

4. The following services will be available:
   - Redpanda: localhost:9092 (Kafka)
   - TimescaleDB: localhost:5432
   - MinIO: localhost:9000 (API) and localhost:9001 (Console)
   - IoT Processor: localhost:5000
   - Web Client: localhost:3000

## Development

### Building the IoT Processor

```bash
cd iot_processor
dotnet build
```

### Running Tests

1. Make sure all services are running:
   ```bash
   docker-compose up -d
   ```

2. Run the tests:
   ```bash
   cd iot_processor.tests
   dotnet test
   ```

The tests will:
- Generate test data and send it to Redpanda
- Verify Redpanda connectivity
- Verify TimescaleDB connectivity
- Test API endpoints

### Web Client Development

1. Install dependencies:
   ```bash
   cd web_client
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

- `iot_processor/`: The main IoT data processing service
- `iot_processor.tests/`: Test project for integration tests
- `web_client/`: Web interface for viewing IoT data
- `docker-compose.yml`: Docker Compose configuration
- `init-timescaledb.sql`: Database initialization script

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Verify TimescaleDB is running:
   ```bash
   docker ps | grep timescaledb
   ```

2. Check database logs:
   ```bash
   docker logs timescaledb
   ```

3. Try connecting manually:
   ```bash
   PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d iotdb
   ```

### Redpanda Issues

If you encounter Redpanda issues:

1. Verify Redpanda is running:
   ```bash
   docker ps | grep redpanda
   ```

2. Check Redpanda logs:
   ```bash
   docker logs redpanda
   ```

## License

[Add your license here]

## Quick Start

1. **Start the system**
   ```bash
   docker-compose up -d
   ```

2. **Access the API documentation**
   - Open http://localhost:5000 in your browser
   - You'll see the Swagger UI with all available endpoints

3. **Generate test data**
   ```bash
   curl -X POST http://localhost:5000/api/test \
     -H "Content-Type: application/json" \
     -d '{"durationSeconds": 5, "messagesPerSecond": 2, "numberOfDevices": 3}'
   ```

4. **Check the data**
   ```bash
   curl http://localhost:5000/api/stats
   ```

### API Reference

#### Data Models

##### Telemetry Message
```json
{
  "deviceId": "string",
  "timestamp": "2024-04-03T00:00:00Z",
  "temperature": 25.5,
  "humidity": 60.0,
  "pressure": 1013.25
}
```

##### Alarm Message
```json
{
  "deviceId": "string",
  "timestamp": "2024-04-03T00:00:00Z",
  "alarmType": "string",
  "value": 25.5,
  "threshold": 30.0
}
```

##### Data Store Stats
```json
{
  "timescaleRecordCount": 0,
  "parquetFileCount": 0,
  "messagesPerSecond": 0,
  "latestMessages": [
    {
      "deviceId": "string",
      "timestamp": "2024-04-03T00:00:00Z",
      "temperature": 25.5,
      "humidity": 60.0,
      "pressure": 1013.25
    }
  ],
  "latestAlarms": [
    {
      "deviceId": "string",
      "timestamp": "2024-04-03T00:00:00Z",
      "alarmType": "string",
      "value": 25.5,
      "threshold": 30.0
    }
  ],
  "parquetFiles": []
}
```

#### Endpoint Details

##### GET /api/stats
Returns statistics about the data store.

**Response**
```json
{
  "timescaleRecordCount": 24,
  "parquetFileCount": 0,
  "messagesPerSecond": 0,
  "latestMessages": [...],
  "latestAlarms": [...],
  "parquetFiles": []
}
```

##### GET /api/messages
Returns the latest telemetry messages.

**Response**
```json
[
  {
    "deviceId": "device-1",
    "timestamp": "2024-04-03T00:00:00Z",
    "temperature": 25.5,
    "humidity": 60.0,
    "pressure": 1013.25
  }
]
```

##### GET /api/alarms
Returns the latest alarm messages.

**Response**
```json
[
  {
    "deviceId": "device-1",
    "timestamp": "2024-04-03T00:00:00Z",
    "alarmType": "HIGH_TEMPERATURE",
    "value": 35.5,
    "threshold": 30.0
  }
]
```

##### POST /api/test
Generates test data.

**Request**
```json
{
  "durationSeconds": 5,
  "messagesPerSecond": 2,
  "numberOfDevices": 3
}
```

**Response**
```json
{
  "messageCount": 30,
  "devices": ["device-1", "device-2", "device-3"]
}
```

### Usage Examples

#### Generate Test Data
```bash
curl -X POST http://localhost:5000/api/test \
  -H "Content-Type: application/json" \
  -d '{"durationSeconds": 5, "messagesPerSecond": 2, "numberOfDevices": 3}'
```

#### Check Statistics
```bash
curl http://localhost:5000/api/stats
```

#### Get Latest Messages
```bash
curl http://localhost:5000/api/messages
```

#### Get Latest Alarms
```bash
curl http://localhost:5000/api/alarms
```

### Development Workflow

1. **Start development environment**
   ```bash
   docker-compose up -d
   ```

2. **Make code changes**
   - Edit files in your IDE
   - Changes are automatically detected

3. **Rebuild and restart services**
   ```bash
   docker-compose build --no-cache iot_processor
   docker-compose up -d iot_processor
   ```

4. **Run tests**
   ```bash
   docker-compose build --no-cache test
   docker-compose up test
   ```

5. **Check logs**
   ```bash
   docker-compose logs -f iot_processor
   ```

# Redpanda Setup

This repository contains the configuration for running Redpanda, a Kafka-compatible streaming platform.

## Files

- `docker-compose.yml`: Docker Compose configuration for running Redpanda
- `create-topics.sh`: Script to create initial topics in Redpanda
- `.gitignore`: Git ignore file for the project

## Getting Started

1. Start Redpanda:
```bash
docker-compose up -d
```

2. The `topic-creator` service will automatically create the following topics:
   - `iot_messages` (1 partition, 1 replica)
   - `alarms` (1 partition, 1 replica)

3. Verify the topics were created:
```bash
docker exec redpanda rpk topic list
```

## Configuration

The setup includes:
- Redpanda running in a single-node configuration
- Automatic topic creation for `iot_messages` and `alarms`
- Health checks to ensure Redpanda is ready before creating topics

## Network Configuration

The services are configured to use shared networking to ensure proper communication between the Redpanda broker and the topic creator service. 