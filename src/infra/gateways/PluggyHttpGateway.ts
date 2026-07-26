import { AppConfig } from '@shared/config/AppConfig.js';
import { PluggyGateway } from '@application/contracts/PluggyGateway.js';
import { PluggyGatewayError } from '@application/errors/PluggyGatewayError.js';

const PLUGGY_BASE_URL = 'https://api.pluggy.ai';
// Renew the API key a bit before it actually expires to avoid edge races.
const API_KEY_SAFETY_WINDOW_MS = 60_000;
// Fallback TTL used only when the API key JWT can't be decoded (~2h keys).
const API_KEY_FALLBACK_TTL_MS = 90 * 60 * 1000;

type CachedApiKey = {
  value: string;
  expiresAt: number;
};

/**
 * Anti-corruption layer around Pluggy's REST API.
 *
 * Uses native `fetch` (no SDK) to keep the Lambda bundle small and cold starts
 * fast. Pluggy auth is two-step: exchange clientId/clientSecret for a
 * short-lived API key, then send it as `X-API-KEY`. The API key is cached on
 * the instance (a DI singleton reused across warm invocations) so hot requests
 * skip the extra `/auth` round-trip.
 */
export class PluggyHttpGateway extends PluggyGateway {
  static inject = [AppConfig];

  private cachedApiKey: CachedApiKey | null = null;

  constructor(private readonly config: AppConfig) {
    super();
  }

  override async createConnectToken(
    input: PluggyGateway.CreateConnectTokenInput,
  ): Promise<PluggyGateway.CreateConnectTokenOutput> {
    const apiKey = await this.getApiKey();

    const response = await fetch(`${PLUGGY_BASE_URL}/connect_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        clientUserId: input.clientUserId,
        webhookUrl: input.webhookUrl,
      }),
    });

    if (!response.ok) {
      throw new PluggyGatewayError('Failed to create Pluggy connect token.');
    }

    const data = (await response.json()) as { accessToken: string };

    return { accessToken: data.accessToken };
  }

  private async getApiKey(): Promise<string> {
    if (this.cachedApiKey && Date.now() < this.cachedApiKey.expiresAt) {
      return this.cachedApiKey.value;
    }

    const response = await fetch(`${PLUGGY_BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.config.pluggy.clientId,
        clientSecret: this.config.pluggy.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new PluggyGatewayError('Failed to authenticate with Pluggy.');
    }

    const data = (await response.json()) as { apiKey: string };

    this.cachedApiKey = {
      value: data.apiKey,
      expiresAt: this.resolveApiKeyExpiration(data.apiKey),
    };

    return data.apiKey;
  }

  private resolveApiKeyExpiration(apiKey: string): number {
    try {
      const [, payload] = apiKey.split('.');
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(normalized)) as { exp?: number };

      if (typeof exp === 'number') {
        return exp * 1000 - API_KEY_SAFETY_WINDOW_MS;
      }
    } catch {
      // Fall back to a conservative TTL if the JWT can't be decoded.
    }

    return Date.now() + API_KEY_FALLBACK_TTL_MS;
  }
}
