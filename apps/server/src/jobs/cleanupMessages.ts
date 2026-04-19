import { db } from '../db/index.js'
import { problemMessages } from '../db/schema.js'
import { lt } from 'drizzle-orm'

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

export async function cleanupOldMessages(): Promise<void> {
  const cutoff = new Date(Date.now() - FORTY_EIGHT_HOURS)
  await db.delete(problemMessages).where(lt(problemMessages.createdAt, cutoff))
}

export function scheduleMessageCleanup(): void {
  // Run once on startup to handle any backlog
  void cleanupOldMessages()

  // Then every 24 hours
  setInterval(() => void cleanupOldMessages(), 24 * 60 * 60 * 1000)
}
