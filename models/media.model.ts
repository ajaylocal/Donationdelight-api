import mongoose, { Schema } from 'mongoose'
import { IMedia, IMediaDocument, MediaFileType } from '~/types'

const mediaSchema = new Schema<IMediaDocument>(
  {
    filename: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: false,
      default: '',
    },
    fileUrl: {
      type: String,
      required: false,
      default: '',
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: Object.values(MediaFileType),
      default: MediaFileType.OTHER,
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: false,
    },
    relatedId: {
      type: String,
      required: false,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    autoUpdate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

// Indexes for better query performance
mediaSchema.index({ fileType: 1, relatedId: 1 })
mediaSchema.index({ uploadedBy: 1 })
mediaSchema.index({ store: 1 })
mediaSchema.index({ createdAt: -1 })
mediaSchema.index({ isPublic: 1 })

// Virtual for file extension
mediaSchema.virtual('fileExtension').get(function () {
  return this.originalName.split('.').pop()?.toLowerCase()
})

// Virtual for formatted file size
mediaSchema.virtual('formattedFileSize').get(function () {
  const bytes = this.fileSize
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
})

// Ensure virtuals are included in JSON output
mediaSchema.set('toJSON', { virtuals: true })

const Media = mongoose.model<IMediaDocument>('Media', mediaSchema)
export default Media
