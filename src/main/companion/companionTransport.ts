import type { CompanionMessage } from '../../shared/companionTypes';

export interface CompanionTransport { connect: () => Promise<void>; disconnect: () => Promise<void>; send: (message: CompanionMessage) => Promise<void>; receive: (handler: (message: CompanionMessage) => void) => () => void; close: () => Promise<void>; readonly state: 'OFFLINE' | 'CONNECTED'; }

export class LocalDevelopmentTransport implements CompanionTransport {
  private connected = false;
  private readonly handlers = new Set<(message: CompanionMessage) => void>();
  get state(): 'OFFLINE' | 'CONNECTED' { return this.connected ? 'CONNECTED' : 'OFFLINE'; }
  async connect(): Promise<void> { this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  async send(message: CompanionMessage): Promise<void> { if (!this.connected) throw new Error('Companion transport is offline.'); this.handlers.forEach((handler) => handler(message)); }
  receive(handler: (message: CompanionMessage) => void): () => void { this.handlers.add(handler); return () => this.handlers.delete(handler); }
  async close(): Promise<void> { this.handlers.clear(); await this.disconnect(); }
}