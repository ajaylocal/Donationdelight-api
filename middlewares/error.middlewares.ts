import { ErrorHandler, NotFoundHandler } from 'hono'
import { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status'
import { logger } from '~/utils'

// Error Handler
export const errorHandler: ErrorHandler = (err, c) => {
  // Check if it's an HTTPException
  if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
    const statusCode = err.status as StatusCode
    const message = err.message || 'Bad Request'

    // Log the error with details
    logger.error(`HTTPException ${statusCode}: ${message}`, {
      method: c.req.method,
      url: c.req.url,
      status: statusCode,
      userAgent: c.req.header('User-Agent'),
      ip:
        c.req.header('CF-Connecting-IP') ||
        c.req.header('X-Forwarded-For') ||
        'unknown',
    })

    return c.json(
      {
        success: false,
        message: message,
      },
      statusCode as ContentfulStatusCode
    )
  }

  // Handle other errors
  const currentStatus =
    'status' in err ? err.status : c.newResponse(null).status

  const statusCode = currentStatus !== 200 ? (currentStatus as StatusCode) : 500
  const env = c.env?.NODE_ENV || process.env?.NODE_ENV

  // Log the error with details
  logger.error(
    `Error ${statusCode}: ${err?.message || 'Internal Server Error'}`,
    {
      method: c.req.method,
      url: c.req.url,
      status: statusCode,
      stack: err?.stack,
      userAgent: c.req.header('User-Agent'),
      ip:
        c.req.header('CF-Connecting-IP') ||
        c.req.header('X-Forwarded-For') ||
        'unknown',
    }
  )

  return c.json(
    {
      success: false,
      message: err?.message || 'Internal Server Error',
      stack: env ? null : err?.stack,
    },
    statusCode as ContentfulStatusCode
  )
}

// Not Found Handler
export const notFound: NotFoundHandler = (c) => {
  // Log the 404 attempt
  logger.warn(`404 Not Found: ${c.req.method} ${c.req.url}`, {
    method: c.req.method,
    url: c.req.url,
    userAgent: c.req.header('User-Agent'),
    ip:
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      'unknown',
  })

  return c.json(
    {
      success: false,
      message: `Not Found - [${c.req.method}]:[${c.req.url}]`,
    },
    404 // Explicitly set 404 status
  )
}
