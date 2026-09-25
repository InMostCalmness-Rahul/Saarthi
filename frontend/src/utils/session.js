import { ApiError, apiRequest } from "./apiClient";

// The client no longer invents its own identity. A session (opaque userId +
// signed token) is minted by the backend and cached locally. The previous
// `user_${Date.now()}` scheme made every user id guessable and every
// user-scoped endpoint enumerable.
const STORAGE_KEY = "saarthi_session";

let inFlightSession = null;

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.userId) {
      return null;
    }
    // Treat tokens expiring within a minute as expired to avoid mid-request 401s.
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) <= Date.now() + 60_000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getStoredSession() {
  return readStoredSession();
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns a usable session, minting one when missing/expired.
 * Concurrent callers share a single in-flight request.
 */
export async function ensureSession({ force = false } = {}) {
  if (!force) {
    const existing = readStoredSession();
    if (existing) {
      return existing;
    }
  }

  if (inFlightSession) {
    return inFlightSession;
  }

  inFlightSession = apiRequest("/api/auth/session", { method: "POST", body: {} })
    .then((data) => {
      const session = {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
        trustScore: data.trustScore,
        trustPhase: data.trustPhase,
      };
      persistSession(session);
      return session;
    })
    .finally(() => {
      inFlightSession = null;
    });

  return inFlightSession;
}

/**
 * Runs an authenticated request, transparently re-minting the session once if the
 * server reports the token as expired/invalid.
 */
export async function withSession(request) {
  let session = await ensureSession();

  try {
    return await request(session);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      session = await ensureSession({ force: true });
      return request(session);
    }
    throw error;
  }
}
