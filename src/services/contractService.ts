import { DatabaseService } from '../lib/databaseService';
import { DbService, genId } from '../lib/mysqlHelper';
import { NotificationService } from './notificationService';

const COLLECTION = 'contracts';

export class ContractService {
  static async getAllContracts() {
    return await DatabaseService.getAll(COLLECTION);
  }

  static async createContract(data: any) {
    const { roomId, tenantId, startDate, endDate, deposit, status } = data;

    // Check if room already has an active contract
    if (roomId) {
      const existingRoomContract = await DbService.findOne(COLLECTION, 'roomId = ? AND status = "ACTIVE"', [roomId]);
      if (existingRoomContract) {
        throw new Error('Phòng này đã có hợp đồng đang hiệu lực. Vui lòng kết thúc hợp đồng cũ trước khi tạo mới.');
      }
    }

    // Check if tenant already has an active contract
    if (tenantId) {
      const existingTenantContract = await DbService.findOne(COLLECTION, 'tenantId = ? AND status = "ACTIVE"', [tenantId]);
      if (existingTenantContract) {
        throw new Error('Người thuê này đã có hợp đồng đang hiệu lực ở một phòng khác.');
      }
    }
    
    return await DbService.transaction(async (conn) => {
      const contractId = genId();
      const now = new Date();

      const contractData: any = {
        id: contractId,
        roomId: roomId || null,
        tenantId: tenantId || null,
        startDate: startDate ? new Date(startDate) : now,
        endDate: endDate ? new Date(endDate) : now,
        deposit: Number(deposit) || 0,
        status: status || 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };

      await DbService.create(COLLECTION, contractData);

      // Update room status to OCCUPIED and link tenant
      if (roomId) {
        await DbService.update('rooms', roomId, {
          status: 'OCCUPIED',
          tenantId: tenantId || null
        });
      }

      // Ensure tenant is linked to this room
      if (tenantId && roomId) {
        await DbService.update('tenants', tenantId, {
          roomId: roomId
        });
      }

      return contractData;
    });
  }

  static async updateContract(id: string, data: any) {
    const { roomId, tenantId, startDate, endDate, deposit, status } = data;
    
    // Validations before transaction if fields are changing
    if (roomId) {
      const existingRoomContract = await DbService.findOne(COLLECTION, 'roomId = ? AND status = "ACTIVE"', [roomId]);
      // If there's an active contract for this room AND it's not the one we are editing
      if (existingRoomContract && existingRoomContract.id !== id) {
        throw new Error('Phòng này đã có hợp đồng đang hiệu lực. Không thể chuyển sang phòng này.');
      }
    }

    if (tenantId) {
      const existingTenantContract = await DbService.findOne(COLLECTION, 'tenantId = ? AND status = "ACTIVE"', [tenantId]);
      if (existingTenantContract && existingTenantContract.id !== id) {
        throw new Error('Người thuê này đã có hợp đồng đang hiệu lực ở một phòng khác.');
      }
    }

    return await DbService.transaction(async (conn) => {
      const oldContract = await DbService.getById(COLLECTION, id);
      if (!oldContract) throw new Error('Contract not found');
      
      const updateData: any = {};
      if (roomId !== undefined) updateData.roomId = roomId;
      if (tenantId !== undefined) updateData.tenantId = tenantId;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (deposit !== undefined) updateData.deposit = Number(deposit) || 0;
      if (status !== undefined) updateData.status = status;

      await DbService.update(COLLECTION, id, updateData);

      // Handle Room/Tenant changes status updates
      if (roomId !== undefined && roomId !== oldContract?.roomId) {
        // Free old room
        if (oldContract?.roomId) {
          await DbService.update('rooms', oldContract.roomId, { status: 'AVAILABLE', tenantId: null });
        }
        // Occupy new room
        if (roomId) {
          await DbService.update('rooms', roomId, { status: 'OCCUPIED', tenantId: tenantId || oldContract?.tenantId });
        }
      }

      // Update tenant room reference if roomId or tenantId changed
      if (tenantId !== undefined && tenantId !== oldContract?.tenantId) {
        // If swapping tenant, old tenant loses room
        if (oldContract?.tenantId) {
          await DbService.update('tenants', oldContract.tenantId, { roomId: null });
        }
        // New tenant gets room
        if (tenantId) {
          await DbService.update('tenants', tenantId, { roomId: roomId || oldContract?.roomId });
        }
      }

      // If contract is terminated, free up the current room
      if (status === 'TERMINATED') {
        const currentRoomId = roomId || oldContract?.roomId;
        if (currentRoomId) {
          await DbService.update('rooms', currentRoomId, { status: 'AVAILABLE', tenantId: null });
        }
        
        const currentTenantId = tenantId || oldContract?.tenantId;
        if (currentTenantId) {
          await DbService.update('tenants', currentTenantId, { roomId: null });
        }
      }
      
      // Notify the tenant and the room
      const targetTenantId = tenantId || oldContract?.tenantId;
      const targetRoomId = roomId || oldContract?.roomId;
      
      setTimeout(() => {
        if (targetTenantId) {
          NotificationService.notifyTenant(
            targetTenantId,
            'Thông tin hợp đồng đã cập nhật',
            'Chủ trọ đã cập nhật thông tin hợp đồng của bạn. Vui lòng kiểm tra lại.',
            'SYSTEM'
          );
        }
        if (targetRoomId) {
          NotificationService.notifyRoom(
            targetRoomId,
            'Hợp đồng phòng đã được cập nhật',
            'Chủ trọ đã cập nhật thông tin hợp đồng liên quan đến phòng của bạn.',
            'CONTRACT'
          );
        }
      }, 0);

      return { id, ...oldContract, ...updateData };
    });
  }

  static async deleteContract(id: string) {
    return await DbService.transaction(async (conn) => {
      const contract = await DbService.getById(COLLECTION, id);
      if (!contract) return { id, success: true };

      // NEW: Check if contract is active before deleting
      if (contract.status === 'ACTIVE') {
        throw new Error('Không thể xóa hợp đồng khi đang có hiệu lực. Hệ thống yêu cầu phải kết thúc hợp đồng trước mới có thể xóa.');
      }
      
      if (contract?.roomId) {
        await DbService.update('rooms', contract.roomId, { status: 'AVAILABLE', tenantId: null });
        
        if (contract.tenantId) {
          await DbService.update('tenants', contract.tenantId, { roomId: null });
        }
      }

      await DbService.delete(COLLECTION, id);

      return { id, success: true };
    });
  }
}

