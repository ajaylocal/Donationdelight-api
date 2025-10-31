import mongoose, { Schema, Types } from 'mongoose'
import { type IRoleDocument } from '~/types'

const permissionSchema = new Schema(
  {
    create: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
  { _id: false }
)

const roleSchema = new Schema<IRoleDocument>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // Made optional for system roles
    permissions: {
      type: Map,
      of: permissionSchema,
      required: true,
    },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const Role = mongoose.model<IRoleDocument>('Role', roleSchema)
export default Role
