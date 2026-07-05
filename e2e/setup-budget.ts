import api from '@actual-app/api';
import fs from 'node:fs';
import { ACCOUNT_NAME } from './constants';

async function main(): Promise<void> {
  const dataDir = process.env.ACTUAL_DATA_DIR;
  if (!dataDir) {
    throw new Error('ACTUAL_DATA_DIR must be set so this script and the MCP server share one budget');
  }
  // runImport creates a new budget file every run; wipe any prior state so a
  // reused ACTUAL_DATA_DIR can't leave stale budgets that make budgets[0]
  // (and therefore the budget the server loads) non-deterministic.
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // No serverURL: @actual-app/api embeds the budget engine and runs fully local
  // against dataDir, so the e2e needs no Actual sync server. runImport creates
  // the very budget the MCP server will pick up via getBudgets() on first use.
  await api.init({ dataDir });
  await api.runImport('e2e-budget', async () => {
    await api.createAccount({ name: ACCOUNT_NAME }, 0);
  });

  const budgets = await api.getBudgets();
  console.log(`Provisioned ${budgets.length} budget(s) in ${dataDir}:`);
  console.log(JSON.stringify(budgets, null, 2));

  await api.shutdown();
}

main().catch((err) => {
  console.error('Budget provisioning failed:', err);
  process.exit(1);
});
