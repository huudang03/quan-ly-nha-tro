import bcrypt from 'bcryptjs';
import { DatabaseService } from '../lib/databaseService';
import { User } from '../types';
import { NotificationService } from './notificationService';

const SALT_ROUNDS = 10;
const COLLECTION = 'users';

export class UserService {
  /**
   * Create a new user with hashed password
   */
  static async createUser(userData: any) {
    const { username, password, role, name, email, phone, address, idCard, status, tenantId } = userData;

    // Check if username exists
    const existing = await DatabaseService.findOne<User>(COLLECTION, ['username', '==', username]);
    if (existing) {
      throw new Error(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống!`);
    }

    // Check if phone exists
    if (phone) {
      if (phone.replace(/\D/g, '').length < 10) {
        throw new Error('Số điện thoại phải có ít nhất 10 chữ số!');
      }
      const existingPhone = await DatabaseService.findOne<User>(COLLECTION, ['phone', '==', phone]);
      if (existingPhone) {
        throw new Error(`Số điện thoại "${phone}" đã được sử dụng bởi tài khoản khác!`);
      }
    }

    // Check if email exists
    if (email) {
      const existingEmail = await DatabaseService.findOne<User>(COLLECTION, ['email', '==', email]);
      if (existingEmail) {
        throw new Error(`Email "${email}" đã tồn tại trên hệ thống!`);
      }
    }

    // Check if idCard exists
    if (idCard) {
      const existingIdCard = await DatabaseService.findOne<User>(COLLECTION, ['idCard', '==', idCard]);
      if (existingIdCard) {
        throw new Error(`Số CCCD "${idCard}" đã được sử dụng bởi tài khoản khác!`);
      }
    }

    if (!password || password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự!');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const userToCreate = {
      username,
      password: hashedPassword,
      role: role || 'TENANT',
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      idCard: idCard || null,
      status: status || 'ACTIVE',
      tenantId: tenantId || null,
    };

    const newUser = await DatabaseService.create<any>(COLLECTION, userToCreate);

    // Sync to tenant if linked
    if (newUser.tenantId) {
      try {
        const tenantDataToSync: any = {};
        if (userToCreate.name) tenantDataToSync.name = userToCreate.name;
        if (userToCreate.phone) tenantDataToSync.phone = userToCreate.phone;
        if (userToCreate.address) tenantDataToSync.address = userToCreate.address;
        if (userToCreate.email) tenantDataToSync.email = userToCreate.email;
        if (userToCreate.idCard) tenantDataToSync.idCard = userToCreate.idCard;
        
        if (Object.keys(tenantDataToSync).length > 0) {
          await DatabaseService.update('tenants', newUser.tenantId, tenantDataToSync);
        }
      } catch (err) {
        console.error('[UserService] Error syncing to tenant on create:', err);
      }
    }

    // Create welcome notification
    await DatabaseService.create('notifications', {
      userId: newUser.id,
      title: 'Chào mừng thành viên mới!',
      content: `Chào mừng ${name} đã tham gia hệ thống Quản lý nhà trọ. Chúc bạn có những trải nghiệm tuyệt vời!`,
      type: 'SYSTEM',
      isRead: false
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * Update user with optional password hashing
   */
  static async updateUser(id: string, userData: any) {
    const { username, password, oldPassword, role, name, email, phone, address, idCard, status, tenantId } = userData;

    const user = await DatabaseService.getById<User>(COLLECTION, id);
    if (!user) throw new Error('User not found');

    // Check if new username is taken
    if (username && username !== user.username) {
      const existingUsername = await DatabaseService.findOne<User>(COLLECTION, ['username', '==', username]);
      if (existingUsername) throw new Error(`Tên đăng nhập "${username}" đã tồn tại!`);
    }

    // Check if new phone is taken
    if (phone && phone !== user.phone) {
      if (phone.replace(/\D/g, '').length < 10) {
        throw new Error('Số điện thoại phải có ít nhất 10 chữ số!');
      }
      const existingPhone = await DatabaseService.findOne<User>(COLLECTION, ['phone', '==', phone]);
      if (existingPhone) throw new Error(`Số điện thoại "${phone}" đã được sử dụng!`);
    }

    // Check if new email is taken
    if (email && email !== user.email) {
      const existingEmail = await DatabaseService.findOne<User>(COLLECTION, ['email', '==', email]);
      if (existingEmail) throw new Error(`Email "${email}" đã được sử dụng bởi tài khoản khác!`);
    }

    // Check if new idCard is taken
    if (idCard && idCard !== user.idCard) {
      const existingIdCard = await DatabaseService.findOne<User>(COLLECTION, ['idCard', '==', idCard]);
      if (existingIdCard) throw new Error(`Số CCCD "${idCard}" đã được sử dụng bởi tài khoản khác!`);
    }

    const data: any = {
      username: username || user.username,
      role: role || user.role,
      name: name || user.name,
      email: email || user.email,
      phone: phone || user.phone,
      address: address || user.address,
      idCard: idCard || user.idCard,
      status: status || user.status,
      tenantId: tenantId || user.tenantId,
    };

    if (password) {
      if (password.length < 6) {
        throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự!');
      }
      if (oldPassword) {
        const isMatch = await bcrypt.compare(oldPassword, user.password!);
        if (!isMatch) throw new Error('Mật khẩu cũ không chính xác');
      }
      data.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updatedUser = await DatabaseService.update<User>(COLLECTION, id, data);
    
    // Notify user about update if they are a tenant
    if (updatedUser.role === 'TENANT') {
      try {
        await NotificationService.createNotification({
          userId: updatedUser.id,
          title: 'Thông tin tài khoản đã cập nhật',
          content: 'Chủ trọ đã cập nhật thông tin tài khoản của bạn trên hệ thống. Vui lòng kiểm tra lại.',
          type: 'SYSTEM'
        });
      } catch (err) {
        console.error('[UserService] Error notifying user:', err);
      }
    }

    // Sync to tenant if linked
    if (updatedUser.tenantId) {
      try {
        const tenantDataToSync: any = {};
        if (data.name !== undefined) tenantDataToSync.name = data.name;
        if (data.phone !== undefined) tenantDataToSync.phone = data.phone;
        if (data.address !== undefined) tenantDataToSync.address = data.address;
        if (data.email !== undefined) tenantDataToSync.email = data.email;
        if (data.idCard !== undefined) tenantDataToSync.idCard = data.idCard;
        
        if (Object.keys(tenantDataToSync).length > 0) {
          await DatabaseService.update('tenants', updatedUser.tenantId, tenantDataToSync);
        }
      } catch (err) {
        console.error('[UserService] Error syncing to tenant:', err);
      }
    }

    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Fetch all users without returning passwords
   */
  static async getAllUsers() {
    const users = await DatabaseService.getAll<User>(COLLECTION);
    return users.map((user: any) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  /**
   * Login user
   */
  static async login(username: string, password: string) {
    const user = await DatabaseService.findOne<User>(COLLECTION, ['username', '==', username]);
    
    if (!user) {
      console.log(`[UserService] Login failed: User ${username} not found.`);
      throw new Error('Tên đăng nhập không tồn tại trong hệ thống!');
    }

    const isMatch = await bcrypt.compare(password, user.password!);
    if (!isMatch) {
      console.log(`[UserService] Login failed: Incorrect password for ${username}.`);
      throw new Error('Mật khẩu không chính xác!');
    }

    // Don't return password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Delete user
   */
  static async deleteUser(id: string) {
    const user = await DatabaseService.getById<User>(COLLECTION, id);
    if (!user) return { success: true };

    if (user.role === 'ADMIN') {
      throw new Error('Không thể xóa tài khoản Quản trị viên!');
    }

    if (user.tenantId) {
      const tenant = await DatabaseService.getById<any>('tenants', user.tenantId);
      if (tenant && tenant.roomId) {
        throw new Error('Không thể xóa tài khoản của người đang thuê phòng!');
      }
    }

    await DatabaseService.delete(COLLECTION, id);
    return { success: true };
  }
}
