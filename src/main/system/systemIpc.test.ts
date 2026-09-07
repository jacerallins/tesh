import { describe, expect, it } from 'vitest';
import { validateCreateInput, validateDeleteInput, validateMoveInput, validatePath, validateSearchInput } from './systemIpc';

describe('system IPC validation', () => {
  it('requires bounded string paths and structured payloads', () => {
    expect(validatePath('C:\\Users\\User\\readme.md')).toContain('readme.md');
    expect(() => validatePath('')).toThrow();
    expect(() => validatePath({})).toThrow();
    expect(() => validateCreateInput({ path: 'x' })).toThrow();
    expect(validateMoveInput({ source: 'a', destination: 'b' }).confirmed).toBe(false);
    expect(validateDeleteInput({ path: 'a', confirmed: true }).confirmed).toBe(true);
  });

  it('bounds search options and rejects arbitrary extension payloads', () => {
    expect(validateSearchInput({ root: 'C:\\Users', query: 'readme', limit: 10 }).limit).toBe(10);
    expect(() => validateSearchInput({ root: 'C:\\Users', extensions: ['x'.repeat(21)] })).toThrow();
    expect(() => validateSearchInput({ root: 'C:\\Users', extensions: ['.md'], limit: 'all' })).toThrow();
  });
});