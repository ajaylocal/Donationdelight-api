import { Role } from '~/models'
import { logger } from '~/utils'
import { PermissionResource } from '~/types'

/**
 * Initialize admin role with all permissions
 */
export async function initializeAdminRole(): Promise<void> {
  try {
    // Check if admin role already exists
    const existingAdminRole = await Role.findOne({ name: 'admin' })

    if (existingAdminRole) {
      logger.info('Admin role already exists in database')
      return
    }

    // Create admin role with all permissions set to true
    const adminPermissions: Record<PermissionResource, any> = {
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
    }

    // Create admin role
    const adminRole = new Role({
      name: 'admin',
      description: 'System administrator with full access to all features',
      createdBy: undefined, // System-created role (no createdBy)
      permissions: adminPermissions,
      isSystem: true,
      isActive: true,
      isAdmin: true,
    })

    await adminRole.save()

    logger.info('Admin role created successfully with all permissions', {
      roleId: adminRole._id,
      permissions: Object.keys(adminPermissions).length,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to initialize admin role', { error: errorMessage })
    throw error
  }
}

/**
 * Initialize application data
 */
export async function initializeApp(): Promise<void> {
  try {
    logger.info('Starting application initialization...')

    // Initialize admin role
    await initializeAdminRole()

    logger.info('Application initialization completed successfully')
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Application initialization failed', { error: errorMessage })
    throw error
  }
}
