import { createApp } from '@main/factories/createApp.js';
import { honoHttpAdapter } from '@main/adapters/honoHttpAdapter.js';
import { privateRoute } from '@main/factories/privateRoute.js';
import { pluggyWebhookAuthMiddleware } from '@main/middlewares/pluggyWebhookAuthMiddleware.js';
import { CreateConnectTokenController } from '@application/controllers/pluggy/CreateConnectTokenController.js';
import { ListAccountsController } from '@application/controllers/pluggy/ListAccountsController.js';
import { ListTransactionsController } from '@application/controllers/pluggy/ListTransactionsController.js';
import { GetTransactionsSummaryController } from '@application/controllers/pluggy/GetTransactionsSummaryController.js';
import { PluggyWebhookController } from '@application/controllers/pluggy/PluggyWebhookController.js';

const pluggyRoutes = createApp();

pluggyRoutes.post('/pluggy/connect-token', ...privateRoute(CreateConnectTokenController));
pluggyRoutes.get('/pluggy/accounts', ...privateRoute(ListAccountsController));
pluggyRoutes.get('/pluggy/transactions/summary', ...privateRoute(GetTransactionsSummaryController));
pluggyRoutes.get('/pluggy/transactions', ...privateRoute(ListTransactionsController));

// Public: Pluggy calls this server-to-server and cannot carry a user token, so
// it is guarded by a shared secret header instead of `authMiddleware`.
pluggyRoutes.post(
  '/pluggy/webhook',
  pluggyWebhookAuthMiddleware(),
  honoHttpAdapter(PluggyWebhookController),
);

export { pluggyRoutes };
