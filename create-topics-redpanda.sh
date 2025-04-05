#!/bin/bash

# Wait for Redpanda to be ready
echo "Waiting for Redpanda to be ready..."
until rpk cluster health > /dev/null 2>&1; do
    echo "Redpanda is not ready yet. Waiting..."
    sleep 2
done
echo "Redpanda is ready!"

# Check and create topics if they don't exist
echo "Checking existing topics..."
if ! rpk topic describe iot_messages > /dev/null 2>&1; then
    echo "Creating topic iot_messages..."
    rpk topic create iot_messages --partitions 1 --replicas 1
else
    echo "Topic iot_messages already exists, skipping creation"
fi

if ! rpk topic describe alarms > /dev/null 2>&1; then
    echo "Creating topic alarms..."
    rpk topic create alarms --partitions 1 --replicas 1
else
    echo "Topic alarms already exists, skipping creation"
fi

# List topics
echo "Current topics:"
rpk topic list 