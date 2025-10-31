import { Role, User } from '~/models'
import { logger } from '~/utils'
import { PermissionResource } from '~/types'

/**
 * Set up the initial superadmin role with all permissions
 */
export const setupSuperAdminRole = async () => {
  try {
    // Check if superadmin role already exists
    const existingSuperAdminRole = await Role.findOne({
      name: 'superadmin',
    })

    if (existingSuperAdminRole) {
      logger.info('Superadmin role already exists')
      return existingSuperAdminRole
    }

    // Create superadmin permissions - full access to everything
    const superAdminPermissions: Record<PermissionResource, any> = {
      [PermissionResource.USERS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.ROLES]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.STORES]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.CUSTOMERS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.ORDERS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.CATEGORIES]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.PRODUCTS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.MODIFIERS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.METHODS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.REPORTS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.SETTINGS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.TAX_RULES]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
      [PermissionResource.COUPONS]: {
        create: true,
        read: true,
        update: true,
        delete: true,
      },
    }

    // Create superadmin role
    const superAdminRole = await Role.create({
      name: 'superadmin',
      description: 'Super Administrator with full system access',
      permissions: new Map(Object.entries(superAdminPermissions)),
      isSystem: true,
      isActive: true,
      isAdmin: true,
      isSuperAdmin: true,
    })

    logger.info('Superadmin role created successfully', {
      roleId: superAdminRole._id,
    })
    return superAdminRole
  } catch (error) {
    logger.error('Error creating superadmin role', { error })
    throw error
  }
}

/**
 * Create a superadmin user (if it doesn't exist)
 */
export const setupSuperAdminUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName?: string
) => {
  try {
    // Check if superadmin user already exists
    const existingSuperAdmin = await User.findOne({
      email: email.toLowerCase(),
    })

    if (existingSuperAdmin) {
      logger.info('Superadmin user already exists')
      return existingSuperAdmin
    }

    // Get the superadmin role
    const superAdminRole = await Role.findOne({ name: 'superadmin' })
    if (!superAdminRole) {
      throw new Error(
        'Superadmin role not found. Please run setupSuperAdminRole first.'
      )
    }

    // Create superadmin user
    const superAdminUser = await User.create({
      username: email.split('@')[0], // Use email prefix as username
      email: email.toLowerCase(),
      password, // This should be hashed by the User model
      firstName,
      lastName,
      isAdmin: true,
      isSuperAdmin: true,
      role: superAdminRole._id,
      status: 'active',
    })

    logger.info('Superadmin user created successfully', {
      userId: superAdminUser._id,
      email: superAdminUser.email,
    })
    return superAdminUser
  } catch (error) {
    logger.error('Error creating superadmin user', { error })
    throw error
  }
}

/**
 * Initialize the superadmin system
 */
export const initializeSuperAdmin = async (
  email: string,
  password: string,
  firstName: string,
  lastName?: string
) => {
  try {
    logger.info('Initializing superadmin system...')

    // Create superadmin role
    const superAdminRole = await setupSuperAdminRole()

    // Create superadmin user
    const superAdminUser = await setupSuperAdminUser(
      email,
      password,
      firstName,
      lastName
    )

    logger.info('Superadmin system initialized successfully', {
      roleId: superAdminRole._id,
      userId: superAdminUser._id,
    })

    return {
      role: superAdminRole,
      user: superAdminUser,
    }
  } catch (error) {
    logger.error('Error initializing superadmin system', { error })
    throw error
  }
}
