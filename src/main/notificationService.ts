import { Notification } from 'electron';
import type { AuditService } from './auditService';

export interface NotificationInput { title: string; body: string; silent?: boolean; }
export class NotificationService {
  constructor(private readonly audit: AuditService) {}
  show(input: NotificationInput): void {
    const title = input.title.trim().slice(0, 120); const body = input.body.trim().slice(0, 2000);
    if (!title || !body) throw new Error('Notification content is invalid.');
    if (!Notification.isSupported()) { this.audit.record('NOTIFICATION_UNAVAILABLE'); return; }
    const notification = new Notification({ title, body, silent: Boolean(input.silent) }); notification.show(); this.audit.record('NOTIFICATION_SHOWN', title);
  }
}
