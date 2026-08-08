import { Registry } from '@kernel/di/Registry.js';
import { PurgeExpiredRefreshTokensUseCase } from '@application/useCases/auth/PurgeExpiredRefreshTokensUseCase.js';

export async function handle(): Promise<PurgeExpiredRefreshTokensUseCase.Output> {
  const purgeExpiredRefreshTokens = Registry.getInstance().resolve(PurgeExpiredRefreshTokensUseCase);
  const result = await purgeExpiredRefreshTokens.execute();

  // eslint-disable-next-line no-console
  console.log(`[CLEANUP] Removed ${result.deletedCount} expired refresh tokens.`);

  return result;
}
