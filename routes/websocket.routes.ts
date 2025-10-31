import { Hono } from 'hono'
import { protect } from '~/middlewares/auth.middlewares'
import { wsManager } from '~/utils/websocket'
import logger from '~/utils/logger'

const websocketRoutes = new Hono()

// Get WebSocket statistics (admin only)
websocketRoutes.get('/stats', protect, async (c) => {
  try {
    const stats = wsManager.getStats()

    return c.json({
      success: true,
      data: stats,
      message: 'WebSocket statistics retrieved successfully',
    })
  } catch (error) {
    logger.error('Error getting WebSocket stats:', error)
    return c.json(
      {
        success: false,
        message: 'Failed to get WebSocket statistics',
      },
      500
    )
  }
})

// Health check endpoint for WebSocket server
websocketRoutes.get('/health', async (c) => {
  try {
    const stats = wsManager.getStats()

    return c.json({
      success: true,
      data: {
        serverOnline: true,
        activeConnections: stats.activeConnections,
        totalConnections: stats.totalConnections,
        timestamp: new Date().toISOString(),
      },
      message: 'WebSocket server health check',
    })
  } catch (error) {
    logger.error('Error in WebSocket health check:', error)
    return c.json(
      {
        success: false,
        message: 'WebSocket server health check failed',
      },
      500
    )
  }
})

export default websocketRoutes
