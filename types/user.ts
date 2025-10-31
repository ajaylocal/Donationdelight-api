import { Types, Document } from 'mongoose'

export enum UserRole {
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
  MANAGER = 'manager',
  STAFF = 'staff',
  CUSTOMER = 'customer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export interface IOTP {
  code: string
  expires: Date
}

export interface IUser {
  _id: Types.ObjectId
  username: string
  email: string
  password: string
  pin?: string
  firstName: string
  lastName?: string
  phone?: string
  avatar?: string
  isAdmin: boolean
  isSuperAdmin: boolean
  role: Types.ObjectId
  status: UserStatus
  otp?: IOTP
  store?: Types.ObjectId
  stores?: Types.ObjectId[]
  createdBy?: Types.ObjectId
  updatedBy?: Types.ObjectId
  lastLoginAt?: Date
  lastActiveAt?: Date
  deletedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId
  matchPassword(pass: string): Promise<boolean>
  generateOTP(): string
  createOTP(expiryMinutes?: number): string
  verifyOTP(otpCode: string): boolean
  clearOTP(): void
  hasValidOTP(): boolean
}
