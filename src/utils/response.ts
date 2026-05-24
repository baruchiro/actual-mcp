// ----------------------------
// RESPONSE UTILITIES
// ----------------------------

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
  const prefix = context.toolName ? `Error in ${context.toolName}` : 'Error';
  const codeSuffix = context.code ? ` [${context.code}]` : '';
  const result: CallToolResult = {
    isError: true,
    content: [{ type: 'text', text: `${prefix}${codeSuffix}: ${message}` }],
  };
  if (context.code || context.toolName) {
    result._meta = {
      ...(context.code ? { code: context.code } : {}),
      ...(context.toolName ? { tool: context.toolName } : {}),
    };
  }
  return result;
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
    if (message) {
      return { message, ...(code ? { code } : {}) };
    }
    // No usable string field — fall through to JSON serialization so the
    // client at least sees the shape of the object instead of "[object Object]".
    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== '{}') {
        return { message: serialized, ...(code ? { code } : {}) };
      }
    } catch {
      // circular or otherwise unserializable
    }
    return { message: 'Unknown error (non-serializable object thrown)', ...(code ? { code } : {}) };
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
  return error(normalized.message, {
    ...context,
    code: context.code ?? normalized.code,
  });
}
