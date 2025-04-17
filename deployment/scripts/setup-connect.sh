#!/bin/bash

set -e

echo "Setting up Kafka Connect..."

# Install JDBC connector if not already installed
if [ ! -d "/usr/share/confluent-hub-components/confluentinc-kafka-connect-jdbc" ]; then
    echo "Installing JDBC connector..."
    confluent-hub install --no-prompt confluentinc/kafka-connect-jdbc:10.7.4
fi

# Start Kafka Connect
echo "Starting Kafka Connect..."
/etc/confluent/docker/run 