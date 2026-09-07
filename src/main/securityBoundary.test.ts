import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('renderer security boundary', () => {
  it('exposes only the typed Tesh bridge from preload', () => {
    const preload = fs.readFileSync(path.join(__dirname, 'preload.ts'), 'utf8');
    expect(preload).toContain('contextBridge.exposeInMainWorld');
    expect(preload).not.toMatch(/require\(|process\.|child_process|readFile|ipcRenderer\.send\(/);
  });
});