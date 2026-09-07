import { describe, expect, it } from 'vitest';
import { validateFailureInput } from './diagnosticsIpc';

describe('diagnostics IPC validation', () => {
  it('accepts only known development fault components', () => {
    expect(validateFailureInput('AI', true)).toEqual({ component: 'AI', enabled: true });
    expect(() => validateFailureInput('SHELL', true)).toThrow();
    expect(() => validateFailureInput('AI', 'true')).toThrow();
  });
});