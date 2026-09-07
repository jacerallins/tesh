export interface TeshAIProvider {
  process(input: string, context: unknown): Promise<unknown>;
}
