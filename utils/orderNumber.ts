import { Order } from '../models/order.model'
import logger from './logger'

/**
 * Generate unique order number for a store
 * @param storeId - The store/store ID
 * @param orderType - 'POS', 'WEB', or 'AI'
 * @returns Promise<string> - Generated order number
 */
export async function generateOrderNumber(
  storeId: string,
  orderType: 'POS' | 'WEB' | 'AI'
): Promise<string> {
  try {
    const prefix =
      orderType === 'POS' ? 'ORD' : orderType === 'WEB' ? 'WEB' : 'AI'

    // Find the highest order number for this store and order type
    const lastOrder = await Order.findOne({
      store: storeId,
      orderNumber: { $regex: `^${prefix}-` },
    }).sort({ orderNumber: -1 })

    let nextNumber = 1

    if (lastOrder) {
      // Extract the number from the last order number
      const match = lastOrder.orderNumber.match(
        new RegExp(`^${prefix}-(\\d+)$`)
      )
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    // Format the order number with leading zeros (3 digits)
    const orderNumber = `${prefix}-${nextNumber.toString().padStart(3, '0')}`

    logger.info(
      `Generated order number: ${orderNumber} for store: ${storeId}, type: ${orderType}, lastOrder: ${
        lastOrder?.orderNumber || 'none'
      }`
    )

    return orderNumber
  } catch (error) {
    logger.error('Error generating order number:', error)
    throw new Error('Failed to generate order number')
  }
}

/**
 * Validate if an order number is unique for a store
 * @param orderNumber - The order number to validate
 * @param storeId - The store/store ID
 * @returns Promise<boolean> - True if unique, false if exists
 */
export async function isOrderNumberUnique(
  orderNumber: string,
  storeId: string
): Promise<boolean> {
  try {
    const existingOrder = await Order.findOne({
      orderNumber,
      store: storeId,
    })

    return !existingOrder
  } catch (error) {
    logger.error('Error checking order number uniqueness:', error)
    throw new Error('Failed to validate order number')
  }
}
