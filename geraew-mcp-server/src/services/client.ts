/**
 * Authenticated HTTP client for the GeraEW API.
 *
 * Handles JWT auth transparently: it logs in with email/password (or uses a
 * pre-supplied access token), caches the tokens, and on a 401 it refreshes the
 * access token — falling back to a fresh login when the refresh token is dead.
 */
import axios, { AxiosError, AxiosInstance } from "axios";
import { API_PREFIX, BASE_URL, ENV } from "../constants.js";

interface Tokens {
  accessToken: string;
  refreshToken?: string;
}

export class GeraewApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GeraewApiError";
  }
}

export class GeraewClient {
  private http: AxiosInstance;
  private tokens: Tokens | null = null;
  private authInFlight: Promise<void> | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: `${BASE_URL}${API_PREFIX}`,
      timeout: 120_000,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // Allow arbitrarily large image/video base64 payloads.
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (ENV.accessToken) {
      this.tokens = {
        accessToken: ENV.accessToken,
        refreshToken: ENV.refreshToken,
      };
    }
  }

  /** True when the server has credentials or a token available. */
  static hasCredentials(): boolean {
    return Boolean(ENV.accessToken || (ENV.email && ENV.password));
  }

  private async ensureAuth(): Promise<void> {
    if (this.tokens?.accessToken) return;
    if (!this.authInFlight) {
      this.authInFlight = this.login().finally(() => {
        this.authInFlight = null;
      });
    }
    await this.authInFlight;
  }

  private async login(): Promise<void> {
    if (!ENV.email || !ENV.password) {
      throw new GeraewApiError(
        "Not authenticated. Set GERAEW_EMAIL + GERAEW_PASSWORD (or GERAEW_ACCESS_TOKEN) in the MCP server environment.",
        401,
        "NO_CREDENTIALS",
      );
    }
    try {
      const { data } = await this.http.post("/auth/login", {
        email: ENV.email,
        password: ENV.password,
      });
      this.tokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
    } catch (error) {
      throw this.toApiError(error, "Login failed");
    }
  }

  private async refresh(): Promise<boolean> {
    if (!this.tokens?.refreshToken) return false;
    try {
      const { data } = await this.http.post("/auth/refresh", {
        refreshToken: this.tokens.refreshToken,
      });
      this.tokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? this.tokens.refreshToken,
      };
      return true;
    } catch {
      return false;
    }
  }

  /** Re-authenticate after a 401: try refresh, then a full re-login. */
  private async reauth(): Promise<void> {
    if (await this.refresh()) return;
    this.tokens = null;
    await this.login();
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    params?: Record<string, unknown>,
    retriedAfter401 = false,
  ): Promise<T> {
    await this.ensureAuth();
    try {
      const { data } = await this.http.request<T>({
        method,
        url: path,
        data: body,
        params,
        headers: { Authorization: `Bearer ${this.tokens!.accessToken}` },
      });
      // Some endpoints wrap responses in { success, data }; unwrap if present.
      return unwrap<T>(data);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 && !retriedAfter401) {
        await this.reauth();
        return this.request<T>(method, path, body, params, true);
      }
      throw this.toApiError(error, `${method} ${path} failed`);
    }
  }

  private toApiError(error: unknown, fallback: string): GeraewApiError {
    if (axios.isAxiosError(error)) {
      const err = error as AxiosError<any>;
      const status = err.response?.status;
      const payload = err.response?.data;
      const apiError = payload?.error ?? payload;
      const message =
        apiError?.message ?? payload?.message ?? err.message ?? fallback;
      const code = apiError?.code ?? payload?.code;
      return new GeraewApiError(message, status, code);
    }
    return new GeraewApiError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Unwrap the `{ success, data, meta }` envelope when the API uses it. */
function unwrap<T>(data: any): T {
  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    "data" in data
  ) {
    return data.data as T;
  }
  return data as T;
}
