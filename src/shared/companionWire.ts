import type { CompanionMessage } from './companionTypes';

const messageTypes = ['PAIRING_CHALLENGE_REQUEST', 'PAIRING_CHALLENGE_RESPONSE', 'PAIR_REQUEST', 'PAIR_RESPONSE', 'AUTH_REQUEST', 'AUTH_RESPONSE', 'PING', 'PONG', 'STATE_UPDATE', 'COMMAND_REQUEST', 'COMMAND_RESPONSE', 'ERROR'] as const;

export function parseCompanionMessage(value: unknown): CompanionMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Companion message is malformed.');
  const message = value as Record<string, unknown>;
  if (typeof message.messageId !== 'string' || typeof message.deviceId !== 'string' || typeof message.type !== 'string' || typeof message.timestamp !== 'string' || typeof message.requestId !== 'string' || !message.payload || typeof message.payload !== 'object' || !messageTypes.includes(message.type as typeof messageTypes[number])) throw new Error('Companion message is malformed.');
  return message as unknown as CompanionMessage;
}

export function encodeCompanionMessage(message: CompanionMessage): string { return `${JSON.stringify(message)}\n`; }