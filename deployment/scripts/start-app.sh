#!/bin/bash

set -e

# Parse command line arguments
KEEP_DATA=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-data)
            KEEP_DATA=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--keep-data]"
            echo "  --keep-data: Keep existing volumes and data"
            exit 1
            ;;
    esac
done

# Change to project root directory
cd "$(dirname "$0")/../.."

echo "Starting IoT Platform Application Services..."

# Start backend and frontend services
echo "Starting application services..."
if [ "$KEEP_DATA" = true ]; then
    echo "Keeping existing volumes and data..."
    docker-compose -f deployment/docker-compose.app.yml up -d
else
    echo "Starting with clean state..."
    docker-compose -f deployment/docker-compose.app.yml down -v
    docker-compose -f deployment/docker-compose.app.yml up -d
fi

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
while ! curl -s http://localhost:3000/api/health > /dev/null; do
    sleep 5
    echo "Waiting for backend..."
done

echo "Application services startup complete!"
echo "Backend is available at: http://localhost:3000"
echo "Frontend is available at: http://localhost:3000"

# Show current deployment status
echo -e "\nCurrent deployment status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 