import logger from './logger'
import { notificationService } from '../services/notification.service'

// WebSocket message types
export enum WebSocketEventType {
  PROFILE_UPDATED = 'profile_updated',
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_STATUS_CHANGED = 'order_status_changed',
  CUSTOMER_CREATED = 'customer_created',
  CUSTOMER_UPDATED = 'customer_updated',
  PRODUCT_UPDATED = 'product_updated',
  CATEGORY_UPDATED = 'category_updated',
  STORE_UPDATED = 'store_updated',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  GENERAL_NOTIFICATION = 'general_notification',
  PING = 'ping',
  PONG = 'pong',
  SERVER_STATUS = 'server_status',
}

// WebSocket message structure
export interface WebSocketMessage {
  type: WebSocketEventType
  data: any
  timestamp: string
  userId?: string
  storeId?: string
  sessionId?: string
}

// Client connection info
interface ClientConnection {
  ws: any // Bun WebSocket
  userId?: string
  storeId?: string
  sessionId: string
  isAlive: boolean
  lastPingTime: number
  lastActiveTime: number
  connectedAt: number
}

class WebSocketManager {
  private clients: Map<string, ClientConnection> = new Map()
  private pingInterval: any = null

  // Initialize WebSocket server (for Bun, this is handled by the server)
  initialize(server: any) {
    logger.info('WebSocket server initialized')

    // Set up ping interval to keep connections alive (every 30 seconds)
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, sessionId) => {
        if (!client.isAlive) {
          logger.warn(`Terminating inactive connection: ${sessionId}`)
          this.handleDisconnection(sessionId)
          return
        }

        client.isAlive = false
        // Send ping message
        try {
          client.ws.send(
            JSON.stringify({
              type: WebSocketEventType.PING,
              timestamp: new Date().toISOString(),
            })
          )
        } catch (error) {
          logger.error(`Error sending ping to ${sessionId}:`, error)
          this.handleDisconnection(sessionId)
        }
      })
    }, 30000) // Ping every 30 seconds
  }

  // Handle WebSocket upgrade (called by Bun server)
  handleWebSocketUpgrade(ws: any) {
    const sessionId = this.generateSessionId()
    const clientIp = 'unknown' // Bun doesn't provide request info in this context
    const now = Date.now()

    logger.info(`New WebSocket connection: ${sessionId} from ${clientIp}`)

    // Store client connection
    this.clients.set(sessionId, {
      ws,
      sessionId,
      isAlive: true,
      lastPingTime: now,
      lastActiveTime: now,
      connectedAt: now,
    })

    // Send welcome message
    this.sendToClient(sessionId, {
      type: WebSocketEventType.GENERAL_NOTIFICATION,
      data: { message: 'Connected to ZipZap WebSocket server' },
      timestamp: new Date().toISOString(),
    })
  }

  // Handle WebSocket messages (called by Bun server)
  handleWebSocketMessage(ws: any, message: string | Buffer) {
    const sessionId = this.findSessionIdByWebSocket(ws)
    if (!sessionId) {
      logger.warn('Received message from unknown WebSocket connection')
      return
    }

    try {
      // Convert Buffer to string if needed
      const messageString =
        typeof message === 'string' ? message : message.toString()
      const parsedMessage = JSON.parse(messageString)
      logger.debug(`Received message from ${sessionId}:`, parsedMessage)

      const client = this.clients.get(sessionId)
      if (!client) {
        logger.warn(`Client not found for session: ${sessionId}`)
        return
      }

      // Update last active time
      client.lastActiveTime = Date.now()

      // Handle different message types
      switch (parsedMessage.type) {
        case 'authenticate':
          this.authenticateClient(sessionId, parsedMessage.data)
          break
        case WebSocketEventType.PONG:
          // Handle pong response
          client.isAlive = true
          client.lastPingTime = Date.now()

          // Update user's last active time in database
          if (client.userId) {
            this.updateUserLastActive(client.userId)
          }
          break
        case WebSocketEventType.PING:
          // Handle ping from client (for client-initiated ping)
          client.isAlive = true
          client.lastPingTime = Date.now()

          // Send pong response
          this.sendToClient(sessionId, {
            type: WebSocketEventType.PONG,
            data: { pong: true },
            timestamp: new Date().toISOString(),
          })

          // Update user's last active time in database
          if (client.userId) {
            this.updateUserLastActive(client.userId)
          }
          break
        default:
          logger.debug(`Unhandled message type: ${parsedMessage.type}`)
      }
    } catch (error) {
      logger.error(`Error parsing message from ${sessionId}:`, error)
    }
  }

  // Update user's last active time in database
  private async updateUserLastActive(userId: string) {
    try {
      // Import User model dynamically to avoid circular dependencies
      const { default: User } = await import('../models/user.model')

      await User.findByIdAndUpdate(userId, {
        lastActiveAt: new Date(),
      })

      logger.debug(`Updated last active time for user: ${userId}`)
    } catch (error) {
      logger.error(`Error updating last active time for user ${userId}:`, error)
    }
  }

  // Handle WebSocket close (called by Bun server)
  handleWebSocketClose(ws: any, code: number, reason: string) {
    const sessionId = this.findSessionIdByWebSocket(ws)
    if (sessionId) {
      this.handleDisconnection(sessionId)
    }
  }

  // Find session ID by WebSocket instance
  private findSessionIdByWebSocket(ws: any): string | null {
    for (const [sessionId, client] of this.clients.entries()) {
      if (client.ws === ws) {
        return sessionId
      }
    }
    return null
  }

  // Authenticate client with user and store info
  private authenticateClient(
    sessionId: string,
    authData: { userId?: string; storeId?: string }
  ) {
    const client = this.clients.get(sessionId)
    if (client) {
      client.userId = authData.userId
      client.storeId = authData.storeId

      logger.info(
        `Client authenticated: ${sessionId}, User: ${authData.userId}, Store: ${authData.storeId}`
      )

      // Notify other clients in the same store about new user
      if (authData.storeId) {
        this.broadcastToStore(
          authData.storeId,
          {
            type: WebSocketEventType.USER_JOINED,
            data: { userId: authData.userId, storeId: authData.storeId },
            timestamp: new Date().toISOString(),
            userId: authData.userId,
            storeId: authData.storeId,
          },
          sessionId
        ) // Exclude the sender
      }
    }
  }

  // Handle client disconnection
  private handleDisconnection(sessionId: string) {
    const client = this.clients.get(sessionId)
    if (client) {
      logger.info(`Client disconnected: ${sessionId}`)

      // Notify other clients in the same store about user leaving
      if (client.storeId) {
        this.broadcastToStore(
          client.storeId,
          {
            type: WebSocketEventType.USER_LEFT,
            data: { userId: client.userId, storeId: client.storeId },
            timestamp: new Date().toISOString(),
            userId: client.userId,
            storeId: client.storeId,
          },
          sessionId
        )
      }
    }

    this.clients.delete(sessionId)
  }

  // Send message to specific client
  sendToClient(sessionId: string, message: WebSocketMessage) {
    const client = this.clients.get(sessionId)
    if (client && client.ws.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify(message))
      } catch (error) {
        logger.error(`Error sending message to ${sessionId}:`, error)
        this.handleDisconnection(sessionId)
      }
    }
  }

  // Send message to specific user
  sendToUser(userId: string, message: WebSocketMessage) {
    this.clients.forEach((client, sessionId) => {
      if (client.userId === userId && client.ws.readyState === 1) {
        this.sendToClient(sessionId, message)
      }
    })
  }

  // Send message to specific store (store isolation)
  sendToStore(storeId: string, message: WebSocketMessage) {
    this.clients.forEach((client, sessionId) => {
      if (client.storeId === storeId && client.ws.readyState === 1) {
        this.sendToClient(sessionId, message)
      }
    })
  }

  // Broadcast message to all connected clients
  broadcast(message: WebSocketMessage, excludeSessionId?: string) {
    this.clients.forEach((client, sessionId) => {
      if (sessionId !== excludeSessionId && client.ws.readyState === 1) {
        this.sendToClient(sessionId, message)
      }
    })
  }

  // Broadcast message to specific store (store isolation)
  broadcastToStore(
    storeId: string,
    message: WebSocketMessage,
    excludeSessionId?: string
  ) {
    this.clients.forEach((client, sessionId) => {
      if (
        client.storeId === storeId &&
        sessionId !== excludeSessionId &&
        client.ws.readyState === 1
      ) {
        this.sendToClient(sessionId, message)
      }
    })
  }

  // Send profile update notification
  sendProfileUpdate(userId: string, profileData: any) {
    const message: WebSocketMessage = {
      type: WebSocketEventType.PROFILE_UPDATED,
      data: profileData,
      timestamp: new Date().toISOString(),
      userId,
    }

    this.sendToUser(userId, message)
    logger.info(`Profile update notification sent to user: ${userId}`)
  }

  // Send order update notification
  sendOrderUpdate(storeId: string, orderData: any) {
    const message: WebSocketMessage = {
      type: WebSocketEventType.ORDER_UPDATED,
      data: orderData,
      timestamp: new Date().toISOString(),
      storeId,
    }

    this.sendToStore(storeId, message)
    logger.info(`Order update notification sent to store: ${storeId}`)
  }

  // Send order creation notification
  sendOrderCreated(storeId: string, orderData: any) {
    const message: WebSocketMessage = {
      type: WebSocketEventType.ORDER_CREATED,
      data: orderData,
      timestamp: new Date().toISOString(),
      storeId,
    }

    this.sendToStore(storeId, message)
    logger.info(`Order creation notification sent to store: ${storeId}`)
  }

  // Send customer update notification
  sendCustomerUpdate(storeId: string, customerData: any) {
    const message: WebSocketMessage = {
      type: WebSocketEventType.CUSTOMER_UPDATED,
      data: customerData,
      timestamp: new Date().toISOString(),
      storeId,
    }

    this.sendToStore(storeId, message)
    logger.info(`Customer update notification sent to store: ${storeId}`)
  }

  // Get connection statistics
  getStats() {
    const now = Date.now()
    const storeConnections = new Map<string, number>()

    this.clients.forEach((client) => {
      if (client.storeId) {
        storeConnections.set(
          client.storeId,
          (storeConnections.get(client.storeId) || 0) + 1
        )
      }
    })

    return {
      totalConnections: this.clients.size,
      activeConnections: Array.from(this.clients.values()).filter(
        (client) => client.ws.readyState === 1
      ).length,
      storeConnections: Object.fromEntries(storeConnections),
      averageConnectionTime:
        this.clients.size > 0
          ? Array.from(this.clients.values()).reduce(
              (sum, client) => sum + (now - client.connectedAt),
              0
            ) / this.clients.size
          : 0,
    }
  }

  // Cleanup on shutdown
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    this.clients.forEach((client) => {
      client.ws.close()
    })

    this.clients.clear()
    logger.info('WebSocket server cleaned up')
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    )
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager()
export default wsManager
