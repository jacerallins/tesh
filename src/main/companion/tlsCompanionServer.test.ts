import { describe, expect, it } from 'vitest';
import { initializeMemoryDatabase } from '../memory/memoryDatabase';
import { AuditService } from '../auditService';
import { CompanionService } from './companionService';
import { TlsCompanionServer } from './tlsCompanionServer';

describe('TlsCompanionServer', () => {
  it('refuses to start without explicit TLS credentials', async () => {
    const database = initializeMemoryDatabase(':memory:');
    const audit = new AuditService(database.connection);
    const server = new TlsCompanionServer(new CompanionService(database.connection, audit), audit);
    await expect(server.start({ certificate: '', privateKey: '' })).rejects.toThrow('TLS certificate');
    database.close();
  });
});