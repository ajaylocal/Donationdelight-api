import { wsManager } from './utils/websocket'
import { logger } from './utils/logger'

const port = 8001

console.log(`Starting simple WebSocket server on port ${port}...`)

// Create simple WebSocket server
const server = Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req)
      if (upgraded) {
        console.log('WebSocket connection upgraded successfully')
        return undefined
      }
      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    return new Response('WebSocket server running', { status: 200 })
  },
  websocket: {
    open(ws) {
      console.log('WebSocket connection opened')
      wsManager.handleWebSocketUpgrade(ws)
    },
    message(ws, message) {
      console.log('Received message:', message)
      wsManager.handleWebSocketMessage(ws, message)
    },
    close(ws, code, reason) {
      console.log(`WebSocket connection closed: ${code} ${reason}`)
      wsManager.handleWebSocketClose(ws, code, reason)
    },
  },
})

// Initialize WebSocket manager
wsManager.initialize(server)

console.log(`Simple WebSocket server running on port ${port}`)
console.log(`Test URL: ws://localhost:${port}/ws`)

// Keep the server running
process.on('SIGINT', () => {
  console.log('Shutting down...')
  wsManager.cleanup()
  process.exit(0)
})
