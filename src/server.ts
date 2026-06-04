import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setupPrompts } from './prompts.js';
import { setupResources } from './resources.js';
import { setupTools } from './tools/index.js';

interface CreateServerOptions {
  enableWrite: boolean;
}

/**
 * Creates and configures a new MCP Server instance with all resources, tools, and prompts.
 *
 * A fresh instance is created per connection/session so that concurrent HTTP/SSE
 * clients never share transports or logging state with one another.
 *
 * @param options - Server configuration options
 * @returns A fully configured Server instance ready to be connected to a transport
 */
export function createServer(options: CreateServerOptions): Server {
  const server = new Server(
    {
      name: 'Actual Budget',
      version: '1.0.0',
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
    // Reason: write directly to stderr instead of overriding console, which would
    // race across concurrent connections sharing the global console object.
    process.stderr.write(`--- Logging level: ${request.params.level}\n`);
    return {};
  });

  return server;
}
