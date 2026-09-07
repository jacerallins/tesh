import type { TeshBridge } from '../shared/types';

declare global {
  interface Window {
    tesh: TeshBridge;
  }
}

export {};
