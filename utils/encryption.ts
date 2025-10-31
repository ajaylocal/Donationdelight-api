import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const TAG_LENGTH = 16 // 128 bits

// Get encryption key from environment or generate a default one
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    // Generate a default key based on a secret (not recommended for production)
    const defaultSecret = 'zipzap-default-encryption-key-2024'
    return crypto.scryptSync(defaultSecret, 'salt', KEY_LENGTH)
  }

  // If key is provided as hex string, convert it
  if (key.length === 64) {
    // 32 bytes = 64 hex characters
    return Buffer.from(key, 'hex')
  }

  // Otherwise, derive key from the provided string
  return crypto.scryptSync(key, 'salt', KEY_LENGTH)
}

/**
 * Encrypt a string using AES-256-GCM
 * @param text - The text to encrypt
 * @returns Encrypted string in format: iv:tag:encryptedData (all base64 encoded)
 */
export const encrypt = (text: string): string => {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    cipher.setAAD(Buffer.from('zipzap-ghl-token', 'utf8'))

    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const tag = cipher.getAuthTag()

    // Combine IV, tag, and encrypted data
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
  } catch (error) {
    throw new Error(
      `Encryption failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Decrypt a string using AES-256-GCM
 * @param encryptedText - The encrypted text in format: iv:tag:encryptedData
 * @returns Decrypted string
 */
export const decrypt = (encryptedText: string): string => {
  try {
    const key = getEncryptionKey()
    const parts = encryptedText.split(':')

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }

    const [ivBase64, tagBase64, encrypted] = parts
    const iv = Buffer.from(ivBase64, 'base64')
    const tag = Buffer.from(tagBase64, 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(Buffer.from('zipzap-ghl-token', 'utf8'))
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    throw new Error(
      `Decryption failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 * @param text - The text to check
 * @returns True if the text appears to be encrypted
 */
export const isEncrypted = (text: string): boolean => {
  return text.includes(':') && text.split(':').length === 3
}

/**
 * Safely decrypt a token, returning null if decryption fails
 * @param encryptedToken - The encrypted token
 * @returns Decrypted token or null if decryption fails
 */
export const safeDecrypt = (
  encryptedToken: string | undefined | null
): string | null => {
  if (!encryptedToken) {
    return null
  }

  try {
    return decrypt(encryptedToken)
  } catch (error) {
    console.warn('Failed to decrypt token:', error)
    return null
  }
}
