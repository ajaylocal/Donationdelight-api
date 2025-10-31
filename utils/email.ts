import { logger } from './index'
import { EMAILIT_API_BASE, EMAILIT_API_KEY, FROM_EMAIL } from './constants'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface OTPEmailData {
  email: string
  otp: string
  username?: string
  storeName?: string
}

interface PasswordResetEmailData {
  email: string
  resetUrl: string
  username?: string
  storeName?: string
}

export class EmailService {
  private apiConfig: {
    baseUrl: string
    apiKey: string
  }

  constructor() {
    this.apiConfig = {
      baseUrl: EMAILIT_API_BASE || 'https://api.emailit.com/v1',
      apiKey: EMAILIT_API_KEY || '',
    }

    // Validate configuration
    if (!this.apiConfig.apiKey) {
      logger.warn('Email API key not configured. Email service will not work.')
    }
  }

  /**
   * Send email using SMTP
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.apiConfig.apiKey) {
        logger.error('Email API key missing. Cannot send email.')
        return false
      }

      // Log configuration for debugging
      logger.info('Email service configuration:', {
        baseUrl: this.apiConfig.baseUrl,
        hasApiKey: !!this.apiConfig.apiKey,
        fromEmail: FROM_EMAIL,
      })

      // Prepare request payload
      const payload = {
        from: FROM_EMAIL || 'noreply@zipzap.com',
        to: options.to,
        reply_to: FROM_EMAIL || 'support@zipzap.com',
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      }

      // Log request for debugging
      logger.info('Sending email request:', {
        url: `${this.apiConfig.baseUrl}/emails`,
        to: options.to,
        subject: options.subject,
        hasHtml: !!options.html,
        hasText: !!options.text,
      })

      // Send email using Emailit API
      const response = await fetch(`${this.apiConfig.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiConfig.apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Failed to send email:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: `${this.apiConfig.baseUrl}/emails`,
          config: {
            baseUrl: this.apiConfig.baseUrl,
            hasApiKey: !!this.apiConfig.apiKey,
            fromEmail: FROM_EMAIL,
          },
        })
        return false
      }

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
      })
      return true
    } catch (error) {
      logger.error('Error sending email:', error)
      return false
    }
  }

  /**
   * Send OTP email for 2FA
   */
  async sendOTPEmail(data: OTPEmailData): Promise<boolean> {
    const { email, otp, username, storeName } = data

    const subject = 'Your Login Verification Code'
    const html = this.generateOTPEmailTemplate(otp, username, storeName)

    return this.sendEmail({
      to: email,
      subject,
      html,
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    const { email, resetUrl, username, storeName } = data

    const subject = 'Reset Your Password'
    const html = this.generatePasswordResetEmailTemplate(
      resetUrl,
      username,
      storeName
    )

    return this.sendEmail({
      to: email,
      subject,
      html,
    })
  }

  /**
   * Generate OTP email HTML template
   */
  private generateOTPEmailTemplate(
    otp: string,
    username?: string,
    storeName?: string
  ): string {
    const greeting = username ? `Hello ${username},` : 'Hello,'
    const storeInfo = storeName ? ` for ${storeName}` : ''

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Verification Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .otp-code {
            background-color: #f3f4f6;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 4px;
            color: #1f2937;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
          .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">ZipZap</div>
            <h1>Login Verification Code</h1>
          </div>
          
          <p>${greeting}</p>
          
          <p>You requested a verification code${storeInfo}. Here's your one-time password:</p>
          
          <div class="otp-code">${otp}</div>
          
          <p>This code will expire in 10 minutes for security reasons.</p>
          
          <div class="warning">
            <strong>Security Notice:</strong> Never share this code with anyone. ZipZap will never ask for this code via phone, email, or text message.
          </div>
          
          <p>If you didn't request this code, please ignore this email and consider changing your password.</p>
          
          <div class="footer">
            <p>This is an automated message from ZipZap. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ZipZap. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Generate password reset email HTML template
   */
  private generatePasswordResetEmailTemplate(
    resetUrl: string,
    username?: string,
    storeName?: string
  ): string {
    const greeting = username ? `Hello ${username},` : 'Hello,'
    const storeInfo = storeName ? ` for ${storeName}` : ''

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .reset-button {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
            text-align: center;
          }
          .reset-button:hover {
            background-color: #1d4ed8;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
          .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #92400e;
          }
          .expiry {
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #374151;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">ZipZap</div>
            <h1>Reset Your Password</h1>
          </div>
          
          <p>${greeting}</p>
          
          <p>You requested a password reset${storeInfo}. Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="reset-button">Reset Password</a>
          </div>
          
          <div class="expiry">
            <strong>Important:</strong> This link will expire in 15 minutes for security reasons.
          </div>
          
          <div class="warning">
            <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. The link will expire automatically.
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetUrl}</p>
          
          <div class="footer">
            <p>This is an automated message from ZipZap. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ZipZap. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Strip HTML tags to create plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiConfig.apiKey
  }
}

export const emailService = new EmailService()
export default emailService
