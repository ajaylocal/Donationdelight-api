# WebSocket Setup Guide

## Overview

The WebSocket implementation runs on a separate server to handle real-time connections. This setup provides better performance and isolation.

## Quick Start

### Option 1: Use the startup script (Recommended)

```bash
./start-dev.sh
```

This will start both servers:

- API Server: http://localhost:8000
- WebSocket Server: ws://localhost:8001

### Option 2: Run servers separately

Terminal 1 (API Server):

```bash
bun run dev
```

Terminal 2 (WebSocket Server):

```bash
bun run websocket
```

## Environment Variables

Add these to your `.env` file:

```bash
# API Server
PORT=8000
API_VERSION=v1

# WebSocket Server
WS_PORT=8001

# Frontend (in UI project)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_PORT=8001
```

## Testing WebSocket Connection

1. Start both servers
2. Open your browser console
3. Check the WebSocket status indicator in the header
4. You should see "Connected" status

## Troubleshooting

### Connection Issues

- Make sure both servers are running
- Check that ports 8000 and 8001 are available
- Verify environment variables are set correctly

### High Request Count

- The 4k+ requests you're seeing are likely from the UI trying to connect
- This is normal during connection attempts
- Once connected, the request count should stabilize

### WebSocket Status Shows "Not Connected"

1. Check if WebSocket server is running on port 8001
2. Verify the WebSocket URL in browser console
3. Check for CORS issues in browser console
4. Ensure the WebSocket server is accessible

## Development

### Running in Development Mode

```bash
# Start both servers with hot reload
./start-dev.sh
```

### Running in Production

```bash
# Start API server
NODE_ENV=production bun run start

# Start WebSocket server (in separate process)
NODE_ENV=production bun run websocket-server.ts
```

## Architecture

- **API Server** (port 8000): Handles HTTP requests and REST API
- **WebSocket Server** (port 8001): Handles real-time WebSocket connections
- **Frontend**: Connects to both servers as needed

## Monitoring

Check WebSocket server status:

```bash
curl http://localhost:8001/
```

Check WebSocket statistics:

```bash
curl http://localhost:8000/api/v1/websocket/stats
```

## Security Notes

- WebSocket server runs on separate port for isolation
- CORS is configured for development
- Production should use proper SSL certificates
- Consider rate limiting for WebSocket connections
