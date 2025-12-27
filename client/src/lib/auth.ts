import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { queryClient } from "./react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = Tokens & { user: Omit<User, "password"> };

type LoginDto = { email: string; password: string };

type RefreshDto = { sessionId: string; refreshToken: string };

const TOKEN_KEY = "auth_tokens";
let inMemoryTokens: Tokens | null = loadTokens();
let refreshPromise: Promise<string | null> | null = null;

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

function persistTokens(tokens: Tokens | null) {
  inMemoryTokens = tokens;
  if (!tokens) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function getTokens() {
  return inMemoryTokens ?? loadTokens();
}

export function setTokens(tokens: Tokens) {
  persistTokens(tokens);
}

export function clearTokens() {
  persistTokens(null);
}

export function getAccessToken() {
  return getTokens()?.accessToken ?? null;
}

export function getRefreshToken() {
  return getTokens()?.refreshToken ?? null;
}

export function getSessionId() {
  return getTokens()?.sessionId ?? null;
}

function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_URL,
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      const headers = (config.headers ?? {}) as AxiosRequestHeaders;
      headers.Authorization = `Bearer ${token}`;
      config.headers = headers;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetryableConfig;
      const status = error.response?.status;
      if (status === 401 && original && !original._retry) {
        original._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          const headers = (original.headers ?? {}) as AxiosRequestHeaders;
          headers.Authorization = `Bearer ${newToken}`;
          original.headers = headers;
          return instance(original);
        }
        clearTokens();
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export const api = createApiClient();

export async function login(dto: LoginDto): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", dto);
  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    sessionId: data.sessionId,
  });
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const tokens = getTokens();
  if (!tokens?.refreshToken || !tokens.sessionId) return null;

  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<AuthResponse>(
        `${API_URL}/auth/refresh`,
        {
          refreshToken: tokens.refreshToken,
          sessionId: tokens.sessionId,
        } satisfies RefreshDto
      );
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      });
      return data.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function ensureSession() {
  const tokens = getTokens();
  const hasTokens = !!tokens?.refreshToken && !!tokens?.sessionId;
  if (!hasTokens) return null;
  const token = await refreshAccessToken();
  if (!token) return null;
  return fetchMe();
}

export async function logout() {
  const tokens = getTokens();
  if (!tokens) {
    clearTokens();
    return;
  }

  try {
    await api.post("/auth/logout", {
      refreshToken: tokens.refreshToken,
      sessionId: tokens.sessionId,
    } satisfies RefreshDto);
  } finally {
    clearTokens();
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }
}
