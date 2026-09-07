import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileService, FileServiceError } from './fileService';

describe('FileService', () => {
  let root: string;
  let outside: string;
  let service: FileService;
  let trashed: string[];
  let verified = true;
  let permitted = true;

  beforeEach(async () => {
    verified = true;
    permitted = true;
    root = await mkdtemp(path.join(os.tmpdir(), 'tesh-system-'));
    outside = await mkdtemp(path.join(os.tmpdir(), 'tesh-outside-'));
    await writeFile(path.join(root, 'readme.md'), '# Tesh');
    await writeFile(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2]));
    await writeFile(path.join(root, 'large.txt'), 'x'.repeat(1024 * 1024 + 1));
    trashed = [];
    service = new FileService({ authorizeAction: ({ resource }) => ({ result: permitted && resource.startsWith(root) ? 'ALLOWED' : 'DENIED' }) } as never, () => verified, undefined, async (filePath) => { trashed.push(filePath); });
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); });

  it('requires a verified session before any file access', async () => {
    verified = false;
    await expect(service.read(path.join(root, 'readme.md'))).rejects.toMatchObject({ code: 'FILE_ACCESS_DENIED' });
  });

  it('reads an authorized text file and rejects an unauthorized scope', async () => {
    const result = await service.read(path.join(root, 'readme.md'));
    expect(result.content).toBe('# Tesh');
    await writeFile(path.join(outside, 'secret.txt'), 'secret');
    await expect(service.read(path.join(outside, 'secret.txt'))).rejects.toMatchObject({ code: 'FILE_ACCESS_DENIED' });
  });

  it('rejects traversal into a real outside file and unsupported or oversized files', async () => {
    await writeFile(path.join(outside, 'secret.txt'), 'secret');
    await expect(service.read(path.join(root, '..', path.basename(outside), 'secret.txt'))).rejects.toMatchObject({ code: 'FILE_ACCESS_DENIED' });
    await expect(service.read(path.join(root, 'binary.bin'))).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
    await expect(service.read(path.join(root, 'large.txt'))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('creates without overwriting, moves, and renames within scope', async () => {
    const created = path.join(root, 'created.txt');
    await service.create({ path: created, content: 'hello' });
    expect(await readFile(created, 'utf8')).toBe('hello');
    await expect(service.create({ path: created, content: 'overwrite' })).rejects.toMatchObject({ code: 'FILE_ALREADY_EXISTS' });
    const renamed = path.join(root, 'renamed.txt');
    await service.rename({ source: created, destination: renamed });
    const moved = path.join(root, 'moved.txt');
    await service.move({ source: renamed, destination: moved });
    expect(await readFile(moved, 'utf8')).toBe('hello');
  });

  it('requires confirmation and moves deletes to trash', async () => {
    const filePath = path.join(root, 'readme.md');
    await expect(service.delete({ path: filePath })).rejects.toMatchObject({ code: 'DELETE_REQUIRES_CONFIRMATION' });
    const result = await service.delete({ path: filePath, confirmed: true });
    expect(result.mode).toBe('MOVE_TO_TRASH');
    expect(trashed).toEqual([filePath]);
  });

  it('limits search results to the authorized directory', async () => {
    const results = await service.search({ root, query: '.md', limit: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('readme.md');
  });

  it('does not follow a symlink that could escape scope', async () => {
    await writeFile(path.join(outside, 'secret.txt'), 'secret');
    try { await symlink(path.join(outside, 'secret.txt'), path.join(root, 'link.txt')); } catch { return; }
    await expect(service.read(path.join(root, 'link.txt'))).rejects.toMatchObject({ code: 'FILE_ACCESS_DENIED' });
  });
});