import { DatabaseService } from '../lib/databaseService';

import { NotificationService } from './notificationService';

const COLLECTION = 'rooms';

function normalizeRoomName(name: string): string {
  if (!name) return '';
  // Convert to lowercase, remove "phòng" prefix or "phòng" anywhere if followed by a number/space
  // and trim all spaces
  return name.toLowerCase()
    .replace(/^phòng\s+/, '')
    .replace(/^phòng/, '')
    .trim();
}

export class RoomService {
  static async getAllRooms() {
    return await DatabaseService.getAll(COLLECTION);
  }

  static async createRoom(roomData: any) {
    console.log('[RoomService] createRoom data:', roomData);
    const { name, price, area, status, tenantId, imageUrl, description } = roomData;
    
    // Check if room name already exists (case-insensitive and robust)
    if (name) {
      const normalizedSearchName = normalizeRoomName(name);
      
      const allRooms = await DatabaseService.getAll(COLLECTION);
      const isDuplicate = allRooms.some(r => 
        normalizeRoomName(r.name) === normalizedSearchName || 
        (r.normalizedName && normalizeRoomName(r.normalizedName) === normalizedSearchName)
      );

      if (isDuplicate) {
        throw new Error(`Tên phòng "${name}" đã tồn tại. Hệ thống không cho phép trùng tên phòng.`);
      }
    }

    const numPrice = Number(price) || 0;
    const numArea = Number(area) || 0;

    if (numPrice < 0) throw new Error('Giá thuê không được là số âm');
    if (numArea < 0) throw new Error('Diện tích không được là số âm');

    return await DatabaseService.create(COLLECTION, {
      name: name.trim(),
      normalizedName: name.trim().toLowerCase(),
      price: numPrice,
      area: numArea,
      status: status || 'AVAILABLE',
      tenantId: tenantId || null,
      imageUrl: imageUrl || null,
      description: description || '',
    });
  }

  static async updateRoom(id: string, roomData: any) {
    console.log('[RoomService] updateRoom id:', id, 'data:', roomData);
    const { name, price, area, status, tenantId, imageUrl, description } = roomData;
    
    // Check if new room name already exists (if name is being updated, case-insensitive)
    if (name) {
      const normalizedSearchName = normalizeRoomName(name);
      
      // Fetch all rooms to be absolutely sure
      const allRooms = await DatabaseService.getAll(COLLECTION);
      const isDuplicate = allRooms.some(r => 
        r.id !== id && (
          normalizeRoomName(r.name) === normalizedSearchName || 
          (r.normalizedName && normalizeRoomName(r.normalizedName) === normalizedSearchName)
        )
      );

      if (isDuplicate) {
        throw new Error(`Tên phòng "${name}" đã tồn tại. Hệ thống không cho phép trùng tên phòng.`);
      }
    }

    const numPrice = Number(price) || 0;
    const numArea = Number(area) || 0;

    if (numPrice < 0) throw new Error('Giá thuê không được là số âm');
    if (numArea < 0) throw new Error('Diện tích không được là số âm');

    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name.trim();
      updateData.normalizedName = name.trim().toLowerCase();
    }
    if (price !== undefined) updateData.price = numPrice;
    if (area !== undefined) updateData.area = numArea;
    if (status !== undefined) updateData.status = status;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (description !== undefined) updateData.description = description;
    if (tenantId !== undefined) updateData.tenantId = tenantId || null;
    updateData.updatedAt = new Date();
    
    const result = await DatabaseService.update(COLLECTION, id, updateData);

    // Notify current tenant if there is one
    const currentRoom = await DatabaseService.getById<any>(COLLECTION, id);
    if (currentRoom?.tenantId) {
      await NotificationService.notifyTenant(
        currentRoom.tenantId,
        'Thông tin phòng đã thay đổi',
        `Chủ trọ đã cập nhật thông tin phòng ${currentRoom.name}. Vui lòng kiểm tra lại.`,
        'SYSTEM',
        { roomId: id }
      );
    }
    
    // Also notify the entire room (all users linked to this roomId)
    await NotificationService.notifyRoom(
      id,
      'Cập nhật thông tin phòng',
      `Chủ trọ đã cập nhật thông tin cài đặt của phòng ${currentRoom?.name || 'bạn'}.`,
      'SYSTEM',
      { roomId: id }
    );

    return result;
  }

  static async deleteRoom(id: string) {
    await DatabaseService.delete(COLLECTION, id);
    return { id, success: true };
  }
}
