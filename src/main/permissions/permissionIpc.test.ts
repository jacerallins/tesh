import { describe, expect, it } from 'vitest';
import { validateAuthorization, validateDuration, validatePermissionType } from './permissionIpc';

describe('permission IPC validation', () => {
  it('accepts known permission values and rejects arbitrary values', () => {
    expect(validatePermissionType('MEMORY_ACCESS')).toBe('MEMORY_ACCESS');
    expect(() => validatePermissionType('ALL_ACCESS')).toThrow();
    expect(validateDuration('SESSION')).toBe('SESSION');
    expect(() => validateDuration('FOREVER')).toThrow();
  });

  it('validates structured authorization requests', () => {
    expect(validateAuthorization({ capabilityId: 'memory.read', resource: 'local' }).capabilityId).toBe('memory.read');
    expect(() => validateAuthorization({ capabilityId: 42 })).toThrow();
    expect(() => validateAuthorization({ capabilityId: 'memory.read', requestedPermissions: ['ALL'] })).toThrow();
  });
});