import { app, ipcMain, type BrowserWindow } from 'electron';
import path from 'node:path';
import { NativeSpeakerVerificationService } from './nativeSpeakerVerificationService';
import { NativeWakeWordService } from './nativeWakeWordService';

function resourceScript(relativePath: string): string {
  return app.isPackaged ? path.join(process.resourcesPath, relativePath) : path.join(app.getAppPath(), relativePath);
}

function defaultModel(relativePath: string, envName: string): string | undefined {
  const configured = process.env[envName]?.trim();
  return configured || path.join(app.getPath('userData'), 'models', relativePath);
}

export function registerNativeVoiceIpc(dashboardWindow: () => BrowserWindow | undefined): () => void {
  const wake = new NativeWakeWordService({
    python: process.env.TESH_WAKEWORD_PYTHON ?? 'python',
    script: process.env.TESH_WAKEWORD_SCRIPT ?? resourceScript('scripts/tesh_wakeword.py'),
    model: defaultModel('tesh-wakeword.onnx', 'TESH_WAKEWORD_MODEL'),
    phrase: 'Tesh',
  });
  const speaker = new NativeSpeakerVerificationService({
    executable: process.env.TESH_SPEAKER_PYTHON ?? 'python',
    script: process.env.TESH_SPEAKER_SCRIPT ?? resourceScript('scripts/tesh_speaker.py'),
    model: defaultModel('speaker.onnx', 'TESH_SPEAKER_MODEL') ?? '',
    profile: process.env.TESH_SPEAKER_PROFILE ?? path.join(app.getPath('userData'), 'voice', 'primary-speaker.json'),
  });

  const wakeDetected = wake.onDetected(() => dashboardWindow()?.webContents.send('voice:wake-detected'));
  const wakeError = wake.onError((message) => dashboardWindow()?.webContents.send('voice:wake-error', message));

  ipcMain.handle('voice:wake-status', () => wake.getStatus());
  ipcMain.handle('voice:wake-start', async () => { await wake.start(); });
  ipcMain.handle('voice:wake-stop', async () => { await wake.stop(); });

  ipcMain.handle('voice:speaker-status', () => ({ configured: speaker.isConfigured(), enrolled: speaker.isEnrolled(), profile: speaker.profilePath }));
  ipcMain.handle('voice:speaker-enroll', async (_event, samples: number) => {
    await speaker.enroll(samples);
    return { configured: speaker.isConfigured(), enrolled: speaker.isEnrolled(), profile: speaker.profilePath };
  });
  ipcMain.handle('voice:speaker-verify', async () => speaker.verify());
  ipcMain.handle('voice:speaker-clear', async () => { await speaker.clearEnrollment(); return { configured: speaker.isConfigured(), enrolled: speaker.isEnrolled(), profile: speaker.profilePath }; });

  return () => {
    wakeDetected();
    wakeError();
    void wake.stop();
    ipcMain.removeHandler('voice:wake-status');
    ipcMain.removeHandler('voice:wake-start');
    ipcMain.removeHandler('voice:wake-stop');
    ipcMain.removeHandler('voice:speaker-status');
    ipcMain.removeHandler('voice:speaker-enroll');
    ipcMain.removeHandler('voice:speaker-verify');
    ipcMain.removeHandler('voice:speaker-clear');
  };
}
