import { Redis } from "ioredis";
import { config } from "../config.js";
import type { OnlineUser } from "@leetconnect/types";

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export const redisPublisher = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export const redisSubscriber = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// ── Presence helpers ──────────────────────────────────────────────────────────

const PRESENCE_TTL_SECONDS = 35;

/** Add/refresh a user in a problem room presence sorted set */
export async function upsertPresence(
  slug: string,
  user: OnlineUser
): Promise<void> {
  const key = `presence:${slug}`;
  const now = Date.now();
  await redis
    .pipeline()
    .zadd(key, now, JSON.stringify({ ...user, joinedAt: user.joinedAt ?? now }))
    .expire(key, PRESENCE_TTL_SECONDS * 10) // keep key alive as long as someone's present
    .set(`user:${user.userId}:location`, slug, "EX", PRESENCE_TTL_SECONDS)
    .exec();
}

/** Remove a user from a problem room presence sorted set */
export async function removePresence(
  slug: string,
  userId: string
): Promise<void> {
  const key = `presence:${slug}`;
  const members = await redis.zrange(key, 0, -1);
  const toRemove = members.filter((m) => {
    try {
      return (JSON.parse(m) as { userId: string }).userId === userId;
    } catch {
      return false;
    }
  });
  if (toRemove.length > 0) {
    await redis.zrem(key, ...toRemove);
  }
  await redis.del(`user:${userId}:location`);
}

/** Get all live users in a room (evict stale ones first) */
export async function getLivePresence(slug: string): Promise<OnlineUser[]> {
  const key = `presence:${slug}`;
  const staleThreshold = Date.now() - PRESENCE_TTL_SECONDS * 1000;

  // Remove stale entries
  await redis.zremrangebyscore(key, "-inf", staleThreshold);

  const members = await redis.zrange(key, 0, -1);
  const users: OnlineUser[] = [];
  for (const m of members) {
    try {
      users.push(JSON.parse(m) as OnlineUser);
    } catch {
      // skip malformed entries
    }
  }
  return users;
}

/** Add a user to a voice channel participant set */
export async function joinVoiceChannel(
  channelId: string,
  userId: string
): Promise<void> {
  await redis.sadd(`voice:${channelId}:participants`, userId);
}

/** Remove a user from a voice channel participant set */
export async function leaveVoiceChannel(
  channelId: string,
  userId: string
): Promise<void> {
  await redis.srem(`voice:${channelId}:participants`, userId);
}

/** Get all participants in a voice channel */
export async function getVoiceParticipants(
  channelId: string
): Promise<string[]> {
  return redis.smembers(`voice:${channelId}:participants`);
}
