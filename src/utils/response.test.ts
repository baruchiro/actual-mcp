import { describe, it, expect } from 'vitest';
import { error, errorFromCatch, normalizeError, success, successWithJson } from './response.js';

describe('response utilities', () => {
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
      expect((result.content[0] as { text: string }).text).toBe('Error: boom');
      expect(result._meta).toBeUndefined();
    });

    it('includes tool name and code when provided', () => {
      const result = error('boom', { toolName: 'get-accounts', code: 'budget_not_loaded' });
      expect((result.content[0] as { text: string }).text).toBe('Error in get-accounts [budget_not_loaded]: boom');
      expect(result._meta).toEqual({ code: 'budget_not_loaded', tool: 'get-accounts' });
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
  });

  describe('errorFromCatch', () => {
    it('produces a useful message for Error instances', () => {
      const result = errorFromCatch(new Error('boom'));
      expect((result.content[0] as { text: string }).text).toBe('Error: boom');
      expect(result.isError).toBe(true);
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
      expect((result.content[0] as { text: string }).text).toBe('Error in get-accounts: boom');
      expect(result._meta).toEqual({ tool: 'get-accounts' });
    });

    it('lifts the code from the thrown object into the response', () => {
      const result = errorFromCatch({ message: 'auth failed', code: 'auth_required' }, { toolName: 'get-accounts' });
      expect((result.content[0] as { text: string }).text).toBe('Error in get-accounts [auth_required]: auth failed');
      expect(result._meta).toEqual({ code: 'auth_required', tool: 'get-accounts' });
    });
  });
});
