import { defineConfig } from '@playwright/test';
import frontendConfig from './playwright.config.js';

// Optional: requires a running backend. Kept separate from isolated UI tests.
export default defineConfig({
  ...frontendConfig,
  testDir: './integration',
  fullyParallel: false,
  workers: 1,
});
