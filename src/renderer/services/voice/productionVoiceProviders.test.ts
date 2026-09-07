import { describe, expect, it } from 'vitest';
import { ProductionSpeakerVerificationProvider } from './productionSpeakerVerificationProvider';
import { ProductionWakeWordProvider } from './productionWakeWordProvider';

describe('production voice provider boundaries', () => {
  it('never claims a production speaker is enrolled or verified', async () => {
    const provider = new ProductionSpeakerVerificationProvider();
    await expect(provider.getStatus()).resolves.toBeUndefined();
    await expect(provider.verify()).resolves.toMatchObject({ result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE' });
  });

  it('fails closed when production wake-word detection is unavailable', async () => {
    const provider = new ProductionWakeWordProvider('Tesh Pineapples');
    await expect(provider.start()).rejects.toMatchObject({ code: 'WAKE_WORD_UNAVAILABLE' });
  });
});
