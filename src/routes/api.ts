import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import cryptoRandomString from 'crypto-random-string';
import bcrypt from 'bcryptjs';
import { DatabaseService } from '../lib/databaseService';
import { Room, User, Invoice, Notification, SystemConfig } from '../types';

import { DbService } from '../lib/mysqlHelper';
import { EmailService } from '../services/emailService';
import { RoomService } from '../services/roomService';
import { TenantService } from '../services/tenantService';
import { InvoiceService } from '../services/invoiceService';
import { UserService } from '../services/userService';
import { ContractService } from '../services/contractService';
import { UtilityService } from '../services/utilityService';
import { NotificationService } from '../services/notificationService';
import { sendSuccess, validateBody } from '../middleware/common';

const router = Router();

// Forgot password route
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Vui lòng nhập email' });

    console.log(`[AUTH] Forgot password request for email: ${email}`);
    const user = await DatabaseService.findOne<User>('users', ['email', '==', email]);
    
    if (!user) {
      console.log(`[AUTH] No user found with email: ${email}`);
      // Still return success to prevent enumeration
      return sendSuccess(res, { message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn' });
    }

    const token = cryptoRandomString({ length: 32, type: 'url-safe' });
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Persist the reset token
    await DatabaseService.create('passwordResets', {
  email,
  token,
  expiresAt
});
    
    // Get the base URL for the reset link
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const origin = req.headers.origin || `${protocol}://${host}`;
    const baseUrl = process.env.APP_URL || origin;
    
    // Get SMTP config from DB or Env
    const sysConfig = await DatabaseService.getById<any>('systemConfigs', 'default');
    const smtpHost = sysConfig?.smtpHost || process.env.SMTP_HOST;
    
    // Check if SMTP is configured
    if (!smtpHost) {
      console.warn('[AUTH] SMTP_HOST is not configured. Cannot send email.');
      const resetLink = `${baseUrl}/reset-password?token=${token}`;
      console.log(`[DEBUG] Reset link for ${email}: ${resetLink}`);
      
      return sendSuccess(res, { 
        message: 'Yêu cầu đã được ghi nhận. Tuy nhiên, hệ thống chưa cấu hình máy chủ gửi email (SMTP). Vui lòng cấu hình SMTP trong Cài đặt hệ thống để nhận email thực tế.',
        token: process.env.NODE_ENV !== 'production' ? token : undefined
      });
    }

    try {
      await EmailService.sendResetPasswordEmail(email, token, sysConfig, baseUrl);
      sendSuccess(res, { message: 'Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu vào email của bạn.' });
    } catch (emailErr: any) {
      console.error('[AUTH] Failed to send email via SMTP, full error:');
      console.error(emailErr);
      const resetLink = `${baseUrl}/reset-password?token=${token}`;
      
      let errorMessage = 'Có lỗi khi gửi email. Có thể cấu hình SMTP chưa chính xác hoặc máy chủ bị chặn kết nối.';
      
      if (emailErr.message?.includes('Invalid login') || emailErr.message?.includes('auth') || emailErr.message?.includes('Username and Password not accepted') || emailErr.message?.includes('Đăng nhập SMTP thất bại')) {
        errorMessage = 'Lỗi đăng nhập SMTP. Nếu dùng Gmail, hãy chắc chắn bạn đã dùng "Mật khẩu ứng dụng" (App Password) 16 ký tự thay vì mật khẩu thông thường.';
      } else if (emailErr.code === 'ETIMEDOUT') {
        errorMessage = 'Kết nối tới máy chủ SMTP bị hết hạn (Timeout). Vui lòng kiểm tra lại Host và Port.';
      } else if (emailErr.message) {
        errorMessage = `Lỗi SMTP: ${emailErr.message}`;
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
        debugLink: process.env.NODE_ENV !== 'production' ? resetLink : undefined,
        errorDetail: process.env.NODE_ENV !== 'production' ? emailErr.message : undefined
      });
    }
  } catch (err) { next(err); }
});

// Reset password route
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    console.log('TOKEN NHAN DUOC:', token);

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu token hoặc mật khẩu'
      });
    }

    const resetRequest = await DatabaseService.findOne<any>(
      'passwordResets',
      ['token', '==', token]
    );

    console.log('RESET REQUEST:', resetRequest);

    if (!resetRequest) {
      return res.status(400).json({
        success: false,
        error: 'Không tìm thấy token'
      });
    }

const expiresTime = Number(resetRequest.expiresAt);
const nowTime = Date.now();

console.log('EXPIRES:', expiresTime);
console.log('NOW:', nowTime);

if (nowTime > expiresTime) {
  return res.status(400).json({
    success: false,
    error: 'Link đã hết hạn'
  });
}

    const user = await DatabaseService.findOne<User>(
      'users',
      ['email', '==', resetRequest.email]
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Không tìm thấy người dùng'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await DatabaseService.update('users', user.id, {
      password: hashedPassword
    });

    await DatabaseService.delete('passwordResets', resetRequest.id);

    sendSuccess(res, {
      message: 'Đặt lại mật khẩu thành công'
    });

  } catch (err) {
    next(err);
  }
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/**
 * Rooms API
 */
router.get('/rooms', async (req, res, next) => {
  try {
    const rooms = await RoomService.getAllRooms();
    sendSuccess(res, rooms);
  } catch (err) { next(err); }
});

router.post('/rooms', upload.single('image'), async (req, res, next) => {
  try {
    console.log('[API] POST /rooms body:', req.body);
    console.log('[API] POST /rooms file:', req.file);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;
    const result = await RoomService.createRoom({ ...req.body, imageUrl });
    sendSuccess(res, result);
  } catch (err) { 
    console.error('[API] POST /rooms error:', err);
    next(err); 
  }
});

router.put('/rooms/:id', upload.single('image'), async (req, res, next) => {
  try {
    console.log('[API] PUT /rooms/:id body:', req.body);
    console.log('[API] PUT /rooms/:id file:', req.file);
    const existingRoom = await DatabaseService.getById<Room>('rooms', req.params.id);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl !== undefined ? req.body.imageUrl : existingRoom?.imageUrl);
    const result = await RoomService.updateRoom(req.params.id, { ...req.body, imageUrl });
    sendSuccess(res, result);
  } catch (err) { 
    console.error('[API] PUT /rooms/:id error:', err);
    next(err); 
  }
});

router.delete('/rooms/:id', async (req, res, next) => {
  try {
    const result = await RoomService.deleteRoom(req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// Generic upload endpoint
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

/**
 * Tenants API
 */
router.get('/tenants', async (req, res, next) => {
  try {
    const tenants = await TenantService.getAllTenants();
    sendSuccess(res, tenants);
  } catch (err) { next(err); }
});

router.post('/tenants', validateBody(['name']), async (req, res, next) => {
  try {
    const result = await TenantService.createTenant(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.put('/tenants/:id', async (req, res, next) => {
  try {
    const result = await TenantService.updateTenant(req.params.id, req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const result = await TenantService.deleteTenant(req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * Contracts API
 */
router.get('/contracts', async (req, res, next) => {
  try {
    const contracts = await ContractService.getAllContracts();
    sendSuccess(res, contracts);
  } catch (err) { next(err); }
});

router.post('/contracts', validateBody(['roomId', 'tenantId', 'startDate', 'endDate']), async (req, res, next) => {
  try {
    const result = await ContractService.createContract(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.put('/contracts/:id', async (req, res, next) => {
  try {
    const result = await ContractService.updateContract(req.params.id, req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.delete('/contracts/:id', async (req, res, next) => {
  try {
    const result = await ContractService.deleteContract(req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * Utility Readings API
 */
router.get('/utility-readings', async (req, res, next) => {
  try {
    const readings = await UtilityService.getAllReadings();
    sendSuccess(res, readings);
  } catch (err) { next(err); }
});

router.post('/utility-readings', validateBody(['roomId', 'month']), async (req, res, next) => {
  try {
    const result = await UtilityService.createReading(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.put('/utility-readings/:id', async (req, res, next) => {
  try {
    const result = await UtilityService.updateReading(req.params.id, req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.delete('/utility-readings/:id', async (req, res, next) => {
  try {
    const result = await UtilityService.deleteReading(req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// Removed duplicated Notifications API block
/**
 * Invoices API
 */
router.post('/invoices/generate', async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!month) throw new Error('Month is required');
    const result = await InvoiceService.generateInvoices(month);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/invoices', async (req, res, next) => {
  try {
    const invoices = await DatabaseService.getAll('invoices', ['month', 'desc']);
    sendSuccess(res, invoices);
  } catch (err) { next(err); }
});

router.post('/invoices', validateBody(['roomId', 'month', 'dueDate']), async (req, res, next) => {
  try {
    const result = await InvoiceService.createInvoice(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/check-payment/:code', async (req, res, next) => {
  try {
    const result = await InvoiceService.checkPaymentByCode(req.params.code);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.put('/invoices/:id', async (req, res, next) => {
  try {
    const data = req.body;
    const updateData: any = {};
    
    if (data.code !== undefined) updateData.code = data.code;
    if (data.roomId !== undefined) updateData.roomId = data.roomId;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
    if (data.month !== undefined) updateData.month = data.month;
    if (data.roomPrice !== undefined) updateData.roomPrice = isNaN(Number(data.roomPrice)) ? 0 : Number(data.roomPrice);
    if (data.electricityCost !== undefined) updateData.electricityCost = isNaN(Number(data.electricityCost)) ? 0 : Number(data.electricityCost);
    if (data.waterCost !== undefined) updateData.waterCost = isNaN(Number(data.waterCost)) ? 0 : Number(data.waterCost);
    if (data.internetCost !== undefined) updateData.internetCost = isNaN(Number(data.internetCost)) ? 0 : Number(data.internetCost);
    if (data.trashCost !== undefined) updateData.trashCost = isNaN(Number(data.trashCost)) ? 0 : Number(data.trashCost);
    if (data.otherCosts !== undefined) updateData.otherCosts = isNaN(Number(data.otherCosts)) ? 0 : Number(data.otherCosts);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined && data.dueDate) {
      const date = new Date(data.dueDate);
      if (!isNaN(date.getTime())) {
        updateData.dueDate = date.toISOString();
      }
    }

    // Always recalculate total on backend if any component is being updated
    const existingInvoice = await DatabaseService.getById<any>('invoices', req.params.id);
    if (existingInvoice) {
      const roomPrice = updateData.roomPrice !== undefined ? updateData.roomPrice : (existingInvoice.roomPrice || 0);
      const electricityCost = updateData.electricityCost !== undefined ? updateData.electricityCost : (existingInvoice.electricityCost || 0);
      const waterCost = updateData.waterCost !== undefined ? updateData.waterCost : (existingInvoice.waterCost || 0);
      const internetCost = updateData.internetCost !== undefined ? updateData.internetCost : (existingInvoice.internetCost || 0);
      const trashCost = updateData.trashCost !== undefined ? updateData.trashCost : (existingInvoice.trashCost || 0);
      const otherCosts = updateData.otherCosts !== undefined ? updateData.otherCosts : (existingInvoice.otherCosts || 0);
      
      updateData.total = roomPrice + electricityCost + waterCost + internetCost + trashCost + otherCosts;
    } else if (data.total !== undefined) {
      updateData.total = isNaN(Number(data.total)) ? 0 : Number(data.total);
    }

    const result = await DatabaseService.update('invoices', req.params.id, updateData);

    // Get the full updated document to return and for notification
    const updatedInvoice = await DatabaseService.getById<any>('invoices', req.params.id);
    
    // Background notification for transparency
    if (updatedInvoice?.tenantId || updatedInvoice?.roomId) {
      (async () => {
        try {
          if (updatedInvoice.tenantId) {
            await NotificationService.notifyTenant(
              updatedInvoice.tenantId,
              'Hóa đơn đã được cập nhật',
              `Chủ trọ đã chỉnh sửa thông tin hóa đơn tháng ${updatedInvoice.month} (Mã: ${updatedInvoice.code || updatedInvoice.id}).`,
              'INVOICE',
              { invoiceId: req.params.id, roomId: updatedInvoice.roomId }
            );
          }
          // Also notify anyone else in the room
          if (updatedInvoice.roomId) {
            await NotificationService.notifyRoom(
              updatedInvoice.roomId,
              'Cập nhật hóa đơn phòng',
              `Thông tin hóa đơn tháng ${updatedInvoice.month} của phòng đã được thay đổi.`,
              'INVOICE',
              { invoiceId: req.params.id, roomId: updatedInvoice.roomId }
            );
          }
        } catch (notifyErr) {
          console.error('[API] Error sending invoice update notification:', notifyErr);
        }
      })();
    }

    sendSuccess(res, updatedInvoice || result);
  } catch (err) { next(err); }
});

router.delete('/invoices/:id', async (req, res, next) => {
  try {
    await DatabaseService.delete('invoices', req.params.id);
    sendSuccess(res, { success: true });
  } catch (err) { next(err); }
});

/**
 * Users API
 */
router.post('/login', validateBody(['username', 'password']), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await UserService.login(username, password);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

router.get('/users', async (req, res, next) => {
  try {
    const users = await UserService.getAllUsers();
    sendSuccess(res, users);
  } catch (err) { next(err); }
});

router.post('/users', validateBody(['username', 'password', 'role', 'name']), async (req, res, next) => {
  try {
    const result = await UserService.createUser(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const result = await UserService.updateUser(req.params.id, req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const result = await UserService.deleteUser(req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * System Config API
 */
router.get('/system-config', async (req, res, next) => {
  try {
    const config = await DatabaseService.getById('systemConfigs', 'default');
    sendSuccess(res, config);
  } catch (err) { next(err); }
});

router.put('/system-config', async (req, res, next) => {
  try {
    const { 
      propertyName, electricityPrice, waterPrice, internetPrice, trashPrice, 
      bankName, bankAccount, bankAccountName, bankQrUrl, bankHubApiKey, bankHubSecret,
      smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom
    } = req.body;
    const updateData = {
      propertyName: propertyName || 'Hệ thống Quản lý Nhà trọ',
      electricityPrice: Number(electricityPrice) || 0,
      waterPrice: Number(waterPrice) || 0,
      internetPrice: Number(internetPrice) || 0,
      trashPrice: Number(trashPrice) || 0,
      bankName: bankName || '',
      bankAccount: bankAccount || '',
      bankAccountName: bankAccountName || '',
      bankQrUrl: bankQrUrl || '',
      bankHubApiKey: bankHubApiKey || '',
      bankHubSecret: bankHubSecret || '',
      smtpHost: smtpHost || '',
      smtpPort: Number(smtpPort) || 587,
      smtpUser: smtpUser || '',
      smtpPass: smtpPass || '',
      smtpFrom: smtpFrom || '',
    };
    const result = await DatabaseService.set('systemConfigs', 'default', updateData);
    
    // Broadcast notification to ALL users about price changes
    try {
      const allUsersSnap = await DatabaseService.getAll('users');
      const promises = [];
      allUsersSnap.forEach(uDoc => {
        promises.push(NotificationService.createNotification({
          userId: uDoc.id,
          title: 'Cập nhật giá dịch vụ & hệ thống',
          content: 'Chủ trọ đã cập nhật thông tin cài đặt hệ thống hoặc giá dịch vụ (điện, nước, internet...). Vui lòng kiểm tra lại.',
          type: 'SYSTEM'
        }));
      });
      await Promise.all(promises);
    } catch (err) {
      console.error('[API] Error broadcasting system update:', err);
    }

    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * Notifications API
 */
router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await NotificationService.getAllNotifications();
    sendSuccess(res, notifications);
  } catch (err) { next(err); }
});

router.post('/notifications', validateBody(['userId', 'title', 'content', 'type']), async (req, res, next) => {
  try {
    const result = await NotificationService.createNotification(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.post('/notifications/batch', async (req, res, next) => {
  try {
    const { userIds, senderId, title, content, type, invoiceId } = req.body;
    const notifications = await Promise.all(userIds.map((userId: string) => 
      NotificationService.createNotification({ userId, senderId, title, content, type, invoiceId })
    ));
    sendSuccess(res, notifications);
  } catch (err) { next(err); }
});

router.put('/notifications/:id', async (req, res, next) => {
  try {
    const result = await NotificationService.markAsRead(req.params.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.post('/notifications/mark-all-read', async (req, res, next) => {
  try {
    await DatabaseService.update('notifications', 'ALL', { isRead: true });
    sendSuccess(res, { success: true });
  } catch (err) { next(err); }
});

router.delete('/notifications/clear-all', async (req, res, next) => {
  try {
    await DatabaseService.delete('notifications', 'ALL');
    sendSuccess(res, { success: true });
  } catch (err) { next(err); }
});

router.delete('/notifications/:id', async (req, res, next) => {
  try {
    await NotificationService.deleteNotification(req.params.id);
    sendSuccess(res, { success: true });
  } catch (err) { next(err); }
});

/**
 * System Backup & Restore API
 */
router.get('/system/backup', async (req, res, next) => {
  try {
    const collections = ['rooms', 'tenants', 'contracts', 'utility-readings', 'invoices', 'users', 'systemConfigs', 'notifications'];
    const backupData: any = {};
    
    for (const col of collections) {
      backupData[col] = await DatabaseService.getAll(col);
    }
    
    sendSuccess(res, backupData);
  } catch (err) { next(err); }
});

router.post('/system/restore', async (req, res, next) => {
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Dữ liệu khôi phục không hợp lệ');
    }

    const collections = Object.keys(backupData);
    let operationCount = 0;

    await DbService.transaction(async (conn) => {
      for (const colName of collections) {
        const docs = backupData[colName];
        if (!Array.isArray(docs)) continue;

        for (const docData of docs) {
          const { id, ...data } = docData;
          if (!id) continue;
          
          // Convert ISO strings back to Date objects for date fields
          const processedData = { ...data };
          for (const key in processedData) {
            const val = processedData[key];
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
               processedData[key] = new Date(val);
            }
          }

          // Use DB Service set inside transaction
          await DbService.set(colName, id, processedData);
          operationCount++;
        }
      }
    });

    sendSuccess(res, { success: true });
  } catch (err) { next(err); }
});

export default router;
