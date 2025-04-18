-- Function to handle database initialization based on mode
DO $$
BEGIN
    -- Get the initialization mode from environment variable, default to 'check'
    -- Modes: check (default), drop, fail, force
    DECLARE init_mode TEXT := current_setting('app.init_mode', TRUE);
    BEGIN
        IF init_mode IS NULL THEN
            init_mode := 'check';
        END IF;

        -- Handle different modes
        IF init_mode = 'fail' AND EXISTS (SELECT 1 FROM pg_database WHERE datname = 'iot_platform') THEN
            RAISE EXCEPTION 'Database iot_platform already exists and mode is set to fail';
        ELSIF init_mode IN ('drop', 'force') AND EXISTS (SELECT 1 FROM pg_database WHERE datname = 'iot_platform') THEN
            RAISE NOTICE 'Dropping existing database iot_platform';
            -- Terminate existing connections
            PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'iot_platform';
            DROP DATABASE iot_platform;
        ELSIF init_mode = 'check' AND EXISTS (SELECT 1 FROM pg_database WHERE datname = 'iot_platform') THEN
            RAISE NOTICE 'Database iot_platform already exists, continuing';
            RETURN;
        END IF;

        -- Create database if it doesn't exist or was dropped
        IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'iot_platform') THEN
            CREATE DATABASE iot_platform;
            RAISE NOTICE 'Created database iot_platform';
        END IF;
    END;
END $$;

\c iot_platform

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create the iot_messages table
CREATE TABLE IF NOT EXISTS iot_messages (
    timestamp TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    pressure DOUBLE PRECISION,
    battery DOUBLE PRECISION,
    metadata JSONB
);

-- Convert the table to a hypertable
SELECT create_hypertable('iot_messages', 'timestamp', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_iot_messages_device_id ON iot_messages(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_messages_timestamp ON iot_messages(timestamp DESC);

-- Create continuous aggregates for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS iot_messages_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    device_id,
    avg(temperature) AS avg_temperature,
    avg(humidity) AS avg_humidity,
    avg(pressure) AS avg_pressure,
    avg(battery) AS avg_battery
FROM iot_messages
GROUP BY bucket, device_id;

-- Set refresh policy for the continuous aggregate
SELECT add_continuous_aggregate_policy('iot_messages_1h',
    start_offset => INTERVAL '1 month',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Create retention policy
SELECT add_retention_policy('iot_messages', INTERVAL '6 months');

-- Create alarms table
CREATE TABLE IF NOT EXISTS alarms (
    timestamp TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    severity INTEGER,
    error_code INTEGER
);

-- Convert to hypertable
SELECT create_hypertable('alarms', 'timestamp', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alarms_device_id ON alarms(device_id); 