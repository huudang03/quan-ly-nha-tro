import React, { useState } from 'react';
import { SystemConfig, User, Notification } from '../types';
import { Card, Button, Input, Toast, Select, ConfirmModal } from './UI';
import { Settings, Database, Save, RefreshCcw, Download, Home, Bell } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface SystemManagementProps {
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  propertyName: string;
  setPropertyName: (name: string) => void;
  users: User[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  createNotifications: (notifications: Notification[]) => Promise<void>;
  onRefresh: () => void;
}

export function SystemManagement({ config, setConfig, propertyName, setPropertyName, users, setNotifications, createNotifications, onRefresh }: SystemManagementProps) {
  const [formData, setFormData] = useState<SystemConfig>(config);
  const [propName, setPropName] = useState(propertyName);
  const [isDirty, setIsDirty] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isDirty) {
      setFormData(config);
    }
  }, [config, isDirty]);

  React.useEffect(() => {
    if (!isDirty) {
      setPropName(propertyName);
    }
  }, [propertyName, isDirty]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ isVisible: true, message, type });
  };

  const handleSaveConfig = async () => {
    try {
      // Ensure we use the latest formData and propName
      const payload = { 
        ...formData, 
        propertyName: propName,
        // Ensure numeric fields are actually numbers
        electricityPrice: Number(formData.electricityPrice) || 0,
        waterPrice: Number(formData.waterPrice) || 0,
        internetPrice: Number(formData.internetPrice) || 0,
        trashPrice: Number(formData.trashPrice) || 0
      };

      await apiFetch('/api/system-config', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      setPropertyName(propName);
      setIsDirty(false);
      onRefresh();
      showToast('Cập nhật cấu hình hệ thống thành công!');
    } catch (err: any) {
      console.error('Error saving config:', err);
      showToast('Lỗi khi lưu cấu hình: ' + err.message, 'error');
    }
  };

  const updateFormData = (newData: Partial<SystemConfig>) => {
    setFormData(prev => ({ ...prev, ...newData }));
    setIsDirty(true);
  };

  const updatePropName = (name: string) => {
    setPropName(name);
    setIsDirty(true);
  };
  
  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const data = await apiFetch<any>('/api/system/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_boardingpro_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Đã tải xuống bản sao lưu dữ liệu!');
    } catch (err: any) {
      console.error('Backup error:', err);
      showToast('Lỗi khi sao lưu dữ liệu: ' + err.message, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isRestoring) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        setPendingRestoreData(data);
        setIsRestoreConfirmOpen(true);
      } catch (err: any) {
        console.error('File read error:', err);
        showToast('Lỗi khi đọc file: ' + err.message, 'error');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreConfirm = async () => {
    if (!pendingRestoreData || isRestoring) return;

    try {
      setIsRestoring(true);
      setIsRestoreConfirmOpen(false);
      await apiFetch('/api/system/restore', {
        method: 'POST',
        body: JSON.stringify(pendingRestoreData)
      });
      showToast('Khôi phục dữ liệu thành công! Hệ thống sẽ tải lại dữ liệu.');
      onRefresh();
    } catch (err: any) {
      console.error('Restore error:', err);
      showToast('Lỗi khi khôi phục dữ liệu: ' + err.message, 'error');
    } finally {
      setIsRestoring(false);
      setPendingRestoreData(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Cài đặt hệ thống</h2>
        <p className="text-zinc-500 text-sm mt-1 font-medium">Cấu hình thông tin tòa nhà, giá dịch vụ và thanh toán.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <Card title="Cấu hình chung" subtitle="Thông tin cơ bản và giá dịch vụ mặc định">
            <div className="space-y-6">
                <Input 
                  label="Tên khu trọ / Tòa nhà" 
                  icon={<Home size={18} className="text-green-500" />}
                  value={propName || ''} 
                  onChange={e => updatePropName(e.target.value)} 
                  className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                />
                
                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">Giá dịch vụ mặc định</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input 
                      label="Giá điện (VNĐ/kWh)" 
                      numeric
                      value={formData.electricityPrice ?? ''} 
                      onChange={e => updateFormData({ electricityPrice: e.target.value === '' ? undefined : Number(e.target.value) })} 
                      className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                    />
                    <Input 
                      label="Giá nước (VNĐ/m³)" 
                      numeric
                      value={formData.waterPrice ?? ''} 
                      onChange={e => updateFormData({ waterPrice: e.target.value === '' ? undefined : Number(e.target.value) })} 
                      className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                    />
                    <Input 
                      label="Tiền Internet (VNĐ/tháng)" 
                      numeric
                      value={formData.internetPrice ?? ''} 
                      onChange={e => updateFormData({ internetPrice: e.target.value === '' ? undefined : Number(e.target.value) })} 
                      className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                    />
                    <Input 
                      label="Tiền rác (VNĐ/tháng)" 
                      numeric
                      value={formData.trashPrice ?? ''} 
                      onChange={e => updateFormData({ trashPrice: e.target.value === '' ? undefined : Number(e.target.value) })} 
                      className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                    />
                  </div>
                </div>

              <div className="pt-6 border-t border-zinc-100">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">Thông tin chuyển khoản</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Select 
                    label="Ngân hàng" 
                    value={formData.bankName || ''} 
                    onChange={e => updateFormData({ bankName: e.target.value })}
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                    options={[
                      { value: '', label: 'Chọn ngân hàng' },
                      { value: 'MB', label: 'MB Bank (Quân Đội)' },
                      { value: 'VCB', label: 'Vietcombank' },
                      { value: 'TCB', label: 'Techcombank' },
                      { value: 'BIDV', label: 'BIDV' },
                      { value: 'ICB', label: 'VietinBank' },
                      { value: 'VBA', label: 'Agribank' },
                      { value: 'ACB', label: 'ACB' },
                      { value: 'TPB', label: 'TPBank' },
                      { value: 'VPB', label: 'VPBank' },
                      { value: 'VIB', label: 'VIB' },
                      { value: 'STB', label: 'Sacombank' },
                      { value: 'HDB', label: 'HDBank' },
                      { value: 'SHB', label: 'SHB' },
                      { value: 'MSB', label: 'MSB' },
                      { value: 'SEA', label: 'SeABank' },
                      { value: 'OCB', label: 'OCB' },
                      { value: 'LPB', label: 'LPBank' },
                      { value: 'BAB', label: 'Bac A Bank' },
                      { value: 'NAB', label: 'Nam A Bank' },
                      { value: 'PVC', label: 'PVComBank' },
                      { value: 'NCB', label: 'NCB' },
                      { value: 'EIB', label: 'Eximbank' },
                    ]}
                  />
                  <Input 
                    label="Số tài khoản" 
                    value={formData.bankAccount || ''} 
                    onChange={e => updateFormData({ bankAccount: e.target.value })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                  <Input 
                    label="Tên chủ tài khoản" 
                    value={formData.bankAccountName || ''} 
                    onChange={e => updateFormData({ bankAccountName: e.target.value.toUpperCase() })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                  <Input 
                    label="Link ảnh QR Code (Tùy chọn)" 
                    placeholder="https://example.com/qr.png"
                    value={formData.bankQrUrl || ''} 
                    onChange={e => updateFormData({ bankQrUrl: e.target.value })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                </div>
              </div>
              
              <div className="pt-6 border-t border-zinc-100">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">Cấu hình Email (SMTP)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Input 
                    label="SMTP Host" 
                    placeholder="smtp.gmail.com"
                    value={formData.smtpHost || ''} 
                    onChange={e => updateFormData({ smtpHost: e.target.value })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                  <Input 
                    label="SMTP Port" 
                    numeric
                    placeholder="587"
                    value={formData.smtpPort ?? ''} 
                    onChange={e => updateFormData({ smtpPort: e.target.value === '' ? undefined : Number(e.target.value) })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                  <Input 
                    label="SMTP User" 
                    placeholder="your-email@gmail.com"
                    value={formData.smtpUser || ''} 
                    onChange={e => updateFormData({ smtpUser: e.target.value })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                  <Input 
                    label="SMTP Password" 
                    type="password"
                    placeholder="••••••••"
                    value={formData.smtpPass || ''} 
                    onChange={e => updateFormData({ smtpPass: e.target.value })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium"
                  />
                  <Input 
                    label="Email người gửi (SMTP From)" 
                    placeholder='"Quản lý nhà trọ" <noreply@example.com>'
                    value={formData.smtpFrom || ''} 
                    onChange={e => updateFormData({ smtpFrom: e.target.value })} 
                    className="rounded-2xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 font-medium col-span-full"
                  />
                </div>
                <p className="mt-4 text-[10px] text-zinc-400 italic">
                  * Hệ thống cần cấu hình SMTP để gửi email khôi phục mật khẩu. Nếu dùng Gmail, vui lòng sử dụng "Mật khẩu ứng dụng" (App Password).
                </p>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <Button className="w-full shadow-lg shadow-green-200/50 rounded-2xl h-12 text-base font-bold" onClick={handleSaveConfig}>
                  <Save size={20} /> Lưu tất cả cấu hình
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <Card title="Xem trước QR" subtitle="Mã QR hiển thị trên hóa đơn">
            <div className="flex flex-col items-center">
              {(formData.bankQrUrl || (formData.bankName && formData.bankAccount)) ? (
                <div className="w-full space-y-4">
                  <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm flex items-center justify-center hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500">
                    {formData.bankQrUrl ? (
                      <img 
                        src={formData.bankQrUrl} 
                        alt="Custom QR Preview" 
                        className="w-full aspect-square object-contain" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <img 
                        src={`https://img.vietqr.io/image/${formData.bankName || 'MB'}-${formData.bankAccount || '0123456789'}-compact.png?amount=500000&addInfo=${encodeURIComponent('HD101T03')}&accountName=${encodeURIComponent(formData.bankAccountName || 'NGUYEN VAN A')}`} 
                        alt="Auto QR Preview" 
                        className="w-full aspect-square" 
                        referrerPolicy="no-referrer" 
                      />
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-zinc-900">
                      {formData.bankName} - {formData.bankAccount}
                    </p>
                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                      {formData.bankAccountName || 'CHƯA CÓ TÊN CHỦ TK'}
                    </p>
                  </div>
                  <p className="text-[10px] text-zinc-400 text-center italic leading-relaxed px-4">
                    {formData.bankQrUrl ? '* Đang sử dụng ảnh QR tùy chỉnh của bạn' : '* Đây là mã QR tự động tạo từ thông tin ngân hàng'}
                  </p>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 mb-4">
                    <Bell size={32} />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">Vui lòng nhập thông tin ngân hàng để tạo mã QR.</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Dữ liệu hệ thống" subtitle="Sao lưu và khôi phục">
            <div className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
              />
              <div className="p-5 bg-zinc-50/50 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-green-500 shadow-sm border border-zinc-100 transition-colors">
                    {isBackingUp ? <RefreshCcw size={20} className="animate-spin" /> : <Database size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">Sao lưu</p>
                    <p className="text-[10px] text-zinc-500 font-medium">Tải xuống dữ liệu</p>
                  </div>
                </div>
                <button 
                  onClick={handleBackup} 
                  disabled={isBackingUp}
                  className="p-2 text-zinc-400 hover:text-green-600 transition-colors disabled:opacity-50"
                >
                  <Download size={20} />
                </button>
              </div>

              <div className="p-5 bg-zinc-50/50 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-green-500 shadow-sm border border-zinc-100 transition-colors">
                    {isRestoring ? <RefreshCcw size={20} className="animate-spin" /> : <RefreshCcw size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">Khôi phục</p>
                    <p className="text-[10px] text-zinc-500 font-medium">Nhập từ bản sao lưu</p>
                  </div>
                </div>
                <button 
                  onClick={handleRestoreClick} 
                  disabled={isRestoring}
                  className="text-xs font-bold text-green-600 hover:underline underline-offset-4 disabled:opacity-50"
                >
                  {isRestoring ? 'Đang khôi phục...' : 'Khôi phục'}
                </button>
              </div>

              <div className="pt-2 text-[10px] text-zinc-400 italic leading-relaxed">
                * Lưu ý: Tính năng sao lưu và khôi phục dữ liệu giúp bạn bảo vệ thông tin tòa nhà.
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isRestoreConfirmOpen}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onConfirm={handleRestoreConfirm}
        title="Xác nhận khôi phục dữ liệu"
        message="Bạn có chắc chắn muốn khôi phục dữ liệu? Hành động này sẽ ghi đè lên toàn bộ dữ liệu hiện tại và không thể hoàn tác."
      />

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />
    </div>
  );
}
