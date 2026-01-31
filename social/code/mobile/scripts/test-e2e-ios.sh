#!/bin/bash

# Start Metro in the background
echo "Starting Metro bundler..."
EXPO_PUBLIC_MOCK_MODE=true npx expo start --no-dev > /dev/null 2>&1 &
METRO_PID=$!

# Wait for Metro to be ready
echo "Waiting for Metro to be ready..."
sleep 8

# Build and install the app
echo "Building and installing iOS app..."
EXPO_PUBLIC_MOCK_MODE=true npx expo run:ios

# Run Maestro tests
echo "Running Maestro tests..."
EXPO_PUBLIC_MOCK_MODE=true maestro test .maestro

# Clean up: kill Metro
echo "Stopping Metro bundler..."
kill $METRO_PID 2>/dev/null || true

