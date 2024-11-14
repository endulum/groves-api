import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globals: true,
    environment: 'node',
    bail: 1,
    poolOptions: { forks: { singleFork: true } },
  },
});
