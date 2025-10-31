# WebSocket Implementation Guide

This document describes the WebSocket implementation for real-time updates in the ZipZap application.

## Overview

The WebSocket implementation provides real-time communication between the server and client applications, enabling instant updates for profile changes, order updates, customer updates, and other events.

## Architecture

### Backend (API)

- **WebSocket Manager**: `utils/websocket.ts` - Manages WebSocket connections and message broadcasting
- **Server Integration**: `server.ts` - Integrates WebSocket with Bun's server
- **Controller Integration**: `controllers/user.controllers.ts` - Sends WebSocket notifications on profile updates

### Frontend (UI)

- **WebSocket Hook**: `hooks/use-websocket.ts` - Manages WebSocket connections and message handling
- **WebSocket Provider**: `providers/websocket-provider.tsx` - Global WebSocket context provider
- **Status Component**: `components/websocket-status.tsx` - Visual connection status indicator

## Message Structure

All WebSocket messages follow a standardized structure:

```typescript
interface WebSocketMessage {
  type: WebSocketEventType
  data: any
  timestamp: string
  userId?: string
  storeId?: string
  sessionId?: string
}
```

## Event Types

### Profile Events

- `PROFILE_UPDATED` - Sent when user profile is updated
- `USER_JOINED` - Sent when a user connects to WebSocket
- `USER_LEFT` - Sent when a user disconnects from WebSocket

### Order Events

- `ORDER_CREATED` - Sent when a new order is created
- `ORDER_UPDATED` - Sent when an order is updated
- `ORDER_STATUS_CHANGED` - Sent when order status changes

### Customer Events

- `CUSTOMER_CREATED` - Sent when a new customer is created
- `CUSTOMER_UPDATED` - Sent when customer information is updated

### Store Events

- `STORE_UPDATED` - Sent when store information is updated
- `PRODUCT_UPDATED` - Sent when product information is updated
- `CATEGORY_UPDATED` - Sent when category information is updated

### General Events

- `GENERAL_NOTIFICATION` - General notifications and welcome messages

## Usage Examples

### Backend - Sending Notifications

```typescript
import { wsManager } from '~/utils/websocket'

// Send profile update notification
wsManager.sendProfileUpdate(userId, {
  action: 'profile_updated',
  profile: updatedProfile,
  updatedFields: {
    firstName: true,
    email: true,
  },
})

// Send order update notification
wsManager.sendOrderUpdate(storeId, {
  orderNumber: '12345',
  status: 'preparing',
  items: [...],
})

// Send customer update notification
wsManager.sendCustomerUpdate(storeId, {
  customerId: 'customer123',
  customerName: 'John Doe',
  action: 'updated',
})
```

### Frontend - Using WebSocket Hook

```typescript
import { useWebSocket } from '~/hooks/use-websocket'

const MyComponent = () => {
  const { status, isConnected, lastMessage, sendMessage } = useWebSocket({
    autoConnect: true,
    autoReconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  })

  // Handle profile updates
  useEffect(() => {
    if (lastMessage?.type === 'profile_updated') {
      console.log('Profile updated:', lastMessage.data)
      // Refetch profile or update UI
    }
  }, [lastMessage])

  return (
    <div>
      <p>Connection Status: {status}</p>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

### Frontend - Using WebSocket Context

```typescript
import { useWebSocketContext } from '~/providers/websocket-provider'

const MyComponent = () => {
  const { status, isConnected, sendMessage } = useWebSocketContext()

  const handleCustomAction = () => {
    sendMessage({
      type: 'custom_action',
      data: { action: 'test' },
    })
  }

  return (
    <div>
      <WebSocketStatusIndicator showDetails={true} />
      <button onClick={handleCustomAction}>Send Test Message</button>
    </div>
  )
}
```

## Connection Management

### Authentication

When a client connects, it should send an authentication message:

```typescript
{
  type: 'authenticate',
  data: {
    userId: 'user123',
    storeId: 'store456',
  },
}
```

### Reconnection

The WebSocket hook automatically handles reconnection with configurable parameters:

- `autoReconnect`: Enable/disable automatic reconnection
- `reconnectInterval`: Time between reconnection attempts (default: 5000ms)
- `maxReconnectAttempts`: Maximum number of reconnection attempts (default: 5)

### Connection Status

The WebSocket status can be:

- `CONNECTING` - Attempting to connect
- `CONNECTED` - Successfully connected
- `DISCONNECTED` - Not connected
- `ERROR` - Connection error

## API Endpoints

### WebSocket Statistics

```
GET /api/v1/websocket/stats
```

Response:

```json
{
  "success": true,
  "data": {
    "totalConnections": 5,
    "activeConnections": 3
  },
  "message": "WebSocket statistics retrieved successfully"
}
```

### WebSocket Health Check

```
GET /api/v1/websocket/health
```

Response:

```json
{
  "success": true,
  "data": {
    "healthy": true,
    "totalConnections": 5,
    "activeConnections": 3
  },
  "message": "WebSocket server is healthy"
}
```

## Error Handling

### Backend Error Handling

- Connection errors are logged with detailed information
- Failed message sends are logged and connections are cleaned up
- Invalid messages are logged but don't crash the server

### Frontend Error Handling

- Connection errors show toast notifications
- Failed reconnection attempts are logged
- Message parsing errors are handled gracefully

## Performance Considerations

### Backend

- Ping/pong mechanism keeps connections alive
- Inactive connections are automatically cleaned up
- Message broadcasting is optimized for multiple recipients

### Frontend

- Automatic reconnection prevents connection loss
- Message handling is debounced to prevent UI spam
- Connection status is cached to prevent unnecessary re-renders

## Security

### Authentication

- Clients must authenticate with valid user and store IDs
- Unauthenticated connections receive limited functionality

### Message Validation

- All incoming messages are validated for structure
- Malformed messages are rejected and logged

### Rate Limiting

- Consider implementing rate limiting for message sending
- Monitor connection counts to prevent abuse

## Monitoring

### Backend Monitoring

- Connection statistics are available via API endpoints
- Detailed logging for all WebSocket events
- Error tracking for failed connections and messages

### Frontend Monitoring

- Connection status is visible in the UI
- Toast notifications for important events
- Console logging for debugging

## Future Enhancements

### Planned Features

- Message encryption for sensitive data
- Room-based messaging for store-specific updates
- Message queuing for offline clients
- Advanced filtering and subscription management

### Scalability Considerations

- Consider Redis for session management in multi-server setups
- Implement message persistence for critical updates
- Add load balancing support for WebSocket connections

## Troubleshooting

### Common Issues

1. **Connection Fails**

   - Check if WebSocket server is running
   - Verify CORS settings
   - Check network connectivity

2. **Messages Not Received**

   - Verify authentication was sent
   - Check message format
   - Ensure user/store IDs match

3. **Frequent Disconnections**
   - Check network stability
   - Verify ping/pong mechanism
   - Review reconnection settings

### Debug Mode

Enable debug logging by setting environment variable:

```bash
LOG_LEVEL=debug
```

This will provide detailed WebSocket connection and message logs.

## Installation

### Backend Dependencies

```bash
bun add ws @types/ws
```

### Frontend Dependencies

No additional dependencies required - uses native WebSocket API.

## Configuration

### Environment Variables

```bash
# WebSocket configuration
WS_PORT=8001  # Optional: separate WebSocket port
WS_PATH=/ws   # WebSocket endpoint path
```

### Server Configuration

The WebSocket server is automatically initialized with the HTTP server in `server.ts`.

## Testing

### Manual Testing

1. Start the server
2. Open browser console
3. Connect to WebSocket endpoint
4. Send authentication message
5. Trigger profile update
6. Verify real-time notification

### Automated Testing

WebSocket functionality can be tested using WebSocket testing tools or browser automation frameworks.
