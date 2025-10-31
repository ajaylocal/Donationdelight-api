import { IOpeningHours, IDaySchedule, ITimeSlot } from '~/types'

/**
 * Get the current day of the week as a key for opening hours
 */
export function getCurrentDayKey(): keyof IOpeningHours {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const today = new Date().getDay()
  return days[today] as keyof IOpeningHours
}

/**
 * Check if a store is currently open based on opening hours
 */
export function isStoreCurrentlyOpen(openingHours: IOpeningHours): boolean {
  const currentDay = getCurrentDayKey()
  const daySchedule = openingHours[currentDay]

  if (!daySchedule.isOpen) {
    return false
  }

  if (daySchedule.timeSlots.length === 0) {
    return false
  }

  const now = new Date()
  const currentTime = now.toLocaleTimeString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  })

  return daySchedule.timeSlots.some((slot) => {
    return isTimeInRange(currentTime, slot.start, slot.end)
  })
}

/**
 * Check if a given time falls within a time range
 */
export function isTimeInRange(
  time: string,
  start: string,
  end: string
): boolean {
  const timeToMinutes = (timeStr: string): number => {
    const [timePart, period] = timeStr.split(' ')
    const [hours, minutes] = timePart.split(':').map(Number)

    let hour24 = hours
    if (period === 'PM' && hours !== 12) {
      hour24 = hours + 12
    } else if (period === 'AM' && hours === 12) {
      hour24 = 0
    }

    return hour24 * 60 + minutes
  }

  const currentMinutes = timeToMinutes(time)
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)

  // Handle cases where end time is on the next day
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

/**
 * Get the next opening time for a store
 */
export function getNextOpeningTime(
  openingHours: IOpeningHours
): { day: string; time: string } | null {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const currentDay = new Date().getDay()

  // Check the next 7 days
  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7
    const dayKey = days[checkDay] as keyof IOpeningHours
    const daySchedule = openingHours[dayKey]

    if (daySchedule.isOpen && daySchedule.timeSlots.length > 0) {
      return {
        day: dayKey,
        time: daySchedule.timeSlots[0].start,
      }
    }
  }

  return null
}

/**
 * Create a default opening hours structure
 */
export function createDefaultOpeningHours(): IOpeningHours {
  return {
    monday: { isOpen: false, timeSlots: [] },
    tuesday: { isOpen: false, timeSlots: [] },
    wednesday: { isOpen: false, timeSlots: [] },
    thursday: { isOpen: false, timeSlots: [] },
    friday: { isOpen: false, timeSlots: [] },
    saturday: { isOpen: false, timeSlots: [] },
    sunday: { isOpen: false, timeSlots: [] },
  }
}

/**
 * Set opening hours for a specific day
 */
export function setDayOpeningHours(
  openingHours: IOpeningHours,
  day: keyof IOpeningHours,
  isOpen: boolean,
  timeSlots: ITimeSlot[] = []
): IOpeningHours {
  return {
    ...openingHours,
    [day]: { isOpen, timeSlots },
  }
}

/**
 * Add a time slot to a specific day
 */
export function addTimeSlot(
  openingHours: IOpeningHours,
  day: keyof IOpeningHours,
  timeSlot: ITimeSlot
): IOpeningHours {
  const daySchedule = openingHours[day]
  return {
    ...openingHours,
    [day]: {
      ...daySchedule,
      isOpen: true,
      timeSlots: [...daySchedule.timeSlots, timeSlot],
    },
  }
}

/**
 * Remove a time slot from a specific day
 */
export function removeTimeSlot(
  openingHours: IOpeningHours,
  day: keyof IOpeningHours,
  slotIndex: number
): IOpeningHours {
  const daySchedule = openingHours[day]
  const newTimeSlots = daySchedule.timeSlots.filter(
    (_, index) => index !== slotIndex
  )

  return {
    ...openingHours,
    [day]: {
      ...daySchedule,
      isOpen: newTimeSlots.length > 0,
      timeSlots: newTimeSlots,
    },
  }
}
