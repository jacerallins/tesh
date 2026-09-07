import { describe, expect, it } from 'vitest';
import { validateCompanionPermission, validatePairInput } from './companionIpc';

describe('companion IPC validation', () => {
  it('accepts bounded pairing data and known device permissions only', () => {
    expect(validatePairInput({ challengeId: 'challenge', code: 'ABCD', name: 'Phone', platform: 'ANDROID', deviceType: 'phone', publicKey: 'public', signature: 'signature' }).platform).toBe('ANDROID');
    expect(validateCompanionPermission('COMPANION_VIEW_STATUS')).toBe('COMPANION_VIEW_STATUS');
    expect(() => validateCompanionPermission('PERMISSION_CHANGE')).toThrow();
    expect(() => validatePairInput({ platform: 'ANDROID' })).toThrow();
  });
});