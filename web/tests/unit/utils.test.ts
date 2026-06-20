import { describe, test, expect, vi } from 'vitest';
import { debounce } from '$lib/utils/debounce';
import { estimateTokens } from '$lib/core/tokenize';
import { stringHash } from '$lib/utils/hash';

describe('debounce', () => {
  test('delays invocation', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  test('collapses rapid calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(); d(); d();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  test('passes latest args', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d('b');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('b');
    vi.useRealTimers();
  });

  test('cancel prevents call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('estimateTokens', () => {
  test('roughly chars / 3.35', () => {
    expect(estimateTokens('a'.repeat(335))).toBeCloseTo(100, -1);
  });

  test('empty string is zero', () => {
    expect(estimateTokens('')).toBe(0);
  });

  test('floors result', () => {
    expect(Number.isInteger(estimateTokens('hello'))).toBe(true);
  });
});

describe('stringHash', () => {
  test('deterministic', () => {
    expect(stringHash('hello')).toBe(stringHash('hello'));
  });

  test('differs for different inputs', () => {
    expect(stringHash('a')).not.toBe(stringHash('b'));
  });

  test('returns integer', () => {
    expect(Number.isInteger(stringHash('test'))).toBe(true);
  });
});
