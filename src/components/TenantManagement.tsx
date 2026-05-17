import React, { useState } from 'react';
import { Tenant, Room, Contract, User, Notification } from '../types';
import { Card, Button, Input, Select, Modal, ConfirmModal, Table, THead, TBody, TH, TR, TD, Toast, cn } from './UI';
import { Plus, Edit2, Trash2, Search, User as UserIcon, CreditCard, Phone, MapPin, Home, RefreshCcw } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface TenantManagementProps {
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  createNotification: (notification: Notification) => Promise<void>;
  onRefresh: () => void;
}

export function TenantManagement({ tenants, setTenants, rooms, setRooms, contracts, setContracts, users, setUsers, setNotifications, createNotification, onRefresh }: TenantManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const [formData, setFormData] = useState<Partial<Tenant>>({ name: '', idCard: '', phone: '', address: '', email: '', roomId: '' });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setToast({ message: 'Đã cập nhật dữ liệu mới nhất', type: 'success', isVisible: true });
    } catch (error) {
      setToast({ message: 'Lỗi khi cập nhật dữ liệu', type: 'error', isVisible: true });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };
  
  const unlinkedUsers = React.useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'TENANT') return false;
      
      // 1. Kiểm tra qua liên kết tenantId
      if (u.tenantId) {
        const tenant = tenants.find(t => t.id === u.tenantId);
        // Nếu tìm thấy người thuê và người thuê đó đã có phòng -> Loại
        if (tenant && tenant.roomId && tenant.roomId !== '') return false;
      }
      
      // 2. Kiểm tra qua số điện thoại (đề phòng chưa liên kết tenantId)
      if (u.phone) {
        const userPhone = u.phone.replace(/\D/g, '');
        if (userPhone) {
          const tenantWithSamePhone = tenants.find(t => {
            const tPhone = (t.phone || '').replace(/\D/g, '');
            return tPhone === userPhone && t.roomId && t.roomId !== '';
          });
          // Nếu tìm thấy người thuê trùng số điện thoại và đã có phòng -> Loại
          if (tenantWithSamePhone) return false;
        }
      }
      
      return true;
    });
  }, [users, tenants]);
  
  const sortedRooms = React.useMemo(() => {
    const getNum = (name: string) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0]) : 999999;
    };
    
    return [...rooms].sort((a, b) => {
      const numA = getNum(a.name);
      const numB = getNum(b.name);
      
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [rooms]);

  const handleSave = async () => {
    // Validation
    if (!formData.name?.trim()) {
      setToast({ message: 'Vui lòng nhập họ và tên!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.idCard?.trim()) {
      setToast({ message: 'Vui lòng nhập số CCCD!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.phone?.trim()) {
      setToast({ message: 'Vui lòng nhập số điện thoại!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.address?.trim()) {
      setToast({ message: 'Vui lòng nhập địa chỉ thường trú!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.roomId) {
      setToast({ message: 'Vui lòng chọn phòng thuê!', type: 'error', isVisible: true });
      return;
    }

    if (formData.phone && formData.phone.replace(/\D/g, '').length < 10) {
      setToast({ message: 'Số điện thoại phải có ít nhất 10 chữ số!', type: 'error', isVisible: true });
      return;
    }
    
    try {
      if (editingTenant) {
        await apiFetch(`/api/tenants/${editingTenant.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        const tenantData = {
          ...formData,
          selectedUserId: selectedUserId || undefined
        };
        await apiFetch('/api/tenants', {
          method: 'POST',
          body: JSON.stringify(tenantData)
        });
      }

      onRefresh();
      setIsModalOpen(false);
      setEditingTenant(null);
      setSelectedUserId('');
      setFormData({ name: '', idCard: '', phone: '', address: '', email: '', roomId: '' });
      setToast({ message: editingTenant ? 'Cập nhật thành công!' : 'Thêm mới thành công!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('[TenantManagement] Error saving tenant:', err);
      setToast({ message: err.message || 'Lỗi khi lưu thông tin!', type: 'error', isVisible: true });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tenantToDelete) return;
    
    try {
      await apiFetch(`/api/tenants/${tenantToDelete.id}`, { method: 'DELETE' });
      onRefresh();
      setToast({ message: 'Đã xóa người thuê!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('[TenantManagement] Error deleting tenant:', err);
      setToast({ message: err.message || 'Lỗi khi xóa người thuê!', type: 'error', isVisible: true });
    } finally {
      setTenantToDelete(null);
    }
  };

  const filteredTenants = React.useMemo(() => {
    const filtered = tenants.filter(t => {
      const name = t.name?.toLowerCase() || '';
      const phone = t.phone?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return name.includes(search) || phone.includes(search);
    });

    return filtered.sort((a, b) => {
      const roomA = rooms.find(r => r.id === a.roomId)?.name || 'ZZZ';
      const roomB = rooms.find(r => r.id === b.roomId)?.name || 'ZZZ';
      
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      return collator.compare(roomA, roomB);
    });
  }, [tenants, searchTerm, rooms]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Quản lý người thuê</h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Danh sách khách hàng đang thuê trọ trong hệ thống.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            variant="secondary"
            onClick={handleRefresh}
            className="flex-1 sm:flex-none"
            title="Làm mới dữ liệu"
            disabled={isRefreshing}
          >
            <RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} />
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="flex-[3] sm:flex-none shadow-lg shadow-green-200/50">
            <Plus size={18} /> Thêm người thuê
          </Button>
        </div>
      </div>

      <Card className="p-2 bg-zinc-50/50 border-zinc-200/60">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <Table>
        <THead>
          <TR hover={false}>
            <TH className="w-16">STT</TH>
            <TH>Họ tên</TH>
            <TH>CCCD</TH>
            <TH>Số điện thoại</TH>
            <TH>Phòng</TH>
            <TH className="text-right">Thao tác</TH>
          </TR>
        </THead>
        <TBody>
          {filteredTenants.length > 0 ? (
            filteredTenants.map((tenant, index) => (
              <TR key={tenant.id} zebra={index % 2 !== 0}>
                <TD className="font-bold text-zinc-400 text-xs">{index + 1}</TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold text-sm border border-green-100 shadow-sm">
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 tracking-tight">{tenant.name}</span>
                      {tenant.email && <span className="text-[10px] text-green-600 lowercase tabular-nums">{tenant.email}</span>}
                    </div>
                  </div>
                </TD>
                <TD className="font-medium tabular-nums">{tenant.idCard}</TD>
                <TD className="font-medium tabular-nums">{tenant.phone}</TD>
                <TD>
                  <span className="px-3 py-1 bg-green-50 rounded-lg text-[10px] font-black text-green-700 uppercase tracking-wider border border-green-100">
                    {rooms.find(r => r.id === tenant.roomId)?.name || 'Chưa có'}
                  </span>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { setEditingTenant(tenant); setFormData(tenant); setIsModalOpen(true); }} 
                      className="p-2 hover:bg-green-50 hover:text-green-600 rounded-xl transition-colors text-zinc-400"
                      title="Sửa"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setTenantToDelete(tenant);
                        setIsConfirmOpen(true);
                      }} 
                      className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors text-zinc-400"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </TD>
              </TR>
            ))
          ) : (
            <TR hover={false}>
              <TD colSpan={6} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-200 mb-4">
                    <Search size={32} />
                  </div>
                  <p className="text-zinc-900 font-bold">Không tìm thấy người thuê</p>
                  <p className="text-zinc-500 text-sm mt-1">Thử thay đổi từ khóa tìm kiếm hoặc thêm người thuê mới.</p>
                </div>
              </TD>
            </TR>
          )}
        </TBody>
      </Table>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa người thuê"
        message="Bạn có chắc chắn muốn xóa người thuê và kết thúc hợp đồng thuê phòng này không?"
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingTenant(null); setSelectedUserId(''); }} 
        title={editingTenant ? "Sửa thông tin khách" : "Thêm khách thuê mới"}
      >
        <div className="space-y-5">
          {!editingTenant && unlinkedUsers.length > 0 && (
            <Select 
              label="Chọn tài khoản đăng ký (nếu có)" 
              value={selectedUserId} 
              onChange={e => {
                const userId = e.target.value;
                setSelectedUserId(userId);
                if (userId) {
                  const user = users.find(u => u.id === userId);
                  if (user) {
                    setFormData({
                      ...formData,
                      name: user.name || '',
                      idCard: user.idCard || '',
                      phone: user.phone || '',
                      address: user.address || '',
                      email: user.email || ''
                    });
                  }
                }
              }}
              options={[
                { value: '', label: 'Tự nhập thông tin' },
                ...unlinkedUsers.map(u => ({ 
                  value: u.id, 
                  label: `${u.name} (${u.username})` 
                }))
              ]}
            />
          )}
          <Input label="Họ và tên" icon={<UserIcon size={18} />} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nguyễn Văn A" />
          <Input label="Số CCCD" numeric icon={<CreditCard size={18} />} value={formData.idCard || ''} onChange={e => setFormData({ ...formData, idCard: e.target.value })} placeholder="012345678901" />
          <Input label="Số điện thoại" numeric icon={<Phone size={18} />} value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="0987654321" />
          <Input label="Địa chỉ thường trú" icon={<MapPin size={18} />} value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Hà Nội, Việt Nam" />
          <Input label="Email" type="email" icon={<RefreshCcw size={18} />} value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
          <Select 
            label="Phòng thuê" 
            value={formData.roomId || ''} 
            onChange={e => setFormData({ ...formData, roomId: e.target.value })}
            options={[
              { value: '', label: 'Chọn phòng' },
              ...sortedRooms.map(r => ({ 
                value: r.id, 
                label: `${r.name} ${r.status === 'OCCUPIED' ? '(Đã thuê)' : '(Trống)'}` 
              }))
            ]}
          />
          <Button className="w-full h-12 text-base font-bold mt-4" onClick={handleSave}>Lưu thông tin</Button>
        </div>
      </Modal>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />
    </div>
  );
}
