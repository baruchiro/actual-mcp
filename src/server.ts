import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setupPrompts } from './prompts.js';
import { setupResources } from './resources.js';
import { setupTools } from './tools/index.js';

// Read the version at runtime; a static JSON import of package.json (outside
// rootDir: ./src) would break the build (TS6059).
const { version: SERVER_VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

interface CreateServerOptions {
  enableWrite: boolean;
}

/**
 * Create a fresh MCP Server per connection/session so concurrent HTTP/SSE clients
 * never share transports or logging state.
 */
export function createServer(options: CreateServerOptions): Server {
  const server = new Server(
    {
      name: 'Actual Budget',
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
        logging: {},
      },
    }
  );

  setupResources(server);
  setupTools(server, options.enableWrite);
  setupPrompts(server);

  server.setRequestHandler(SetLevelRequestSchema, (request) => {
    // stderr, not console: avoids races across concurrent connections.
    process.stderr.write(`--- Logging level: ${request.params.level}\n`);
    return {};
  });

  return server;
}
