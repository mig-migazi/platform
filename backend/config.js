const config = {
    kafka: {
        brokerType: process.env.BROKER_TYPE || 'confluent',
        bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092',
        schemaRegistry: process.env.KAFKA_SCHEMA_REGISTRY_URL || (process.env.BROKER_TYPE === 'confluent' ? 'http://schema-registry:8081' : 'http://localhost:8081'),
        topics: {
            telemetry: 'iot_messages',
            alarms: 'iot_alarms'
        },
        // Common Kafka configuration
        clientId: 'iot-platform-backend',
        connectionTimeout: 3000,
        requestTimeout: 3000,
        retry: {
            initialRetryTime: 100,
            maxRetryTime: 30000,
            retries: 10
        },
        ssl: false,
        sasl: null,
        logLevel: 5, // DEBUG + 1
        socketFactory: {
            keepAlive: true,
            keepAliveDelay: 1000
        }
    },
    telemetry: {
        defaultValues: {
            temperature: 25.0,
            humidity: 60.0,
            pressure: 1013.25,
            battery: 95.0
        }
    },
    alarms: {
        types: ['HIGH_TEMP', 'LOW_BATTERY', 'HIGH_HUMIDITY'],
        defaultValues: {
            HIGH_TEMP: 30.0,
            LOW_BATTERY: 20.0,
            HIGH_HUMIDITY: 80.0
        }
    }
};

module.exports = config; 