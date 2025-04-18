# IoT Platform

A scalable IoT platform for processing and visualizing IoT device messages and alarms using modern cloud-native technologies.

## Architecture

The platform consists of the following components:

### Backend Services
- **Kafka**: Message broker for handling IoT messages and alarms
- **Schema Registry**: Manages Avro schemas for message validation
- **Kafka Connect**: Handles data integration with TimescaleDB
  - JDBC Sink Connector for IoT Messages
  - JDBC Sink Connector for Alarms with timestamp conversion
- **TimescaleDB**: Time-series database for storing IoT data
- **Node.js Backend**: REST API service for managing the platform

### Frontend
- **React Application**: Modern web interface for monitoring and testing
- Built with Material-UI for a clean, responsive design
- Real-time updates using Server-Sent Events (SSE)

## Prerequisites

- Docker and Docker Compose
- Node.js 20.x (for local development)
- npm 10.x (for local development)

## Quick Start

1. Extract the platform package to your desired location:
   ```bash
   unzip platform.zip
   cd platform
   ```

2. Start the platform services (Kafka, TimescaleDB, etc.):
   ```bash
   ./deployment/scripts/start-platform.sh
   ```

   This script will:
   - Start Kafka and Schema Registry
   - Initialize TimescaleDB
   - Register schemas
   - Create Kafka topics
   - Configure Kafka Connect with proper timestamp handling

3. Start the application services (backend and frontend):
   ```bash
   ./deployment/scripts/start-app.sh
   ```

4. Access the web interface at http://localhost:3000

### Optional Flags

Both startup scripts support the `--keep-data` flag to preserve existing data:
```bash
./deployment/scripts/start-platform.sh --keep-data
./deployment/scripts/start-app.sh --keep-data
```

## Components

### Backend (Node.js)
- REST API for platform management
- Kafka producer/consumer integration
- Schema Registry integration
- TimescaleDB connection management
- Test message generation
- Health monitoring

Endpoints:
- `GET /api/health`: Platform health status
- `GET /api/topic-counts`: Message counts in Kafka topics
- `GET /api/database-counts`: Record counts in TimescaleDB
- `POST /api/test`: Start a test message generation
- `GET /api/test-progress`: SSE endpoint for test progress
- `POST /api/test-alarm`: Generate a test alarm message

### Frontend (React)
- Real-time monitoring dashboard
- Test message generation interface
- Health status monitoring
- Message count visualization

Components:
- `HealthStatus`: Shows platform component health
- `MessageCounts`: Displays message counts from Kafka and TimescaleDB
- `TestProgress`: Controls and monitors test message generation

### Data Storage
- **TimescaleDB**:
  - `iot_messages`: Stores IoT device telemetry
    - Timestamp (TIMESTAMPTZ)
    - Device ID
    - Temperature, Humidity, Pressure, Battery
    - Metadata (JSONB)
  - `alarms`: Stores device alarm events
    - Timestamp (TIMESTAMPTZ)
    - Device ID
    - Severity
    - Error Code

### Message Schemas
- IoT Messages Schema (Avro)
- Alarm Messages Schema (Avro)

### Kafka Connect Configuration
- **JDBC Sink Connector for IoT Messages**:
  - Handles IoT device telemetry data
  - Direct mapping to TimescaleDB table
  - Error handling with dead letter queue

- **JDBC Sink Connector for Alarms**:
  - Handles alarm events
  - Includes timestamp conversion from Unix milliseconds to TIMESTAMPTZ
  - Field renaming for database compatibility
  - Error handling with dead letter queue

## Development

### Local Development Setup

1. Backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure ports 3000, 3001, 8081, 8082, 8083, 9092, and 5432 are available
2. **Container Issues**: Try running with `--keep-data` flag to preserve existing data
3. **Network Issues**: Ensure Docker network `platform_kafka-network` is created
4. **Timestamp Issues**: If alarms are not being stored, check the Kafka Connect logs for timestamp conversion errors

### Logs

Check container logs for specific services:
```bash
docker logs backend
docker logs frontend
docker logs kafka
docker logs timescaledb
docker logs connect  # For Kafka Connect issues
```

## License

[Your License Here]
