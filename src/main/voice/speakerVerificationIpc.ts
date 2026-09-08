import { dialog, ipcMain } from 'electron';
import type { NativeSpeakerVerificationService } from './nativeSpeakerVerificationService';

export function registerSpeakerVerificationIpc(service: NativeSpeakerVerificationService): void {
  ipcMain.handle('voice:speaker-configured', () => service.isConfigured());
  ipcMain.handle('voice:speaker-enrolled', () => service.isEnrolled());
  ipcMain.handle('voice:speaker-clear', async () => { await service.clearEnrollment(); });
  ipcMain.handle('voice:speaker-verify', async () => service.verify());
  ipcMain.handle('voice:speaker-enroll-files', async () => {
    if (!service.isConfigured()) return { enrolled: false, message: 'Speaker verification is not configured. Set TESH_SPEAKER_MODEL first.' };
    const result = await dialog.showOpenDialog({
      title: 'Choose Tesh voice enrollment recordings',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio recordings', extensions: ['m4a', 'wav', 'mp3', 'flac', 'ogg', 'aac'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { enrolled: false, message: 'Enrollment cancelled.' };
    if (result.filePaths.length > 10) return { enrolled: false, message: 'Choose no more than 10 recordings.' };
    try {
      await service.enrollFromAudioFiles(result.filePaths);
      return { enrolled: true, message: `${result.filePaths.length} voice recording${result.filePaths.length === 1 ? '' : 's'} enrolled.` };
    } catch (error) {
      return { enrolled: false, message: error instanceof Error ? error.message : 'Voice enrollment failed.' };
    }
  });
}
