#!/bin/sh

# Wait for Redpanda to be ready
echo "Waiting for Redpanda to be ready..."
until rpk cluster health > /dev/null 2>&1; do
  echo "Redpanda is not ready yet. Waiting..."
  sleep 2
done
echo "Redpanda is ready!"

# Create topics
echo "Creating topics..."
echo "Creating iot_messages topic..."
rpk topic create iot_messages --partitions 1 --replicas 1

echo "Creating alarms topic..."
rpk topic create alarms --partitions 1 --replicas 1

# List topics
echo "Topics created:"
rpk topic list 