#!/bin/bash

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
until kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; do
    echo "Kafka is not ready yet. Waiting..."
    sleep 2
done
echo "Kafka is ready!"

# Create topics
echo "Creating topics..."
kafka-topics --create --bootstrap-server localhost:9092 --topic iot_messages --partitions 1 --replication-factor 1
kafka-topics --create --bootstrap-server localhost:9092 --topic alarms --partitions 1 --replication-factor 1

# List topics
echo "Topics created:"
kafka-topics --list --bootstrap-server localhost:9092 