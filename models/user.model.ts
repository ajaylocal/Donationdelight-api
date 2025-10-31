import { Schema, model } from 'mongoose'
import { UserStatus, type IUserDocument } from '~/types'
import { TIMEZONE } from '~/utils'

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      match: /.+\@.+\..+/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      validate: {
        validator: function (v: string) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(v)
        },
        message:
          'Password must contain at least 1 uppercase, 1 lowercase and 1 number',
      },
    },
    pin: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String },
    phone: {
      type: String,
      match: [/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'],
    },
    avatar: { type: String },
    isAdmin: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      required: true,
      default: UserStatus.ACTIVE,
    },
    otp: {
      type: new Schema(
        {
          code: { type: String, required: true },
          expires: { type: Date, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: false,
    },
    stores: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    lastLoginAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  {
    timestamps: {
      // Use Specific timezone for the timestamps
      currentTime: () => {
        return new Date(
          new Date().toLocaleString('en-US', { timeZone: TIMEZONE })
        )
      },
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Index for quick lookup
userSchema.index({ store: 1, role: 1 })
userSchema.index({ status: 1, isAdmin: 1 })
userSchema.index({ createdBy: 1 })
userSchema.index({ stores: 1 })

// Compound unique indexes for store-specific uniqueness
userSchema.index({ store: 1, email: 1 }, { unique: true, sparse: true })
userSchema.index({ store: 1, username: 1 }, { unique: true, sparse: true })
// Removed PIN uniqueness - PINs can be reused within a store
// userSchema.index({ store: 1, pin: 1 }, { unique: true, sparse: true })

// Virtual field for full name
userSchema.virtual('name').get(function (this: any) {
  return `${this.firstName} ${this.lastName || ''}`
})

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await Bun.password.verify(enteredPassword, this.password)
}

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next()
  }
  try {
    this.password = await Bun.password.hash(this.password, {
      algorithm: 'bcrypt',
      cost: 10, // number between 4-31 [Heiger is secure but slower]
    })
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Pre-save middleware to set isAdmin and isSuperAdmin based on role
userSchema.pre('save', async function (next) {
  try {
    // Only check if role is modified or this is a new document
    if (this.isModified('role') || this.isNew) {
      if (this.role) {
        // Populate the role to get the properties
        await this.populate('role')
        const role = this.role as any

        // Set isAdmin and isSuperAdmin based on role properties
        if (role) {
          this.isAdmin = role.isAdmin || role.name === 'admin'
          this.isSuperAdmin = role.isSuperAdmin || role.name === 'superadmin'
        } else {
          this.isAdmin = false
          this.isSuperAdmin = false
        }

        // Unpopulate the role to keep the response clean
        this.role = role._id
      } else {
        this.isAdmin = false
        this.isSuperAdmin = false
      }
    }
    next()
  } catch (error) {
    next(error as Error)
  }
})

// OTP-related methods
userSchema.methods.generateOTP = function () {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

userSchema.methods.createOTP = function (expiryMinutes: number = 10) {
  const otp = this.generateOTP()
  const expires = new Date(Date.now() + expiryMinutes * 60 * 1000)

  this.otp = {
    code: otp,
    expires: expires,
  }

  return otp
}

userSchema.methods.verifyOTP = function (otpCode: string): boolean {
  if (!this.otp || !this.otp.code || !this.otp.expires) {
    return false
  }

  if (this.otp.code !== otpCode) {
    return false
  }

  if (new Date() > this.otp.expires) {
    return false
  }

  // Clear the OTP after successful verification
  this.otp = undefined
  return true
}

userSchema.methods.clearOTP = function () {
  this.otp = undefined
}

userSchema.methods.hasValidOTP = function (): boolean {
  return !!(
    this.otp &&
    this.otp.code &&
    this.otp.expires &&
    new Date() <= this.otp.expires
  )
}

// Transform the user object before sending it as a response
userSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete (ret as any).password
    delete (ret as any).__v
    delete (ret as any).otp // Remove OTP from all user responses
    return ret
  },
})

const User = model<IUserDocument>('User', userSchema)
export default User
