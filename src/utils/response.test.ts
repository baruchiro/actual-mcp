import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { error, errorFromCatch, normalizeError, success, successWithJson } from './response.js';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

describe('response utilities', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reason: error()/errorFromCatch() log to the server console by design;
    // silence (and capture) it here so test output stays clean.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('success', () => {
    it('returns a text content result', () => {
      const result = success('hello');
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);
    });
  });

  describe('successWithJson', () => {
    it('stringifies data into text content', () => {
      const result = successWithJson({ a: 1 });
      expect(result.content[0]).toMatchObject({ type: 'text', text: '{"a":1}' });
    });
  });

  describe('error', () => {
    it('marks result as error and prefixes with "Error"', () => {
      const result = error('boom');
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toMatch(/^Error \(ref: [0-9a-f-]+\): boom$/);
      expect(result._meta?.correlationId).toMatch(UUID);
    });

    it('includes tool name and code when provided', () => {
      const result = error('boom', { toolName: 'get-accounts', code: 'budget_not_loaded' });
      expect((result.content[0] as { text: string }).text).toMatch(
        /^Error in get-accounts \[budget_not_loaded\] \(ref: [0-9a-f-]+\): boom$/
      );
      expect(result._meta).toMatchObject({ code: 'budget_not_loaded', tool: 'get-accounts' });
      expect(result._meta?.correlationId).toMatch(UUID);
    });

    it('generates a unique correlation id for each error', () => {
      const a = error('boom');
      const b = error('boom');
      expect(a._meta?.correlationId).not.toBe(b._meta?.correlationId);
    });

    it('uses the same correlation id in the text and _meta', () => {
      const result = error('boom', { toolName: 'get-accounts' });
      const id = result._meta?.correlationId as string;
      expect((result.content[0] as { text: string }).text).toContain(`ref: ${id}`);
    });

    it('logs the correlation id and message to the server console', () => {
      const result = error('boom', { toolName: 'get-accounts', code: 'auth_required' });
      const id = result._meta?.correlationId as string;
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(id));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });
  });

  describe('normalizeError', () => {
    it('extracts message and name from Error instances', () => {
      const err = new TypeError('bad type');
      expect(normalizeError(err)).toMatchObject({
        message: 'bad type',
        name: 'TypeError',
      });
    });

    it('passes through string errors verbatim', () => {
      expect(normalizeError('plain string')).toEqual({ message: 'plain string' });
    });

    it('extracts message and code from plain objects', () => {
      const result = normalizeError({ message: 'auth failed', code: 'auth_required' });
      expect(result).toEqual({ message: 'auth failed', code: 'auth_required' });
    });

    it('serializes objects with no recognized string fields to JSON', () => {
      const result = normalizeError({ status: 500, foo: 'bar' });
      expect(result.message).toBe('{"status":500,"foo":"bar"}');
    });

    it('returns a descriptive fallback for empty objects', () => {
      const result = normalizeError({});
      expect(result.message).toBe('Unknown error (non-serializable object thrown)');
    });

    it('handles null and undefined', () => {
      expect(normalizeError(null)).toEqual({ message: 'null' });
      expect(normalizeError(undefined)).toEqual({ message: 'undefined' });
    });

    it('handles non-serializable objects without throwing', () => {
      const circular: Record<string, unknown> = { foo: 'bar' };
      circular.self = circular;
      const result = normalizeError(circular);
      expect(result.message).toMatch(/Unknown error|foo/);
    });

    it('prefers "reason" or "error" when message is absent', () => {
      expect(normalizeError({ reason: 'rejected' })).toMatchObject({ message: 'rejected' });
      expect(normalizeError({ error: 'broke' })).toMatchObject({ message: 'broke' });
    });

    it('preserves name and stack from non-Error objects', () => {
      const result = normalizeError({ message: 'boom', name: 'CustomError', stack: 'CustomError: boom\n  at x' });
      expect(result).toMatchObject({ message: 'boom', name: 'CustomError', stack: 'CustomError: boom\n  at x' });
    });
  });

  describe('errorFromCatch', () => {
    it('produces a useful message for Error instances', () => {
      const result = errorFromCatch(new Error('boom'));
      expect((result.content[0] as { text: string }).text).toMatch(/^Error \(ref: [0-9a-f-]+\): boom$/);
      expect(result.isError).toBe(true);
    });

    it('logs the stack under the same correlation id', () => {
      const result = errorFromCatch(new Error('boom'));
      const id = result._meta?.correlationId as string;
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`[${id}] stack:`));
    });

    it('logs the stack from a thrown plain object under the same correlation id', () => {
      const result = errorFromCatch({ message: 'boom', stack: 'CustomError: boom\n  at x' });
      const id = result._meta?.correlationId as string;
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`[${id}] stack: CustomError: boom`));
    });

    it('never produces "[object Object]" for plain object rejections', () => {
      const result = errorFromCatch({ message: 'something failed', code: 'upstream' });
      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('[object Object]');
      expect(text).toContain('something failed');
    });

    it('serializes anonymous object rejections to JSON', () => {
      const result = errorFromCatch({ status: 500, foo: 'bar' });
      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('[object Object]');
      expect(text).toContain('foo');
    });

    it('attaches tool name from context', () => {
      const result = errorFromCatch(new Error('boom'), { toolName: 'get-accounts' });
      expect((result.content[0] as { text: string }).text).toMatch(/^Error in get-accounts \(ref: [0-9a-f-]+\): boom$/);
      expect(result._meta).toMatchObject({ tool: 'get-accounts' });
      expect(result._meta?.correlationId).toMatch(UUID);
    });

    it('lifts the code from the thrown object into the response', () => {
      const result = errorFromCatch({ message: 'auth failed', code: 'auth_required' }, { toolName: 'get-accounts' });
      expect((result.content[0] as { text: string }).text).toMatch(
        /^Error in get-accounts \[auth_required\] \(ref: [0-9a-f-]+\): auth failed$/
      );
      expect(result._meta).toMatchObject({ code: 'auth_required', tool: 'get-accounts' });
      expect(result._meta?.correlationId).toMatch(UUID);
    });
  });
});
