import logger from '~/utils/logger'

export interface NotificationData {
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  timestamp?: string
  metadata?: Record<string, any>
}

class NotificationService {
  private emailService: any = null
  private discordWebhookUrl: string | null = null

  constructor() {
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || null

    // Initialize email service (you can integrate with SendGrid, AWS SES, etc.)
    this.initializeEmailService()
  }

  private initializeEmailService() {
    // TODO: Initialize your preferred email service
    // Example with SendGrid:
    // this.emailService = sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    // Example with AWS SES:
    // this.emailService = new AWS.SES({ region: process.env.AWS_REGION })

    logger.info('Email service initialized')
  }

  async sendEmailNotification(data: NotificationData): Promise<boolean> {
    try {
      if (!this.emailService) {
        logger.warn('Email service not configured')
        return false
      }

      // TODO: Implement email sending logic
      // Example with SendGrid:
      /*
      const msg = {
        to: process.env.ADMIN_EMAIL,
        from: process.env.FROM_EMAIL,
        subject: data.title,
        text: data.message,
        html: `<h1>${data.title}</h1><p>${data.message}</p><p>Time: ${data.timestamp}</p>`,
      }
      
      await this.emailService.send(msg)
      */

      logger.info(`Email notification sent: ${data.title}`)
      return true
    } catch (error) {
      logger.error('Error sending email notification:', error)
      return false
    }
  }

  async sendDiscordNotification(data: NotificationData): Promise<boolean> {
    try {
      if (!this.discordWebhookUrl) {
        logger.warn('Discord webhook URL not configured')
        return false
      }

      const color = this.getDiscordColor(data.type)

      const message = {
        embeds: [
          {
            title: data.title,
            description: data.message,
            color: color,
            timestamp: data.timestamp || new Date().toISOString(),
            fields: data.metadata
              ? Object.entries(data.metadata).map(([key, value]) => ({
                  name: key,
                  value: String(value),
                  inline: true,
                }))
              : [],
          },
        ],
      }

      const response = await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        throw new Error(`Discord API responded with status: ${response.status}`)
      }

      logger.info(`Discord notification sent: ${data.title}`)
      return true
    } catch (error) {
      logger.error('Error sending Discord notification:', error)
      return false
    }
  }

  private getDiscordColor(type: NotificationData['type']): number {
    switch (type) {
      case 'success':
        return 0x00ff00 // Green
      case 'warning':
        return 0xffff00 // Yellow
      case 'error':
        return 0xff0000 // Red
      case 'info':
      default:
        return 0x0099ff // Blue
    }
  }

  async sendServerStatusNotification(
    status: 'online' | 'offline',
    downtime?: number
  ): Promise<void> {
    const data: NotificationData = {
      title: `ZipZap Server ${
        status === 'online' ? '🟢 Online' : '🔴 Offline'
      }`,
      message:
        status === 'online'
          ? `Server is back online after ${Math.round(
              (downtime || 0) / 1000
            )} seconds of downtime`
          : 'Server appears to be down - no active WebSocket connections',
      type: status === 'online' ? 'success' : 'error',
      timestamp: new Date().toISOString(),
      metadata: {
        downtime: downtime ? `${Math.round(downtime / 1000)}s` : 'N/A',
        status: status,
      },
    }

    // Send both email and Discord notifications
    await Promise.allSettled([
      this.sendEmailNotification(data),
      this.sendDiscordNotification(data),
    ])
  }

  async sendWebSocketNotification(event: string, details: any): Promise<void> {
    const data: NotificationData = {
      title: `WebSocket Event: ${event}`,
      message: `WebSocket event occurred: ${event}`,
      type: 'info',
      timestamp: new Date().toISOString(),
      metadata: details,
    }

    // Send both email and Discord notifications
    await Promise.allSettled([
      this.sendEmailNotification(data),
      this.sendDiscordNotification(data),
    ])
  }
}

export const notificationService = new NotificationService()
export default notificationService
