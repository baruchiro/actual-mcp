import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export async function connectMcpClient(mcpUrl: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  const client = new Client({ name: 'actual-mcp-e2e', version: '1.0.0' }, {});
  await client.connect(transport);
  return client;
}

export function toolText(result: ToolResult): string {
  const text = result.content.find((c) => c.type === 'text')?.text;
  if (result.isError) {
    throw new Error(`Tool returned isError=true: ${text ?? '(no message)'}`);
  }
  if (!text) {
    throw new Error('Tool result had no text content');
  }
  return text;
}

export function toolJson<T>(result: ToolResult): T {
  return JSON.parse(toolText(result)) as T;
}
