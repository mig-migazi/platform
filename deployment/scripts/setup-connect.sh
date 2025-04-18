#!/bin/bash

set -e

echo "Setting up Kafka Connect..."

# Install JDBC connector using Confluent Hub
echo "Installing JDBC connector..."
confluent-hub install --no-prompt confluentinc/kafka-connect-jdbc:10.7.3

# Start Kafka Connect
echo "Starting Kafka Connect..."
/etc/confluent/docker/run 