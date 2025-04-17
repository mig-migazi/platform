#!/bin/bash

# Start TimescaleDB and Kafka Connect
docker-compose -f docker-compose.timescaledb.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Initialize TimescaleDB tables
echo "Initializing TimescaleDB tables..."
docker exec -i timescaledb psql -U postgres -d iot_platform < timescaledb-init.sql

# Wait for Kafka Connect to be ready
echo "Waiting for Kafka Connect to be ready..."
sleep 10

# Create Kafka Connect connectors
echo "Creating Kafka Connect connectors..."
docker exec -i kafka-connect curl -X POST -H "Content-Type: application/json" --data @/usr/share/confluent-hub-components/iot-messages-sink.json http://kafka-connect:8083/connectors
docker exec -i kafka-connect curl -X POST -H "Content-Type: application/json" --data @/usr/share/confluent-hub-components/alarms-sink.json http://kafka-connect:8083/connectors

echo "Setup complete!" 