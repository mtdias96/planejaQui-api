import { AppConfig } from '@shared/config/AppConfig.js';
import { PluggyGatewayError } from '@application/errors/PluggyGatewayError.js';
import { PluggyRateLimitError } from '@application/errors/PluggyRateLimitError.js';

// Margem de segurança de 60s antes da expiração do JWT para evitar expiração durante o trânsito
const API_KEY_SAFETY_WINDOW_MS = 60_000;
// TTL padrão de 90min caso o JWT não possua o campo 'exp'
const API_KEY_FALLBACK_TTL_MS = 90 * 60 * 1000;

export class PluggyClient {
  static inject = [AppConfig];

  private cachedApiKey: PluggyClient.CachedApiKey | null = null;

  constructor(private readonly config: AppConfig) {}

  async get<TResponse>(path: string, query?: PluggyClient.Query): Promise<TResponse> {
    return this.request<TResponse>('GET', path, { query });
  }

  async post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.request<TResponse>('POST', path, { body });
  }

  private async request<TResponse>(
    method: PluggyClient.Method,
    path: string,
    options: PluggyClient.RequestOptions,
    isRetry = false,
  ): Promise<TResponse> {
    const apiKey = await this.getApiKey();

    const response = await this.send(
      this.buildUrl(path, options.query),
      method,
      { 'X-API-KEY': apiKey },
      options.body,
    );

    // Se o token expirar em um Lambda quente, invalida o cache e tenta novamente exatamente uma vez
    if (response.status === 401 || response.status === 403) {
      if (isRetry) {
        throw new PluggyGatewayError('Pluggy rejected the API credentials.');
      }

      this.cachedApiKey = null;
      return this.request<TResponse>(method, path, options, true);
    }

    if (response.status === 429) {
      throw new PluggyRateLimitError(this.parseRetryAfter(response.headers));
    }

    if (!this.isSuccessful(response.status)) {
      this.logFailure(method, path, response);
      throw new PluggyGatewayError();
    }

    return response.body as TResponse;
  }

  private async getApiKey(): Promise<string> {
    if (this.cachedApiKey && Date.now() < this.cachedApiKey.expiresAt) {
      return this.cachedApiKey.value;
    }

    const response = await this.send(`${this.config.pluggy.baseUrl}/auth`, 'POST', {}, {
      clientId: this.config.pluggy.clientId,
      clientSecret: this.config.pluggy.clientSecret,
    });

    const apiKey = (response.body as PluggyClient.AuthBody | null)?.apiKey;

    if (!this.isSuccessful(response.status) || !apiKey) {
      throw new PluggyGatewayError('Failed to authenticate with Pluggy.');
    }

    this.cachedApiKey = {
      value: apiKey,
      expiresAt: this.resolveApiKeyExpiration(apiKey),
    };

    return apiKey;
  }

  private async send(
    url: string,
    method: PluggyClient.Method,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<PluggyClient.Response> {
    const hasBody = body !== undefined;

    const response = await fetch(url, {
      method,
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    return {
      status: response.status,
      headers: response.headers,
      body: await this.parseBody(response),
    };
  }

  private async parseBody(response: Response): Promise<unknown> {
    const raw = await response.text();

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private buildUrl(path: string, query?: PluggyClient.Query): string {
    const url = new URL(`${this.config.pluggy.baseUrl}${path}`);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  private isSuccessful(status: number): boolean {
    return status >= 200 && status < 300;
  }

  private parseRetryAfter(headers: Headers): number | undefined {
    const raw = headers.get('retry-after') ?? headers.get('ratelimit-reset');
    const seconds = Number(raw);

    return Number.isFinite(seconds) && raw !== null ? seconds : undefined;
  }

  private resolveApiKeyExpiration(apiKey: string): number {
    try {
      const [, payload] = apiKey.split('.');
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      const { exp } = JSON.parse(decoded) as { exp?: number };

      if (typeof exp === 'number') {
        return exp * 1000 - API_KEY_SAFETY_WINDOW_MS;
      }
    } catch {
      // Ignora erro de parse e utiliza o TTL padrão abaixo
    }

    return Date.now() + API_KEY_FALLBACK_TTL_MS;
  }

  // Registra falhas upstream para monitoramento (headers omitidos para não vazar a chave de API)
  private logFailure(
    method: PluggyClient.Method,
    path: string,
    response: PluggyClient.Response,
  ): void {
    // eslint-disable-next-line no-console
    console.error('[pluggy] request failed', {
      method,
      path,
      status: response.status,
      body: response.body,
    });
  }
}

export namespace PluggyClient {
  export type Method = 'GET' | 'POST';

  export type Query = Record<string, string | undefined>;

  export type RequestOptions = {
    query?: Query;
    body?: unknown;
  };

  export type Response = {
    status: number;
    headers: Headers;
    body: unknown;
  };

  export type CachedApiKey = {
    value: string;
    expiresAt: number;
  };

  export type AuthBody = {
    apiKey: string;
  };
}
