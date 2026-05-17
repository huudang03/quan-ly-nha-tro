import React, { useState } from 'react';
import { Contract, Room, Tenant, User, Notification } from '../types';
import { Card, Button, Input, DateInput, Select, Modal, ConfirmModal, Toast, cn } from './UI';
import { Plus, FileText, Search, Calendar, User as UserIcon, Edit2, Trash2, Eye, Zap, Banknote, Loader2, AlertCircle, Clock, RefreshCcw } from 'lucide-react';
import { differenceInMonths, parseISO, isWithinInterval, addDays, differenceInDays } from 'date-fns';
import { formatDate } from '../lib/dateUtils';
import { apiFetch } from '../lib/api';

interface ContractManagementProps {
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  isAdmin: boolean;
  currentUser: User;
  users: User[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  createNotification: (notification: Notification) => Promise<void>;
  onRefresh: () => void;
}

export function ContractManagement({ contracts, setContracts, rooms, setRooms, tenants, setTenants, isAdmin, currentUser, users, setNotifications, createNotification, onRefresh }: ContractManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contractToTerminate, setContractToTerminate] = useState<string | null>(null);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Contract>>({ roomId: '', tenantId: '', startDate: '', endDate: '', deposit: 0 });
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', isVisible: boolean }>({ message: '', type: 'success', isVisible: false });

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
  
  const getDuration = (start: string, end: string) => {
    if (!start || !end) return 0;
    try {
      const months = differenceInMonths(parseISO(end), parseISO(start));
      return Math.max(0, months);
    } catch (e) {
      return 0;
    }
  };

  const getStatusInfo = (contract: Contract) => {
    if (contract.status === 'TERMINATED') return { label: 'Đã kết thúc', color: 'bg-rose-500 text-white border-rose-600' };
    
    const today = new Date();
    const endDate = parseISO(contract.endDate);
    const thirtyDaysFromNow = addDays(today, 30);
    
    if (isWithinInterval(endDate, { start: today, end: thirtyDaysFromNow })) {
      return { label: 'Sắp hết hạn', color: 'bg-amber-500 text-white border-amber-600' };
    }
    
    return { label: 'Đang hiệu lực', color: 'bg-emerald-500 text-white border-emerald-600' };
  };

  const errors = React.useMemo(() => {
    const errs: Record<string, string> = {};
    
    if (!formData.startDate) {
      errs.startDate = 'Vui lòng nhập ngày bắt đầu';
    }
    
    if (!formData.endDate) {
      errs.endDate = 'Vui lòng nhập ngày kết thúc';
    }

    if (formData.startDate && formData.endDate) {
      const start = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);
      if (start >= end) {
        errs.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
      }
    }

    if (formData.deposit !== undefined && formData.deposit <= 0) {
      errs.deposit = 'Tiền đặt cọc phải lớn hơn 0';
    }
    if (!formData.roomId) errs.roomId = 'Vui lòng chọn phòng';
    if (!formData.tenantId) errs.tenantId = 'Vui lòng chọn người thuê';
    return errs;
  }, [formData]);

  const isValid = Object.keys(errors).length === 0;

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

  const sortedTenants = React.useMemo(() => {
    return [...tenants].sort((a, b) => a.name.localeCompare(b.name));
  }, [tenants]);

  const openModal = (contract?: Contract, viewOnly: boolean = false) => {
    if (contract) {
      setEditingContract(contract);
      setFormData(contract);
      setIsViewOnly(viewOnly);
    } else {
      setEditingContract(null);
      setFormData({ roomId: '', tenantId: '', startDate: '', endDate: '', deposit: 0 });
      setIsViewOnly(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!isAdmin || !isValid || isSaving) return;
    setIsSaving(true);
    
    try {
      if (editingContract) {
        await apiFetch(`/api/contracts/${editingContract.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await apiFetch('/api/contracts', {
          method: 'POST',
          body: JSON.stringify({
            roomId: formData.roomId || '',
            tenantId: formData.tenantId || '',
            startDate: formData.startDate || '',
            endDate: formData.endDate || '',
            deposit: Number(formData.deposit) || 0,
            status: 'ACTIVE',
          })
        });
      }

      onRefresh();
      setToast({ message: editingContract ? 'Đã cập nhật hợp đồng!' : 'Đã tạo hợp đồng mới!', type: 'success', isVisible: true });
      setIsModalOpen(false);
      setEditingContract(null);
      setFormData({ roomId: '', tenantId: '', startDate: '', endDate: '', deposit: 0 });
    } catch (err: any) {
      console.error('Error saving contract:', err);
      setToast({ message: err.message || 'Lỗi khi lưu hợp đồng', type: 'error', isVisible: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!contractToDelete) return;

    const contract = contracts.find(c => c.id === contractToDelete);
    if (contract?.status === 'ACTIVE') {
      setToast({ message: 'Không thể xóa hợp đồng đang có hiệu lực!', type: 'error', isVisible: true });
      setContractToDelete(null);
      setIsDeleteConfirmOpen(false);
      return;
    }

    try {
      await apiFetch(`/api/contracts/${contractToDelete}`, { method: 'DELETE' });
      onRefresh();
      setToast({ message: 'Đã xóa hợp đồng!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Error deleting contract:', err);
      setToast({ message: err.message || 'Lỗi khi xóa hợp đồng', type: 'error', isVisible: true });
    } finally {
      setContractToDelete(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleTerminateConfirm = async () => {
    if (!contractToTerminate) return;

    try {
      await apiFetch(`/api/contracts/${contractToTerminate}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'TERMINATED' })
      });
      onRefresh();
      setToast({ message: 'Đã kết thúc hợp đồng!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Error terminating contract:', err);
      setToast({ message: err.message || 'Lỗi khi kết thúc hợp đồng', type: 'error', isVisible: true });
    } finally {
      setContractToTerminate(null);
      setIsConfirmOpen(false);
    }
  };

  const filteredContracts = React.useMemo(() => {
    const filtered = isAdmin 
      ? contracts.filter(c => {
          const room = rooms.find(r => r.id === c.roomId);
          const tenant = tenants.find(t => t.id === c.tenantId);
          const roomName = room?.name?.toLowerCase() || '';
          const tenantName = tenant?.name?.toLowerCase() || '';
          const search = searchTerm.toLowerCase();
          return roomName.includes(search) || tenantName.includes(search);
        })
      : contracts.filter(c => c.tenantId === currentUser.tenantId);

    return filtered.sort((a, b) => {
      const roomA = rooms.find(r => r.id === a.roomId)?.name || 'ZZZ';
      const roomB = rooms.find(r => r.id === b.roomId)?.name || 'ZZZ';
      
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      return collator.compare(roomA, roomB);
    });
  }, [contracts, isAdmin, rooms, tenants, searchTerm, currentUser.tenantId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
            {isAdmin ? 'Quản lý hợp đồng' : 'Hợp đồng của tôi'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Quản lý các cam kết thuê phòng và tiền đặt cọc.</p>
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
          {isAdmin && (
            <Button onClick={() => openModal()} className="flex-[3] sm:flex-none shadow-lg shadow-green-200/50">
              <Plus size={18} /> Tạo hợp đồng mới
            </Button>
          )}
        </div>
      </div>

      {isAdmin && (
        <Card className="p-2 bg-zinc-50/50 border-zinc-200/60">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên phòng hoặc người thuê..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {filteredContracts.length > 0 ? (
          filteredContracts.map(contract => {
            const duration = getDuration(contract.startDate, contract.endDate);
            const today = new Date();
            const endDate = parseISO(contract.endDate);
            const daysToExpiry = differenceInDays(endDate, today);
            const isExpiringSoon = contract.status === 'ACTIVE' && daysToExpiry >= 0 && daysToExpiry < 7;
            const isTerminated = contract.status === 'TERMINATED';
            
            return (
              <div key={contract.id}>
                <Card 
                  className={cn(
                    "p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 cursor-pointer bg-white overflow-hidden",
                    isTerminated ? "border-l-4 border-l-red-400" : 
                    isExpiringSoon ? "border-l-4 border-l-yellow-400" : 
                    "border-l-4 border-l-green-400"
                  )}
                  onClick={() => openModal(contract, !isAdmin)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    {/* Left: Room Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                        <FileText size={24} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-lg font-bold text-zinc-900 truncate">
                          {rooms.find(r => r.id === contract.roomId)?.name}
                        </h4>
                        <p className="text-sm text-zinc-500 truncate">
                          {tenants.find(t => t.id === contract.tenantId)?.name}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Contract Info */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-zinc-100 px-3 py-1 rounded-full text-xs text-zinc-600 flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar size={12} />
                          {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                        </span>
                        <span className="bg-zinc-100 px-3 py-1 rounded-full text-xs text-zinc-600 flex items-center gap-1.5 whitespace-nowrap">
                          <Clock size={12} />
                          {duration} tháng
                        </span>
                      </div>
                      {isExpiringSoon && (
                        <div className="flex">
                          <span className="bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <AlertCircle size={12} />
                            Sắp hết hạn
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Deposit + Status + Actions */}
                    <div className="flex flex-col md:items-end gap-3">
                      <div className="flex flex-col md:items-end">
                        <span className="text-xs text-zinc-400 font-medium">Tiền đặt cọc</span>
                        <p className="text-2xl font-bold text-green-600">
                          {(contract.deposit || 0).toLocaleString()}đ
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                          isTerminated ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                        )}>
                          {isTerminated ? 'ĐÃ KẾT THÚC' : 'ĐANG HIỆU LỰC'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(contract, !isAdmin);
                            }}
                            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors"
                          >
                            Chi tiết
                          </button>
                          
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal(contract, false);
                                }}
                                className="p-2 rounded hover:bg-zinc-100 text-zinc-400 transition-colors"
                                title="Sửa"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContractToDelete(contract.id);
                                  setIsDeleteConfirmOpen(true);
                                }}
                                className={cn(
                                  "p-2 rounded transition-colors",
                                  contract.status === 'ACTIVE' ? "text-zinc-400 hover:text-red-500 hover:bg-red-50" : "hover:bg-zinc-100 text-zinc-400 hover:text-red-600"
                                )}
                                title="Xóa"
                              >
                                <Trash2 size={18} />
                              </button>
                              
                              {contract.status === 'ACTIVE' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setContractToTerminate(contract.id);
                                    setIsConfirmOpen(true);
                                  }}
                                  className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors ml-1"
                                >
                                  Kết thúc
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })
        ) : (
          <div className="py-24 bg-white rounded-[3rem] border border-dashed border-zinc-200 flex flex-col items-center justify-center text-center px-6">
            <div className="w-24 h-24 bg-green-50 rounded-[2.5rem] flex items-center justify-center text-green-300 mb-8">
              <FileText size={48} />
            </div>
            <h3 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Chưa có hợp đồng nào</h3>
            <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto font-medium">
              {searchTerm ? 'Không tìm thấy hợp đồng nào khớp với từ khóa của bạn.' : 'Bắt đầu quản lý bằng cách tạo hợp đồng thuê đầu tiên cho người thuê của bạn.'}
            </p>
            <div className="mt-10 flex gap-4">
              {searchTerm ? (
                <Button variant="outline" onClick={() => setSearchTerm('')} className="rounded-2xl px-8">
                  Xóa tìm kiếm
                </Button>
              ) : (
                isAdmin && (
                  <Button onClick={() => openModal()} className="shadow-lg shadow-green-200/50 rounded-2xl px-8 h-12">
                    <Plus size={18} /> Tạo hợp đồng ngay
                  </Button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleTerminateConfirm}
        title="Xác nhận kết thúc hợp đồng"
        message="Bạn có chắc chắn muốn kết thúc hợp đồng này? Phòng sẽ được chuyển về trạng thái trống."
      />

      <ConfirmModal 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa hợp đồng"
        message="Bạn có chắc chắn muốn xóa hợp đồng này? Thao tác này không thể hoàn tác."
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingContract(null);
          setFormData({ roomId: '', tenantId: '', startDate: '', endDate: '', deposit: undefined });
        }} 
        title={isViewOnly ? "Chi tiết hợp đồng" : (editingContract ? "Sửa hợp đồng" : "Tạo hợp đồng thuê mới")}
      >
        <div className="space-y-6">
          <div className="space-y-5">
            <Select 
              label="Phòng thuê" 
              value={formData.roomId || ''} 
              onChange={e => setFormData({ ...formData, roomId: e.target.value })}
              disabled={isViewOnly || isSaving}
              className={cn(
                "rounded-xl border-zinc-200 px-4 py-2.5 focus:ring-2 focus:ring-green-500/20 transition-all duration-200",
                errors.roomId && "border-rose-500 focus:ring-rose-500/10"
              )}
              options={[
                { value: '', label: 'Chọn phòng' },
                ...sortedRooms.map(r => ({ 
                  value: r.id, 
                  label: `${r.name} ${r.status === 'OCCUPIED' ? '(Đã thuê)' : '(Trống)'}` 
                }))
              ]}
            />
            {errors.roomId && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider ml-1 -mt-4 flex items-center gap-1"><AlertCircle size={10} /> {errors.roomId}</p>}

            <Select 
              label="Người thuê" 
              value={formData.tenantId || ''} 
              onChange={e => setFormData({ ...formData, tenantId: e.target.value })}
              disabled={isViewOnly || isSaving || !formData.roomId}
              className={cn(
                "rounded-xl border-zinc-200 px-4 py-2.5 focus:ring-2 focus:ring-green-500/20 transition-all duration-200",
                errors.tenantId && "border-rose-500 focus:ring-rose-500/10"
              )}
              options={[
                { 
                  value: '', 
                  label: !formData.roomId 
                    ? 'Vui lòng chọn phòng trước' 
                    : 'Chọn người thuê'
                },
                ...sortedTenants
                  .filter(t => !t.roomId || t.roomId === formData.roomId)
                  .map(t => ({ 
                    value: t.id, 
                    label: `${t.name}${t.roomId === formData.roomId ? ' (Đã ở phòng này)' : ' (Chưa có phòng)'}` 
                  }))
              ]}
            />
            {errors.tenantId && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider ml-1 -mt-4 flex items-center gap-1"><AlertCircle size={10} /> {errors.tenantId}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <DateInput 
                  label="Ngày bắt đầu" 
                  value={formData.startDate || ''} 
                  onChange={(val: string) => setFormData({ ...formData, startDate: val })} 
                  disabled={isViewOnly || isSaving}
                  min={!editingContract ? new Date().toISOString().split('T')[0] : undefined}
                  className={cn(
                    "rounded-xl border-zinc-200 py-2.5 focus:ring-2 focus:ring-green-500/20 transition-all duration-200",
                    errors.startDate && "border-rose-500 focus:ring-rose-500/10"
                  )}
                />
                {errors.startDate && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider ml-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.startDate}</p>}
              </div>
              <div className="space-y-1.5">
                <DateInput 
                  label="Ngày kết thúc" 
                  value={formData.endDate || ''} 
                  onChange={(val: string) => setFormData({ ...formData, endDate: val })} 
                  disabled={isViewOnly || isSaving}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className={cn(
                    "rounded-xl border-zinc-200 py-2.5 focus:ring-2 focus:ring-green-500/20 transition-all duration-200",
                    errors.endDate && "border-rose-500 focus:ring-rose-500/10"
                  )}
                />
                {errors.endDate && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider ml-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.endDate}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Input 
                label="Tiền đặt cọc" 
                numeric
                placeholder="Nhập tiền đặt cọc..."
                value={formData.deposit || ''} 
                onChange={e => setFormData({ ...formData, deposit: e.target.value === '' ? 0 : Number(e.target.value) })} 
                disabled={isViewOnly || isSaving}
                className={cn(
                  "rounded-xl border-zinc-200 px-4 py-3 text-lg font-semibold text-green-600 focus:ring-2 focus:ring-green-500/20 transition-all duration-200",
                  errors.deposit && "border-rose-500 focus:ring-rose-500/10"
                )}
              />
              <div className="flex justify-between items-center px-1">
                {errors.deposit ? (
                  <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.deposit}
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-green-600/60 uppercase tracking-widest">
                    {formData.deposit ? `${formData.deposit.toLocaleString()} VNĐ` : '0 VNĐ'}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {!isViewOnly && (
            <Button 
              className="w-full mt-6 shadow-lg shadow-green-200/50 hover:scale-[1.02] transition-all duration-300 py-4 text-base relative overflow-hidden" 
              onClick={handleSave}
              disabled={!isValid || isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={20} className="animate-spin" />
                  Đang lưu...
                </span>
              ) : (
                editingContract ? "Lưu thay đổi" : "Xác nhận tạo hợp đồng"
              )}
            </Button>
          )}
          
          {isViewOnly && (
            <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-xs text-zinc-500 italic text-center">
                Đây là bản xem trước hợp đồng. Vui lòng liên hệ quản lý nếu có thắc mắc.
              </p>
              <Button variant="outline" className="w-full mt-4" onClick={() => setIsModalOpen(false)}>
                Đóng
              </Button>
            </div>
          )}
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
