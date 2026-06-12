import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setupPrompts } from './prompts.js';
import { setupResources } from './resources.js';
import { setupTools } from './tools/index.js';

// package.json is outside rootDir, so read it at runtime instead of importing it.
const { version: SERVER_VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

interface CreateServerOptions {
  enableWrite: boolean;
}

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
    process.stderr.write(`--- Logging level: ${request.params.level}\n`);
    return {};
  });

  return server;
}
