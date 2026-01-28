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

export async function httpJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
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

export function toUserMessage(err: unknown, fallback = "Terjadi kesalahan") {
  if (err instanceof HttpError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}