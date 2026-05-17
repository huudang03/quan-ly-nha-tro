import { DatabaseService } from '../lib/databaseService';
import { DbService, genId } from '../lib/mysqlHelper';
import { NotificationService } from './notificationService';

const COLLECTION = 'tenants';

export class TenantService {
  static async getAllTenants() {
    return await DatabaseService.getAll(COLLECTION);
  }

  static async createTenant(tenantData: any) {
    const { name, idCard, phone, address, email, roomId, selectedUserId } = tenantData;
    
    // Check if phone exists
    if (phone) {
      if (phone.replace(/\D/g, '').length < 10) {
        throw new Error('Số điện thoại phải có ít nhất 10 chữ số!');
      }
      const existingTenant = await DatabaseService.findOne(COLLECTION, ['phone', '==', phone]);
      if (existingTenant) {
        throw new Error(`Số điện thoại "${phone}" đã được đăng ký cho người thuê khác!`);
      }
    }

    // Check if email exists
    if (email) {
      const existingEmail = await DatabaseService.findOne(COLLECTION, ['email', '==', email]);
      if (existingEmail) {
        throw new Error(`Email "${email}" đã được đăng ký cho người thuê khác!`);
      }
    }

    // Check if idCard exists
    if (idCard) {
      const existingIdCard = await DatabaseService.findOne(COLLECTION, ['idCard', '==', idCard]);
      if (existingIdCard) {
        throw new Error(`Số CCCD "${idCard}" đã được đăng ký cho người thuê khác!`);
      }
    }

    return await DbService.transaction(async (conn) => {
      const tenantId = genId();
      const now = new Date();

      const tenantDataToCreate: any = {
        id: tenantId,
        name,
        idCard: idCard || null,
        phone: phone || null,
        address: address || null,
        email: email || null,
        roomId: roomId || null,
        createdAt: now,
        updatedAt: now
      };

      // 1. Create the tenant
      await DbService.create('tenants', tenantDataToCreate);

      // 2. If roomId is provided, update room status to OCCUPIED
      if (roomId) {
        await DbService.update('rooms', roomId, {
          status: 'OCCUPIED',
          tenantId: tenantId,
        });
      }

      // 3. If selectedUserId is provided, link the user to this tenant
      if (selectedUserId) {
        const userUpdate: any = { 
          tenantId: tenantId,
          updatedAt: now
        };
        if (name) userUpdate.name = name;
        if (phone) userUpdate.phone = phone;
        if (address) userUpdate.address = address;
        if (email) userUpdate.email = email;
        if (idCard) userUpdate.idCard = idCard;
        
        await DbService.update('users', selectedUserId, userUpdate);
      }

      return tenantDataToCreate;
    });
  }

  static async updateTenant(id: string, tenantData: any) {
    const { name, idCard, phone, address, email, roomId } = tenantData;
    
    return await DbService.transaction(async (conn) => {
      const oldTenant = await DbService.getById(COLLECTION, id);
      if (!oldTenant) throw new Error('Tenant not found');

      // Check if new phone is taken
      if (phone && phone !== oldTenant.phone) {
        if (phone.replace(/\D/g, '').length < 10) {
          throw new Error('Số điện thoại phải có ít nhất 10 chữ số!');
        }
        const existingSnap = await DbService.findOne(COLLECTION, 'phone = ?', [phone]);
        if (existingSnap) throw new Error(`Số điện thoại "${phone}" đã được sử dụng bởi người thuê khác!`);
      }

      // Check if new email is taken
      if (email && email !== oldTenant.email) {
        const existingSnap = await DbService.findOne(COLLECTION, 'email = ?', [email]);
        if (existingSnap) throw new Error(`Email "${email}" đã được sử dụng bởi người thuê khác!`);
      }

      // Check if new idCard is taken
      if (idCard && idCard !== oldTenant.idCard) {
        const existingSnap = await DbService.findOne(COLLECTION, 'idCard = ?', [idCard]);
        if (existingSnap) throw new Error(`Số CCCD "${idCard}" đã được sử dụng bởi người thuê khác!`);
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (idCard !== undefined) updateData.idCard = idCard;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (email !== undefined) updateData.email = email;
      if (roomId !== undefined) updateData.roomId = roomId || null;

      await DbService.update('tenants', id, updateData);

      // Handle room status changes
      if (roomId !== undefined && oldTenant?.roomId !== roomId) {
        // If old room exists, mark it as AVAILABLE
        if (oldTenant?.roomId) {
          await DbService.update('rooms', oldTenant.roomId, { status: 'AVAILABLE', tenantId: null });
        }
        // If new room exists, mark it as OCCUPIED
        if (roomId) {
          await DbService.update('rooms', roomId, { status: 'OCCUPIED', tenantId: id });
        }
      }

      // Sync back to linked User(s)
      const usersSnap = await DbService.findMany('users', 'tenantId = ?', [id]);
      for (const userDoc of usersSnap) {
        const userUpdate: any = {};
        if (name !== undefined) userUpdate.name = name;
        if (phone !== undefined) userUpdate.phone = phone;
        if (address !== undefined) userUpdate.address = address;
        if (email !== undefined) userUpdate.email = email;
        if (idCard !== undefined) userUpdate.idCard = idCard;
        if (Object.keys(userUpdate).length > 0) {
          await DbService.update('users', userDoc.id, userUpdate);
        }
      }

      // Notify the tenant about information update
      setTimeout(() => {
        NotificationService.notifyTenant(
          id,
          'Thông tin cá nhân đã cập nhật',
          'Chủ trọ đã cập nhật thông tin cá nhân của bạn trên hệ thống. Vui lòng kiểm tra lại.',
          'SYSTEM'
        );
      }, 0);

      return { id, ...oldTenant, ...updateData };
    });
  }

  static async deleteTenant(id: string) {
    return await DbService.transaction(async (conn) => {
      const tenant = await DbService.getById(COLLECTION, id);
      if (!tenant) return { id, success: true };
      
      if (tenant?.roomId) {
        throw new Error('Không thể xóa người thuê đang thuê phòng!');
      }

      // Also unlink from User
      const usersSnap = await DbService.findMany('users', 'tenantId = ?', [id]);
      for (const userDoc of usersSnap) {
        await DbService.update('users', userDoc.id, { tenantId: null });
      }

      await DbService.delete(COLLECTION, id);

      return { id, success: true };
    });
  }
}

