import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['e2e/**/*.test.ts'],
    globals: true,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
