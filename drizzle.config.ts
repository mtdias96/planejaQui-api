import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infra/database/drizzle/schemas/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
