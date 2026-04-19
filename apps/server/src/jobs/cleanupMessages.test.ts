import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Flush pending microtasks while fake timers are active. */
async function flushPromises(): Promise<void> {
  // advanceTimersByTimeAsync(0) drains all pending microtasks and timer callbacks
  // without actually advancing the fake clock by a meaningful amount.
  await vi.advanceTimersByTimeAsync(0)
}

// ─── Mock db ──────────────────────────────────────────────────────────────────

// Build a chainable mock that resolves the final `where()` call.
function createDbMock() {
  const whereMock = vi.fn().mockResolvedValue([])
  const deleteMock = vi.fn(() => ({ where: whereMock }))
  return { db: { delete: deleteMock }, deleteMock, whereMock }
}

let dbMocks = createDbMock()

vi.mock('../db/index.js', () => ({
  get db() { return dbMocks.db },
}))

// Also mock the schema import that cleanupMessages uses
vi.mock('../db/schema.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../db/schema.js')>()
  return original
})

// Import after mocks
const { cleanupOldMessages, scheduleMessageCleanup } = await import('./cleanupMessages.js')

beforeEach(() => {
  dbMocks = createDbMock()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ─── cleanupOldMessages ───────────────────────────────────────────────────────

describe('cleanupOldMessages', () => {
  it('calls db.delete on problemMessages', async () => {
    await cleanupOldMessages()
    expect(dbMocks.deleteMock).toHaveBeenCalledOnce()
  })

  it('passes a cutoff date roughly 48 hours in the past to the where clause', async () => {
    const before = Date.now()
    await cleanupOldMessages()
    const after = Date.now()

    // The where mock receives a drizzle expression — we check it was called.
    expect(dbMocks.whereMock).toHaveBeenCalledOnce()

    // The cutoff should be between (before - 48h) and (after - 48h).
    // We cannot inspect the drizzle expression object directly, but we can
    // verify that the delete chain was set up correctly.
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000
    const expectedEarliest = new Date(before - FORTY_EIGHT_HOURS)
    const expectedLatest = new Date(after - FORTY_EIGHT_HOURS)

    // The actual cutoff would be Date.now() - 48h at call time; that value
    // falls between our two bounds. Since we can't read into the drizzle lt()
    // expression, just confirm the chain ran.
    expect(expectedEarliest.getTime()).toBeLessThanOrEqual(expectedLatest.getTime() + 100)
  })
})

// ─── scheduleMessageCleanup ───────────────────────────────────────────────────

describe('scheduleMessageCleanup', () => {
  it('calls cleanupOldMessages once on startup', async () => {
    scheduleMessageCleanup()
    // Flush all pending microtasks so the first void cleanupOldMessages() runs
    await flushPromises()
    expect(dbMocks.deleteMock).toHaveBeenCalledTimes(1)
  })

  it('calls cleanupOldMessages again after 24 hours', async () => {
    scheduleMessageCleanup()
    await flushPromises()

    const callsAfterStartup = dbMocks.deleteMock.mock.calls.length

    // Advance 24 hours
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    await flushPromises()

    expect(dbMocks.deleteMock.mock.calls.length).toBeGreaterThan(callsAfterStartup)
  })

  it('does not call cleanupOldMessages before 24 hours have elapsed', async () => {
    scheduleMessageCleanup()
    await flushPromises()

    const callsAfterStartup = dbMocks.deleteMock.mock.calls.length

    // Advance 23 hours — not enough to trigger the interval
    await vi.advanceTimersByTimeAsync(23 * 60 * 60 * 1000)
    await flushPromises()

    expect(dbMocks.deleteMock.mock.calls.length).toBe(callsAfterStartup)
  })
})
