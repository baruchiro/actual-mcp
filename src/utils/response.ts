// ----------------------------
// RESPONSE UTILITIES
// ----------------------------

import { randomUUID } from 'node:crypto';
import { CallToolResult, TextContent, ImageContent, AudioContent } from '@modelcontextprotocol/sdk/types.js';

/**
 * Standard MCP content item types (union of all supported content types)
 */
export type ContentItem = TextContent | ImageContent | AudioContent;

/**
 * Text content item (most common type)
 */
export type TextContentItem = TextContent;

/**
 * Standard MCP response structure (compatible with CallToolResult)
 */
export type Response = CallToolResult;

/**
 * Optional context for building error responses. Carrying the tool name
 * and an optional stable code lets clients render and audit failures
 * without needing server log access.
 */
export interface ErrorContext {
  toolName?: string;
  code?: string;
}

/**
 * Normalized shape extracted from any thrown value.
 */
export interface NormalizedError {
  message: string;
  code?: string;
  name?: string;
  stack?: string;
}

/**
 * Create a successful plain text response
 * @param text - The text message
 * @returns A success response object with text content
 */
export function success(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Create a success response with structured content
 * @param content - Array of content items
 * @returns A success response object with provided content
 */
export function successWithContent(content: ContentItem): CallToolResult {
  return {
    content: [content],
  };
}

/**
 * Create a success response with JSON data
 * @param data - Any data object that can be JSON-stringified
 * @returns A success response with JSON data wrapped as a resource
 */
export function successWithJson<T>(data: T): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data),
      },
    ],
  };
}

/**
 * Create an error response
 * @param message - The error message
 * @param context - Optional tool name and stable error code
 * @returns An error response object
 */
export function error(message: string, context: ErrorContext = {}): CallToolResult {
  // Reason: every failure gets a correlation id that is both returned to the
  // client (as a human-quotable `ref:` in the text and as `_meta.correlationId`)
  // and logged server-side under the same id. This lets a user report a failure
  // by its ref and a maintainer grep the matching log line, without the user
  // needing container/log access.
  const correlationId = randomUUID();
  const prefix = context.toolName ? `Error in ${context.toolName}` : 'Error';
  const codeSuffix = context.code ? ` [${context.code}]` : '';
  console.error(`[${correlationId}] ${prefix}${codeSuffix}: ${message}`);
  return {
    isError: true,
    content: [{ type: 'text', text: `${prefix}${codeSuffix} (ref: ${correlationId}): ${message}` }],
    _meta: {
      correlationId,
      ...(context.code ? { code: context.code } : {}),
      ...(context.toolName ? { tool: context.toolName } : {}),
    },
  };
}

/**
 * Best-effort extraction of a useful message and code from any thrown value.
 * Handles `Error` instances, plain objects with `message`/`error`/`reason`
 * properties, strings, and falls back to JSON for unknown shapes.
 */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof Error) {
    const codeValue = (err as Error & { code?: unknown }).code;
    return {
      message: err.message || err.name || 'Unknown error',
      name: err.name,
      stack: err.stack,
      ...(typeof codeValue === 'string' ? { code: codeValue } : {}),
    };
  }

  if (typeof err === 'string') {
    return { message: err };
  }

  if (err === null || err === undefined) {
    return { message: String(err) };
  }

  if (typeof err === 'object') {
    const record = err as Record<string, unknown>;
    const messageCandidates = [record.message, record.error, record.reason, record.description, record.detail];
    const message = messageCandidates.find((value): value is string => typeof value === 'string' && value.length > 0);
    const code = typeof record.code === 'string' ? record.code : undefined;
    // Reason: preserve name/stack when a non-Error object is thrown (e.g.
    // a serialized error), so errorFromCatch() can still log the stack under
    // the same correlation id and keep the traceability path intact.
    const extras = {
      ...(typeof record.name === 'string' ? { name: record.name } : {}),
      ...(typeof record.stack === 'string' ? { stack: record.stack } : {}),
      ...(code ? { code } : {}),
    };
    if (message) {
      return { message, ...extras };
    }
    // No usable string field — fall through to JSON serialization so the
    // client at least sees the shape of the object instead of "[object Object]".
    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== '{}') {
        return { message: serialized, ...extras };
      }
    } catch {
      // circular or otherwise unserializable
    }
    return { message: 'Unknown error (non-serializable object thrown)', ...extras };
  }

  return { message: String(err) };
}

/**
 * Create an error response from an Error object or any thrown value.
 * Extracts a usable message even from non-Error rejections (plain objects,
 * strings, etc.) so clients never see "[object Object]".
 *
 * @param err - The error object or value
 * @param context - Optional tool name and stable error code for the response
 * @returns An error response object
 */
export function errorFromCatch(err: unknown, context: ErrorContext = {}): CallToolResult {
  const normalized = normalizeError(err);
  const result = error(normalized.message, {
    ...context,
    code: context.code ?? normalized.code,
  });
  if (normalized.stack) {
    // Reason: keep the full stack out of the client response but log it under
    // the same correlation id, so the user-facing ref traces back to the trace.
    const correlationId = (result._meta as { correlationId?: string } | undefined)?.correlationId;
    console.error(`[${correlationId ?? 'unknown'}] stack: ${normalized.stack}`);
  }
  return result;
}
