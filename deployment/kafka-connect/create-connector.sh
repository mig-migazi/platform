#!/bin/bash

# Wait for Kafka Connect to be ready
echo "Waiting for Kafka Connect to be ready..."
while ! curl -s http://connect:8083/connectors > /dev/null; do
  sleep 1
done

# Register the JDBC sink connector
echo "Registering JDBC sink connector..."
curl -X POST -H "Content-Type: application/json" \
  --data @/kafka-connect/iot-messages-sink.json \
  http://connect:8083/connectors

# Check if the connector was created successfully
echo "Checking connector status..."
curl -s http://connect:8083/connectors/iot-messages-sink/status | jq . 