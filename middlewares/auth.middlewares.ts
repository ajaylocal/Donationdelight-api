import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception' // Added for better error handling
import { Jwt } from 'hono/utils/jwt'
import { Role, User } from '~/models'
import type { IUser, IPermission } from '~/types'
import { PermissionResource } from '~/types'

// Protect Route for Authenticated Users
export const protect = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Not authorized! No token provided!',
    })
  }

  const token = authHeader.replace(/^Bearer\s+/i, '')

  try {
    const { id } = await Jwt.verify(token, process.env.JWT_SECRET || '') // Updated from Bun.env
    if (!id) {
      throw new HTTPException(401, { message: 'Invalid token payload!' })
    }

    const user = await User.findById(id).populate('role').select('-password')
    if (!user) {
      throw new HTTPException(401, { message: 'User not found!' })
    }

    // Add storeId to user object
    const userWithStoreId = user.toObject() as any
    if (user.store) {
      userWithStoreId.store = user.store.toString()
    } else if (user.stores && user.stores.length > 0) {
      userWithStoreId.store = user.stores[0].toString()
    }

    // Type-safe user assignment
    c.set('user', userWithStoreId as IUser)
    await next()
  } catch (err) {
    throw new HTTPException(401, { message: 'Invalid token! Not authorized!' })
  }
}

// Check if user is admin
export const isAdmin = async (c: Context, next: Next) => {
  const user = c.get('user') as IUser | undefined

  if (!user) {
    throw new HTTPException(401, {
      message: 'Not authorized! No user context!',
    })
  }

  if (user.isAdmin) {
    await next()
  } else {
    throw new HTTPException(403, { message: 'Not authorized as an admin!' }) // 403 for permission denied
  }
}

// Check if user is superadmin
export const isSuperAdmin = async (c: Context, next: Next) => {
  const user = c.get('user') as IUser | undefined

  if (!user) {
    throw new HTTPException(401, {
      message: 'Not authorized! No user context!',
    })
  }

  if (user.isSuperAdmin) {
    await next()
  } else {
    throw new HTTPException(403, { message: 'Not authorized as a superadmin!' }) // 403 for permission denied
  }
}

// API Key authentication middleware
export const requireApiKey = async (c: Context, next: Next) => {
  const authHeader = c.req.header('AI-API-KEY') || c.req.header('ai-api-key')

  if (!authHeader) {
    throw new HTTPException(401, {
      message: 'Authorization header is required',
    })
  }

  // Remove "Bearer " prefix
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw new HTTPException(401, {
      message: 'API key is required',
    })
  }

  const validApiKey = process.env.AI_API_KEY

  if (!validApiKey) {
    throw new HTTPException(500, {
      message: 'API key validation not configured',
    })
  }

  if (token !== validApiKey) {
    throw new HTTPException(401, {
      message: 'Invalid API key',
    })
  }

  await next()
}

// Optional authentication middleware - sets user context if valid token is provided
export const optionalAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '')

    try {
      const { id } = await Jwt.verify(token, process.env.JWT_SECRET || '')
      if (id) {
        const user = await User.findById(id)
          .populate('role')
          .select('-password')
        if (user) {
          // Add storeId to user object
          const userWithStoreId = user.toObject() as any
          if (user.store) {
            userWithStoreId.store = user.store.toString()
          } else if (user.stores && user.stores.length > 0) {
            userWithStoreId.store = user.stores[0].toString()
          }

          // Type-safe user assignment
          c.set('user', userWithStoreId as IUser)
        }
      }
    } catch (err) {
      // Invalid token, but continue without user context
      console.log(
        'Optional auth: Invalid token, continuing without user context'
      )
    }
  }

  await next()
}

// Require specific permissions for a module
export const requirePermission = (
  module: PermissionResource,
  action: keyof IPermission
) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as IUser | undefined

    if (!user) {
      throw new HTTPException(401, {
        message: 'Not authorized! No user context!',
      })
    }

    // Superadmins bypass all permission checks
    if (user.isSuperAdmin) {
      return next()
    }

    // For certain critical operations, only superadmins should have access
    const superAdminOnlyOperations = [PermissionResource.STORES]

    if (superAdminOnlyOperations.includes(module) && action === 'create') {
      throw new HTTPException(403, {
        message: 'Only superadmins can perform this operation',
      })
    }

    // Regular admins can bypass permission checks for most operations
    if (user.isAdmin) {
      return next()
    }

    // For regular users, check role-based permissions
    let role
    if (typeof user.role === 'object' && user.role._id) {
      // Role is already populated
      role = user.role
    } else {
      // Role is an ID, need to fetch it
      const roleId =
        typeof user.role === 'string' ? user.role : user.role?.toString()
      role = await Role.findById(roleId).lean()
    }

    if (!role) {
      throw new HTTPException(403, {
        message: 'User role not found!',
      })
    }

    // Convert Mongoose Map to plain object for easier access
    const permissions =
      role.permissions instanceof Map
        ? Object.fromEntries(role.permissions)
        : role.permissions

    const perms = permissions?.[module]
    if (!perms || perms[action] !== true) {
      throw new HTTPException(403, {
        message: `Forbidden: No ${action} access to ${module}`,
      })
    }

    return next()
  }
}
