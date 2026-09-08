import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { initializeMemoryDatabase } from './memory/memoryDatabase';
import { MemoryRepository } from './memory/memoryRepository';
import { MemoryService } from './memory/memoryService';
import { registerMemoryIpc } from './memory/memoryIpc';
import { PermissionRepository } from './permissions/permissionRepository';
import { PermissionService } from './permissions/permissionService';
import { registerPermissionIpc } from './permissions/permissionIpc';
import { FileService } from './system/fileService';
import { SystemService } from './system/systemService';
import { registerSystemIpc } from './system/systemIpc';
import { OpenAICompatibleProvider } from './ai/aiProvider';
import { aiConfig } from './ai/aiConfig';
import { ConversationService } from './ai/conversationService';
import { ToolExecutor } from './ai/toolExecutor';
import { registerConversationIpc } from './ai/conversationIpc';
import { MemoryIntelligenceService } from './memory/memoryIntelligenceService';
import { registerMemoryIntelligenceIpc } from './memory/memoryIntelligenceIpc';
import { MockCommunicationProvider } from './communication/mockCommunicationProvider';
import { CommunicationService } from './communication/communicationService';
import { registerCommunicationIpc } from './communication/communicationIpc';
import { AuditService } from './auditService';
import { DiagnosticsService } from './diagnosticsService';
import { registerDiagnosticsIpc } from './diagnosticsIpc';
import { CompanionService } from './companion/companionService';
import { registerCompanionIpc } from './companion/companionIpc';
import { TlsCompanionServer } from './companion/tlsCompanionServer';
import { registerNativeVoiceIpc } from './voice/nativeVoiceIpc';

const isDevelopment = process.argv.includes('--dev');
let memoryDatabase: ReturnType<typeof initializeMemoryDatabase> | undefined;
let developmentVerifiedSession = false;
let dashboardWindow: BrowserWindow | undefined;
let overlayWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let assistantActive = false;
let quitting = false;
let latestAssistantState = { state: 'idle', amplitude: 0 };
let nativeSpeechProcess: ChildProcessWithoutNullStreams | undefined;
let disposeNativeVoiceIpc: (() => void) | undefined;

function nativeSpeechScriptPath(): string {
  return isDevelopment ? path.join(__dirname, '../../scripts/windows_speech.ps1') : path.join(process.resourcesPath, 'scripts/windows_speech.ps1');
}

function nativeSpeechAvailable(): boolean {
  return process.platform === 'win32';
}

function broadcastNativeSpeechError(message: string): void {
  dashboardWindow?.webContents.send('voice:native-error', message);
  overlayWindow?.webContents.send('voice:native-error', message);
}

function stopNativeSpeech(): void {
  if (!nativeSpeechProcess) return;
  try { nativeSpeechProcess.stdin.write('STOP\n'); } catch {}
  setTimeout(() => { if (nativeSpeechProcess && !nativeSpeechProcess.killed) nativeSpeechProcess.kill(); nativeSpeechProcess = undefined; }, 500);
}

function startNativeSpeech(): Promise<void> {
  if (!nativeSpeechAvailable()) return Promise.reject(new Error('Native Windows speech is unavailable on this platform.'));
  if (nativeSpeechProcess) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', nativeSpeechScriptPath()], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    nativeSpeechProcess = child;
    let settled = false;
    let buffer = '';
    const fail = (message: string): void => { if (!settled) { settled = true; reject(new Error(message)); } broadcastNativeSpeechError(message); };
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line === 'READY') { if (!settled) { settled = true; resolve(); } continue; }
        if (line.startsWith('FINAL\t')) {
          const transcript = line.slice(6).trim();
          if (transcript) { dashboardWindow?.webContents.send('voice:native-final', transcript); overlayWindow?.webContents.send('voice:native-final', transcript); }
        } else if (line.startsWith('ERROR\t')) fail(line.slice(6).trim() || 'Windows speech recognition failed.');
      }
    });
    child.stderr.on('data', (chunk: Buffer) => broadcastNativeSpeechError(chunk.toString('utf8').trim()));
    child.on('error', (error) => { nativeSpeechProcess = undefined; fail(error.message); });
    child.on('exit', (code) => { if (nativeSpeechProcess === child) nativeSpeechProcess = undefined; if (!settled && code !== 0) fail(`Windows speech helper exited with code ${code ?? 'unknown'}.`); });
  });
}

function createDashboardWindow(): BrowserWindow {
  const window = new BrowserWindow({ width: 1200, height: 800, minWidth: 960, minHeight: 640, backgroundColor: '#101820', show: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } });
  if (isDevelopment) void window.loadURL('http://localhost:5173'); else void window.loadFile(path.join(__dirname, '../../dist/index.html'));
  window.on('close', (event) => { if (!quitting) { event.preventDefault(); window.hide(); } });
  window.on('closed', () => { dashboardWindow = undefined; });
  dashboardWindow = window;
  return window;
}

function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({ width: 360, height: 360, frame: false, transparent: true, hasShadow: false, resizable: false, movable: false, focusable: false, alwaysOnTop: false, skipTaskbar: true, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } });
  if (isDevelopment) void window.loadURL('http://localhost:5173/?overlay=1'); else void window.loadFile(path.join(__dirname, '../../dist/index.html'), { query: { overlay: '1' } });
  window.webContents.on('did-finish-load', () => window.webContents.send('assistant:state', latestAssistantState));
  window.on('closed', () => { overlayWindow = undefined; assistantActive = false; });
  return window;
}

function showAssistant(): void {
  overlayWindow ??= createOverlayWindow();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const bounds = overlayWindow.getBounds();
  overlayWindow.setPosition(Math.round(display.bounds.x + (display.bounds.width - bounds.width) / 2), Math.round(display.bounds.y + (display.bounds.height - bounds.height) / 2));
  assistantActive = true;
  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.webContents.send('assistant:state', latestAssistantState);
  overlayWindow.showInactive();
}

function hideAssistant(): void { assistantActive = false; overlayWindow?.setAlwaysOnTop(false); overlayWindow?.hide(); }

function createTray(): void {
  const icon = nativeImage.createFromDataURL('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="%23101820"/><path d="M8 8h16v4H12v4h9v4h-9v4h12v4H8z" fill="%239ed8ce"/></svg>');
  tray = new Tray(icon);
  tray.setToolTip('Tesh');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Activate Tesh', click: () => { dashboardWindow?.webContents.send('assistant:activate'); showAssistant(); } }, { label: 'Open Tesh Dashboard', click: () => { dashboardWindow?.show(); dashboardWindow?.focus(); } }, { label: 'Pause Voice Activation', type: 'checkbox', checked: false, click: (item) => dashboardWindow?.webContents.send('assistant:voice-pause', item.checked) }, { label: 'Settings', click: () => { dashboardWindow?.show(); dashboardWindow?.focus(); } }, { type: 'separator' }, { label: 'Quit Tesh', click: () => { quitting = true; app.quit(); } }]));
  tray.on('double-click', () => { dashboardWindow?.show(); dashboardWindow?.focus(); });
}

ipcMain.handle('runtime:get-status', () => ({ platform: process.platform, appVersion: app.getVersion(), isPackaged: app.isPackaged }));
ipcMain.handle('assistant:show', () => showAssistant());
ipcMain.handle('assistant:hide', () => hideAssistant());
ipcMain.handle('assistant:update-state', (_event, value: { state: string; amplitude: number }) => { latestAssistantState = value; overlayWindow?.webContents.send('assistant:state', value); if (assistantActive && value.state === 'idle') setTimeout(hideAssistant, 900); });
ipcMain.handle('voice:native-available', () => nativeSpeechAvailable());
ipcMain.handle('voice:native-start', () => startNativeSpeech());
ipcMain.handle('voice:native-stop', () => { stopNativeSpeech(); });

app.whenReady().then(() => {
  app.setAppUserModelId('com.tesh.desktop');
  memoryDatabase = initializeMemoryDatabase(path.join(app.getPath('userData'), 'tesh-memory.sqlite'));
  const audit = new AuditService(memoryDatabase.connection);
  const diagnostics = new DiagnosticsService(audit);
  const memoryService = new MemoryService(new MemoryRepository(memoryDatabase.connection), (event, memoryId) => { audit.record(event, memoryId); });
  registerMemoryIpc(memoryService);
  const permissionService = new PermissionService(new PermissionRepository(memoryDatabase.connection), (event, permissionId) => { audit.record(event, permissionId); });
  registerPermissionIpc(permissionService);
  registerSystemIpc(new FileService(permissionService, () => developmentVerifiedSession, (event, resource) => audit.record(event, resource)), new SystemService(app.getVersion(), permissionService, () => developmentVerifiedSession, (event) => audit.record(event)), (verified) => { if (isDevelopment) developmentVerifiedSession = verified; });
  const files = new FileService(permissionService, () => developmentVerifiedSession, (event, resource) => audit.record(event, resource));
  const system = new SystemService(app.getVersion(), permissionService, () => developmentVerifiedSession, (event) => audit.record(event));
  const memoryIntelligence = new MemoryIntelligenceService(memoryDatabase.connection, memoryService, permissionService, (event) => audit.record(event));
  const communication = new CommunicationService(new MockCommunicationProvider(), permissionService, () => developmentVerifiedSession, (event) => audit.record(event));
  registerConversationIpc(new ConversationService(new OpenAICompatibleProvider(aiConfig, process.env.TESH_AI_API_KEY, () => diagnostics.shouldFail('AI')), new ToolExecutor(files, system, communication), async (query) => { if (diagnostics.shouldFail('MEMORY')) throw new Error('Development memory failure.'); return memoryIntelligence.retrieveRelevant(query); }));
  registerMemoryIntelligenceIpc(memoryIntelligence);
  registerCommunicationIpc(communication);
  registerDiagnosticsIpc(diagnostics, isDevelopment);
  const companion = new CompanionService(memoryDatabase.connection, audit, (command) => developmentVerifiedSession && permissionService.authorizeAction({ capabilityId: command === 'FILE_READ' ? 'file.read' : 'system.diagnostics', resource: 'companion' }).result === 'ALLOWED');
  registerCompanionIpc(companion, isDevelopment);
  if (process.env.TESH_COMPANION_TLS_CERT && process.env.TESH_COMPANION_TLS_KEY) { const companionServer = new TlsCompanionServer(companion, audit); void companionServer.start({ certificate: process.env.TESH_COMPANION_TLS_CERT, privateKey: process.env.TESH_COMPANION_TLS_KEY, host: process.env.TESH_COMPANION_BIND_HOST ?? '127.0.0.1', port: Number(process.env.TESH_COMPANION_PORT ?? 0) }); }
  createTray();
  disposeNativeVoiceIpc = registerNativeVoiceIpc(() => dashboardWindow);
  createDashboardWindow();
  if (isDevelopment) globalShortcut.register('CommandOrControl+Shift+Space', () => { showAssistant(); dashboardWindow?.webContents.send('assistant:activate'); });
  app.on('activate', () => { dashboardWindow?.show(); });
});

app.on('will-quit', () => { quitting = true; stopNativeSpeech(); disposeNativeVoiceIpc?.(); globalShortcut.unregisterAll(); tray?.destroy(); memoryDatabase?.close(); });
app.on('window-all-closed', () => {});
