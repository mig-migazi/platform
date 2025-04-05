# Kafka Platform Setup

This repository contains configurations for setting up both Redpanda and Confluent Platform (Kafka) with KRaft mode.

## Prerequisites

- Docker
- Docker Compose

## Available Configurations

### 1. Redpanda
A lightweight, Kafka-compatible streaming platform.

Configuration file: `docker-compose.redpanda.yml`

### 2. Confluent Platform (Kafka)
A full-featured Kafka distribution with KRaft mode (no ZooKeeper required).

Configuration file: `docker-compose.confluent.yml`

## Testing

A test script is provided to verify both setups. The script will:
1. Start the services
2. Create the required topics
3. Verify the topics are created correctly
4. Test message production and consumption

To run the tests:

```bash
# Test both Redpanda and Confluent Platform with clean data (default)
./test.sh

# Test only Redpanda with clean data
./test.sh --redpanda-only

# Test only Confluent Platform with clean data
./test.sh --confluent-only

# Test while preserving existing data
./test.sh --keep-data
```

### Data Persistence

By default, the test script will delete all data volumes when starting up. This ensures a clean state for testing. However, you can preserve data between runs using the `--keep-data` flag:

- Without `--keep-data`: All data is deleted when services are stopped
- With `--keep-data`: Data is preserved between runs

This is useful when you want to:
- Start fresh for each test run (default)
- Preserve messages and topics between runs
- Test data persistence scenarios

## Topics

Both configurations create the following topics:
- `iot_messages` (1 partition, 1 replica)
- `alarms` (1 partition, 1 replica)

The topic creation scripts will:
- Check if topics already exist
- Only create topics that don't exist
- Preserve existing topics and their data

## Manual Testing

If you want to test a specific configuration manually:

### Redpanda
```bash
# Start the services with clean data
docker-compose -f docker-compose.redpanda.yml down -v
docker-compose -f docker-compose.redpanda.yml up -d

# Start the services preserving existing data
docker-compose -f docker-compose.redpanda.yml down
docker-compose -f docker-compose.redpanda.yml up -d

# Check topics
docker exec redpanda rpk topic list
docker exec redpanda rpk topic describe iot_messages alarms

# Clean up (with or without -v to preserve/delete data)
docker-compose -f docker-compose.redpanda.yml down [-v]
```

### Confluent Platform
```bash
# Start the services with clean data
docker-compose -f docker-compose.confluent.yml down -v
docker-compose -f docker-compose.confluent.yml up -d

# Start the services preserving existing data
docker-compose -f docker-compose.confluent.yml down
docker-compose -f docker-compose.confluent.yml up -d

# Check topics
docker exec broker kafka-topics --bootstrap-server localhost:9092 --list
docker exec broker kafka-topics --bootstrap-server localhost:9092 --describe

# Clean up (with or without -v to preserve/delete data)
docker-compose -f docker-compose.confluent.yml down [-v]
```

## Networking

Both configurations use Docker's internal networking:
- Redpanda: Uses `network_mode: "service:redpanda"` for the topic-creator service
- Confluent Platform: Uses `network_mode: "service:broker"` for the topic-creator service

This ensures that services can communicate using their container names, which is important for remote deployments.
