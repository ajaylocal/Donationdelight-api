import { wsManager } from './utils/websocket'
import { logger } from './utils/logger'

const wsPort = process.env.WS_PORT || 8001

// Create WebSocket server
const server = Bun.serve({
  port: parseInt(wsPort.toString()),
  fetch(req, server) {
    const url = new URL(req.url)

    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req)
      if (upgraded) {
        // WebSocket connection established
        logger.info('WebSocket connection upgraded successfully')
        return undefined
      }
      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    return new Response('WebSocket server running', { status: 200 })
  },
  websocket: {
    open(ws) {
      logger.info('WebSocket connection opened')
      wsManager.handleWebSocketUpgrade(ws)
    },
    message(ws, message) {
      wsManager.handleWebSocketMessage(ws, message)
    },
    close(ws, code, reason) {
      logger.info(`WebSocket connection closed: ${code} ${reason}`)
      wsManager.handleWebSocketClose(ws, code, reason)
    },
  },
})

// Initialize WebSocket manager
wsManager.initialize(server)

logger.info(`WebSocket server running on port ${wsPort}`)

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down WebSocket server gracefully')
  wsManager.cleanup()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down WebSocket server gracefully')
  wsManager.cleanup()
  process.exit(0)
})
