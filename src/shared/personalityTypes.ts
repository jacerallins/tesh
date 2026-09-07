export const personalityLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type PersonalityLevel = (typeof personalityLevels)[number];
export interface PersonalityProfile {
  formality: PersonalityLevel;
  warmth: PersonalityLevel;
  humor: PersonalityLevel;
  expressiveness: PersonalityLevel;
  verbosity: PersonalityLevel;
  proactive: PersonalityLevel;
}
export interface PersonalityBridge { get: () => Promise<PersonalityProfile>; update: (input: Partial<PersonalityProfile>) => Promise<PersonalityProfile>; }
