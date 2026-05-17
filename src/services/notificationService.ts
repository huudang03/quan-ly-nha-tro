import { DatabaseService } from '../lib/databaseService';
import { DbService } from '../lib/mysqlHelper';

const COLLECTION = 'notifications';

export class NotificationService {
  static async getAllNotifications() {
    return await DatabaseService.getAll(COLLECTION, ['createdAt', 'desc']);
  }

  static async createNotification(data: any) {
    const { userId, senderId, title, content, type, isRead, invoiceId, roomId } = data;
    return await DatabaseService.create(COLLECTION, {
      userId,
      senderId: senderId || null,
      title,
      content,
      type: type || 'SYSTEM',
      isRead: !!isRead,
      invoiceId: invoiceId || null,
      roomId: roomId || null,
    });
  }

  static async markAsRead(id: string) {
    return await DatabaseService.update(COLLECTION, id, { isRead: true });
  }

  static async deleteNotification(id: string) {
    await DatabaseService.delete(COLLECTION, id);
    return { id, success: true };
  }

  static async notifyTenant(tenantId: string, title: string, content: string, type: string = 'SYSTEM', extraData: any = {}) {
    try {
      const usersSnap = await DbService.findMany('users', 'tenantId = ?', [tenantId]);
      
      const promises = [];
      usersSnap.forEach(d => {
        promises.push(this.createNotification({
          userId: d.id,
          title,
          content,
          type,
          ...extraData
        }));
      });
      await Promise.all(promises);
    } catch (err) {
      console.error('[NotificationService] notifyTenant error:', err);
    }
  }

  static async notifyRoom(roomId: string, title: string, content: string, type: string = 'SYSTEM', extraData: any = {}) {
    try {
      // 1. Notify by room link in Tenant record
      const room = await DatabaseService.getById<any>('rooms', roomId);
      if (room?.tenantId) {
        await this.notifyTenant(room.tenantId, title, content, type, extraData);
      }

      // 2. Notify all Users who have this roomId in their roomIds array (using user_rooms custom table for many to many)
      const usersSnap = await DbService.query(
        'SELECT u.* FROM users u JOIN user_rooms ur ON u.id = ur.userId WHERE ur.roomId = ?', 
        [roomId]
      );
      
      const promises = [];
      usersSnap.forEach((d: any) => {
        promises.push(this.createNotification({
          userId: d.id,
          title,
          content,
          type,
          ...extraData
        }));
      });
      await Promise.all(promises);
    } catch (err) {
      console.error('[NotificationService] notifyRoom error:', err);
    }
  }
}

