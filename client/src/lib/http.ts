import { clearTokens, getAccessToken, refreshAccessToken } from "./auth";

const apiUrlEnv = (import.meta as { env?: Record<string, string> }).env?.
  VITE_API_URL;
const apiBaseRoot = (apiUrlEnv ?? "http://localhost:3000/api").replace(
  /\/api\/?$/,
  "",
);

function resolveUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${apiBaseRoot}${path}`;
}

export class HttpError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function parseBody(text: string) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildInitWithAuth(init?: RequestInit, token?: string): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!token) {
    // Debug: surface when requests go out without a bearer; remove after diagnosing 401s.
    console.warn("httpJson: no access token attached", { url: init?.cache });
  }
  return { ...init, headers } satisfies RequestInit;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = parseBody(text);

  if (!res.ok) {
    const message =
      typeof data === "string"
        ? data || "Permintaan gagal"
        : (data as { message?: string })?.message || "Permintaan gagal";
    throw new HttpError(message, res.status, data);
  }

  return data as T;
}

export async function httpJson<T>(
  url: string,
  init?: RequestInit,
  _retry = false,
): Promise<T> {
  const target = resolveUrl(url);
  // Attach access token if available so protected endpoints work across the app.
  const token = getAccessToken();
  const firstInit = buildInitWithAuth(init, token ?? undefined);
  const first = await fetch(target, firstInit);

  if (first.status === 401 && !_retry) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      console.warn("httpJson: refreshAccessToken returned null, clearing tokens", {
        url,
      });
    }
    if (newToken) {
      const retryInit = buildInitWithAuth(init, newToken);
      const retryRes = await fetch(target, retryInit);
      return handleResponse<T>(retryRes);
    }
    clearTokens();
  }

  return handleResponse<T>(first);
}

export function toUserMessage(err: unknown, fallback = "Terjadi kesalahan") {
  if (err instanceof HttpError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}