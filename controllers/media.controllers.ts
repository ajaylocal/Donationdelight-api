import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { join, extname, basename } from 'path'
import { writeFile, mkdir, unlink, access, readFile } from 'fs/promises'
import { Media, User, Store } from '~/models'
import { IMedia, MediaFileType } from '~/types'
import logger from '~/utils/logger'
import { GHL_API_BASE, getGHLToken } from '~/utils/constants'

// GoHighLevel API Helper Functions
class GoHighLevelAPI {
  private static getHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28',
    }
  }

  private static getFormDataHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
    }
  }

  // Upload file to GoHighLevel
  static async uploadFile(
    token: string,
    file: File,
    options: {
      name?: string
      folderId?: string
      hosted?: boolean
      fileUrl?: string
    } = {}
  ) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const formData = new FormData()

    if (options.hosted && options.fileUrl) {
      // Upload from URL
      formData.append('fileUrl', options.fileUrl)
      formData.append('hosted', 'true')
    } else {
      // Upload file directly
      formData.append('file', file)
      formData.append('hosted', 'false')
    }

    if (options.name) {
      formData.append('name', options.name)
    }

    if (options.folderId) {
      formData.append('folderId', options.folderId)
    }

    const response = await fetch(`${GHL_API_BASE}/medias/upload-file`, {
      method: 'POST',
      headers: this.getFormDataHeaders(token),
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  // Get list of files/folders from GoHighLevel
  static async getFiles(
    token: string,
    options: {
      folderId?: string
      page?: number
      limit?: number
      type?: string
    } = {}
  ) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const params = new URLSearchParams()
    // Add required type parameter - try different values
    params.append('type', options.type || 'all')
    if (options.folderId) params.append('folderId', options.folderId)
    if (options.page) params.append('page', options.page.toString())
    if (options.limit) params.append('limit', options.limit.toString())

    const url = `${GHL_API_BASE}/medias/files${
      params.toString() ? `?${params.toString()}` : ''
    }`

    // Debug logging
    logger.info('GoHighLevel API Request:', {
      url,
      headers: this.getHeaders(token),
      params: params.toString(),
    })

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('GoHighLevel API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()

    // Debug logging for successful response
    logger.info('GoHighLevel API Response:', {
      status: response.status,
      data: responseData,
      dataKeys: Object.keys(responseData),
      filesCount:
        responseData?.files?.length ||
        responseData?.data?.files?.length ||
        'no files array',
    })

    return responseData
  }

  // Get single file from GoHighLevel
  static async getFile(token: string, fileId: string) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const response = await fetch(`${GHL_API_BASE}/medias/${fileId}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  // Update file/folder in GoHighLevel
  static async updateFile(token: string, fileId: string, updateData: any) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const response = await fetch(`${GHL_API_BASE}/medias/${fileId}`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(updateData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  // Delete file/folder from GoHighLevel
  static async deleteFile(token: string, fileId: string) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const response = await fetch(`${GHL_API_BASE}/medias/${fileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  // Create folder in GoHighLevel
  static async createFolder(token: string, name: string, parentId?: string) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const response = await fetch(`${GHL_API_BASE}/medias/folder`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        name,
        parentId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  // Bulk update files in GoHighLevel
  static async bulkUpdateFiles(token: string, files: any[]) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const response = await fetch(`${GHL_API_BASE}/medias/update-files`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ files }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  // Bulk delete files in GoHighLevel
  static async bulkDeleteFiles(
    token: string,
    files: string[],
    trash: boolean = true
  ) {
    if (!token) {
      throw new Error('GHL token not provided')
    }

    const response = await fetch(`${GHL_API_BASE}/medias/delete-files`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ files, trash }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GHL API Error: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }
}

// Configuration
const UPLOAD_DIR = join(process.cwd(), 'uploads')
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// Validate file type
function isValidFileType(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext)
}

// Generate unique filename (short)
function generateUniqueFilename(originalName: string): string {
  const ext = extname(originalName)
  const uniqueId = uuidv4().replace(/-/g, '').substring(0, 8) // 8 character unique ID
  return `${uniqueId}${ext}`
}

// Get content type
function getContentType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  }
  return contentTypes[ext] || 'application/octet-stream'
}

// Upload media file to GoHighLevel
export const uploadMedia = async (c: Context) => {
  try {
    const formData = await c.req.formData()

    // Check if it's a single file or multiple files
    const file = formData.get('file') as File
    const files = formData.getAll('files') as File[]

    // Determine if we're doing bulk upload
    const isBulkUpload = files.length > 0

    // Use files array for bulk, or create array with single file
    const filesToProcess = isBulkUpload ? files : file ? [file] : []

    const fileType =
      (formData.get('fileType') as MediaFileType) || MediaFileType.OTHER
    const relatedId = formData.get('relatedId') as string
    const isPublic = formData.get('isPublic') !== 'false' // default to true
    const autoUpdate = formData.get('autoUpdate') !== 'false' // default to true
    const folderId = formData.get('folderId') as string
    const hosted = formData.get('hosted') === 'true'
    const fileUrl = formData.get('fileUrl') as string

    // Get user from context
    const user = c.get('user')

    // Determine the store scope for media upload
    let storeId = formData.get('storeId') as string

    // If not in form data, try to get from current user's store
    if (!storeId) {
      storeId =
        user?.store?._id ||
        (user?.stores && user?.stores.length > 0
          ? user?.stores[0]?._id
          : null) ||
        (user?.selectedRestaurants && user?.selectedRestaurants.length > 0
          ? user?.selectedRestaurants[0]?._id
          : null) ||
        user?.store
    }

    if (!storeId) {
      throw new HTTPException(400, {
        message:
          'Store is required. Please provide storeId in form data or ensure user has access to a store.',
      })
    }

    if (filesToProcess.length === 0 && !hosted) {
      throw new HTTPException(400, {
        message: 'No file(s) provided',
      })
    }

    if (hosted && !fileUrl) {
      throw new HTTPException(400, {
        message: 'fileUrl is required when hosted is true',
      })
    }

    // For bulk upload, use the bulk functions
    if (isBulkUpload) {
      const ghlToken = await getGHLToken(storeId)
      if (!ghlToken) {
        // Use local storage bulk upload
        return await bulkUploadToLocalStorage(c, {
          files: filesToProcess,
          fileType,
          relatedId,
          isPublic,
          autoUpdate,
          user,
          storeId,
        })
      } else {
        // Use GoHighLevel bulk upload (individual processing)
        return await bulkUploadToGoHighLevel(c, {
          files: filesToProcess,
          fileType,
          relatedId,
          isPublic,
          autoUpdate,
          user,
          storeId,
          folderId,
          ghlToken,
        })
      }
    }

    // Single file upload (original logic)
    const singleFile = filesToProcess[0]

    // Validate file type (only for direct uploads)
    if (!hosted && !isValidFileType(singleFile.name)) {
      return c.json(
        {
          error: 'Invalid file type. Allowed: jpg, jpeg, png, webp, gif, svg',
        },
        400
      )
    }

    // Validate file size (only for direct uploads)
    if (!hosted && singleFile.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        400
      )
    }

    // Check if GoHighLevel is configured
    const ghlToken = await getGHLToken(storeId)
    if (!ghlToken) {
      // Use local storage (original method)
      return await uploadToLocalStorage(c, {
        file: singleFile,
        fileType,
        relatedId,
        isPublic,
        autoUpdate,
        user,
        storeId,
      })
    }

    // Upload to GoHighLevel
    let ghlResponse
    try {
      ghlResponse = await GoHighLevelAPI.uploadFile(ghlToken, singleFile, {
        name: singleFile?.name,
        folderId: folderId || undefined,
        hosted: hosted,
        fileUrl: fileUrl || undefined,
      })

      // Debug logging
      logger.info('GoHighLevel upload response:', ghlResponse)
    } catch (ghlError: any) {
      logger.error('GoHighLevel upload failed:', ghlError)
      throw new HTTPException(500, {
        message: `Failed to upload to GoHighLevel: ${ghlError.message}`,
      })
    }

    // Extract data from GoHighLevel response
    const ghlData = ghlResponse.data || ghlResponse
    const ghlFileUrl =
      ghlData?.url || ghlData?.fileUrl || ghlData?.file_url || ''

    if (!ghlFileUrl) {
      logger.warn('No file URL received from GoHighLevel:', ghlResponse)
    }

    // Create media record in database with GoHighLevel data
    const media = new Media({
      filename:
        ghlData?.filename || ghlData?.name || singleFile?.name || 'unknown',
      originalName: singleFile?.name || ghlData?.name || 'unknown',
      filePath: '', // No local file path since it's stored in GHL
      fileUrl: ghlFileUrl,
      fileSize: singleFile?.size || ghlData?.size || 0,
      mimeType:
        singleFile?.type ||
        ghlData?.mimeType ||
        ghlData?.mime_type ||
        'application/octet-stream',
      fileType: fileType,
      uploadedBy: user?.id,
      store: storeId,
      relatedId,
      isPublic: isPublic,
      autoUpdate: autoUpdate,
      metadata: {
        uploadedAt: new Date().toISOString(),
        userAgent: c.req.header('User-Agent'),
        ghlFileId: ghlData?.id,
        ghlFolderId: ghlData?.folderId || ghlData?.folder_id,
        hosted: hosted,
        originalFileUrl: fileUrl,
        ghlResponse: ghlResponse, // Store full response for debugging
      },
    })

    await media.save()

    logger.info(
      `Media uploaded to GoHighLevel: ${media.filename} by user: ${user?.id}`
    )

    // Auto-update functionality
    if (autoUpdate && media.fileType === MediaFileType.USER) {
      try {
        // Use relatedId if provided, otherwise use uploader's ID
        const targetUserId = relatedId || user?.id

        if (targetUserId) {
          await User.findByIdAndUpdate(targetUserId, {
            avatar: media.fileUrl,
          })
          logger.info(
            `User avatar auto-updated: ${targetUserId} with ${media.fileUrl}`
          )
        }
      } catch (error) {
        logger.error('Failed to auto-update user avatar:', error)
      }
    }

    // Auto-update store logo/banner for users with store update permission
    if (
      autoUpdate &&
      (media.fileType === MediaFileType.STORE_LOGO ||
        media.fileType === MediaFileType.STORE_BANNER) &&
      storeId
    ) {
      try {
        // Check if user has store update permission (excluding superadmin)
        if (user && !user.isSuperAdmin && user.role) {
          // Check if user has store update permission
          const hasStoreUpdatePermission =
            user.role.permissions?.stores?.update || false

          if (hasStoreUpdatePermission) {
            const updateField =
              media.fileType === MediaFileType.STORE_LOGO ? 'logo' : 'banner'
            await Store.findByIdAndUpdate(storeId, {
              [updateField]: media.fileUrl,
            })
            logger.info(
              `Store ${updateField} auto-updated: ${storeId} with ${media.fileUrl}`
            )
          }
        }
      } catch (error) {
        logger.error('Failed to auto-update store logo/banner:', error)
      }
    }

    return c.json(
      {
        success: true,
        message: 'Media uploaded successfully to GoHighLevel',
        data: {
          ...media.toObject(),
          ghlResponse: ghlResponse.data,
        },
      },
      201
    )
  } catch (error) {
    logger.error('Error uploading media:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Get all media from GoHighLevel
export const getAllMedia = async (c: Context) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const folderId = c.req.query('folderId')
    const search = c.req.query('search')
    const type = c.req.query('type')

    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Determine store scope based on user role
    let targetStoreId = c.req.query('storeId')

    // Superadmins can access all media, others are limited to their store
    if (!user.isSuperAdmin) {
      // Non-superadmins can only access media from their own store
      targetStoreId =
        user?.store?._id ||
        (user?.stores && user?.stores.length > 0
          ? user?.stores[0]?._id
          : null) ||
        (user?.selectedRestaurants && user?.selectedRestaurants.length > 0
          ? user?.selectedRestaurants[0]?._id
          : null) ||
        user?.store ||
        ''

      if (!targetStoreId) {
        throw new HTTPException(400, {
          message:
            'Store access required. Please ensure you have access to a store.',
        })
      }
    }

    // Check if GoHighLevel is configured for the target store
    const ghlToken = await getGHLToken(targetStoreId || '')
    if (!ghlToken) {
      // Use local storage (original method)
      return await getAllMediaFromLocal(c, {
        page,
        limit,
        fileType: c.req.query('fileType'),
        relatedId: c.req.query('relatedId'),
        storeId: targetStoreId, // Use the determined store ID
        uploadedBy: c.req.query('uploadedBy'),
        search,
        sortBy: c.req.query('sortBy') || 'createdAt',
        sortOrder: c.req.query('sortOrder') === 'asc' ? 1 : -1,
        user,
      })
    }

    // Fetch from GoHighLevel API
    let ghlResponse
    try {
      ghlResponse = await GoHighLevelAPI.getFiles(ghlToken, {
        folderId: folderId || undefined,
        page: page,
        limit: limit,
        type: type || 'all', // Use query parameter or default to 'all'
      })
    } catch (ghlError: any) {
      logger.error('GoHighLevel fetch failed:', ghlError)
      throw new HTTPException(500, {
        message: `Failed to fetch from GoHighLevel: ${ghlError.message}`,
      })
    }

    // Also get local database records for additional metadata
    const localMediaQuery: any = {}

    // Filter by store based on user role
    if (user.isSuperAdmin) {
      // SuperAdmin can see all media
      if (targetStoreId) {
        localMediaQuery.store = targetStoreId
      }
    } else {
      // Non-superadmins can only see media from their store
      localMediaQuery.store = user.store
    }

    // Get local media records that match GoHighLevel files
    const ghlFileIds =
      ghlResponse.data?.files?.map((file: any) => file.id) || []
    if (ghlFileIds.length > 0) {
      localMediaQuery['metadata.ghlFileId'] = { $in: ghlFileIds }
    }

    const localMedia = await Media.find(localMediaQuery)
      .populate('uploadedBy', 'name email')
      .populate('store', 'name slug')
      .lean()

    // Debug logging for data processing
    logger.info('Processing GoHighLevel response:', {
      ghlResponseKeys: Object.keys(ghlResponse),
      ghlDataKeys: Object.keys(ghlResponse.data || {}),
      ghlFiles: ghlResponse.data?.files || ghlResponse.files,
      ghlFilesLength:
        ghlResponse.data?.files?.length || ghlResponse.files?.length || 0,
      localMediaLength: localMedia.length,
    })

    // Try different possible response structures
    const ghlFiles =
      ghlResponse.data?.files || ghlResponse.files || ghlResponse.data || []

    logger.info('Extracted GHL files:', {
      ghlFiles,
      ghlFilesLength: Array.isArray(ghlFiles)
        ? ghlFiles.length
        : 'not an array',
      ghlFilesType: typeof ghlFiles,
    })

    // Merge GoHighLevel data with local metadata
    const mergedMedia = Array.isArray(ghlFiles)
      ? ghlFiles.map((ghlFile: any) => {
          const localRecord = localMedia.find(
            (local) => local.metadata?.ghlFileId === ghlFile.id
          )

          return {
            ...ghlFile,
            // Local metadata
            fileType: localRecord?.fileType || MediaFileType.OTHER,
            uploadedBy: localRecord?.uploadedBy,
            store: localRecord?.store,
            relatedId: localRecord?.relatedId,
            isPublic: localRecord?.isPublic ?? true,
            autoUpdate: localRecord?.autoUpdate ?? false,
            // Local database ID for reference
            localId: localRecord?._id,
            // Additional metadata
            metadata: {
              ...ghlFile.metadata,
              ...localRecord?.metadata,
            },
          }
        })
      : []

    // Apply search filter if provided
    let filteredMedia = mergedMedia
    if (search) {
      filteredMedia = mergedMedia.filter(
        (file: any) =>
          file.name?.toLowerCase().includes(search.toLowerCase()) ||
          file.filename?.toLowerCase().includes(search.toLowerCase())
      )
    }

    return c.json({
      success: true,
      message: 'Media retrieved successfully from GoHighLevel',
      data: filteredMedia,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil((ghlResponse.data?.total || 0) / limit),
        totalItems: ghlResponse.data?.total || 0,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil((ghlResponse.data?.total || 0) / limit),
        hasPrevPage: page > 1,
      },
      ghlResponse: ghlResponse.data,
    })
  } catch (error) {
    logger.error('Get all media error:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    return c.json({ error: 'Failed to fetch media' }, 500)
  }
}

// Get single media by ID from GoHighLevel
export const getMedia = async (c: Context) => {
  try {
    const identifier = c.req.param('id')
    const accept = c.req.header('Accept')

    // Get user from context (optional for public access)
    const user = c.get('user')

    // Check if GoHighLevel is configured
    const userStoreId =
      user?.store?._id ||
      (user?.stores && user?.stores.length > 0 ? user?.stores[0]?._id : null) ||
      (user?.selectedRestaurants && user?.selectedRestaurants.length > 0
        ? user?.selectedRestaurants[0]?._id
        : null) ||
      user?.store ||
      ''

    const ghlToken = await getGHLToken(userStoreId)
    if (!ghlToken) {
      // Use local storage (original method)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier)
      let localMedia

      if (isObjectId) {
        localMedia = await Media.findById(identifier)
          .populate('uploadedBy', 'name email')
          .populate('store', 'name slug')
      } else {
        localMedia = await Media.findOne({ filename: identifier })
          .populate('uploadedBy', 'name email')
          .populate('store', 'name slug')
      }

      if (!localMedia) {
        return c.json({ error: 'Media not found' }, 404)
      }

      // Check authorization for local media
      // Allow public access if isPublic is true
      if (localMedia.isPublic) {
        // Public media is accessible to everyone
      } else if (!user) {
        // Private media requires authentication
        return c.json(
          { error: 'Authentication required for private media' },
          401
        )
      } else {
        // Check user permissions for private media
        const canAccess =
          user.isSuperAdmin ||
          (user.isAdmin &&
            localMedia.store?.toString() === user.store?.toString()) ||
          localMedia.uploadedBy?.toString() === user.id

        if (!canAccess) {
          return c.json({ error: 'Access denied' }, 403)
        }
      }

      // Check if client wants JSON metadata or the actual file
      if (accept?.includes('application/json')) {
        return c.json({
          success: true,
          message: 'Media retrieved successfully from local storage',
          data: localMedia,
        })
      }

      // Serve the actual file
      if (localMedia.filePath && existsSync(localMedia.filePath)) {
        const fileBuffer = await readFile(localMedia.filePath)
        return new Response(fileBuffer as any, {
          headers: {
            'Content-Type': localMedia.mimeType,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          },
        })
      } else {
        return c.json({ error: 'File not found on disk' }, 404)
      }
    }

    // Try to get from GoHighLevel first
    let ghlResponse
    try {
      ghlResponse = await GoHighLevelAPI.getFile(ghlToken, identifier)
    } catch (ghlError: any) {
      logger.error('GoHighLevel fetch failed:', ghlError)
      // Fallback to local database if GHL fails
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier)
      let localMedia

      if (isObjectId) {
        localMedia = await Media.findById(identifier)
          .populate('uploadedBy', 'name email')
          .populate('store', 'name slug')
      } else {
        localMedia = await Media.findOne({ filename: identifier })
          .populate('uploadedBy', 'name email')
          .populate('store', 'name slug')
      }

      if (!localMedia) {
        return c.json({ error: 'Media not found' }, 404)
      }

      // Check authorization for local media
      // Allow public access if isPublic is true
      if (localMedia.isPublic) {
        // Public media is accessible to everyone
      } else if (!user) {
        // Private media requires authentication
        return c.json(
          { error: 'Authentication required for private media' },
          401
        )
      } else {
        // Check user permissions for private media
        const canAccess =
          user.isSuperAdmin ||
          (user.isAdmin &&
            localMedia.store?.toString() === user.store?.toString()) ||
          localMedia.uploadedBy?.toString() === user.id

        if (!canAccess) {
          return c.json({ error: 'Access denied' }, 403)
        }
      }

      // Check if client wants JSON metadata or the actual file
      if (accept?.includes('application/json')) {
        return c.json({
          success: true,
          message: 'Media retrieved successfully from local database',
          data: localMedia,
        })
      }

      // Serve the actual file
      if (localMedia.filePath && existsSync(localMedia.filePath)) {
        const fileBuffer = await readFile(localMedia.filePath)
        return new Response(fileBuffer as any, {
          headers: {
            'Content-Type': localMedia.mimeType,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          },
        })
      } else {
        return c.json({ error: 'File not found on disk' }, 404)
      }
    }

    // Get local metadata for the GoHighLevel file
    const localMedia = await Media.findOne({ 'metadata.ghlFileId': identifier })
      .populate('uploadedBy', 'name email')
      .populate('store', 'name slug')

    // Check authorization
    if (localMedia) {
      // Allow public access if isPublic is true
      if (localMedia.isPublic) {
        // Public media is accessible to everyone
      } else if (!user) {
        // Private media requires authentication
        return c.json(
          { error: 'Authentication required for private media' },
          401
        )
      } else {
        // Check user permissions for private media
        const canAccess =
          user.isSuperAdmin ||
          (user.isAdmin &&
            localMedia.store?.toString() === user.store?.toString()) ||
          localMedia.uploadedBy?.toString() === user.id

        if (!canAccess) {
          return c.json({ error: 'Access denied' }, 403)
        }
      }
    } else if (!user) {
      // If no local media record and no user, we can't determine if it's public
      // For GoHighLevel files without local metadata, require authentication
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Merge GoHighLevel data with local metadata
    const mergedMedia = {
      ...ghlResponse.data,
      // Local metadata
      fileType: localMedia?.fileType || MediaFileType.OTHER,
      uploadedBy: localMedia?.uploadedBy,
      store: localMedia?.store,
      relatedId: localMedia?.relatedId,
      isPublic: localMedia?.isPublic ?? true,
      autoUpdate: localMedia?.autoUpdate ?? false,
      // Local database ID for reference
      localId: localMedia?._id,
      // Additional metadata
      metadata: {
        ...ghlResponse.data?.metadata,
        ...localMedia?.metadata,
      },
    }

    // If client wants JSON (API call), return media info
    if (accept?.includes('application/json')) {
      return c.json({
        success: true,
        message: 'Media retrieved successfully from GoHighLevel',
        data: mergedMedia,
        ghlResponse: ghlResponse.data,
      })
    }

    // For file serving, redirect to GoHighLevel URL or serve from their CDN
    if (ghlResponse.data?.url) {
      return c.redirect(ghlResponse.data.url)
    }

    return c.json({ error: 'File URL not available' }, 404)
  } catch (error) {
    logger.error('Get media error:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    return c.json({ error: 'Failed to fetch media' }, 500)
  }
}

// Replace media file using GoHighLevel API
export const replaceMedia = async (c: Context) => {
  try {
    const mediaId = c.req.param('id')
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const hosted = formData.get('hosted') === 'true'
    const fileUrl = formData.get('fileUrl') as string

    if (!file && !hosted) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (hosted && !fileUrl) {
      return c.json({ error: 'fileUrl is required when hosted is true' }, 400)
    }

    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Find existing media
    const existingMedia = await Media.findById(mediaId)
    if (!existingMedia) {
      throw new HTTPException(404, {
        message: 'Media not found',
      })
    }

    // Check authorization
    const canModify =
      user.isSuperAdmin ||
      (user.isAdmin &&
        existingMedia.store?.toString() === user.store?.toString()) ||
      existingMedia.uploadedBy?.toString() === user.id

    if (!canModify) {
      throw new HTTPException(403, {
        message: 'Access denied',
      })
    }

    // Validate file type (only for direct uploads)
    if (!hosted && !isValidFileType(file.name)) {
      return c.json(
        {
          error: 'Invalid file type. Allowed: jpg, jpeg, png, webp, gif, svg',
        },
        400
      )
    }

    // Validate file size (only for direct uploads)
    if (!hosted && file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        400
      )
    }

    // Check if GoHighLevel is configured
    const ghlToken = await getGHLToken(existingMedia.store?.toString() || '')
    if (!ghlToken) {
      // Use local storage (original method)
      return await replaceMediaInLocalStorage(c, {
        mediaId,
        file,
        hosted,
        fileUrl,
        existingMedia,
        user,
      })
    }

    // Upload new file to GoHighLevel
    let ghlResponse
    try {
      ghlResponse = await GoHighLevelAPI.uploadFile(ghlToken, file, {
        name: file?.name,
        hosted: hosted,
        fileUrl: fileUrl || undefined,
      })
    } catch (ghlError: any) {
      logger.error('GoHighLevel upload failed:', ghlError)
      throw new HTTPException(500, {
        message: `Failed to upload to GoHighLevel: ${ghlError.message}`,
      })
    }

    // Delete old file from GoHighLevel if we have the GHL file ID
    if (existingMedia.metadata?.ghlFileId) {
      try {
        await GoHighLevelAPI.deleteFile(
          ghlToken,
          existingMedia.metadata.ghlFileId
        )
        logger.info(
          `Old media deleted from GoHighLevel: ${existingMedia.metadata.ghlFileId}`
        )
      } catch (ghlError) {
        logger.warn('Could not delete old file from GoHighLevel:', ghlError)
      }
    }

    // Update database record with new GoHighLevel data
    existingMedia.filename =
      ghlResponse.data?.filename || file?.name || existingMedia.filename
    existingMedia.originalName =
      file?.name || ghlResponse.data?.name || existingMedia.originalName
    existingMedia.filePath = '' // No local file path since it's stored in GHL
    existingMedia.fileUrl =
      ghlResponse.data?.url ||
      ghlResponse.data?.fileUrl ||
      existingMedia.fileUrl
    existingMedia.fileSize =
      file?.size || ghlResponse.data?.size || existingMedia.fileSize
    existingMedia.mimeType =
      file?.type || ghlResponse.data?.mimeType || existingMedia.mimeType
    existingMedia.metadata = {
      ...existingMedia.metadata,
      replacedAt: new Date().toISOString(),
      replacedBy: user.id,
      ghlFileId: ghlResponse.data?.id,
      ghlFolderId: ghlResponse.data?.folderId,
      hosted: hosted,
      originalFileUrl: fileUrl,
    }

    await existingMedia.save()

    logger.info(
      `Media replaced in GoHighLevel: ${existingMedia.filename} by user: ${user.id}`
    )

    // Auto-update functionality for replaced media
    if (
      existingMedia.autoUpdate &&
      existingMedia.fileType === MediaFileType.USER
    ) {
      try {
        // Use relatedId if provided, otherwise use uploader's ID
        const targetUserId = existingMedia.relatedId || existingMedia.uploadedBy

        if (targetUserId) {
          await User.findByIdAndUpdate(targetUserId, {
            avatar: existingMedia.fileUrl,
          })
          logger.info(
            `User avatar auto-updated after replace: ${targetUserId} with ${existingMedia.fileUrl}`
          )
        }
      } catch (error) {
        logger.error('Failed to auto-update user avatar after replace:', error)
      }
    }

    // Auto-update store logo/banner for replaced media
    if (
      existingMedia.autoUpdate &&
      (existingMedia.fileType === MediaFileType.STORE_LOGO ||
        existingMedia.fileType === MediaFileType.STORE_BANNER) &&
      existingMedia.store
    ) {
      try {
        // Check if user has store update permission (excluding superadmin)
        if (user && !user.isSuperAdmin && user.role) {
          // Check if user has store update permission
          const hasStoreUpdatePermission =
            user.role.permissions?.stores?.update || false

          if (hasStoreUpdatePermission) {
            const updateField =
              existingMedia.fileType === MediaFileType.STORE_LOGO
                ? 'logo'
                : 'banner'
            await Store.findByIdAndUpdate(existingMedia.store, {
              [updateField]: existingMedia.fileUrl,
            })
            logger.info(
              `Store ${updateField} auto-updated after replace: ${existingMedia.store} with ${existingMedia.fileUrl}`
            )
          }
        }
      } catch (error) {
        logger.error(
          'Failed to auto-update store logo/banner after replace:',
          error
        )
      }
    }

    return c.json({
      success: true,
      message: 'Media replaced successfully in GoHighLevel',
      data: {
        ...existingMedia.toObject(),
        ghlResponse: ghlResponse.data,
      },
    })
  } catch (error) {
    logger.error('Error replacing media:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Delete media from GoHighLevel
export const deleteMedia = async (c: Context) => {
  try {
    const mediaId = c.req.param('id')

    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Find local media record
    const localMedia = await Media.findById(mediaId)
    if (!localMedia) {
      return c.json({ error: 'Media not found' }, 404)
    }

    // Check authorization
    const canDelete =
      user.isSuperAdmin ||
      (user.isAdmin &&
        localMedia.store?.toString() === user.store?.toString()) ||
      localMedia.uploadedBy?.toString() === user.id

    if (!canDelete) {
      throw new HTTPException(403, {
        message: 'Access denied',
      })
    }

    // Delete from GoHighLevel if we have the GHL file ID and GHL is configured
    let ghlResponse = null
    const ghlToken = await getGHLToken(localMedia.store?.toString() || '')
    if (ghlToken && localMedia.metadata?.ghlFileId) {
      try {
        ghlResponse = await GoHighLevelAPI.deleteFile(
          ghlToken,
          localMedia.metadata.ghlFileId
        )
        logger.info(
          `Media deleted from GoHighLevel: ${localMedia.metadata.ghlFileId}`
        )
      } catch (ghlError) {
        logger.error('Failed to delete from GoHighLevel:', ghlError)
        // Continue with local cleanup even if GHL deletion fails
      }
    }

    // Auto-cleanup functionality before deletion
    if (localMedia.autoUpdate && localMedia.fileType === MediaFileType.USER) {
      try {
        // Use relatedId if provided, otherwise use uploader's ID
        const targetUserId = localMedia.relatedId || localMedia.uploadedBy

        if (targetUserId) {
          // Clear user avatar if it matches the deleted media
          const userRecord = await User.findById(targetUserId)
          if (userRecord && userRecord.avatar === localMedia.fileUrl) {
            await User.findByIdAndUpdate(targetUserId, {
              avatar: null,
            })
            logger.info(
              `User avatar cleared after media deletion: ${targetUserId}`
            )
          }
        }
      } catch (error) {
        logger.error('Failed to clear user avatar after media deletion:', error)
      }
    }

    // Auto-cleanup store logo/banner
    if (
      localMedia.autoUpdate &&
      (localMedia.fileType === MediaFileType.STORE_LOGO ||
        localMedia.fileType === MediaFileType.STORE_BANNER) &&
      localMedia.store
    ) {
      try {
        const store = await Store.findById(localMedia.store)
        if (store) {
          const fieldToCheck =
            localMedia.fileType === MediaFileType.STORE_LOGO ? 'logo' : 'banner'
          if (store[fieldToCheck] === localMedia.fileUrl) {
            await Store.findByIdAndUpdate(localMedia.store, {
              [fieldToCheck]: null,
            })
            logger.info(
              `Store ${fieldToCheck} cleared after media deletion: ${localMedia.store}`
            )
          }
        }
      } catch (error) {
        logger.error(
          'Failed to clear store logo/banner after media deletion:',
          error
        )
      }
    }

    // Delete from local database
    await Media.findByIdAndDelete(mediaId)

    logger.info(`Media deleted: ${localMedia.filename} by user: ${user.id}`)

    return c.json({
      success: true,
      message: 'Media deleted successfully from GoHighLevel and local database',
      ghlResponse: ghlResponse,
    })
  } catch (error) {
    logger.error('Error deleting media:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Get media statistics
export const getMediaStats = async (c: Context) => {
  try {
    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Build match condition based on user role
    let matchCondition = {}
    if (user.isSuperAdmin) {
      // SuperAdmin can see all stats
    } else if (user.isAdmin) {
      // Admin can only see stats from their store
      matchCondition = { store: user.store }
    } else {
      // Regular users can only see their own stats
      matchCondition = { uploadedBy: user.id }
    }

    const [totalFiles, totalSize, fileTypeStats] = await Promise.all([
      Media.countDocuments(matchCondition),
      Media.aggregate([
        { $match: matchCondition },
        { $group: { _id: null, totalSize: { $sum: '$fileSize' } } },
      ]),
      Media.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$fileType',
            count: { $sum: 1 },
            size: { $sum: '$fileSize' },
          },
        },
      ]),
    ])

    const stats = {
      totalFiles,
      totalSize: totalSize[0]?.totalSize || 0,
      fileTypes: fileTypeStats,
      averageFileSize:
        totalFiles > 0 ? (totalSize[0]?.totalSize || 0) / totalFiles : 0,
    }

    return c.json({
      success: true,
      message: 'Media statistics retrieved successfully',
      data: stats,
    })
  } catch (error) {
    logger.error('Error retrieving media statistics:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Create media folder (GoHighLevel API compatible)
export const createMediaFolder = async (c: Context) => {
  try {
    const body = await c.req.json()
    const { name, parentId, storeId } = body

    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Determine store scope
    let targetStoreId =
      storeId ||
      user?.store?._id ||
      (user?.stores && user?.stores.length > 0 ? user?.stores[0]?._id : null) ||
      (user?.selectedRestaurants && user?.selectedRestaurants.length > 0
        ? user?.selectedRestaurants[0]?._id
        : null) ||
      user?.store

    if (!targetStoreId) {
      throw new HTTPException(400, {
        message:
          'Store is required. Please provide storeId or ensure user has access to a store.',
      })
    }

    if (!name) {
      throw new HTTPException(400, {
        message: 'Folder name is required',
      })
    }

    // Check if GoHighLevel is configured
    const ghlToken = await getGHLToken(targetStoreId)
    if (!ghlToken) {
      // Use local storage (original method) - folder creation not supported in local storage
      throw new HTTPException(400, {
        message:
          'Folder creation is not supported in local storage mode. Please use GoHighLevel for folder management.',
      })
    }

    // Create folder in GoHighLevel
    let ghlResponse
    try {
      ghlResponse = await GoHighLevelAPI.createFolder(ghlToken, name, parentId)
    } catch (ghlError: any) {
      logger.error('GoHighLevel folder creation failed:', ghlError)
      throw new HTTPException(500, {
        message: `Failed to create folder in GoHighLevel: ${ghlError.message}`,
      })
    }

    // Create folder record in local database
    const folder = new Media({
      filename: name,
      originalName: name,
      filePath: '', // Folders don't have file paths
      fileUrl: '', // Folders don't have URLs
      fileSize: 0,
      mimeType: 'folder',
      fileType: MediaFileType.FOLDER,
      uploadedBy: user.id,
      store: targetStoreId,
      relatedId: parentId,
      isPublic: true,
      autoUpdate: false,
      metadata: {
        createdAt: new Date().toISOString(),
        isFolder: true,
        parentId: parentId || null,
        ghlFolderId: ghlResponse.data?.id,
      },
    })

    await folder.save()

    logger.info(
      `Media folder created in GoHighLevel: ${name} by user: ${user.id}`
    )

    return c.json(
      {
        success: true,
        message: 'Folder created successfully in GoHighLevel',
        data: {
          ...folder.toObject(),
          ghlResponse: ghlResponse.data,
        },
      },
      201
    )
  } catch (error) {
    logger.error('Error creating media folder:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Bulk update files/folders using GoHighLevel API
export const bulkUpdateMedia = async (c: Context) => {
  try {
    const body = await c.req.json()
    const { files } = body

    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new HTTPException(400, {
        message: 'Files array is required',
      })
    }

    // Check if GoHighLevel is configured
    const userStoreId =
      user?.store?._id ||
      (user?.stores && user?.stores.length > 0 ? user?.stores[0]?._id : null) ||
      (user?.selectedRestaurants && user?.selectedRestaurants.length > 0
        ? user?.selectedRestaurants[0]?._id
        : null) ||
      user?.store ||
      ''

    const ghlToken = await getGHLToken(userStoreId)
    if (!ghlToken) {
      // Use local storage (original method)
      return await bulkUpdateInLocalStorage(c, {
        files,
        user,
      })
    }

    const results: any[] = []
    const errors: any[] = []
    const ghlFiles: any[] = []

    // First, validate all files and prepare GHL update data
    for (const fileUpdate of files) {
      try {
        const { id, ...updateData } = fileUpdate

        if (!id) {
          errors.push({ id: null, error: 'File ID is required' })
          continue
        }

        // Find existing media
        const existingMedia = await Media.findById(id)
        if (!existingMedia) {
          errors.push({ id, error: 'Media not found' })
          continue
        }

        // Check authorization
        const canModify =
          user.isSuperAdmin ||
          (user.isAdmin &&
            existingMedia.store?.toString() === user.store?.toString()) ||
          existingMedia.uploadedBy?.toString() === user.id

        if (!canModify) {
          errors.push({ id, error: 'Access denied' })
          continue
        }

        // Prepare GHL update data
        if (existingMedia.metadata?.ghlFileId) {
          ghlFiles.push({
            id: existingMedia.metadata.ghlFileId,
            ...updateData,
          })
        }

        // Update local media record
        const updatedMedia = await Media.findByIdAndUpdate(
          id,
          {
            ...updateData,
            metadata: {
              ...existingMedia.metadata,
              updatedAt: new Date().toISOString(),
              updatedBy: user.id,
            },
          },
          { new: true }
        )

        results.push(updatedMedia)
        logger.info(`Local media bulk updated: ${id} by user: ${user.id}`)
      } catch (error: any) {
        errors.push({ id: fileUpdate.id, error: error.message })
        logger.error(`Error updating local media ${fileUpdate.id}:`, error)
      }
    }

    // Bulk update in GoHighLevel
    let ghlResponse = null
    if (ghlFiles.length > 0) {
      try {
        ghlResponse = await GoHighLevelAPI.bulkUpdateFiles(ghlToken, ghlFiles)
        logger.info(`Bulk updated ${ghlFiles.length} files in GoHighLevel`)
      } catch (ghlError) {
        logger.error('GoHighLevel bulk update failed:', ghlError)
        // Don't fail the entire operation, just log the error
      }
    }

    return c.json({
      success: true,
      message: 'Bulk update completed',
      data: {
        updated: results,
        errors: errors,
        totalProcessed: files.length,
        successCount: results.length,
        errorCount: errors.length,
        ghlResponse: ghlResponse,
      },
    })
  } catch (error) {
    logger.error('Error in bulk update media:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Bulk delete/trash files or folders (GoHighLevel API compatible)
export const bulkDeleteMedia = async (c: Context) => {
  try {
    const body = await c.req.json()
    const { files, trash = true } = body

    // Get user from context
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new HTTPException(400, {
        message: 'Files array is required',
      })
    }

    // Check if GoHighLevel is configured
    const userStoreId =
      user?.store?._id ||
      (user?.stores && user?.stores.length > 0 ? user?.stores[0]?._id : null) ||
      (user?.selectedRestaurants && user?.selectedRestaurants.length > 0
        ? user?.selectedRestaurants[0]?._id
        : null) ||
      user?.store ||
      ''

    const ghlToken = await getGHLToken(userStoreId)
    if (!ghlToken) {
      // Use local storage (original method)
      return await bulkDeleteInLocalStorage(c, {
        files,
        user,
        trash,
      })
    }

    const results: any[] = []
    const errors: any[] = []
    const ghlFileIds: string[] = []

    // First, validate all files and collect GHL file IDs
    for (const fileId of files) {
      try {
        if (!fileId) {
          errors.push({ id: null, error: 'File ID is required' })
          continue
        }

        // Find existing media
        const existingMedia = await Media.findById(fileId)
        if (!existingMedia) {
          errors.push({ id: fileId, error: 'Media not found' })
          continue
        }

        // Check authorization
        const canDelete =
          user.isSuperAdmin ||
          (user.isAdmin &&
            existingMedia.store?.toString() === user.store?.toString()) ||
          existingMedia.uploadedBy?.toString() === user.id

        if (!canDelete) {
          errors.push({ id: fileId, error: 'Access denied' })
          continue
        }

        // Collect GHL file ID for bulk operation
        if (existingMedia.metadata?.ghlFileId) {
          ghlFileIds.push(existingMedia.metadata.ghlFileId)
        }

        if (trash) {
          // Soft delete - mark as deleted
          existingMedia.metadata = {
            ...existingMedia.metadata,
            deletedAt: new Date().toISOString(),
            deletedBy: user.id,
            isDeleted: true,
          }
          await existingMedia.save()
          results.push({ id: fileId, action: 'trashed' })
        } else {
          // Hard delete - perform auto-cleanup first

          // Auto-cleanup functionality before deletion
          if (
            existingMedia.autoUpdate &&
            existingMedia.fileType === MediaFileType.USER
          ) {
            try {
              const targetUserId =
                existingMedia.relatedId || existingMedia.uploadedBy
              if (targetUserId) {
                const userRecord = await User.findById(targetUserId)
                if (userRecord && userRecord.avatar === existingMedia.fileUrl) {
                  await User.findByIdAndUpdate(targetUserId, { avatar: null })
                  logger.info(
                    `User avatar cleared after bulk media deletion: ${targetUserId}`
                  )
                }
              }
            } catch (error) {
              logger.error(
                'Failed to clear user avatar after bulk media deletion:',
                error
              )
            }
          }

          // Auto-cleanup store logo/banner
          if (
            existingMedia.autoUpdate &&
            (existingMedia.fileType === MediaFileType.STORE_LOGO ||
              existingMedia.fileType === MediaFileType.STORE_BANNER) &&
            existingMedia.store
          ) {
            try {
              const store = await Store.findById(existingMedia.store)
              if (store) {
                const fieldToCheck =
                  existingMedia.fileType === MediaFileType.STORE_LOGO
                    ? 'logo'
                    : 'banner'
                if (store[fieldToCheck] === existingMedia.fileUrl) {
                  await Store.findByIdAndUpdate(existingMedia.store, {
                    [fieldToCheck]: null,
                  })
                  logger.info(
                    `Store ${fieldToCheck} cleared after bulk media deletion: ${existingMedia.store}`
                  )
                }
              }
            } catch (error) {
              logger.error(
                'Failed to clear store logo/banner after bulk media deletion:',
                error
              )
            }
          }

          // Delete from database
          await Media.findByIdAndDelete(fileId)
          results.push({ id: fileId, action: 'deleted' })
        }

        logger.info(
          `Local media bulk ${
            trash ? 'trashed' : 'deleted'
          }: ${fileId} by user: ${user.id}`
        )
      } catch (error: any) {
        errors.push({ id: fileId, error: error.message })
        logger.error(
          `Error ${trash ? 'trashing' : 'deleting'} local media ${fileId}:`,
          error
        )
      }
    }

    // Bulk delete in GoHighLevel
    let ghlResponse = null
    if (ghlFileIds.length > 0) {
      try {
        ghlResponse = await GoHighLevelAPI.bulkDeleteFiles(
          ghlToken,
          ghlFileIds,
          trash
        )
        logger.info(
          `Bulk ${trash ? 'trashed' : 'deleted'} ${
            ghlFileIds.length
          } files in GoHighLevel`
        )
      } catch (ghlError) {
        logger.error('GoHighLevel bulk delete failed:', ghlError)
        // Don't fail the entire operation, just log the error
      }
    }

    return c.json({
      success: true,
      message: `Bulk ${trash ? 'trash' : 'delete'} completed`,
      data: {
        processed: results,
        errors: errors,
        totalProcessed: files.length,
        successCount: results.length,
        errorCount: errors.length,
        ghlResponse: ghlResponse,
      },
    })
  } catch (error) {
    logger.error('Error in bulk delete media:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, {
      message: 'Internal server error',
    })
  }
}

// Replace media in local storage (original method)
async function replaceMediaInLocalStorage(c: Context, options: any) {
  const { mediaId, file, hosted, fileUrl, existingMedia, user } = options

  await ensureUploadDir()

  // Generate unique filename for new file
  const filename = generateUniqueFilename(file.name)
  const filePath = join(UPLOAD_DIR, filename)
  const newFileUrl = `/media/${filename}`

  // Convert file to buffer and save
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await writeFile(filePath, buffer)

  // Delete old file from local storage
  if (existingMedia.filePath) {
    try {
      await unlink(existingMedia.filePath)
      logger.info(`Old file deleted: ${existingMedia.filePath}`)
    } catch (error) {
      logger.warn(`Failed to delete old file: ${existingMedia.filePath}`, error)
    }
  }

  // Update media record
  existingMedia.filename = filename
  existingMedia.originalName = file.name
  existingMedia.filePath = filePath
  existingMedia.fileUrl = newFileUrl
  existingMedia.fileSize = file.size
  existingMedia.mimeType = file.type || getContentType(filename)
  existingMedia.metadata = {
    ...existingMedia.metadata,
    replacedAt: new Date().toISOString(),
    userAgent: c.req.header('User-Agent'),
  }

  await existingMedia.save()

  logger.info(`Media replaced locally: ${filename} by user: ${user?.id}`)

  return c.json({
    success: true,
    message: 'Media replaced successfully in local storage',
    data: existingMedia,
  })
}

// Get all media from local storage (original method)
async function getAllMediaFromLocal(c: Context, options: any) {
  const {
    page,
    limit,
    fileType,
    relatedId,
    storeId,
    uploadedBy,
    search,
    sortBy,
    sortOrder,
    user,
  } = options

  // Build query
  const query: any = {}

  // Filter by store based on user role
  if (user?.isSuperAdmin) {
    // Super admin can see all media
    if (storeId) {
      query.store = storeId
    }
  } else if (user?.store) {
    // Regular users can only see media from their store
    query.store = user.store
  } else {
    // Users without store access can only see their own media
    query.uploadedBy = user?.id
  }

  // Apply additional filters
  if (fileType) {
    query.fileType = fileType
  }
  if (relatedId) {
    query.relatedId = relatedId
  }
  if (uploadedBy) {
    query.uploadedBy = uploadedBy
  }
  if (search) {
    query.$or = [
      { filename: { $regex: search, $options: 'i' } },
      { originalName: { $regex: search, $options: 'i' } },
    ]
  }

  // Calculate pagination
  const skip = (page - 1) * limit

  // Execute query
  const [media, totalCount] = await Promise.all([
    Media.find(query)
      .populate('uploadedBy', 'name email')
      .populate('store', 'name')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Media.countDocuments(query),
  ])

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  return c.json({
    success: true,
    message: 'Media retrieved successfully from local storage',
    data: media,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
    },
  })
}

// Upload to local storage (original method)
async function uploadToLocalStorage(c: Context, options: any) {
  const { file, fileType, relatedId, isPublic, autoUpdate, user, storeId } =
    options

  await ensureUploadDir()

  // Generate unique filename
  const filename = generateUniqueFilename(file.name)
  const filePath = join(UPLOAD_DIR, filename)
  const fileUrl = `/media/${filename}`

  // Convert file to buffer and save
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await writeFile(filePath, buffer)

  const uploadedBy = user?.id

  // Create media record in database
  const media = new Media({
    filename,
    originalName: file.name,
    filePath,
    fileUrl,
    fileSize: file.size,
    mimeType: file.type || getContentType(filename),
    fileType: fileType,
    uploadedBy,
    store: storeId,
    relatedId,
    isPublic: isPublic,
    autoUpdate: autoUpdate,
    metadata: {
      uploadedAt: new Date().toISOString(),
      userAgent: c.req.header('User-Agent'),
    },
  })

  await media.save()

  logger.info(`Media uploaded locally: ${filename} by user: ${uploadedBy}`)

  // Auto-update functionality
  await handleAutoUpdate(media, user, storeId, relatedId)

  return c.json(
    {
      success: true,
      message: 'Media uploaded successfully to local storage',
      data: media,
    },
    201
  )
}

// Handle auto-update functionality (shared between GHL and local)
async function handleAutoUpdate(
  media: any,
  user: any,
  storeId: string,
  relatedId?: string
) {
  // Auto-update functionality
  if (media.autoUpdate && media.fileType === MediaFileType.USER) {
    try {
      // Use relatedId if provided, otherwise use uploader's ID
      const targetUserId = relatedId || user?.id

      if (targetUserId) {
        await User.findByIdAndUpdate(targetUserId, {
          avatar: media.fileUrl,
        })
        logger.info(
          `User avatar auto-updated: ${targetUserId} with ${media.fileUrl}`
        )
      }
    } catch (error) {
      logger.error('Failed to auto-update user avatar:', error)
    }
  }

  // Auto-update store logo/banner for users with store update permission
  if (
    media.autoUpdate &&
    (media.fileType === MediaFileType.STORE_LOGO ||
      media.fileType === MediaFileType.STORE_BANNER) &&
    storeId
  ) {
    try {
      // Check if user has store update permission (excluding superadmin)
      if (user && !user.isSuperAdmin && user.role) {
        // Check if user has store update permission
        const hasStoreUpdatePermission =
          user.role.permissions?.stores?.update || false

        if (hasStoreUpdatePermission) {
          const updateField =
            media.fileType === MediaFileType.STORE_LOGO ? 'logo' : 'banner'
          await Store.findByIdAndUpdate(storeId, {
            [updateField]: media.fileUrl,
          })
          logger.info(
            `Store ${updateField} auto-updated: ${storeId} with ${media.fileUrl}`
          )
        }
      }
    } catch (error) {
      logger.error('Failed to auto-update store logo/banner:', error)
    }
  }
}

// Bulk upload to local storage
async function bulkUploadToLocalStorage(c: Context, options: any) {
  const { files, fileType, relatedId, isPublic, autoUpdate, user, storeId } =
    options

  await ensureUploadDir()

  const results: any[] = []
  const errors: any[] = []

  // Process each file
  for (const file of files) {
    try {
      // Validate file type
      if (!isValidFileType(file.name)) {
        errors.push({
          filename: file.name,
          error: 'Invalid file type. Allowed: jpg, jpeg, png, webp, gif, svg',
        })
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: file.name,
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        })
        continue
      }

      // Generate unique filename
      const filename = generateUniqueFilename(file.name)
      const filePath = join(UPLOAD_DIR, filename)
      const fileUrl = `/media/${filename}`

      // Convert file to buffer and save
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await writeFile(filePath, buffer)

      // Create media record in database
      const media = new Media({
        filename,
        originalName: file.name,
        filePath,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type || getContentType(filename),
        fileType: fileType,
        uploadedBy: user?.id,
        store: storeId,
        relatedId,
        isPublic: isPublic,
        autoUpdate: autoUpdate,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userAgent: c.req.header('User-Agent'),
          bulkUpload: true,
        },
      })

      await media.save()

      // Handle auto-update functionality
      await handleAutoUpdate(media, user, storeId, relatedId)

      results.push({
        filename: file.name,
        mediaId: media._id,
        fileUrl: media.fileUrl,
        success: true,
      })

      logger.info(`Media uploaded locally: ${filename} by user: ${user?.id}`)
    } catch (error) {
      logger.error(`Failed to upload ${file.name}:`, error)
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return c.json({
    success: true,
    message: `Bulk upload completed. ${results.length} files uploaded successfully.`,
    data: {
      results,
      errors,
      totalFiles: files.length,
      successCount: results.length,
      errorCount: errors.length,
    },
  })
}

// Bulk update in local storage
async function bulkUpdateInLocalStorage(c: Context, options: any) {
  const { files, user } = options

  const results: any[] = []
  const errors: any[] = []

  // Process each file update
  for (const fileUpdate of files) {
    try {
      const { id, ...updateData } = fileUpdate

      if (!id) {
        errors.push({ id: null, error: 'File ID is required' })
        continue
      }

      // Find existing media
      const existingMedia = await Media.findById(id)
      if (!existingMedia) {
        errors.push({ id, error: 'Media not found' })
        continue
      }

      // Check authorization
      const canModify =
        user.isSuperAdmin ||
        (user.isAdmin &&
          existingMedia.store?.toString() === user.store?.toString()) ||
        existingMedia.uploadedBy?.toString() === user.id

      if (!canModify) {
        errors.push({ id, error: 'Access denied' })
        continue
      }

      // Update media record
      Object.assign(existingMedia, updateData)
      existingMedia.metadata = {
        ...existingMedia.metadata,
        updatedAt: new Date().toISOString(),
        userAgent: c.req.header('User-Agent'),
        bulkUpdate: true,
      }

      await existingMedia.save()

      results.push({
        id,
        filename: existingMedia.filename,
        success: true,
        updatedFields: Object.keys(updateData),
      })

      logger.info(
        `Media updated locally: ${existingMedia.filename} by user: ${user?.id}`
      )
    } catch (error) {
      logger.error(`Failed to update media ${fileUpdate.id}:`, error)
      errors.push({
        id: fileUpdate.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return c.json({
    success: true,
    message: `Bulk update completed. ${results.length} files updated successfully.`,
    data: {
      results,
      errors,
      totalFiles: files.length,
      successCount: results.length,
      errorCount: errors.length,
    },
  })
}

// Bulk delete in local storage
async function bulkDeleteInLocalStorage(c: Context, options: any) {
  const { files, user, trash = true } = options

  const results: any[] = []
  const errors: any[] = []

  // Process each file deletion
  for (const fileId of files) {
    try {
      if (!fileId) {
        errors.push({ id: null, error: 'File ID is required' })
        continue
      }

      // Find existing media
      const existingMedia = await Media.findById(fileId)
      if (!existingMedia) {
        errors.push({ id: fileId, error: 'Media not found' })
        continue
      }

      // Check authorization
      const canDelete =
        user.isSuperAdmin ||
        (user.isAdmin &&
          existingMedia.store?.toString() === user.store?.toString()) ||
        existingMedia.uploadedBy?.toString() === user.id

      if (!canDelete) {
        errors.push({ id: fileId, error: 'Access denied' })
        continue
      }

      // Auto-cleanup functionality before deletion
      if (
        existingMedia.autoUpdate &&
        existingMedia.fileType === MediaFileType.USER
      ) {
        try {
          const targetUserId =
            existingMedia.relatedId || existingMedia.uploadedBy
          if (targetUserId) {
            const userRecord = await User.findById(targetUserId)
            if (userRecord && userRecord.avatar === existingMedia.fileUrl) {
              await User.findByIdAndUpdate(targetUserId, { avatar: null })
              logger.info(`User avatar cleared: ${targetUserId}`)
            }
          }
        } catch (error) {
          logger.error('Failed to auto-cleanup user avatar:', error)
        }
      }

      // Auto-cleanup store logo/banner
      if (
        existingMedia.autoUpdate &&
        (existingMedia.fileType === MediaFileType.STORE_LOGO ||
          existingMedia.fileType === MediaFileType.STORE_BANNER) &&
        existingMedia.store
      ) {
        try {
          if (user && !user.isSuperAdmin && user.role) {
            const hasStoreUpdatePermission =
              user.role.permissions?.stores?.update || false
            if (hasStoreUpdatePermission) {
              const updateField =
                existingMedia.fileType === MediaFileType.STORE_LOGO
                  ? 'logo'
                  : 'banner'
              await Store.findByIdAndUpdate(existingMedia.store, {
                [updateField]: null,
              })
              logger.info(
                `Store ${updateField} cleared: ${existingMedia.store}`
              )
            }
          }
        } catch (error) {
          logger.error('Failed to auto-cleanup store logo/banner:', error)
        }
      }

      // Delete file from local storage
      if (existingMedia.filePath) {
        try {
          await unlink(existingMedia.filePath)
          logger.info(`File deleted from storage: ${existingMedia.filePath}`)
        } catch (error) {
          logger.warn(
            `Failed to delete file from storage: ${existingMedia.filePath}`,
            error
          )
        }
      }

      // Delete from database
      await Media.findByIdAndDelete(fileId)

      results.push({
        id: fileId,
        filename: existingMedia.filename,
        success: true,
        deleted: true,
      })

      logger.info(
        `Media deleted locally: ${existingMedia.filename} by user: ${user?.id}`
      )
    } catch (error) {
      logger.error(`Failed to delete media ${fileId}:`, error)
      errors.push({
        id: fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return c.json({
    success: true,
    message: `Bulk ${trash ? 'trash' : 'delete'} completed. ${
      results.length
    } files processed successfully.`,
    data: {
      results,
      errors,
      totalFiles: files.length,
      successCount: results.length,
      errorCount: errors.length,
    },
  })
}

// Bulk upload to GoHighLevel (individual processing)
async function bulkUploadToGoHighLevel(c: Context, options: any) {
  const {
    files,
    fileType,
    relatedId,
    isPublic,
    autoUpdate,
    user,
    storeId,
    folderId,
    ghlToken,
  } = options

  const results: any[] = []
  const errors: any[] = []

  // Process each file
  for (const file of files) {
    try {
      // Use the existing uploadMedia logic for each file
      const ghlResponse = await GoHighLevelAPI.uploadFile(ghlToken, file, {
        name: file.name,
        folderId: folderId || undefined,
      })

      const ghlData = ghlResponse.data || ghlResponse
      const ghlFileUrl =
        ghlData?.url || ghlData?.fileUrl || ghlData?.file_url || ''

      // Create media record in database with GoHighLevel data
      const media = new Media({
        filename: ghlData?.filename || ghlData?.name || file.name || 'unknown',
        originalName: file.name || ghlData?.name || 'unknown',
        filePath: '', // No local file path since it's stored in GHL
        fileUrl: ghlFileUrl,
        fileSize: file.size || ghlData?.size || 0,
        mimeType:
          file.type ||
          ghlData?.mimeType ||
          ghlData?.mime_type ||
          'application/octet-stream',
        fileType: fileType,
        uploadedBy: user?.id,
        store: storeId,
        relatedId,
        isPublic: isPublic,
        autoUpdate: autoUpdate,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userAgent: c.req.header('User-Agent'),
          ghlFileId: ghlData?.id,
          ghlFolderId: ghlData?.folderId || ghlData?.folder_id,
          bulkUpload: true,
          ghlResponse: ghlResponse,
        },
      })

      await media.save()

      // Handle auto-update functionality
      await handleAutoUpdate(media, user, storeId, relatedId)

      results.push({
        filename: file.name,
        mediaId: media._id,
        fileUrl: media.fileUrl,
        success: true,
      })

      logger.info(
        `Media uploaded to GoHighLevel: ${media.filename} by user: ${user?.id}`
      )
    } catch (error) {
      logger.error(`Failed to upload ${file.name}:`, error)
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return c.json({
    success: true,
    message: `Bulk upload completed. ${results.length} files uploaded successfully.`,
    data: {
      results,
      errors,
      totalFiles: files.length,
      successCount: results.length,
      errorCount: errors.length,
    },
  })
}
