/**
 * System Loop - Schedule Checking
 */

import { Cron } from 'croner'
import { CONFIG } from './config.js'
import { log } from './utils.js'

export function shouldRunNow(cron: string, timezone: string, lastRun: string | undefined): boolean {
  try {
    const cronJob = new Cron(cron, { timezone })
    const now = new Date()
    const catchUpWindow = new Date(now.getTime() - CONFIG.catchUpWindowHours * 60 * 60 * 1000)

    // Get previous and next scheduled times
    let prev = cronJob.previousRun(now)
    const next = cronJob.nextRun(now)

    // Croner bug workaround: previousRun returns undefined right at/after scheduled time
    // Calculate what prev SHOULD be based on the cron pattern
    if (!prev && next) {
      // Determine the interval from the cron pattern
      // For daily: 24h, for weekly: 7*24h, for hourly: 1h, etc.
      const nextNext = cronJob.nextRun(new Date(next.getTime() + 1000))
      if (nextNext) {
        const intervalMs = nextNext.getTime() - next.getTime()
        const possiblePrev = new Date(next.getTime() - intervalMs)

        // Only use this if it's within our catch-up window
        if (possiblePrev > catchUpWindow && possiblePrev <= now) {
          prev = possiblePrev
        }
      }
    }

    // No previous scheduled time within catch-up window
    if (!prev) return false

    // Never ran before AND prev is within catch-up window - run now
    if (!lastRun) {
      return prev > catchUpWindow
    }

    const lastRunDate = new Date(lastRun)

    // Should run if: scheduled time is after our last run AND within catch-up window
    return prev > lastRunDate && prev > catchUpWindow
  } catch (error) {
    log(`Cron check error for "${cron}": ${error}`, 'error')
    return false
  }
}

export function getNextRun(cron: string, timezone: string): Date | null {
  try {
    const cronJob = new Cron(cron, { timezone })
    return cronJob.nextRun() || null
  } catch {
    return null
  }
}

export function timeToCron(time: string, dayOfWeek?: string): string {
  // Convert "HH:MM" to cron
  const [hours, minutes] = time.split(':').map(Number)
  if (dayOfWeek) {
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    }
    return `${minutes} ${hours} * * ${days[dayOfWeek.toLowerCase()] ?? 0}`
  }
  return `${minutes} ${hours} * * *`
}
