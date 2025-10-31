import { Hono } from 'hono'
import {
  uploadMedia,
  getAllMedia,
  getMedia,
  replaceMedia,
  deleteMedia,
  getMediaStats,
  bulkUpdateMedia,
  bulkDeleteMedia,
  createMediaFolder,
} from '../controllers/media.controllers'
import { isSuperAdmin, protect, requirePermission } from '~/middlewares'
import { PermissionResource } from '~/types'

const app = new Hono()

// GoHighLevel API compatible routes

// Get list of files/folders
app.get(
  '/',
  protect,
  requirePermission(PermissionResource.MEDIA, 'read'),
  getAllMedia
)

// Upload file(s) into media storage (supports both single and bulk upload)
app.post(
  '/',
  protect,
  requirePermission(PermissionResource.MEDIA, 'create'),
  uploadMedia
)

// Create folder
app.post(
  '/folder',
  protect,
  requirePermission(PermissionResource.MEDIA, 'create'),
  createMediaFolder
)

// Get single media by ID or filename (public access for isPublic: true)
app.get('/:id', getMedia)

// Update file/folder
app.post(
  '/:id',
  protect,
  requirePermission(PermissionResource.MEDIA, 'update'),
  replaceMedia
)

// Delete file or folder
app.delete(
  '/:id',
  protect,
  requirePermission(PermissionResource.MEDIA, 'delete'),
  deleteMedia
)

// Bulk update files/folders
app.put(
  '/update-files',
  protect,
  requirePermission(PermissionResource.MEDIA, 'update'),
  bulkUpdateMedia
)

// Bulk delete/trash files or folders
app.put(
  '/delete-files',
  protect,
  requirePermission(PermissionResource.MEDIA, 'delete'),
  bulkDeleteMedia
)

// Legacy routes for backward compatibility
// Get media statistics
app.get('/stats', protect, isSuperAdmin, getMediaStats)

export default app
