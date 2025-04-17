#!/bin/bash

# Change to project root directory
cd "$(dirname "$0")/../.."

# Load environment variables if config file exists (optional)
if [ -f config/env/confluent-config.env ]; then
    set -a
    source config/env/confluent-config.env
    set +a
fi

# Default values if environment variables are not set
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-5}
TOPICS=${CONFLUENT_TOPICS:-iot_messages,alarms}
PARTITIONS=${CONFLUENT_PARTITIONS:-1}
REPLICATION_FACTOR=${CONFLUENT_REPLICATION_FACTOR:-1}

# Function to check if a topic exists
topic_exists() {
    local topic=$1
    kafka-topics --bootstrap-server kafka:9092 --describe --topic "$topic" > /dev/null 2>&1
    return $?
}

# Function to create topics
create_topics() {
    echo "Waiting for Confluent to be ready..."

    # Wait for Confluent to be ready
    for i in {1..30}; do
        if kafka-topics --bootstrap-server kafka:9092 --list > /dev/null 2>&1; then
            echo "✅ Confluent is ready!"
            break
        fi
        echo "⏳ Confluent not ready yet... retrying in 2s ($i)"
        sleep 2
    done

    # Fail if Confluent never became available
    if ! kafka-topics --bootstrap-server kafka:9092 --list > /dev/null 2>&1; then
        echo "❌ Confluent did not become ready in time"
        exit 1
    fi

    echo "Checking and creating topics if needed..."
    
    # Process topics from the comma-separated list
    IFS=',' read -ra TOPIC_ARRAY <<< "$TOPICS"
    all_topics_ok=true
    topics_to_create=()
    
    # First, check which topics need to be created
    for topic in "${TOPIC_ARRAY[@]}"; do
        if topic_exists "$topic"; then
            echo "✅ Topic ${topic} already exists"
        else
            echo "⚠️ Topic ${topic} does not exist, will create it"
            topics_to_create+=("$topic")
        fi
    done

    # If all topics exist, we're done
    if [ ${#topics_to_create[@]} -eq 0 ]; then
        echo "✅ All required topics already exist"
        return 0
    fi

    # Create missing topics
    for topic in "${topics_to_create[@]}"; do
        echo "Creating topic ${topic}..."
        if ! kafka-topics \
            --create \
            --topic "${topic}" \
            --partitions "${PARTITIONS}" \
            --replication-factor "${REPLICATION_FACTOR}" \
            --bootstrap-server kafka:9092 > /dev/null 2>&1; then
            echo "❌ Failed to create topic ${topic}"
            all_topics_ok=false
        else
            echo "✅ Topic ${topic} created successfully"
        fi
    done

    # Verify all topics exist
    for topic in "${TOPIC_ARRAY[@]}"; do
        if ! topic_exists "$topic"; then
            echo "❌ Topic ${topic} does not exist"
            all_topics_ok=false
        fi
    done

    if [ "$all_topics_ok" = true ]; then
        echo "✅ All topics are present and correct"
        return 0
    else
        echo "❌ Some topics are missing or incorrect"
        return 1
    fi
}

# Function to list topics
list_topics() {
    echo "Listing topics..."
    kafka-topics --list --bootstrap-server kafka:9092
}

# Function to delete topics
delete_topics() {
    echo "Deleting topics..."
    IFS=',' read -ra TOPIC_ARRAY <<< "$TOPICS"
    for topic in "${TOPIC_ARRAY[@]}"; do
        echo "Deleting topic ${topic}..."
        kafka-topics \
            --delete \
            --topic "${topic}" \
            --bootstrap-server kafka:9092
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
        echo "Failed to ensure all topics exist after $MAX_RETRIES attempts"
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