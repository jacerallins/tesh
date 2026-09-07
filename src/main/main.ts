import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import path from 'node:path';
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
import { aiConfig } from './ai/aiConfig';
import { AIRouter } from './ai/aiRouter';
import { ConversationRepository } from './ai/conversationRepository';
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
import { NativeWakeWordService } from './voice/nativeWakeWordService';
import { NativeSpeakerVerificationService } from './voice/nativeSpeakerVerificationService';
import { RoutineService } from './routines/routineService';
import { registerRoutineIpc } from './routines/routineIpc';

const isDevelopment = process.argv.includes('--dev');
let memoryDatabase: ReturnType<typeof initializeMemoryDatabase> | undefined;
let developmentVerifiedSession = false;
let dashboardWindow: BrowserWindow | undefined;
let overlayWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let assistantActive = false;
let quitting = false;
let latestAssistantState = { state: 'idle', amplitude: 0 };
const nativeWake = new NativeWakeWordService();
const nativeSpeaker = new NativeSpeakerVerificationService();

function createDashboardWindow(): BrowserWindow { const window = new BrowserWindow({ width: 1200, height: 800, minWidth: 960, minHeight: 640, backgroundColor: '#101820', show: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } }); if (isDevelopment) void window.loadURL('http://localhost:5173'); else void window.loadFile(path.join(__dirname, '../../dist/index.html')); window.on('close', (event) => { if (!quitting) { event.preventDefault(); window.hide(); } }); window.on('closed', () => { dashboardWindow = undefined; }); dashboardWindow = window; return window; }
function createOverlayWindow(): BrowserWindow { const window = new BrowserWindow({ width: 360, height: 360, frame: false, transparent: true, hasShadow: false, resizable: false, movable: false, focusable: false, alwaysOnTop: false, skipTaskbar: true, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } }); if (isDevelopment) void window.loadURL('http://localhost:5173/?overlay=1'); else void window.loadFile(path.join(__dirname, '../../dist/index.html'), { query: { overlay: '1' } }); window.webContents.on('did-finish-load', () => window.webContents.send('assistant:state', latestAssistantState)); window.on('closed', () => { overlayWindow = undefined; assistantActive = false; }); return window; }
function showAssistant(): void { dashboardWindow?.show(); overlayWindow ??= createOverlayWindow(); const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); const bounds = overlayWindow.getBounds(); overlayWindow.setPosition(Math.round(display.bounds.x + (display.bounds.width - bounds.width) / 2), Math.round(display.bounds.y + (display.bounds.height - bounds.height) / 2)); assistantActive = true; overlayWindow.setAlwaysOnTop(true, 'floating'); overlayWindow.webContents.send('assistant:state', latestAssistantState); overlayWindow.showInactive(); }
function hideAssistant(): void { assistantActive = false; overlayWindow?.setAlwaysOnTop(false); overlayWindow?.hide(); }
function createTray(): void { const icon = nativeImage.createFromDataURL('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="%23101820"/><path d="M8 8h16v4H12v4h9v4h-9v4h12v4H8z" fill="%239ed8ce"/></svg>'); tray = new Tray(icon); tray.setToolTip('Tesh'); tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Activate Tesh', click: () => { showAssistant(); dashboardWindow?.webContents.send('assistant:activate'); } }, { label: 'Open Tesh Dashboard', click: () => { dashboardWindow?.show(); dashboardWindow?.focus(); } }, { label: 'Pause Voice Activation', type: 'checkbox', checked: false, click: (item) => dashboardWindow?.webContents.send('assistant:voice-pause', item.checked) }, { label: 'Settings', click: () => { dashboardWindow?.show(); dashboardWindow?.focus(); } }, { type: 'separator' }, { label: 'Quit Tesh', click: () => { quitting = true; app.quit(); } }])); tray.on('double-click', () => { dashboardWindow?.show(); dashboardWindow?.focus(); }); }

ipcMain.handle('runtime:get-status', () => ({ platform: process.platform, appVersion: app.getVersion(), isPackaged: app.isPackaged }));
ipcMain.handle('assistant:show', () => showAssistant()); ipcMain.handle('assistant:hide', () => hideAssistant());
ipcMain.handle('assistant:update-state', (_event, value: { state: string; amplitude: number }) => { latestAssistantState = value; overlayWindow?.webContents.send('assistant:state', value); if (assistantActive && value.state === 'idle') setTimeout(hideAssistant, 900); });
ipcMain.handle('voice:native-status', () => ({ available: nativeWake.isConfigured(), engine: nativeWake.isConfigured() ? 'openwakeword' : 'unknown', message: nativeWake.isConfigured() ? 'Native wake-word bridge configured.' : 'Set TESH_WAKEWORD_SCRIPT and TESH_WAKEWORD_MODEL.' }));
ipcMain.handle('voice:wake-start', async (_event, phrase: string) => { await nativeWake.start(phrase); nativeWake.onDetected(() => dashboardWindow?.webContents.send('voice:wake-detected')); });
ipcMain.handle('voice:wake-stop', () => nativeWake.stop()); ipcMain.handle('voice:wake-audio', (_event, samples: ArrayBuffer, sampleRate: number) => nativeWake.sendAudio(samples, sampleRate));
ipcMain.handle('voice:speaker-configured', () => nativeSpeaker.isConfigured()); ipcMain.handle('voice:speaker-enrolled', () => nativeSpeaker.isEnrolled()); ipcMain.handle('voice:speaker-enroll', (_event, prompt?: string, sampleCount?: number) => nativeSpeaker.enroll(prompt ?? '', sampleCount ?? 1)); ipcMain.handle('voice:speaker-verify', () => nativeSpeaker.verify()); ipcMain.handle('voice:speaker-clear', () => nativeSpeaker.clearEnrollment());

app.whenReady().then(() => {
  app.setAppUserModelId('com.tesh.desktop');
  memoryDatabase = initializeMemoryDatabase(path.join(app.getPath('userData'), 'tesh-memory.sqlite'));
  const audit = new AuditService(memoryDatabase.connection);
  const diagnostics = new DiagnosticsService(audit);
  const memoryService = new MemoryService(new MemoryRepository(memoryDatabase.connection), (event, memoryId) => audit.record(event, memoryId));
  registerMemoryIpc(memoryService);
  const permissionService = new PermissionService(new PermissionRepository(memoryDatabase.connection), (event, permissionId) => audit.record(event, permissionId));
  registerPermissionIpc(permissionService);
  const files = new FileService(permissionService, () => developmentVerifiedSession, (event, resource) => audit.record(event, resource));
  const system = new SystemService(app.getVersion(), permissionService, () => developmentVerifiedSession, (event) => audit.record(event));
  registerSystemIpc(files, system, (verified) => { if (isDevelopment) developmentVerifiedSession = verified; });
  const memoryIntelligence = new MemoryIntelligenceService(memoryDatabase.connection, memoryService, permissionService, (event) => audit.record(event));
  const communication = new CommunicationService(new MockCommunicationProvider(), permissionService, () => developmentVerifiedSession, (event) => audit.record(event));
  const aiProvider = new AIRouter(aiConfig, process.env.TESH_AI_API_KEY, () => diagnostics.shouldFail('AI'));
  const conversation = new ConversationService(aiProvider, new ToolExecutor(files, system, communication), async (query) => { if (diagnostics.shouldFail('MEMORY')) throw new Error('Development memory failure.'); return memoryIntelligence.retrieveRelevant(query); }, new ConversationRepository(memoryDatabase.connection));
  registerConversationIpc(conversation);
  registerMemoryIntelligenceIpc(memoryIntelligence); registerCommunicationIpc(communication); registerDiagnosticsIpc(diagnostics, isDevelopment);
  const companion = new CompanionService(memoryDatabase.connection, audit, (command) => command === 'get_tesh_status'); registerCompanionIpc(companion, true);
  const routines = new RoutineService(memoryDatabase.connection, audit, async (command) => command === 'get_tesh_status'); registerRoutineIpc(routines);
  if (process.env.TESH_COMPANION_TLS_CERT && process.env.TESH_COMPANION_TLS_KEY) { const companionServer = new TlsCompanionServer(companion, audit); void companionServer.start({ certificate: process.env.TESH_COMPANION_TLS_CERT, privateKey: process.env.TESH_COMPANION_TLS_KEY, host: process.env.TESH_COMPANION_BIND_HOST ?? '0.0.0.0', port: Number(process.env.TESH_COMPANION_PORT ?? 443) }); }
  createTray(); createDashboardWindow(); if (isDevelopment) globalShortcut.register('CommandOrControl+Shift+Space', () => { showAssistant(); dashboardWindow?.webContents.send('assistant:activate'); }); app.on('activate', () => dashboardWindow?.show());
});
app.on('will-quit', () => { quitting = true; globalShortcut.unregisterAll(); tray?.destroy(); void nativeWake.stop(); memoryDatabase?.close(); }); app.on('window-all-closed', () => {});
