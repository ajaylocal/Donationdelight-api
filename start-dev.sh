#!/bin/bash

# Start both API server and WebSocket server
echo "Starting ZipZap API v2 with WebSocket support..."

# Start API server in background
bun run --hot server.ts &
API_PID=$!

# Start WebSocket server in background
bun run --hot websocket-server.ts &
WS_PID=$!

echo "API Server PID: $API_PID"
echo "WebSocket Server PID: $WS_PID"
echo "API Server running on: http://localhost:8000"
echo "WebSocket Server running on: ws://localhost:8001"

# Function to cleanup on exit
cleanup() {
    echo "Shutting down servers..."
    kill $API_PID
    kill $WS_PID
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait 