import { DatabaseService } from '../lib/databaseService';
import { DbService } from '../lib/mysqlHelper';

import { Room, UtilityReading, SystemConfig, Invoice, User } from '../types';
import { NotificationService } from './notificationService';

const COLLECTION = 'utility_readings';

export class UtilityService {
  static async getAllReadings() {
    return await DatabaseService.getAll<UtilityReading>(COLLECTION);
  }

  static async createReading(data: any) {
    const { roomId, month, electricityIndex, waterIndex } = data;
    let { previousElectricityIndex, previousWaterIndex, electricityPrice, waterPrice } = data;
    
    // Fetch system config for prices if not provided
    const config = await DatabaseService.getById<SystemConfig>('systemConfigs', 'default') || { electricityPrice: 3500, waterPrice: 15000 } as SystemConfig;
    if (electricityPrice === undefined) electricityPrice = config.electricityPrice;
    if (waterPrice === undefined) waterPrice = config.waterPrice;

    // Fetch previous reading if not provided
    if (previousElectricityIndex === undefined || previousWaterIndex === undefined) {
      const lastReading = await DbService.findOne(COLLECTION, 'roomId = ? AND month < ? ORDER BY month DESC', [roomId, month]);
      if (previousElectricityIndex === undefined) previousElectricityIndex = lastReading?.electricityIndex || 0;
      if (previousWaterIndex === undefined) previousWaterIndex = lastReading?.waterIndex || 0;
    }

    const newReading = await DatabaseService.create<Partial<UtilityReading>>(COLLECTION, {
      roomId,
      month,
      electricityIndex: Number(electricityIndex) || 0,
      waterIndex: Number(waterIndex) || 0,
      previousElectricityIndex: Number(previousElectricityIndex) || 0,
      previousWaterIndex: Number(previousWaterIndex) || 0,
      electricityPrice: Number(electricityPrice) || 0,
      waterPrice: Number(waterPrice) || 0,
    });

    // Side effects: Notifications and Invoice updates
    try {
      const room = await DatabaseService.getById('rooms', roomId);
      const tenantsSnap = await DbService.findMany('tenants', 'roomId = ?', [roomId]);
      const tenantIds = tenantsSnap.map(d => d.id);

      const tenantIdsPlaceholders = tenantIds.length > 0 ? tenantIds.map(() => '?').join(',') : '"_none_"';
      const tenantIdsParams = tenantIds.length > 0 ? tenantIds : [];

      const usersSnap = await DbService.query(
        `SELECT * FROM users WHERE tenantId IN (${tenantIdsPlaceholders}) OR role = 'ADMIN'`,
        tenantIdsParams
      );
      
      const targetUserIds = new Set<string>();
      usersSnap.forEach((d: any) => targetUserIds.add(d.id));

      for (const userId of targetUserIds) {
        await DatabaseService.create('notifications', {
          userId,
          title: 'Chỉ số điện nước mới',
          content: `Chỉ số điện nước tháng ${month} của phòng ${room?.name || roomId} đã được cập nhật.`,
          type: 'SYSTEM',
          isRead: false,
          roomId: roomId,
        });
      }

      // Auto-update or create invoice
      const electricityCost = Math.max(0, (Number(electricityIndex) - Number(previousElectricityIndex)) * Number(electricityPrice));
      const waterCost = Math.max(0, (Number(waterIndex) - Number(previousWaterIndex)) * Number(waterPrice));

      const existingInvoice = await DbService.findOne('invoices', 'roomId = ? AND month = ?', [roomId, month]);

      if (existingInvoice) {
        const newTotal = (existingInvoice.roomPrice || 0) + electricityCost + waterCost + 
                         (existingInvoice.internetCost || 0) + (existingInvoice.trashCost || 0) + (existingInvoice.otherCosts || 0);
        
        await DatabaseService.update<Invoice>('invoices', existingInvoice.id, {
          electricityCost,
          waterCost,
          total: newTotal,
        });
      } else {
        const tenant = tenantsSnap[0];
        if (tenant) {
          const internetCost = config.internetPrice || 0;
          const trashCost = config.trashPrice || 0;
          const otherCosts = 0;
          const actualRoomPrice = room?.price || 0;
          
          const total = actualRoomPrice + electricityCost + waterCost + internetCost + trashCost + otherCosts;
          const dueDate = new Date(`${month}-15`);
          const monthNum = month.split('-')[1];
          const roomNumber = room?.name.match(/\d+/)?.[0] || room?.name || roomId;
          const invoiceCode = `HD${roomNumber}T${monthNum}`;

          await DatabaseService.create<Partial<Invoice>>('invoices', {
            code: invoiceCode,
            roomId: roomId,
            tenantId: tenant.id,
            month,
            roomPrice: actualRoomPrice,
            electricityCost,
            waterCost,
            internetCost,
            trashCost,
            otherCosts,
            total,
            status: 'UNPAID',
            dueDate: dueDate.toISOString(),
          });
        }
      }
    } catch (err) {
      console.error('[UtilityService] Error in side effects:', err);
    }

    return newReading;
  }

  static async updateReading(id: string, data: any) {
    const { roomId, month, electricityIndex, waterIndex, previousElectricityIndex, previousWaterIndex, electricityPrice, waterPrice } = data;
    const updateData: any = {};
    if (roomId !== undefined) updateData.roomId = roomId;
    if (month !== undefined) updateData.month = month;
    if (electricityIndex !== undefined) updateData.electricityIndex = Number(electricityIndex);
    if (waterIndex !== undefined) updateData.waterIndex = Number(waterIndex);
    if (previousElectricityIndex !== undefined) updateData.previousElectricityIndex = Number(previousElectricityIndex);
    if (previousWaterIndex !== undefined) updateData.previousWaterIndex = Number(previousWaterIndex);
    if (electricityPrice !== undefined) updateData.electricityPrice = Number(electricityPrice);
    if (waterPrice !== undefined) updateData.waterPrice = Number(waterPrice);

    const result = await DatabaseService.update<UtilityReading>(COLLECTION, id, updateData);

    // Sync with invoice
    try {
      const reading = await DatabaseService.getById<UtilityReading>(COLLECTION, id);
      if (reading) {
        const finalRoomId = reading.roomId;
        const finalMonth = reading.month;

        const electricityCost = (reading.electricityIndex - (reading.previousElectricityIndex || 0)) * (reading.electricityPrice || 0);
        const waterCost = (reading.waterIndex - (reading.previousWaterIndex || 0)) * (reading.waterPrice || 0);

        const existingInvoice = await DbService.findOne('invoices', 'roomId = ? AND month = ?', [finalRoomId, finalMonth]);

        if (existingInvoice) {
          const newTotal = (existingInvoice.roomPrice || 0) + Math.max(0, electricityCost) + Math.max(0, waterCost) + 
                           (existingInvoice.internetCost || 0) + (existingInvoice.trashCost || 0) + (existingInvoice.otherCosts || 0);
          
          await DatabaseService.update<Invoice>('invoices', existingInvoice.id, {
            electricityCost: Math.max(0, electricityCost),
            waterCost: Math.max(0, waterCost),
            total: newTotal,
          });
        }

        // Notify room tenant
        const room = await DatabaseService.getById<Room>('rooms', finalRoomId);
        await NotificationService.notifyRoom(
          finalRoomId,
          'Cập nhật chỉ số điện nước & hóa đơn',
          `Chủ trọ đã chỉnh sửa chỉ số điện nước tháng ${finalMonth} của phòng ${room?.name || 'bạn'}. Hóa đơn tương ứng đã được cập nhật lại.`,
          'SYSTEM',
          { roomId: finalRoomId }
        );
      }
    } catch (err) {
      console.error('[UtilityService] Error syncing with invoice or notifying:', err);
    }

    return result;
  }

  static async deleteReading(id: string) {
    try {
      const reading = await DatabaseService.getById<UtilityReading>(COLLECTION, id);
      if (reading) {
        const existingInvoice = await DbService.findOne('invoices', 'roomId = ? AND month = ?', [reading.roomId, reading.month]);

        if (existingInvoice) {
          // If reading is deleted, reset utility costs in invoice to 0
          const newTotal = (existingInvoice.roomPrice || 0) + 
                           (existingInvoice.internetCost || 0) + (existingInvoice.trashCost || 0) + (existingInvoice.otherCosts || 0);
          
          await DatabaseService.update<Invoice>('invoices', existingInvoice.id, {
            electricityCost: 0,
            waterCost: 0,
            total: newTotal,
          });
        }
      }
    } catch (err) {
      console.error('[UtilityService] Error during deletion sync:', err);
    }

    await DatabaseService.delete(COLLECTION, id);
    return { id, success: true };
  }
}
