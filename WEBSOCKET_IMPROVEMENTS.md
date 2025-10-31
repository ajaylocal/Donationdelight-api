# WebSocket Improvements

This document outlines the improvements made to the WebSocket implementation for better connection management, monitoring, and reliability.

## Key Improvements

### 1. Enhanced Ping/Pong Mechanism

- **Server-side ping**: Server sends ping every 30 seconds to check client connectivity
- **Client-side ping**: Client sends ping every 30 seconds when connected, every 5 seconds when disconnected
- **Ping timeout**: 10-second timeout for ping responses
- **Automatic reconnection**: Forces reconnection if no pong response received

### 2. Last Active Time Tracking

- **Database updates**: User's `lastActiveAt` field is updated on each ping/pong
- **Real-time tracking**: Tracks when users are actively using the application
- **User activity monitoring**: Helps identify active vs inactive users

### 3. Store Isolation

- **Store-specific messaging**: All WebSocket messages are isolated by store
- **Broadcast to store**: New `broadcastToStore()` method for store-specific notifications
- **User join/leave notifications**: Only sent to users in the same store
- **Order/customer updates**: Only sent to the relevant store

### 4. Improved Connection Management

- **Smart reconnection**: Different reconnection intervals based on connection status
- **Exponential backoff**: Prevents connection loops with intelligent retry delays
- **Connection quality monitoring**: Tracks ping/pong response times
- **Graceful degradation**: Handles connection failures gracefully
- **Connection statistics**: Detailed metrics for monitoring

### 5. Client-Side Server Down Detection

- **Automatic detection**: Client detects when server is unresponsive
- **Client-side notifications**: Sends Discord notifications when server is down
- **Exponential backoff**: Intelligent retry strategy to prevent connection loops
- **Max retry limits**: Stops retrying after 5 attempts to prevent infinite loops

### 6. Server Status Monitoring

- **Automatic detection**: Detects when server goes down (no active connections)
- **Uptime tracking**: Monitors server downtime duration
- **Notification system**: Sends email and Discord notifications for server status changes
- **Health checks**: REST API endpoints for monitoring

### 7. Enhanced Error Handling

- **Timeout handling**: Proper timeout management for ping/pong
- **Error recovery**: Automatic recovery from connection errors
- **Logging**: Comprehensive logging for debugging
- **Graceful cleanup**: Proper cleanup on connection close

## Configuration

### Environment Variables

```bash
# Discord webhook for notifications (server-side)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url

# Discord webhook for client-side notifications
NEXT_PUBLIC_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-client-webhook-url

# Email service (configure based on your provider)
SENDGRID_API_KEY=your-sendgrid-api-key
ADMIN_EMAIL=admin@yourdomain.com
FROM_EMAIL=noreply@yourdomain.com
```

### WebSocket Options

```typescript
const { status, isConnected, isServerDown, sendMessage } = useWebSocket({
  autoConnect: true,
  autoReconnect: true,
  reconnectInterval: 5000, // 5 seconds base delay
  maxReconnectAttempts: 5,
  pingInterval: 30000, // 30 seconds when connected
  pingTimeout: 10000, // 10 seconds timeout
  exponentialBackoff: true, // Enable exponential backoff
  maxReconnectDelay: 30000, // 30 seconds max delay
})
```

## Exponential Backoff Strategy

The reconnection strategy uses exponential backoff to prevent connection loops:

- **Base delay**: 5 seconds
- **Exponential growth**: Delay doubles with each attempt (5s, 10s, 20s, 30s, 30s)
- **Max delay**: 30 seconds (capped)
- **Jitter**: Random 0-1 second added to prevent thundering herd
- **Max attempts**: 5 attempts before giving up

Example reconnection delays:

- Attempt 1: ~5 seconds
- Attempt 2: ~10 seconds
- Attempt 3: ~20 seconds
- Attempt 4: ~30 seconds
- Attempt 5: ~30 seconds
- After 5 attempts: Stop retrying, mark server as down

## API Endpoints

### WebSocket Statistics

```
GET /api/v1/websockets/stats
```

Returns detailed WebSocket statistics including:

- Total connections
- Active connections
- Server online status
- Store-specific connection counts
- Average connection time

### Health Check

```
GET /api/v1/websockets/health
```

Returns basic health information:

- Server online status
- Active connections count
- Timestamp

## Database Schema Changes

### User Model

Added `lastActiveAt` field to track user activity:

```typescript
interface IUser {
  // ... existing fields
  lastActiveAt?: Date
}
```

## Frontend Components

### WebSocket Status Indicator

Enhanced status component showing:

- Connection status (Connected/Connecting/Disconnected/Error)
- Server down state with retry attempts
- Connection quality (Excellent/Good/Poor)
- Real-time ping/pong status

### WebSocket Provider

Improved provider with:

- Better error handling
- Connection quality monitoring
- Automatic reconnection logic with exponential backoff
- Store-specific message filtering
- Server down state management

## Monitoring and Notifications

### Server Status Notifications

- **Email notifications**: Sent to admin email on server status changes
- **Discord notifications**: Rich embed messages with status and downtime info
- **Client-side notifications**: Sent from UI when server is detected as down
- **Automatic detection**: Monitors connection count to detect server issues

### Connection Quality Monitoring

- **Ping response times**: Tracks time between ping and pong
- **Connection quality levels**: Excellent (<30s), Good (<60s), Poor (>60s)
- **Real-time updates**: Status updates in UI components

### Client-Side Server Down Detection

- **Ping timeout detection**: Detects when server doesn't respond to pings
- **Reconnection failure**: Detects when max retry attempts are reached
- **Discord notifications**: Sends notifications from client when server is down
- **User feedback**: Shows server down status in UI with retry attempts

## Best Practices

### 1. Store Isolation

- Always use store-specific methods for broadcasting
- Filter messages by store ID
- Avoid global broadcasts unless necessary

### 2. Connection Management

- Use appropriate ping intervals (30s connected, 5s disconnected)
- Implement exponential backoff for reconnections
- Handle timeouts gracefully
- Implement proper cleanup on disconnect

### 3. Error Handling

- Log all WebSocket errors
- Implement retry logic with exponential backoff
- Monitor connection quality
- Provide user feedback for connection issues

### 4. Performance

- Limit message frequency
- Use efficient message serialization
- Monitor memory usage
- Prevent connection loops with exponential backoff

## Troubleshooting

### Common Issues

1. **Connection drops frequently**

   - Check network stability
   - Verify ping/pong intervals
   - Monitor server resources
   - Check exponential backoff settings

2. **Messages not received**

   - Verify store isolation
   - Check user authentication
   - Monitor WebSocket status
   - Check server down state

3. **High latency**

   - Check ping response times
   - Monitor server performance
   - Verify network connectivity
   - Check connection quality indicators

4. **Infinite reconnection loops**

   - Verify exponential backoff is enabled
   - Check max reconnection attempts
   - Monitor server availability
   - Check client-side server down detection

### Debugging

1. **Enable detailed logging**

   ```typescript
   // In WebSocket manager
   logger.debug('WebSocket message received:', message)
   ```

2. **Monitor connection statistics**

   ```typescript
   // Get stats via API
   GET / api / v1 / websockets / stats
   ```

3. **Check frontend status**

   ```typescript
   const { status, isConnected, isServerDown, reconnectAttempts } =
     useWebSocketContext()
   console.log('WebSocket status:', {
     status,
     isConnected,
     isServerDown,
     reconnectAttempts,
   })
   ```

4. **Monitor reconnection attempts**

   ```typescript
   // Check reconnection progress
   console.log(`Reconnection attempt: ${reconnectAttempts}/5`)
   ```

## Future Enhancements

1. **Message queuing**: Queue messages for offline users
2. **Load balancing**: Support for multiple WebSocket servers
3. **Message persistence**: Store important messages in database
4. **Rate limiting**: Implement message rate limiting
5. **Compression**: Add message compression for large payloads
6. **Analytics**: Detailed usage analytics and reporting
7. **Circuit breaker**: Implement circuit breaker pattern for better fault tolerance
8. **Health checks**: Periodic health checks from client to server
