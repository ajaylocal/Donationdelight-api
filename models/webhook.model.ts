import mongoose, { Schema, Document } from 'mongoose'

export interface iWebhook extends Document {
  name: string
  url: string
  events: string[]
  isActive: boolean
  secret?: string
  store?: mongoose.Types.ObjectId
  headers?: Record<string, string>
  retryCount: number
  maxRetries: number
  lastTriggered?: Date
  lastSuccess?: Date
  lastError?: string
  createdAt: Date
  updatedAt: Date
}

const WebhookSchema = new Schema<iWebhook>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    events: [
      {
        type: String,
        enum: [
          'order.created',
          'order.updated',
          'order.status_changed',
          'order.cancelled',
          'order.completed',
          'customer.created',
          'customer.updated',
          'product.created',
          'product.updated',
          'store.updated',
        ],
        required: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    secret: {
      type: String,
      trim: true,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
    },
    headers: {
      type: Map,
      of: String,
      default: {},
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    lastTriggered: {
      type: Date,
    },
    lastSuccess: {
      type: Date,
    },
    lastError: {
      type: String,
    },
  },
  {
    timestamps: {
      currentTime: () =>
        new Date(
          new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
        ),
    },
  }
)

// Index for efficient querying
WebhookSchema.index({ events: 1, isActive: 1, store: 1 })

export const Webhook = mongoose.model<iWebhook>('Webhook', WebhookSchema)
export default Webhook
