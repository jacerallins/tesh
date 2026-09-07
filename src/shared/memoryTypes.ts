export const memoryCategories = ['WORKING', 'PROJECT', 'PREFERENCE', 'GOAL', 'DECISION', 'FACT', 'EPISODIC', 'ARCHIVED', 'ROUTINE', 'COMMUNICATION_STYLE', 'RELATIONSHIP_CONTEXT', 'USER_INSTRUCTION'] as const;
export type MemoryCategory = (typeof memoryCategories)[number];

export const memoryImportanceLevels = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export type MemoryImportance = (typeof memoryImportanceLevels)[number];

export const memorySources = ['USER_PROVIDED', 'USER_EXPLICIT', 'USER_APPROVED', 'SYSTEM', 'PROJECT', 'CONVERSATION', 'IMPORTED', 'DEVELOPMENT'] as const;
export type MemorySource = (typeof memorySources)[number];

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  tags: string[];
  projectId?: string;
  archived: boolean;
  metadata: Record<string, string>;
}

export type MemoryEventType = 'MEMORY_CREATED' | 'MEMORY_UPDATED' | 'MEMORY_DELETED' | 'MEMORY_ARCHIVED' | 'MEMORY_RESTORED' | 'MEMORY_SEARCHED' | 'MEMORY_CANDIDATE_CREATED' | 'MEMORY_APPROVED' | 'MEMORY_REJECTED' | 'MEMORY_RETRIEVED';

export type MemoryCandidateStatus = 'CANDIDATE' | 'APPROVED' | 'REJECTED';
export type ConversationPrivacy = 'ALLOW_MEMORY' | 'DO_NOT_STORE' | 'TEMPORARY_CONVERSATION';
export interface MemoryCandidate { id: string; content: string; category: MemoryCategory; importance: MemoryImportance; source: MemorySource; sourceConversationId?: string; sourceMessageId?: string; confidence: number; reason: string; status: MemoryCandidateStatus; createdAt: string; }
export interface CommunicationStyleProfile { id: string; source: 'USER_PROVIDED_SAMPLE' | 'USER_APPROVED'; approvalState: 'CANDIDATE' | 'APPROVED'; formality: 'LOW' | 'MEDIUM' | 'HIGH'; verbosity: 'LOW' | 'MEDIUM' | 'HIGH'; punctuationStyle: string; emojiUsage: 'NONE' | 'LOW' | 'HIGH'; greetingStyle: string; closingStyle: string; humorLevel: 'LOW' | 'MEDIUM' | 'HIGH'; commonExpressions: string[]; contactId?: string; createdAt: string; updatedAt: string; }
export interface MemoryCandidateInput { content: string; category: MemoryCategory; importance: MemoryImportance; confidence: number; reason: string; sourceConversationId?: string; sourceMessageId?: string; source?: MemorySource; }
export interface MemoryIntelligenceBridge { createCandidate: (input: MemoryCandidateInput, privacy?: ConversationPrivacy) => Promise<MemoryCandidate | null>; listCandidates: () => Promise<MemoryCandidate[]>; approveCandidate: (id: string) => Promise<Memory>; rejectCandidate: (id: string) => Promise<boolean>; retrieveRelevant: (query: string) => Promise<Memory[]>; createStyleProfile: (input: Omit<CommunicationStyleProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CommunicationStyleProfile>; listStyleProfiles: () => Promise<CommunicationStyleProfile[]>; }

export interface CreateMemoryInput {
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  source: MemorySource;
  tags?: string[];
  projectId?: string;
  metadata?: Record<string, string>;
}

export type UpdateMemoryInput = Partial<Omit<CreateMemoryInput, 'content'>> & { content?: string };

export interface ListMemoriesOptions {
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchMemoriesOptions extends ListMemoriesOptions {
  query: string;
}

export interface MemoryBridge {
  create: (input: CreateMemoryInput) => Promise<Memory>;
  get: (id: string) => Promise<Memory | null>;
  update: (id: string, input: UpdateMemoryInput) => Promise<Memory>;
  delete: (id: string) => Promise<boolean>;
  list: (options?: ListMemoriesOptions) => Promise<Memory[]>;
  search: (options: SearchMemoriesOptions) => Promise<Memory[]>;
  archive: (id: string) => Promise<Memory>;
  restore: (id: string) => Promise<Memory>;
  intelligence: MemoryIntelligenceBridge;
}
