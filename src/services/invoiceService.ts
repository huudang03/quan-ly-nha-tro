import { DatabaseService } from '../lib/databaseService';
import { DbService } from '../lib/mysqlHelper';

import { Room, Invoice, UtilityReading, SystemConfig } from '../types';

const COLLECTION = 'invoices';

export class InvoiceService {
  static async createInvoice(invoiceData: any) {
    const { 
      code, roomId, month, roomPrice, electricityCost, 
      waterCost, internetCost, trashCost, otherCosts, total, status, dueDate 
    } = invoiceData;
    let { tenantId } = invoiceData;

    // Validate month format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('Invalid month format. Use YYYY-MM');
    }

    const room = await DatabaseService.getById<Room>('rooms', roomId);
    if (!room) throw new Error('Room not found');

    const existing = await DbService.findOne(COLLECTION, 'roomId = ? AND month = ?', [roomId, month]);
    
    if (existing) {
      const [year, monthVal] = month.split('-');
      throw new Error(`Hóa đơn cho phòng ${room.name} trong tháng ${monthVal}/${year} đã tồn tại trên hệ thống.`);
    }

    if (!tenantId) {
      tenantId = room.tenantId;
    }
    if (!tenantId) throw new Error('Room has no tenant');

    const monthNum = month.split('-')[1];
    const roomNumber = room?.name.match(/\d+/)?.[0] || room?.name || roomId;
    const ranCode = Math.floor(100 + Math.random() * 900);
    const generatedCode = code || `TROTIEN${roomNumber}T${monthNum}${ranCode}`;

    // Calculate total if not provided
    let finalTotal = Number(total);
    const config = await DatabaseService.getById<SystemConfig>('systemConfigs', 'default') || { internetPrice: 100000, trashPrice: 20000 } as SystemConfig;
    
    const actualRoomPrice = roomPrice !== undefined ? Number(roomPrice) : (room.price || 0);
    const actualElecCost = electricityCost !== undefined ? Number(electricityCost) : 0;
    const actualWaterCost = waterCost !== undefined ? Number(waterCost) : 0;
    const actualInternetCost = internetCost !== undefined ? Number(internetCost) : (config.internetPrice || 0);
    const actualTrashCost = trashCost !== undefined ? Number(trashCost) : (config.trashPrice || 0);
    const actualOtherCosts = otherCosts !== undefined ? Number(otherCosts) : 0;

    if (!finalTotal) {
      finalTotal = actualRoomPrice + actualElecCost + actualWaterCost + actualInternetCost + actualTrashCost + actualOtherCosts;
    }

    const newInvoice = await DatabaseService.create<Partial<Invoice>>(COLLECTION, {
      code: generatedCode,
      roomId: roomId,
      tenantId,
      month,
      roomPrice: actualRoomPrice,
      electricityCost: actualElecCost,
      waterCost: actualWaterCost,
      internetCost: actualInternetCost,
      trashCost: actualTrashCost,
      otherCosts: actualOtherCosts,
      total: finalTotal,
      status: status || 'UNPAID',
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
    });

    // Create notifications
    try {
      const usersSnap = await DbService.findMany('users', 'tenantId = ? OR role = "ADMIN"', [tenantId]);
      
      const targetUserIds = new Set<string>();
      usersSnap.forEach(d => targetUserIds.add(d.id));

      for (const userId of targetUserIds) {
        await DatabaseService.create('notifications', {
          userId,
          title: `Hóa đơn mới tháng ${month}`,
          content: `Hóa đơn mới cho phòng ${room?.name || roomId} đã được tạo. Vui lòng thanh toán.`,
          type: 'INVOICE',
          isRead: false,
          invoiceId: newInvoice.id,
        });
      }
    } catch (err) {
      console.error('[InvoiceService] Error in side effects:', err);
    }

    return newInvoice;
  }

  static async updatePaymentStatusByCode(code: string, amount: number, transactionId?: string) {
    if (amount <= 0) throw new Error('Invalid payment amount');

    // Mẫu TROTIEN101T05123 hoặc HD101T05
    const invoice = await DbService.findOne(COLLECTION, 'code = ? AND status = "UNPAID"', [code]);

    if (!invoice) {
        // Invoice already paid or doesn't exist. We return null to skip without error 500.
        return null;
    }

    await DbService.update(COLLECTION, invoice.id, { status: 'PAID', transactionId: transactionId || null });
    
    // Tìm room name
    const room = await DbService.getById('rooms', invoice.roomId);

    console.log(`[WEBHOOK SUCCESS] Updated invoice ${invoice.id} for Room ${room?.name || invoice.roomId} to PAID. Tx: ${transactionId}`);
    return { roomId: invoice.roomId, roomName: room?.name, month: invoice.month, invoiceId: invoice.id };
  }

  static async updatePaymentStatus(roomName: string, month: string, amount: number) {
    if (amount <= 0) throw new Error('Invalid payment amount');

    const room = await DatabaseService.findOne<Room>('rooms', ['name', '==', roomName]);
    if (!room) {
      throw new Error(`Room not found: ${roomName}`);
    }

    const invoice = await DbService.findOne(COLLECTION, 'roomId = ? AND month = ? AND status = "UNPAID"', [room.id, month]);

    if (!invoice) {
      console.log(`[WEBHOOK] No unpaid invoice found for Room ${roomName} and Month ${month}`);
      return null;
    }

    await DatabaseService.update<Invoice>(COLLECTION, invoice.id, { status: 'PAID' });

    console.log(`[WEBHOOK SUCCESS] Updated invoice ${invoice.id} for Room ${roomName} to PAID`);
    return { roomId: room.id, roomName, month, invoiceId: invoice.id };
  }

  static async generateInvoices(month: string) {
    const rooms = await DbService.findMany('rooms', 'status = "OCCUPIED"', []);
    const config = await DatabaseService.getById<SystemConfig>('systemConfigs', 'default') || { internetPrice: 100000, trashPrice: 20000 } as SystemConfig;
    
    let generatedCount = 0;

    for (const room of rooms) {
      if (!room.tenantId) continue;

      const existing = await DbService.findOne(COLLECTION, 'roomId = ? AND month = ?', [room.id, month]);
      if (existing) continue;

      const reading = await DbService.findOne('utility_readings', 'roomId = ? AND month = ?', [room.id, month]);
      
      let elecCost = 0;
      let waterCost = 0;

      if (reading) {
        elecCost = Math.max(0, (reading.electricityIndex - reading.previousElectricityIndex) * reading.electricityPrice);
        waterCost = Math.max(0, (reading.waterIndex - reading.previousWaterIndex) * reading.waterPrice);
      }

      const total = room.price + elecCost + waterCost + (config.internetPrice || 0) + (config.trashPrice || 0);
      const dueDate = new Date(`${month}-10`);
      const monthNum = month.split('-')[1];
      const roomNumber = room.name.match(/\d+/)?.[0] || room.name;
      const ranCode = Math.floor(100 + Math.random() * 900);
      const invoiceCode = `TROTIEN${roomNumber}T${monthNum}${ranCode}`;

      const newInvoice = await DatabaseService.create<Partial<Invoice>>(COLLECTION, {
        code: invoiceCode,
        roomId: room.id,
        tenantId: room.tenantId,
        month,
        roomPrice: room.price,
        electricityCost: elecCost,
        waterCost: waterCost,
        internetCost: config.internetPrice || 0,
        trashCost: config.trashPrice || 0,
        otherCosts: 0,
        total,
        status: 'UNPAID',
        dueDate: dueDate.toISOString(),
      });

      generatedCount++;

      // Notifications
      const usersSnap = await DbService.findMany('users', 'tenantId = ? OR role = "ADMIN"', [room.tenantId]);
      
      const targetUserIds = new Set<string>();
      usersSnap.forEach(d => targetUserIds.add(d.id));

      for (const userId of targetUserIds) {
        await DatabaseService.create('notifications', {
          userId,
          title: `Hóa đơn tháng ${month}`,
          content: `Hóa đơn mới cho phòng ${room.name} đã được tạo. Vui lòng thanh toán trước ngày 10.`,
          type: 'INVOICE',
          invoiceId: newInvoice.id,
          isRead: false
        });
      }
    }

    return { count: generatedCount };
  }

  static async checkPaymentByCode(code: string) {
    const invoice = await DatabaseService.findOne<Invoice>(COLLECTION, ['code', '==', code]);
    if (invoice && invoice.status === 'PAID') {
      return { status: 'paid', ok: true };
    }
    return { status: 'unpaid', ok: false };
  }
}

