import { Types, Document } from 'mongoose'

export enum MediaFileType {
  USER = 'user',
  STORE_BANNER = 'banner',
  STORE_LOGO = 'logo',
  PRODUCT = 'product',
  FOLDER = 'folder',
  OTHER = 'other',
}

export interface IMedia {
  _id: Types.ObjectId
  filename: string
  originalName: string
  filePath: string
  fileUrl: string
  fileSize: number
  mimeType: string
  fileType: MediaFileType
  uploadedBy?: Types.ObjectId
  store?: Types.ObjectId
  relatedId?: string // userId, storeId, productId, etc.
  isPublic: boolean
  metadata?: Record<string, any>
  autoUpdate: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface IMediaDocument extends IMedia, Document {
  _id: Types.ObjectId
}

// Response types for API
export interface IMediaResponse {
  success: boolean
  message: string
  data: IMedia
}

export interface IMediaListResponse {
  success: boolean
  message: string
  data: IMedia[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface IMediaStats {
  totalFiles: number
  totalSize: number
  fileTypes: Array<{
    _id: MediaFileType
    count: number
    size: number
  }>
  averageFileSize: number
}

export interface IMediaStatsResponse {
  success: boolean
  message: string
  data: IMediaStats
}

// Upload request types
export interface IMediaUploadRequest {
  file: File
  fileType?: MediaFileType
  relatedId?: string
  storeId?: string
  isPublic?: boolean
  autoUpdate?: boolean
}

// Query parameters for filtering
export interface IMediaQueryParams {
  page?: number
  limit?: number
  fileType?: MediaFileType
  relatedId?: string
  storeId?: string
  uploadedBy?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Virtual fields (computed properties)
export interface IMediaVirtuals {
  fileExtension?: string
  formattedFileSize?: string
}
