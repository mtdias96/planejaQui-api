import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock',
      JWT_SECRET: 'super_secret_key_at_least_32_characters_long_for_test',
    },
  },
  resolve: {
    alias: {
      '@application': path.resolve(__dirname, './src/application'),
      '@kernel': path.resolve(__dirname, './src/kernel'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@infra': path.resolve(__dirname, './src/infra'),
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
});
