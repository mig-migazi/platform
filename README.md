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
4. Clean up the containers

To run the tests:

```bash
./test.sh
```

The script will test both Redpanda and Confluent Platform setups sequentially.

## Topics

Both configurations create the following topics:
- `iot_messages` (1 partition, 1 replica)
- `alarms` (1 partition, 1 replica)

## Manual Testing

If you want to test a specific configuration manually:

### Redpanda
```bash
# Start the services
docker-compose -f docker-compose.redpanda.yml up -d

# Check topics
docker exec redpanda rpk topic list
docker exec redpanda rpk topic describe iot_messages alarms

# Clean up
docker-compose -f docker-compose.redpanda.yml down -v --remove-orphans
```

### Confluent Platform
```bash
# Start the services
docker-compose -f docker-compose.confluent.yml up -d

# Check topics
docker exec broker kafka-topics --bootstrap-server localhost:9092 --list
docker exec broker kafka-topics --bootstrap-server localhost:9092 --describe

# Clean up
docker-compose -f docker-compose.confluent.yml down -v --remove-orphans
```

## Networking

Both configurations use Docker's internal networking:
- Redpanda: Uses `network_mode: "service:redpanda"` for the topic-creator service
- Confluent Platform: Uses `network_mode: "service:broker"` for the topic-creator service

This ensures that services can communicate using their container names, which is important for remote deployments.
