# Two-Factor Authentication (2FA) Implementation

This document describes the implementation of Two-Factor Authentication (2FA) for the ZipZap API using email-based OTP verification.

## Overview

The 2FA system adds an extra layer of security to user login by requiring a one-time password (OTP) sent via email after successful password verification.

## Features

- **Email-based OTP**: 6-digit numeric codes sent to user's email
- **Automatic expiration**: OTPs expire after 10 minutes
- **Single-use**: Each OTP can only be used once
- **Rate limiting**: Prevents abuse through automatic cleanup
- **Fallback support**: System works without email configuration

## API Endpoints

### 1. Login with 2FA

**POST** `/users/login`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "userpassword",
  "store": "storeId" // optional
}
```

**First Response (OTP Required):**

```json
{
  "success": true,
  "data": {
    "requiresOTP": true,
    "message": "Verification code sent to your email",
    "userId": "user_id",
    "email": "user@example.com"
  },
  "message": "Please enter the verification code sent to your email"
}
```

**Second Request (with OTP):**

```json
{
  "email": "user@example.com",
  "password": "userpassword",
  "otp": "123456",
  "store": "storeId" // optional
}
```

**Final Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      /* user object */
    },
    "token": "jwt_token",
    "store": {
      /* store info */
    }
  },
  "message": "User logged in successfully"
}
```

### 2. Resend OTP

**POST** `/users/resend-otp`

**Request Body:**

```json
{
  "email": "user@example.com"
}
// OR
{
  "userId": "user_id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Verification code sent to your email",
    "userId": "user_id",
    "email": "user@example.com"
  },
  "message": "Verification code sent successfully"
}
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Email Configuration (Emailit)
EMAILIT_SMTP_HOST=your_smtp_host
EMAILIT_SMTP_PORT=587
EMAILIT_USERNAME=your_username
EMAILIT_PASSWORD=your_password
FROM_EMAIL=noreply@yourdomain.com
```

### Email Service

The system uses Emailit for sending emails. If email configuration is missing, the system will:

1. Log a warning about missing email configuration
2. Allow login to proceed without 2FA
3. Continue normal operation

## Database Schema

### OTP Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // Reference to User
  email: String,           // User's email
  otp: String,            // 6-digit OTP
  type: String,           // 'login', 'reset', 'verification'
  expiresAt: Date,        // Expiration timestamp
  isUsed: Boolean,        // Whether OTP has been used
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

- `{ expiresAt: 1 }` - TTL index for automatic cleanup
- `{ userId: 1, type: 1, isUsed: 1 }` - For efficient queries
- `{ email: 1, type: 1, isUsed: 1 }` - For email-based verification
- `{ otp: 1, type: 1, isUsed: 1 }` - For OTP verification

## Security Features

### OTP Generation

- 6-digit numeric codes (100000-999999)
- Cryptographically secure random generation
- No sequential or predictable patterns

### Expiration

- 10-minute expiration by default
- Automatic cleanup via MongoDB TTL index
- Prevents replay attacks

### Single Use

- Each OTP can only be used once
- Automatic invalidation after use
- Prevents multiple login attempts with same code

### Rate Limiting

- Automatic invalidation of previous unused OTPs
- Prevents OTP accumulation
- Cleanup of expired OTPs

## Email Template

The system sends professionally formatted HTML emails with:

- ZipZap branding
- Clear OTP display
- Security warnings
- Expiration information
- Responsive design

## Error Handling

### Common Error Responses

**Invalid OTP:**

```json
{
  "success": false,
  "message": "Invalid or expired verification code"
}
```

**Email Service Error:**

```json
{
  "success": false,
  "message": "Failed to send verification code. Please try again."
}
```

**Missing Email Configuration:**

```json
{
  "success": false,
  "message": "Email service is not configured"
}
```

## Implementation Details

### Files Modified/Created

1. **`utils/email.ts`** - Email service implementation
2. **`models/otp.model.ts`** - OTP database model
3. **`controllers/user.controllers.ts`** - Updated login logic
4. **`routes/user.routes.ts`** - Added resend OTP route
5. **`utils/index.ts`** - Export email service
6. **`models/index.ts`** - Export OTP model

### Key Functions

- `emailService.sendOTPEmail()` - Sends OTP emails
- `OTP.createForUser()` - Creates new OTP for user
- `OTP.verifyOTPByEmail()` - Verifies OTP by email
- `loginUser()` - Updated login controller with 2FA
- `resendOTP()` - Resend OTP functionality

## Testing

### Manual Testing

1. **Configure email settings** in `.env`
2. **Attempt login** with valid credentials
3. **Check email** for OTP
4. **Complete login** with OTP
5. **Test resend** functionality
6. **Test expiration** by waiting 10+ minutes

### Test Cases

- ✅ Valid credentials → OTP sent
- ✅ Valid OTP → Login successful
- ✅ Invalid OTP → Error response
- ✅ Expired OTP → Error response
- ✅ Resend OTP → New OTP sent
- ✅ Missing email config → Login without 2FA
- ✅ No email address → Login without 2FA

## Future Enhancements

- SMS-based OTP support
- Authenticator app integration (TOTP)
- Backup codes for account recovery
- Remember device functionality
- Admin controls for 2FA enforcement
- Audit logging for 2FA events
