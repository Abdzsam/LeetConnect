import { describe, it, expect } from 'vitest'
import { pickAutoRoom, subRoomId, summarizeProblemSubRooms } from './index.js'

describe('socket room helpers', () => {
  it('builds stable sub-room ids', () => {
    expect(subRoomId('two-sum', 3)).toBe('problem:two-sum:3')
  })

  it('summarizes and sorts only the requested problem sub-rooms', () => {
    const result = summarizeProblemSubRooms(
      [
        { roomId: 'problem:two-sum:2', userCount: 4 },
        { roomId: 'problem:add-two-numbers:1', userCount: 9 },
        { roomId: 'problem:two-sum:1', userCount: 15 },
      ],
      'two-sum',
    )

    expect(result).toEqual([
      { number: 1, userCount: 15, capacity: 15 },
      { number: 2, userCount: 4, capacity: 15 },
    ])
  })

  it('reuses the first room with remaining capacity', () => {
    const roomNumber = pickAutoRoom([
      { number: 1, userCount: 15, capacity: 15 },
      { number: 2, userCount: 6, capacity: 15 },
      { number: 3, userCount: 2, capacity: 15 },
    ])

    expect(roomNumber).toBe(2)
  })

  it('creates room 1 when no sub-rooms exist yet', () => {
    expect(pickAutoRoom([])).toBe(1)
  })

  it('creates the next room when every current room is full', () => {
    const roomNumber = pickAutoRoom([
      { number: 1, userCount: 15, capacity: 15 },
      { number: 2, userCount: 15, capacity: 15 },
    ])

    expect(roomNumber).toBe(3)
  })
})
