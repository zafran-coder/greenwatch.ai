/**
 * GreenWatch AI — Resilient HTTP Fetch Client
 * Supports:
 * - Base URL from VITE_API_URL (defaults to empty string for Vite proxy)
 * - credentials: "include" for signed session cookies
 * - Request cancellation via AbortSignal
 * - Normalized error handling (ApiError)
 * - Silent first-request retry for sleeping/waking servers
 */

const RAW_API_URL = import.meta.env.VITE_API_URL || "";
export const BASE_URL = RAW_API_URL ? RAW_API_URL.replace(/\/+$/, "") : "";

export class ApiError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Normalizes backend error envelopes into an ApiError.
 */
async function normalizeError(response) {
  let message = `Request failed with status ${response.status}`;
  let code = "HTTP_ERROR";
  let details = null;

  try {
    const text = await response.text();
    if (text) {
      const data = JSON.parse(text);
      if (data.error) {
        if (typeof data.error === "string") {
          message = data.error;
        } else if (typeof data.error === "object") {
          message = data.error.message || message;
          code = data.error.code || code;
          details = data.error.details || data.error;
        }
      } else if (data.message) {
        message = data.message;
        code = data.code || code;
        details = data.details || null;
      }
    }
  } catch {
    // If not JSON, fallback to response status text
    if (response.statusText) {
      message = response.statusText;
    }
  }

  return new ApiError(message, response.status, code, details);
}

let hasCompletedFirstRequest = false;

/**
 * Fetch wrapper with silent retries and exponential backoff for cold starts / Render server wakeups.
 */
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 1200) {
  // If this is the initial request to the server, provide extra retry budget and backoff
  const isInitial = !hasCompletedFirstRequest;
  const maxAttempts = isInitial ? Math.max(retries, 5) : retries;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on server wakeup / gateway errors (502, 503, 504)
      if (
        (response.status === 502 || response.status === 503 || response.status === 504) &&
        attempt < maxAttempts &&
        (!options.method || options.method === "GET")
      ) {
        const backoff = isInitial ? Math.min(1000 * Math.pow(1.5, attempt), 8000) : delayMs * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      hasCompletedFirstRequest = true;
      return response;
    } catch (err) {
      // Don't retry if aborted explicitly by user
      if (err.name === "AbortError" || options.signal?.aborted) {
        throw err;
      }

      // Retry network errors (e.g. server starting up / sleeping Render instance)
      if (attempt < maxAttempts) {
        const backoff = isInitial ? Math.min(1000 * Math.pow(1.5, attempt), 8000) : delayMs * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      hasCompletedFirstRequest = true;
      throw err;
    }
  }
}

/**
 * Core HTTP Request Method
 */
export async function apiClient(endpoint, options = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    signal,
    retries = method === "GET" ? 2 : 0,
    ...customConfig
  } = options;

  // Build clean URL
  let url = endpoint;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    url = `${BASE_URL}${cleanEndpoint}`;
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  // Cross-origin Bearer token fallback if cookie is partitioned or blocked
  const authToken =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("greenwatch_auth_token")
      : null;

  const requestHeaders = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(authToken && !headers["Authorization"] && !headers["authorization"] && {
      Authorization: `Bearer ${authToken}`,
    }),
    ...headers,
  };

  const config = {
    method,
    headers: requestHeaders,
    credentials: "include", // strictly included on all requests
    signal,
    ...customConfig,
  };

  if (body) {
    if (isFormData || typeof body === "string") {
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetchWithRetry(url, config, retries);

    if (!response.ok) {
      throw await normalizeError(response);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw err;
    }
    // Normalize generic network/browser errors
    throw new ApiError(
      err.message || "Network connection failed",
      0,
      "NETWORK_ERROR"
    );
  }
}

/**
 * Helper to create a cancelable request bundle.
 */
export function createCancelable() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}
