import React, { useState } from 'react';
import { User, Tenant, Room } from '../types';
import { Card, Button, Input, Select, Modal, ConfirmModal, Toast, Table, THead, TBody, TH, TR, TD, cn } from './UI';
import { Plus, Edit2, Trash2, Lock, Unlock, Search, User as UserIcon, Shield, Phone, Key, UserPlus, AlertCircle, Mail, MapPin } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface UserManagementProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  tenants: Tenant[];
  rooms: Room[];
  onRefresh: () => void;
}

export function UserManagement({ users, setUsers, tenants, rooms, onRefresh }: UserManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'TENANT',
    status: 'ACTIVE',
    tenantId: '',
    phone: '',
    address: '',
    idCard: ''
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  const handleSave = async () => {
    // Validation
    if (!formData.username?.trim()) {
      showToast('Vui lòng nhập tên đăng nhập!', 'error');
      return;
    }
    if (!editingUser && !formData.password?.trim()) {
      showToast('Vui lòng nhập mật khẩu!', 'error');
      return;
    }
    if (!formData.name?.trim()) {
      showToast('Vui lòng nhập họ tên!', 'error');
      return;
    }
    if (!formData.email?.trim()) {
      showToast('Vui lòng nhập email!', 'error');
      return;
    }
    if (!formData.phone?.trim()) {
      showToast('Vui lòng nhập số điện thoại!', 'error');
      return;
    }
    if (!formData.idCard?.trim()) {
      showToast('Vui lòng nhập số CCCD!', 'error');
      return;
    }
    if (!formData.address?.trim()) {
      showToast('Vui lòng nhập địa chỉ!', 'error');
      return;
    }
    if (!formData.role) {
      showToast('Vui lòng chọn vai trò!', 'error');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      showToast('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
      return;
    }

    if (formData.phone && formData.phone.replace(/\D/g, '').length < 10) {
      showToast('Số điện thoại phải có ít nhất 10 chữ số!', 'error');
      return;
    }

    try {
      if (editingUser) {
        await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        showToast('Cập nhật tài khoản thành công!');
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        showToast('Thêm tài khoản thành công!');
      }

      onRefresh();
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu tài khoản!', 'error');
    }
  };

  const toggleStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const newStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';

    try {
      await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      onRefresh();
      showToast(newStatus === 'ACTIVE' ? 'Đã mở khóa tài khoản!' : 'Đã khóa tài khoản!');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái!', 'error');
    }
  };

  const handleDelete = async () => {
    if (userToDelete) {
      try {
        await apiFetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
        onRefresh();
        showToast('Đã xóa tài khoản!');
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      } catch (err: any) {
        showToast(err.message || 'Lỗi khi xóa tài khoản!', 'error');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const name = u.name?.toLowerCase() || '';
    const username = u.username?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return name.includes(search) || username.includes(search);
  }).sort((a, b) => {
    // 1. Prioritize ADMIN
    if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
    if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1;

    // 2. Sort by room name
    const tenantA = tenants.find(t => t.id === a.tenantId);
    const tenantB = tenants.find(t => t.id === b.tenantId);
    const roomA = rooms.find(r => r.id === tenantA?.roomId);
    const roomB = rooms.find(r => r.id === tenantB?.roomId);
    
    const nameA = roomA?.name || 'ZZZ'; // Put unlinked at the end
    const nameB = roomB?.name || 'ZZZ';
    
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Quản lý tài khoản</h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Quản lý quyền truy cập và thông tin đăng nhập hệ thống.</p>
        </div>
        <Button onClick={() => { 
          setEditingUser(null); 
          setFormData({
            username: '',
            password: '',
            name: '',
            role: 'TENANT',
            status: 'ACTIVE',
            tenantId: ''
          }); 
          setIsModalOpen(true); 
        }} className="w-full sm:w-auto shadow-lg shadow-green-200/50">
          <Plus size={18} /> Thêm tài khoản
        </Button>
      </div>

      <Card className="p-2 bg-zinc-50/50 border-zinc-200/60">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Tìm kiếm theo tên hoặc tên đăng nhập..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-zinc-200 shadow-none">
        <Table>
          <THead>
            <TR>
              <TH className="w-16">STT</TH>
              <TH>Tên đăng nhập</TH>
              <TH>Họ tên</TH>
              <TH>Phòng</TH>
              <TH>Vai trò</TH>
              <TH>Trạng thái</TH>
              <TH className="text-right">Thao tác</TH>
            </TR>
          </THead>
          <TBody>
            {filteredUsers.map((user, index) => {
              const tenant = tenants.find(t => t.id === user.tenantId);
              return (
                <TR key={user.id}>
                  <TD className="text-zinc-400 font-bold">{index + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400">
                        <Key size={14} />
                      </div>
                      <span className="font-mono text-sm font-bold text-zinc-600">{user.username}</span>
                    </div>
                  </TD>
                  <TD>
                    <div className="font-bold text-zinc-900">{user.name}</div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{user.phone}</div>
                      {user.email && <div className="text-[10px] text-green-600 font-medium lowercase italic">{user.email}</div>}
                      {user.address && <div className="text-[10px] text-zinc-400 truncate max-w-[150px]">{user.address}</div>}
                    </div>
                  </TD>
                  <TD>
                    {tenant ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-black uppercase tracking-tighter border border-green-100">
                        {rooms.find(r => r.id === tenant.roomId)?.name || tenant.roomId || 'N/A'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-300 font-black uppercase tracking-widest italic">Chưa liên kết</span>
                    )}
                  </TD>
                  <TD>
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm",
                      user.role === 'ADMIN' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200'
                    )}>
                      {user.role}
                    </span>
                  </TD>
                  <TD>
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm",
                      user.status === 'ACTIVE' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                    )}>
                      {user.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => toggleStatus(user.id)} 
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          user.status === 'ACTIVE' ? 'hover:bg-rose-50 text-rose-400 hover:text-rose-600' : 'hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600'
                        )}
                        title={user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                      >
                        {user.status === 'ACTIVE' ? <Lock size={18} /> : <Unlock size={18} />}
                      </button>
                      <button 
                        onClick={() => { 
                          setEditingUser(user); 
                          setFormData({
                            ...user,
                            tenantId: user.tenantId || ''
                          }); 
                          setIsModalOpen(true); 
                        }} 
                        className="p-2 hover:bg-green-50 rounded-xl text-zinc-400 hover:text-green-600 transition-all"
                        title="Sửa tài khoản"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteModalOpen(true);
                        }} 
                        className="p-2 hover:bg-rose-50 rounded-xl text-zinc-400 hover:text-rose-600 transition-all"
                        title="Xóa tài khoản"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? "Cập nhật tài khoản" : "Thêm tài khoản mới"}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input 
              label="Tên đăng nhập" 
              icon={<UserIcon size={18} className="text-green-500" />}
              value={formData.username || ''} 
              onChange={e => setFormData({ ...formData, username: e.target.value })} 
              className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
            <Input 
              label="Mật khẩu" 
              type="password" 
              icon={<Key size={18} className="text-green-500" />}
              placeholder={editingUser ? "Để trống nếu không đổi" : "Nhập mật khẩu"}
              value={formData.password || ''} 
              onChange={e => setFormData({ ...formData, password: e.target.value })} 
              className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input 
              label="Họ tên" 
              icon={<UserPlus size={18} className="text-green-500" />}
              value={formData.name || ''} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
            <Input 
              label="Email" 
              type="email"
              icon={<Mail size={18} className="text-green-500" />}
              value={formData.email || ''} 
              onChange={e => setFormData({ ...formData, email: e.target.value })} 
              className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input 
              label="Số điện thoại" 
              numeric
              icon={<Phone size={18} className="text-green-500" />}
              value={formData.phone || ''} 
              onChange={e => setFormData({ ...formData, phone: e.target.value })} 
              className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
            <Input 
              label="Số CCCD" 
              numeric
              icon={<Shield size={18} className="text-green-500" />}
              value={formData.idCard || ''} 
              onChange={e => setFormData({ ...formData, idCard: e.target.value })} 
              className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
          </div>
          <Input 
            label="Địa chỉ" 
            icon={<MapPin size={18} className="text-green-500" />}
            value={formData.address || ''} 
            onChange={e => setFormData({ ...formData, address: e.target.value })} 
            className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
          />
          <Select 
            label="Vai trò hệ thống" 
            icon={<Shield size={18} className="text-green-500" />}
            value={formData.role || 'TENANT'} 
            onChange={e => setFormData({ ...formData, role: e.target.value as any })}
            className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            options={[
              { value: 'TENANT', label: 'Người thuê (Tenant)' },
              { value: 'ADMIN', label: 'Quản trị viên (Admin)' }
            ]}
          />
          {formData.role === 'TENANT' && (
            <div className="space-y-3">
              <Select 
                label="Liên kết với người thuê" 
                icon={<UserIcon size={18} className="text-green-500" />}
                value={formData.tenantId || ''} 
                onChange={e => setFormData({ ...formData, tenantId: e.target.value })}
                className="rounded-xl border-zinc-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
                options={[
                  { value: '', label: 'Không liên kết' },
                  ...tenants.map(t => ({ value: t.id, label: `${t.name} (${t.phone})` }))
                ]}
              />
              <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-start gap-3">
                <AlertCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider leading-relaxed">
                  Tài khoản phải được liên kết với "Người thuê" để nhận thông báo hóa đơn tự động.
                </p>
              </div>
            </div>
          )}
          <Button className="w-full mt-4 shadow-lg shadow-green-200/50 rounded-2xl h-12 text-base font-bold" onClick={handleSave}>
            {editingUser ? "Cập nhật tài khoản" : "Tạo tài khoản ngay"}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa"
        message={`Bạn có chắc chắn muốn xóa tài khoản "${userToDelete?.username}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa tài khoản"
        cancelText="Hủy"
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
