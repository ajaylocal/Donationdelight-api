# Logging System

This project uses Winston for comprehensive logging with the following features:

## Features

- **Daily log rotation**: Creates separate log files for each day
- **Log level separation**: Different files for different log levels
- **Automatic compression**: Old logs are compressed to save space
- **Log retention**: Configurable retention periods for different log types
- **Development console output**: Pretty console logs in development mode

## Log Files Structure

The logs are organized in the `logs/` directory:

```
logs/
├── combined-2025-06-21.log     # All log levels combined
├── error-2025-06-21.log        # Error logs only (kept for 30 days)
├── warn-2025-06-21.log         # Warning logs only (kept for 14 days)
├── info-2025-06-21.log         # Info logs only (kept for 7 days)
├── exceptions-2025-06-21.log   # Uncaught exceptions (kept for 30 days)
└── rejections-2025-06-21.log   # Unhandled promise rejections (kept for 30 days)
```

## Configuration

Set the log level using the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=info  # Options: error, warn, info, debug, verbose
```

## Usage

### Import the logger

```typescript
import { logger, log } from '~/utils'
```

### Basic logging

```typescript
// Using the logger instance
logger.info('User logged in', { userId: '123', email: 'user@example.com' })
logger.warn('Rate limit approaching', { requests: 95, limit: 100 })
logger.error('Database connection failed', { error: error.message })

// Using the convenience functions
log.info('This is an info message')
log.error('This is an error message')
log.warn('This is a warning message')
```

### Structured logging

The logger supports structured logging with metadata:

```typescript
logger.info('API request processed', {
  method: 'POST',
  url: '/api/v1/users',
  status: 201,
  responseTime: 45,
  userId: '123',
})
```

## Log Levels

- **error**: Error conditions that need immediate attention
- **warn**: Warning conditions that should be noted
- **info**: General information about application flow
- **debug**: Detailed information for debugging
- **verbose**: Very detailed information

## Automatic Features

- **Request/Response logging**: All HTTP requests and responses are logged automatically
- **Error logging**: All errors and exceptions are logged with stack traces
- **404 logging**: All 404 attempts are logged as warnings
- **Application startup**: Server configuration and startup information is logged

## Log Rotation

- Files are rotated daily
- Old files are compressed automatically
- Different retention periods for different log types
- Maximum file size of 20MB before rotation
