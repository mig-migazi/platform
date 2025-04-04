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
