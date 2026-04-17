import type { FastifyInstance } from "fastify";
import { Google } from "arctic";
import { db } from "../db/index.js";
import { users, userSessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { createHash, randomBytes } from "crypto";

function getGoogleClient(fastify: FastifyInstance): Google {
  const baseUrl =
    config.NODE_ENV === "production"
      ? "https://api.leetconnect.dev"
      : `http://localhost:${config.PORT}`;
  return new Google(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/auth/google/callback`
  );
}

interface GoogleUserInfo {
  sub: string;
  name: string;
  picture: string;
  email: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const google = getGoogleClient(fastify);

  // Step 1: Redirect to Google
  fastify.get<{ Querystring: { redirect_uri?: string } }>(
    "/auth/google",
    async (request, reply) => {
      const state = randomBytes(16).toString("hex");
      const codeVerifier = randomBytes(32).toString("base64url");
      const url = google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "profile",
        "email",
      ]);

      // Store state+verifier in a short-lived cookie
      reply.setCookie("oauth_state", state, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
      reply.setCookie("code_verifier", codeVerifier, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });

      // Store the extension's redirect URI so the callback can use it
      const redirectUri = request.query.redirect_uri;
      if (redirectUri) {
        reply.setCookie("oauth_redirect_uri", redirectUri, {
          httpOnly: true,
          secure: config.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 600,
          path: "/",
        });
      }

      return reply.redirect(url.toString());
    }
  );

  // Step 2: Google callback
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>("/auth/google/callback", async (request, reply) => {
    const { code, state, error } = request.query;

    if (error || !code || !state) {
      return reply.code(400).send({ error: "OAuth error" });
    }

    const storedState = request.cookies["oauth_state"];
    const codeVerifier = request.cookies["code_verifier"];
    const storedRedirectUri = request.cookies["oauth_redirect_uri"];

    if (!storedState || storedState !== state || !codeVerifier) {
      return reply.code(400).send({ error: "Invalid state" });
    }

    // Exchange code for tokens
    let tokens: Awaited<ReturnType<typeof google.validateAuthorizationCode>>;
    try {
      tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch {
      return reply.code(400).send({ error: "Failed to exchange code" });
    }

    // Fetch user info from Google
    const userInfoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${tokens.accessToken()}` } }
    );

    if (!userInfoRes.ok) {
      return reply.code(500).send({ error: "Failed to fetch user info" });
    }

    const googleUser = (await userInfoRes.json()) as GoogleUserInfo;

    // Upsert user in DB
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleUser.sub))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          googleId: googleUser.sub,
          displayName: googleUser.name,
          avatarUrl: googleUser.picture,
        })
        .returning();
    }

    if (!user) {
      return reply.code(500).send({ error: "Failed to create user" });
    }

    // Issue JWT access token (15 min)
    const accessToken = fastify.jwt.sign(
      { sub: user.id, displayName: user.displayName },
      { expiresIn: "15m" }
    );

    // Issue refresh token (30 days)
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(userSessions).values({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      userAgent: request.headers["user-agent"],
    });

    // Return tokens — the extension reads these from the redirect URL fragment
    const tokenPayload = {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.getTime(),
    };

    // Redirect back to the extension (or fallback to localhost in dev)
    const fragment = encodeURIComponent(JSON.stringify(tokenPayload));
    const isValidExtensionUri =
      storedRedirectUri &&
      /^https:\/\/[a-z]{32}\.chromiumapp\.org\//.test(storedRedirectUri);
    const baseRedirect = isValidExtensionUri
      ? storedRedirectUri
      : config.NODE_ENV === "production"
        ? "https://leetconnect.dev/auth/callback"
        : "http://localhost:5173/auth/callback";
    return reply.redirect(`${baseRedirect}#${fragment}`);
  });

  // Refresh access token
  fastify.post<{ Body: { refreshToken: string } }>(
    "/auth/refresh",
    async (request, reply) => {
      const { refreshToken } = request.body;
      if (!refreshToken) {
        return reply.code(400).send({ error: "Missing refresh token" });
      }

      const hash = hashToken(refreshToken);
      const [session] = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.refreshTokenHash, hash))
        .limit(1);

      if (!session || session.expiresAt < new Date()) {
        return reply.code(401).send({ error: "Invalid or expired refresh token" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        return reply.code(401).send({ error: "User not found" });
      }

      const accessToken = fastify.jwt.sign(
        { sub: user.id, displayName: user.displayName },
        { expiresIn: "15m" }
      );

      return { accessToken, expiresAt: Date.now() + 15 * 60 * 1000 };
    }
  );

  // Get current user
  fastify.get(
    "/auth/me",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      return { user: request.currentUser };
    }
  );
}
