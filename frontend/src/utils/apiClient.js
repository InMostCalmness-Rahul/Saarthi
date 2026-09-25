// Single place that knows how to reach the backend.
//
// VITE_API_BASE_URL is optional: when it is unset the app uses same-origin
// relative URLs, which the Vite dev/preview proxy forwards to the backend
// (see vite.config.js). Set it explicitly for any deployed build.
const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Performs a JSON request and unwraps the `{ success, data }` envelope.
 * Errors are normalised into ApiError with the server's client-safe message.
 */
export async function apiRequest(path, { method = "GET", body, token, signal } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("The request was cancelled.", { code: "ABORTED" });
    }
    throw new ApiError(
      "Could not reach the Saarthi service. Please check your connection and try again.",
      { code: "NETWORK_ERROR" }
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.error?.code,
    });
  }

  return payload?.data ?? null;
}
