import { access, constants, readdir, realpath, rename as fsRename, stat, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type { Stats } from 'node:fs';
import type { FileActionResult, FileCapability, FileCreateInput, FileDeleteInput, FileErrorCode, FileMoveInput, FileSearchOptions, FileSearchResult, FileTextResult } from '../../shared/systemTypes';
import type { PermissionService } from '../permissions/permissionService';

const MAX_TEXT_FILE_SIZE = 1024 * 1024;
const DEFAULT_SEARCH_LIMIT = 100;
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.ts', '.tsx', '.js', '.css', '.html']);
const capabilityIds: Record<FileCapability, string> = { FILE_READ: 'file.read', FILE_DISPLAY: 'file.display', FILE_CREATE: 'file.create', FILE_RENAME: 'file.rename', FILE_MOVE: 'file.move', FILE_DELETE: 'file.delete' };

export class FileServiceError extends Error {
  readonly code: FileErrorCode;
  constructor(code: FileErrorCode, message: string) { super(message); this.name = 'FileServiceError'; this.code = code; }
}

type Audit = (event: string, resource?: string) => void;
type VerifiedSession = () => boolean;
type Trash = (filePath: string) => Promise<void>;

export class FileService {
  constructor(private readonly permissions: PermissionService, private readonly isVerified: VerifiedSession, private readonly audit: Audit = () => undefined, private readonly moveToTrash: Trash = (filePath) => shell.trashItem(filePath)) {}

  async read(filePath: string): Promise<FileTextResult> {
    const canonical = await this.authorizePath(filePath, 'FILE_READ');
    this.requireTextFile(canonical);
    const file = await this.safeStat(canonical);
    if (!file.isFile()) throw new FileServiceError('FILE_ACCESS_DENIED', 'The requested resource is not a file.');
    if (file.size > MAX_TEXT_FILE_SIZE) throw new FileServiceError('FILE_TOO_LARGE', 'The text file exceeds the supported size limit.');
    try {
      const content = await readFile(canonical, 'utf8');
      this.audit('FILE_READ', canonical);
      return { path: canonical, content, size: file.size, meta: this.meta('FILE_READ', canonical, false) };
    } catch { throw new FileServiceError('FILE_ACCESS_DENIED', 'The file could not be read.'); }
  }

  async display(filePath: string): Promise<FileActionResult> {
    const canonical = await this.authorizePath(filePath, 'FILE_DISPLAY');
    this.requireTextFile(canonical);
    if (!(await this.safeStat(canonical)).isFile()) throw new FileServiceError('FILE_ACCESS_DENIED', 'The requested resource is not a file.');
    const result = await shell.openPath(canonical);
    if (result) throw new FileServiceError('FILE_ACCESS_DENIED', 'The file could not be displayed.');
    this.audit('FILE_DISPLAYED', canonical);
    return { path: canonical, meta: this.meta('FILE_DISPLAY', canonical, false) };
  }

  async create(input: FileCreateInput): Promise<FileActionResult> {
    this.requireVerified();
    const canonical = await this.authorizePath(input.path, 'FILE_CREATE', true);
    this.requireTextFile(canonical);
    try { await access(canonical, constants.F_OK); throw new FileServiceError('FILE_ALREADY_EXISTS', 'The destination file already exists.'); } catch (error) { if (error instanceof FileServiceError) throw error; }
    if (Buffer.byteLength(input.content, 'utf8') > MAX_TEXT_FILE_SIZE) throw new FileServiceError('FILE_TOO_LARGE', 'The text file exceeds the supported size limit.');
    try { await writeFile(canonical, input.content, { encoding: 'utf8', flag: 'wx' }); } catch { throw new FileServiceError('FILE_ACCESS_DENIED', 'The file could not be created.'); }
    this.audit('FILE_CREATED', canonical);
    return { path: canonical, meta: this.meta('FILE_CREATE', canonical, false) };
  }

  async rename(input: FileMoveInput): Promise<FileActionResult> { return this.moveInternal(input, 'FILE_RENAME'); }
  async move(input: FileMoveInput): Promise<FileActionResult> { return this.moveInternal(input, 'FILE_MOVE'); }

  async delete(input: FileDeleteInput): Promise<FileActionResult> {
    this.requireVerified();
    const normalized = this.normalize(input.path);
    const canonical = await this.canonicalize(normalized, false);
    this.authorizeOnly(canonical, 'FILE_DELETE', true);
    if (!input.confirmed) throw new FileServiceError('DELETE_REQUIRES_CONFIRMATION', 'Explicit confirmation is required.');
    await this.moveToTrash(canonical);
    this.audit('FILE_MOVED_TO_TRASH', canonical);
    return { path: canonical, mode: 'MOVE_TO_TRASH', meta: this.meta('FILE_DELETE', canonical, true) };
  }

  async search(options: FileSearchOptions): Promise<FileSearchResult[]> {
    this.requireVerified();
    const root = await this.authorizePath(options.root, 'FILE_READ');
    if (!(await this.safeStat(root)).isDirectory()) throw new FileServiceError('FILE_ACCESS_DENIED', 'The search scope is not a directory.');
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_SEARCH_LIMIT, 1), DEFAULT_SEARCH_LIMIT);
    const offset = Math.max(options.offset ?? 0, 0);
    const extensions = new Set((options.extensions ?? []).map((extension) => extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`));
    const found: FileSearchResult[] = [];
    const walk = async (directory: string): Promise<void> => {
      if (found.length >= offset + limit) return;
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (found.length >= offset + limit) return;
        const candidate = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) { await walk(candidate); continue; }
        if (options.query && !entry.name.toLowerCase().includes(options.query.toLowerCase())) continue;
        if (extensions.size && !extensions.has(path.extname(entry.name).toLowerCase())) continue;
        const details = await this.safeStat(candidate);
        found.push({ path: candidate, name: entry.name, size: details.size, isDirectory: false });
      }
    };
    await walk(root);
    this.audit('FILE_SEARCH', root);
    return found.slice(offset, offset + limit);
  }

  private async moveInternal(input: FileMoveInput, capability: 'FILE_RENAME' | 'FILE_MOVE'): Promise<FileActionResult> {
    this.requireVerified();
    const source = await this.authorizePath(input.source, capability);
    const destination = await this.authorizePath(input.destination, capability, true);
    if (source === destination) throw new FileServiceError('INVALID_PATH', 'Source and destination must differ.');
    try { await access(destination, constants.F_OK); throw new FileServiceError('FILE_ALREADY_EXISTS', 'The destination already exists.'); } catch (error) { if (error instanceof FileServiceError) throw error; }
    try { await fsRename(source, destination); } catch { throw new FileServiceError('FILE_ACCESS_DENIED', 'The file operation could not be completed.'); }
    this.audit(capability === 'FILE_RENAME' ? 'FILE_RENAMED' : 'FILE_MOVED', destination);
    return { path: destination, meta: this.meta(capability, destination, false) };
  }

  private async authorizePath(filePath: string, capability: FileCapability, destination = false): Promise<string> {
    this.requireVerified();
    const normalized = this.normalize(filePath);
    const canonical = await this.canonicalize(normalized, destination);
    this.authorizeOnly(canonical, capability);
    return canonical;
  }
  private authorizeOnly(resource: string, capability: FileCapability, confirmed = false): void {
    const result = this.permissions.authorizeAction({ capabilityId: capabilityIds[capability], resource, confirmed });
    if (result.result !== 'ALLOWED') { this.audit('ACTION_DENIED'); throw new FileServiceError('FILE_ACCESS_DENIED', 'The requested file operation is not authorized.'); }
  }
  private async canonicalize(normalized: string, destination: boolean): Promise<string> {
    try {
      if (destination) return path.join(await realpath(path.dirname(normalized)), path.basename(normalized));
      return await realpath(normalized);
    } catch (error) { if (!destination) throw new FileServiceError('FILE_NOT_FOUND', 'The requested file was not found.'); throw new FileServiceError('FILE_OUTSIDE_SCOPE', 'The destination is not an authorized path.'); }
  }
  private normalize(filePath: string): string { if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || filePath.includes('\0')) throw new FileServiceError('INVALID_PATH', 'An absolute normalized path is required.'); return path.normalize(filePath); }
  private requireVerified(): void { if (!this.isVerified()) throw new FileServiceError('FILE_ACCESS_DENIED', 'The requested operation is not authorized.'); }
  private requireTextFile(filePath: string): void { if (!TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) throw new FileServiceError('UNSUPPORTED_FILE', 'This file type is not supported as text.'); }
  private async safeStat(filePath: string): Promise<Stats> { try { return await stat(filePath); } catch { throw new FileServiceError('FILE_NOT_FOUND', 'The requested file was not found.'); } }
  private meta(capability: FileCapability, resource: string, confirmationRequired: boolean) { return { capability, permissionResult: 'GRANTED', resourceScope: resource, authorizationResult: 'ALLOWED', confirmationRequired }; }
}