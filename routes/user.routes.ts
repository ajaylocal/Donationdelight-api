import { Hono } from 'hono'
//
import {
  getUsers,
  createUser,
  loginUser,
  pinLogin,
  getUserById,
  getProfile,
  editProfile,
  getUsersCreatedByMe,
  resendOTP,
  verifyOTP,
  forgetPassword,
  resetPassword,
} from '~/controllers'
import {
  isAdmin,
  isSuperAdmin,
  protect,
  requirePermission,
} from '~/middlewares'
import { PermissionResource } from '~/types'

const users = new Hono()

// Get All Users (SuperAdmin only)
users.get('/', protect, isSuperAdmin, getUsers)

// Get all staff created by current user
users.get('/staff', protect, getUsersCreatedByMe)

// Create User (Protected - requires authentication and create-user permission)
users.post(
  '/',
  protect,
  requirePermission(PermissionResource.USERS, 'create'),
  createUser
)

// Login User
users.post('/login', loginUser)

// PIN Login User
users.post('/pin-login', pinLogin)

// Resend OTP
users.post('/resend-otp', resendOTP)

// Verify OTP
users.post('/verify-otp', verifyOTP)

// Forget Password
users.post('/forget-password', forgetPassword)

// Reset Password
users.post('/reset-password', resetPassword)

// Get User Profile
users.get('/profile', protect, getProfile)

// Edit User Profile
users.put('/profile', protect, editProfile)

// Get Single User (Admin/SuperAdmin only)
users.get(
  '/:id',
  protect,
  requirePermission(PermissionResource.USERS, 'read'),
  getUserById
)

export default users
