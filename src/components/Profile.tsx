import React, { useState } from 'react';
import { User } from '../types';
import { Card, Input, Button, Toast } from './UI';
import { User as UserIcon, Lock, Mail, Phone, MapPin } from 'lucide-react';

interface ProfileProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

export function Profile({ user, onUpdate }: ProfileProps) {
  const [formData, setFormData] = useState<User>(user);
  const [isEditing, setIsEditing] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', isVisible: boolean }>({ message: '', type: 'success', isVisible: false });

  const handleSave = () => {
    if (!formData.name?.trim()) {
      setToast({ message: 'Vui lòng nhập họ tên!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.email?.trim()) {
      setToast({ message: 'Vui lòng nhập email!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.phone?.trim()) {
      setToast({ message: 'Vui lòng nhập số điện thoại!', type: 'error', isVisible: true });
      return;
    }
    if (!formData.address?.trim()) {
      setToast({ message: 'Vui lòng nhập địa chỉ!', type: 'error', isVisible: true });
      return;
    }

    if (formData.phone && formData.phone.replace(/\D/g, '').length < 10) {
      setToast({ message: 'Số điện thoại phải có ít nhất 10 chữ số!', type: 'error', isVisible: true });
      return;
    }
    
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    if (!passwords.old || !passwords.new || !passwords.confirm) {
      setToast({ message: 'Vui lòng nhập đầy đủ thông tin!', type: 'error', isVisible: true });
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setToast({ message: 'Mật khẩu mới không khớp!', type: 'error', isVisible: true });
      return;
    }
    
    if (passwords.new.length < 6) {
      setToast({ message: 'Mật khẩu phải có ít nhất 6 ký tự!', type: 'error', isVisible: true });
      return;
    }
    
    onUpdate({ ...user, password: passwords.new, oldPassword: passwords.old });
    setPasswords({ old: '', new: '', confirm: '' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Thông tin cá nhân</h2>
          <p className="text-zinc-500 mt-1">Quản lý thông tin tài khoản và bảo mật của bạn.</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto shadow-lg shadow-green-200/50">Chỉnh sửa thông tin</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 text-center overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-green-600 to-emerald-600 opacity-10" />
          <div className="relative z-10 pt-8">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-green-600 mx-auto mb-4 border-4 border-white shadow-xl shadow-green-200/50">
              <UserIcon size={48} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">{user.name}</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Người thuê'}</p>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-100 space-y-4 text-left text-sm px-2">
            <div className="flex items-center gap-3 text-zinc-600 font-medium">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 shrink-0">
                <Mail size={16} />
              </div>
              <span className="truncate">{user.email || 'Chưa cập nhật'}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-600 font-medium">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 shrink-0">
                <Phone size={16} />
              </div>
              <span>{user.phone || 'Chưa cập nhật'}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-600 font-medium">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 shrink-0">
                <MapPin size={16} />
              </div>
              <span className="line-clamp-2">{user.address || 'Chưa cập nhật'}</span>
            </div>
          </div>
        </Card>

        <div className="md:col-span-2 space-y-8">
          {isEditing ? (
            <Card title="Chỉnh sửa thông tin">
              <div className="space-y-4">
                <Input label="Họ và tên" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <Input label="Email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <Input label="Số điện thoại" numeric value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                <Input label="Địa chỉ" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                <div className="flex gap-3 pt-4">
                  <Button className="flex-1 shadow-lg shadow-green-200/50" onClick={handleSave}>Lưu thay đổi</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setIsEditing(false)}>Hủy</Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Đổi mật khẩu">
              <div className="space-y-4">
                <Input 
                  label="Mật khẩu cũ" 
                  type="password" 
                  value={passwords.old} 
                  onChange={e => setPasswords({ ...passwords, old: e.target.value })} 
                />
                <Input 
                  label="Mật khẩu mới" 
                  type="password" 
                  value={passwords.new} 
                  onChange={e => setPasswords({ ...passwords, new: e.target.value })} 
                />
                <Input 
                  label="Xác nhận mật khẩu mới" 
                  type="password" 
                  value={passwords.confirm} 
                  onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} 
                />
                <Button className="w-full mt-4 shadow-lg shadow-green-200/50" onClick={handleChangePassword}>
                  <Lock size={18} /> Cập nhật mật khẩu
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />
    </div>
  );
}
