import type { Context, Next } from 'hono'
import { logger } from '~/utils'

export const customLogger = () => {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const method = c.req.method
    const url = c.req.url
    const userAgent = c.req.header('User-Agent') || ''
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      'unknown'

    // Log the incoming request
    logger.info(`${method} ${url}`, {
      method,
      url,
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    })

    await next()

    const end = Date.now()
    const responseTime = end - start
    const status = c.res.status

    // Log the response
    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    const message = `${method} ${url} ${status} - ${responseTime}ms`

    logger[logLevel](message, {
      method,
      url,
      status,
      responseTime,
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    })
  }
}
