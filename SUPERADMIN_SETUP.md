# SuperAdmin Setup Guide

This guide explains how to set up the SuperAdmin role and user for the ZipZap API.

## Overview

The SuperAdmin role has the highest level of permissions in the system and is required to:

- Create, update, and delete stores
- Manage all system resources
- Bypass all permission checks

## Setup Instructions

### 1. Run the Setup Script

```bash
bun run setup:superadmin
```

This will:

- Create a SuperAdmin role with full permissions
- Create a SuperAdmin user with the following credentials:
  - Email: `superadmin@zipzap.com`
  - Password: `SuperAdmin123!`
  - Username: `superadmin`
  - First Name: `Super`
  - Last Name: `Admin`

### 2. Customize Credentials (Optional)

If you want to use different credentials, edit the `scripts/setupSuperAdmin.ts` file:

```typescript
const result = await initializeSuperAdmin(
  'your-email@example.com', // Email
  'YourPassword123!', // Password
  'Your', // First name
  'Name' // Last name
)
```

### 3. Verify Setup

After running the setup script, you should see output like:

```
✅ Superadmin setup completed successfully!
Role ID: 507f1f77bcf86cd799439011
User ID: 507f1f77bcf86cd799439012
Email: superadmin@zipzap.com
Username: superadmin
```

## API Endpoints

### SuperAdmin-Only Endpoints

The following endpoints require SuperAdmin privileges:

- `POST /api/v1/stores` - Create a new store
- `PUT /api/v1/stores/:id` - Update a store
- `DELETE /api/v1/stores/:id` - Delete a store

### Authentication

To access SuperAdmin endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Role Hierarchy

1. **SuperAdmin** - Highest level, can do everything
2. **Admin** - Can manage most resources but not stores
3. **Manager** - Limited permissions
4. **Staff** - Basic permissions
5. **Cashier** - Minimal permissions

## Security Notes

- Only SuperAdmin users can create, update, or delete stores
- SuperAdmin users bypass all permission checks
- The SuperAdmin role is system-created and cannot be deleted
- Store creation is restricted to prevent unauthorized store creation

## Troubleshooting

### "Not authorized as a superadmin!" Error

This means the user doesn't have SuperAdmin privileges. Check:

1. User has `isSuperAdmin: true` in the database
2. User's role has `isSuperAdmin: true`
3. JWT token is valid and belongs to a SuperAdmin user

### "Superadmin role not found" Error

Run the setup script again:

```bash
bun run setup:superadmin
```

### Database Connection Issues

Ensure your MongoDB connection is working and the `MONGO_URI` environment variable is set correctly.
