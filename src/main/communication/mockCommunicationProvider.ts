import { randomUUID } from 'node:crypto';
import type { CommunicationProvider, Contact } from '../../shared/communicationTypes';

export class MockCommunicationProvider implements CommunicationProvider {
  readonly kind = 'MOCK' as const;
  readonly sent: Array<{ recipient: Contact; content: string }> = [];
  private readonly contacts: Contact[] = [
    { id: 'mock-sarah-1', displayName: 'Sarah Chen', provider: 'MOCK', providerContactId: 'sarah-1', metadata: {} },
    { id: 'mock-sarah-2', displayName: 'Sarah Williams', provider: 'MOCK', providerContactId: 'sarah-2', metadata: {} },
    { id: 'mock-jordan', displayName: 'Jordan Lee', provider: 'MOCK', providerContactId: 'jordan', metadata: {} }
  ];
  async getContacts(): Promise<Contact[]> { return this.contacts.map((contact) => ({ ...contact, metadata: { ...contact.metadata } })); }
  async sendMessage(recipient: Contact, content: string): Promise<{ providerMessageId: string }> { this.sent.push({ recipient, content }); return { providerMessageId: randomUUID() }; }
  async cancelSend(): Promise<void> { return Promise.resolve(); }
}