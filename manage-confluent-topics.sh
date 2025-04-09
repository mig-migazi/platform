#!/bin/bash

# Load environment variables
if [ -f confluent-config.env ]; then
    set -a
    source confluent-config.env
    set +a
else
    echo "Error: confluent-config.env file not found"
    exit 1
fi

# Default values if environment variables are not set
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-5}
TOPICS=${CONFLUENT_TOPICS:-iot_messages,alarms}
PARTITIONS=${CONFLUENT_PARTITIONS:-1}
REPLICATION_FACTOR=${CONFLUENT_REPLICATION_FACTOR:-1}

# Function to create topics
create_topics() {
    echo "Waiting for Confluent to be ready..."

    # Wait for Confluent to be ready
    for i in {1..30}; do
        if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
            echo "✅ Confluent is ready!"
            break
        fi
        echo "⏳ Confluent not ready yet... retrying in 2s ($i)"
        sleep 2
    done

    # Fail if Confluent never became available
    if ! docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
        echo "❌ Confluent did not become ready in time"
        exit 1
    fi

    echo "Attempting to create topics..."
    
    # Create topics from the comma-separated list
    IFS=',' read -ra TOPIC_ARRAY <<< "$TOPICS"
    all_topics_created=true
    
    for topic in "${TOPIC_ARRAY[@]}"; do
        echo "Creating topic ${topic}..."
        if ! docker exec kafka kafka-topics \
            --create \
            --topic "${topic}" \
            --partitions "${PARTITIONS}" \
            --replication-factor "${REPLICATION_FACTOR}" \
            --bootstrap-server localhost:9092 > /dev/null 2>&1; then
            echo "Failed to create topic ${topic}"
            all_topics_created=false
        else
            echo "Topic ${topic} created successfully"
        fi
    done

    # Verify topics were created
    for topic in "${TOPIC_ARRAY[@]}"; do
        if ! docker exec kafka kafka-topics \
            --describe \
            --topic "${topic}" \
            --bootstrap-server localhost:9092 > /dev/null 2>&1; then
            echo "Failed to verify topic ${topic}"
            all_topics_created=false
        else
            echo "Verified topic ${topic} exists"
        fi
    done

    if [ "$all_topics_created" = true ]; then
        echo "All topics created and verified successfully!"
        return 0
    else
        echo "Failed to verify all topics"
        return 1
    fi
}

# Function to list topics
list_topics() {
    echo "Listing topics..."
    docker exec kafka kafka-topics --list --bootstrap-server localhost:9092
}

# Function to delete topics
delete_topics() {
    echo "Deleting topics..."
    IFS=',' read -ra TOPIC_ARRAY <<< "$TOPICS"
    for topic in "${TOPIC_ARRAY[@]}"; do
        echo "Deleting topic ${topic}..."
        docker exec kafka kafka-topics \
            --delete \
            --topic "${topic}" \
            --bootstrap-server localhost:9092
    done
}

# Main script
case "$1" in
    create)
        # Try to create topics with retries
        for i in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $i of $MAX_RETRIES"
            if create_topics; then
                exit 0
            fi
            if [ $i -lt $MAX_RETRIES ]; then
                echo "Retrying in $RETRY_DELAY seconds..."
                sleep $RETRY_DELAY
            fi
        done
        echo "Failed to create topics after $MAX_RETRIES attempts"
        exit 1
        ;;
    list)
        list_topics
        ;;
    delete)
        delete_topics
        ;;
    *)
        echo "Usage: $0 {create|list|delete}"
        exit 1
        ;;
esac 