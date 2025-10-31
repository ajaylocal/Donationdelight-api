import { Types, Document } from 'mongoose'

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum PermissionResource {
  USERS = 'users',
  ROLES = 'roles',
  STORES = 'stores',
  CUSTOMERS = 'customers',
  ORDERS = 'orders',
  CATEGORIES = 'categories',
  PRODUCTS = 'products',
  MODIFIERS = 'modifiers',
  METHODS = 'methods',
  REPORTS = 'reports',
  SETTINGS = 'settings',
  TAX_RULES = 'tax_rules',
  COUPONS = 'coupons',
  PRINTERS = 'printers',
  MEDIA = 'media',
}

export interface IPermission {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
}

export interface IRole {
  _id: Types.ObjectId
  name: string
  description?: string
  createdBy: Types.ObjectId
  permissions: Record<PermissionResource, IPermission>
  isSystem: boolean
  isActive: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface IRoleDocument extends IRole, Document {
  _id: Types.ObjectId
}
