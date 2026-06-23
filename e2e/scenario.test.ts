import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { connectMcpClient, toolJson, toolText, type ToolResult } from './client';
import { ACCOUNT_NAME } from './constants';

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3001/mcp';

// Unique per run: the CLI and Docker passes share one budget, so a fresh payee
// each run keeps their transactions from colliding.
const PAYEE = `E2E Coffee ${Date.now()}`;
const AMOUNT = -1234;
const TODAY = new Date().toISOString().slice(0, 10);

interface AccountRow {
  id: string;
  name: string;
}

const story: { client?: Client; accountId?: string } = {};

beforeAll(async () => {
  story.client = await connectMcpClient(MCP_URL);
});

afterAll(async () => {
  await story.client?.close?.();
});

function call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return story.client!.callTool({ name, arguments: args }) as Promise<ToolResult>;
}

describe('Actual MCP e2e: one transaction from creation to the ledger', () => {
  it('finds the account that was provisioned for this run', async () => {
    const accounts = toolJson<AccountRow[]>(await call('get-accounts', {}));
    const account = accounts.find((a) => a.name === ACCOUNT_NAME);
    expect(account, `expected a "${ACCOUNT_NAME}" account, got ${JSON.stringify(accounts)}`).toBeTruthy();
    story.accountId = account!.id;
  });

  it('records a new transaction against that account', async () => {
    expect(story.accountId).toBeTruthy();
    const text = toolText(
      await call('create-transaction', {
        account: story.accountId,
        date: TODAY,
        amount: AMOUNT,
        payee_name: PAYEE,
      })
    );
    expect(text).toContain('Successfully created transaction');
  });

  it('reads that transaction back out of the ledger', async () => {
    expect(story.accountId).toBeTruthy();
    const report = toolText(
      await call('get-transactions', {
        accountId: story.accountId,
        startDate: '2000-01-01',
        endDate: '2999-12-31',
        payeeName: PAYEE,
      })
    );
    expect(report).toContain(PAYEE);
    expect(report).toContain('Matching Transactions: 1/');
  });
});
