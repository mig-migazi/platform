#!/bin/bash

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
until kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; do
    echo "Kafka is not ready yet. Waiting..."
    sleep 2
done
echo "Kafka is ready!"

# Check and create topics if they don't exist
echo "Checking existing topics..."
if ! kafka-topics --bootstrap-server localhost:9092 --describe --topic iot_messages > /dev/null 2>&1; then
    echo "Creating topic iot_messages..."
    kafka-topics --create --bootstrap-server localhost:9092 --topic iot_messages --partitions 1 --replication-factor 1
else
    echo "Topic iot_messages already exists, skipping creation"
fi

if ! kafka-topics --bootstrap-server localhost:9092 --describe --topic alarms > /dev/null 2>&1; then
    echo "Creating topic alarms..."
    kafka-topics --create --bootstrap-server localhost:9092 --topic alarms --partitions 1 --replication-factor 1
else
    echo "Topic alarms already exists, skipping creation"
fi

# List topics
echo "Current topics:"
kafka-topics --list --bootstrap-server localhost:9092 