import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ENTRYPOINT = fileURLToPath(new URL('../entrypoint.sh', import.meta.url));

// Fake `node`: a `-p` probe reports FAKE_INSTALLED_VERSION (or "not installed"
// via a non-zero exit); anything else is the real launch and gets logged.
const FAKE_NODE = [
  '#!/bin/sh',
  'if [ "$1" = "-p" ]; then',
  '  if [ -n "${FAKE_INSTALLED_VERSION:-}" ]; then',
  '    printf "%s" "$FAKE_INSTALLED_VERSION"',
  '    exit 0',
  '  fi',
  '  exit 1',
  'fi',
  'printf "node %s\\n" "$*" >> "$TEST_LOG"',
  'exit 0',
  '',
].join('\n');

// Fake `npm`: logs the invocation and fails when FAKE_NPM_FAIL is set.
const FAKE_NPM = [
  '#!/bin/sh',
  'printf "npm %s\\n" "$*" >> "$TEST_LOG"',
  'if [ -n "${FAKE_NPM_FAIL:-}" ]; then',
  '  exit 1',
  'fi',
  'exit 0',
  '',
].join('\n');

let workDir: string;
let binDir: string;
let logFile: string;

function writeExecutable(file: string, contents: string): void {
  writeFileSync(file, contents);
  chmodSync(file, 0o755);
}

interface RunResult {
  status: number | null;
  stderr: string;
  log: string;
}

function runEntrypoint(env: Record<string, string>, args: string[] = []): RunResult {
  const result = spawnSync('sh', [ENTRYPOINT, ...args], {
    cwd: workDir,
    encoding: 'utf8',
    env: {
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      TEST_LOG: logFile,
      ...env,
    },
  });
  return {
    status: result.status,
    stderr: result.stderr ?? '',
    log: existsSync(logFile) ? readFileSync(logFile, 'utf8') : '',
  };
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'entrypoint-test-'));
  binDir = path.join(workDir, 'bin');
  logFile = path.join(workDir, 'calls.log');
  mkdirSync(binDir, { recursive: true });
  writeExecutable(path.join(binDir, 'node'), FAKE_NODE);
  writeExecutable(path.join(binDir, 'npm'), FAKE_NPM);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('entrypoint.sh', () => {
  it('launches the server directly and never installs when ACTUAL_MCP_API_VERSION is unset (happy path)', () => {
    const { status, log } = runEntrypoint({}, ['--enable-write', '--sse']);

    expect(status).toBe(0);
    expect(log).toContain('node build/index.js --enable-write --sse');
    expect(log).not.toContain('npm');
  });

  it('installs the requested version before launching when it is not already present', () => {
    const { status, log } = runEntrypoint({ ACTUAL_MCP_API_VERSION: '26.5.2' });

    expect(status).toBe(0);
    expect(log).toContain('npm install --no-save --no-audit --no-fund @actual-app/api@26.5.2');
    // Install must happen before the launch.
    expect(log.indexOf('npm install')).toBeLessThan(log.indexOf('node build/index.js'));
  });

  it('skips the install when the requested version is already installed (idempotent edge case)', () => {
    const { status, stderr, log } = runEntrypoint({
      ACTUAL_MCP_API_VERSION: '26.5.2',
      FAKE_INSTALLED_VERSION: '26.5.2',
    });

    expect(status).toBe(0);
    expect(stderr).toContain('already installed; skipping install');
    expect(log).not.toContain('npm');
    expect(log).toContain('node build/index.js');
  });

  it('always installs when ACTUAL_MCP_API_VERSION is "latest"', () => {
    const { status, log } = runEntrypoint({
      ACTUAL_MCP_API_VERSION: 'latest',
      // Even if some version is present, "latest" should still install.
      FAKE_INSTALLED_VERSION: '26.5.2',
    });

    expect(status).toBe(0);
    expect(log).toContain('npm install --no-save --no-audit --no-fund @actual-app/api@latest');
  });

  it('exits non-zero and does not launch when the install fails (failure case)', () => {
    const { status, stderr, log } = runEntrypoint({
      ACTUAL_MCP_API_VERSION: '26.5.2',
      FAKE_NPM_FAIL: '1',
    });

    expect(status).toBe(1);
    expect(stderr).toContain('failed to install @actual-app/api@26.5.2');
    expect(log).toContain('npm install');
    expect(log).not.toContain('node build/index.js');
  });
});
