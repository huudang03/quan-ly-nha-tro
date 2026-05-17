import React, { useState, useEffect } from 'react';
import { Room, Tenant, Contract, Notification, User } from '../types';
import { Card, Button, Input, Select, Modal, ConfirmModal, cn } from './UI';
import { Plus, Edit2, Trash2, Users, Search, LogOut, Home, RefreshCcw } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface RoomManagementProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  isAdmin: boolean;
  currentUser: User;
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  createNotification: (notification: Notification) => Promise<void>;
  users: User[];
  onRefresh: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function RoomManagement({ rooms, setRooms, isAdmin, currentUser, tenants, setTenants, contracts, setContracts, setNotifications, createNotification, users, onRefresh, showToast }: RoomManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [roomToCheckout, setRoomToCheckout] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedRoomForDetail, setSelectedRoomForDetail] = useState<Room | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Room & { image?: File }>>({ name: '', area: undefined, price: undefined, status: 'AVAILABLE' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: '', area: undefined, price: undefined, status: 'AVAILABLE', description: '' });
    setEditingRoom(null);
    setImagePreview(null);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      showToast('Đã cập nhật dữ liệu mới nhất', 'success');
    } catch (error) {
      showToast('Lỗi khi cập nhật dữ liệu', 'error');
    } finally {
      // Small delay to make the animation visible
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSave = async () => {
    console.log('[RoomManagement] handleSave triggered. formData:', formData, 'editingRoom:', editingRoom);
    if (!formData.name) {
      console.warn('[RoomManagement] Name is missing.');
      showToast('Vui lòng nhập tên phòng', 'error');
      return;
    }

    if (formData.area === undefined || formData.area === null) {
      showToast('Vui lòng nhập diện tích phòng', 'error');
      return;
    }

    if (formData.area < 0) {
      showToast('Diện tích không được là số âm', 'error');
      return;
    }

    if (formData.price === undefined || formData.price === null) {
      showToast('Vui lòng nhập giá thuê phòng', 'error');
      return;
    }

    if (formData.price < 0) {
      showToast('Giá thuê không được là số âm', 'error');
      return;
    }

    try {
      let imageUrl = editingRoom?.imageUrl || null;

      // Handle image upload - Convert to Base64 for permanent storage in database
      if (formData.image) {
        console.log('[RoomManagement] Converting image to Base64...');
        if (formData.image.size > 600 * 1024) {
          showToast('Ảnh quá lớn (vui lòng chọn ảnh dưới 600KB để đảm bảo lưu trữ vĩnh viễn)', 'error');
          return;
        }

        imageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(formData.image!);
        });
        console.log('[RoomManagement] Image converted to Base64');
      } else if (imagePreview === null) {
        // Image was removed
        imageUrl = null;
      }

      const roomData = {
        name: formData.name || '',
        price: Number(formData.price || 0),
        area: Number(formData.area || 0),
        status: formData.status || 'AVAILABLE',
        description: formData.description || '',
        tenantId: formData.tenantId || null,
        imageUrl: imageUrl,
        updatedAt: new Date().toISOString()
      };

      if (editingRoom) {
        console.log('[RoomManagement] Updating room:', editingRoom.id);
        await apiFetch(`/api/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: JSON.stringify(roomData)
        });
        showToast('Đã cập nhật thông tin phòng thành công!', 'success');
        onRefresh();
      } else {
        console.log('[RoomManagement] Creating new room');
        await apiFetch('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(roomData)
        });
        showToast('Đã thêm phòng mới thành công!', 'success');
        onRefresh();
      }
      console.log('[RoomManagement] Save successful');
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('[RoomManagement] Error saving room:', error);
      showToast(`Lỗi: ${error.message}`, 'error');
      setNotifications(prev => [{
        id: Date.now().toString(),
        userId: 'system',
        title: 'Lỗi',
        content: `Không thể lưu thông tin phòng: ${error.message}`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString()
      }, ...prev]);
    }
  };

  const handleDeleteConfirm = async () => {
    if (roomToDelete) {
      const room = rooms.find(r => r.id === roomToDelete);
      const hasTenant = tenants.some(t => t.roomId === roomToDelete);
      
      if (room && (room.status === 'OCCUPIED' || hasTenant)) {
        showToast('Không thể xóa phòng đang có người thuê. Vui lòng thực hiện trả phòng trước.', 'error');
        setRoomToDelete(null);
        return;
      }

      try {
        await apiFetch(`/api/rooms/${roomToDelete}`, { method: 'DELETE' });
        showToast('Đã xóa phòng thành công!', 'success');
        onRefresh();
      } catch (err: any) {
        showToast(err.message || 'Lỗi khi xóa phòng', 'error');
      } finally {
        setRoomToDelete(null);
      }
    }
  };

  const handleCheckoutConfirm = async () => {
    if (!roomToCheckout) return;

    const roomId = roomToCheckout;
    try {
      await apiFetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'AVAILABLE', tenantId: null })
      });
      showToast('Đã xác nhận trả phòng thành công!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi trả phòng', 'error');
    } finally {
      setRoomToCheckout(null);
    }
  };

  const filteredRooms = React.useMemo(() => {
    const filtered = rooms.filter(r => {
      const name = r.name?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return name.includes(search);
    });
    
    const getNum = (name: string) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };

    return filtered.sort((a, b) => {
      const numA = getNum(a.name);
      const numB = getNum(b.name);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  }, [rooms, searchTerm]);

  const groupedRooms = filteredRooms.reduce((acc, room) => {
    const floorMatch = room.name.match(/\d/);
    const floor = floorMatch ? floorMatch[0] : 'Khác';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  const sortedFloors = Object.keys(groupedRooms).sort((a, b) => {
    if (a === 'Khác') return 1;
    if (b === 'Khác') return -1;
    return a.localeCompare(b);
  });

  sortedFloors.forEach(floor => {
    const getNum = (name: string) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };
    groupedRooms[floor].sort((a, b) => {
      const numA = getNum(a.name);
      const numB = getNum(b.name);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Quản lý phòng trọ</h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Theo dõi, chỉnh sửa và quản lý danh sách phòng trong hệ thống.</p>
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
            <Button 
              onClick={() => { resetForm(); setIsModalOpen(true); }} 
              className="flex-[3] sm:flex-none shadow-lg shadow-green-200/50 hover:scale-105 transition-all duration-300"
            >
              <Plus size={18} /> Thêm phòng mới
            </Button>
          )}
        </div>
      </div>

      <Card className="p-2 bg-zinc-50/50 border-zinc-200/60">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Tìm kiếm theo tên phòng..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <div className="space-y-10">
        {sortedFloors.length > 0 ? (
          sortedFloors.map(floor => (
            <div key={floor} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-zinc-100" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">
                  {floor === 'Khác' ? 'Khu vực khác' : `Tầng ${floor}`}
                </h3>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {groupedRooms[floor].map(room => {
                  // Logic xác định phòng của user đang thuê
                  const userInList = users.find(u => u.id === currentUser.id);
                  const effectiveTenantId = userInList?.tenantId || currentUser.tenantId;
                  const myTenant = tenants.find(t => t.id === effectiveTenantId);
                  
                  // Kiểm tra đa lớp: qua tenantId, qua roomIds của user, hoặc qua roomId của tenant
                  const isMyRoom = currentUser.role === 'TENANT' && (
                    (myTenant && String(myTenant.roomId) === String(room.id)) ||
                    (currentUser.roomIds?.includes(room.id)) ||
                    (userInList?.roomIds?.includes(room.id))
                  );
                  
                  if (isMyRoom) {
                    console.log("DEBUG - MY ROOM FOUND:", {
                      roomName: room.name,
                      roomId: room.id,
                      tenant: myTenant,
                      user: userInList
                    });
                  }
                  
                  return (
                    <div key={room.id} className="relative">
                      <Card 
                        onClick={() => setSelectedRoomForDetail(room)}
                        className={cn(
                          "group relative w-full h-80 overflow-hidden p-0 border-zinc-200 rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 bg-white cursor-pointer",
                          isMyRoom && "ring-4 ring-green-500 border-green-600 shadow-green-200/50"
                        )}
                      >
                        {/* Room Image - Layer 1 Base */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden">
                          {room.imageUrl ? (
                            <img 
                              src={room.imageUrl} 
                              alt={room.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${room.id}/800/600`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-300">
                              <Home size={48} />
                            </div>
                          )}
                          
                          {/* Default Gradient for Layer 1 visibility */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-300" />
                        </div>

                        {/* Layer 1: Default Info (Visible when not hovered) */}
                        <div className="absolute inset-0 p-6 flex flex-col justify-end group-hover:opacity-0 transition-all duration-300">
                          <div className="flex justify-between items-end">
                            <div className="space-y-1">
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-md mb-2",
                                room.status === 'AVAILABLE' ? "bg-amber-500/80 text-white" : "bg-green-500/80 text-white"
                              )}>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                {room.status === 'AVAILABLE' ? 'Còn trống' : 'Đã thuê'}
                              </div>
                              <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-md">{room.name}</h3>
                              <p className="text-white/90 text-xs font-bold uppercase tracking-widest">{room.area} m²</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-green-400 drop-shadow-md">
                                {(room.price || 0).toLocaleString()}
                                <span className="text-xs ml-0.5 opacity-80 font-bold">đ</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Layer 2: Hover Overlay (bg-black/50) */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-center p-8 translate-y-4 group-hover:translate-y-0">
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.2em]">Thông tin chi tiết</p>
                              <h4 className="text-2xl font-black text-white tracking-tight">{room.name}</h4>
                            </div>

                            {room.status === 'OCCUPIED' && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Người thuê</p>
                                <div className="flex flex-wrap gap-2">
                                  {tenants.filter(t => t.roomId === room.id).map(t => (
                                    <span key={t.id} className="text-sm font-bold text-white">
                                      {t.name}
                                    </span>
                                  ))}
                                  {tenants.filter(t => t.roomId === room.id).length === 0 && (
                                    <span className="text-sm font-bold text-zinc-500 italic">Đang cập nhật...</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {room.description && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Mô tả</p>
                                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                                  {room.description}
                                </p>
                              </div>
                            )}

                            {isAdmin && (
                              <div className="pt-4 flex flex-wrap gap-2">
                                {room.status === 'OCCUPIED' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRoomToCheckout(room.id);
                                      setIsCheckoutConfirmOpen(true);
                                    }}
                                    className="flex-1 min-w-[100px] py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-[10px] font-black text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
                                  >
                                    <LogOut size={14} /> Trả phòng
                                  </button>
                                )}
                                <div className="flex gap-2 w-full">
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation();
                                      setEditingRoom(room); 
                                      setFormData(room); 
                                      setImagePreview(room.imageUrl || null);
                                      setIsModalOpen(true); 
                                    }} 
                                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black text-white uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2"
                                  >
                                    <Edit2 size={14} /> Sửa
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const hasTenant = tenants.some(t => t.roomId === room.id);
                                      if (room.status === 'OCCUPIED' || hasTenant) {
                                        showToast('Không thể xóa phòng đang có người thuê. Vui lòng thực hiện trả phòng trước.', 'error');
                                        return;
                                      }
                                      setRoomToDelete(room.id);
                                      setIsConfirmOpen(true);
                                    }} 
                                    className="flex-1 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-black text-rose-400 uppercase tracking-widest transition-all border border-rose-500/20 flex items-center justify-center gap-2"
                                  >
                                    <Trash2 size={14} /> Xóa
                                  </button>
                                </div>
                              </div>
                            )}

                            {!isAdmin && !isMyRoom && (
                              <div className="pt-4">
                                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl">
                                  Xem chi tiết
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* "Your Room" Badge */}
                        {isMyRoom && (
                          <div className="absolute top-4 left-4 z-20">
                            <div className="bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg border border-white/20">
                              Phòng của bạn
                            </div>
                          </div>
                        )}
                      </Card>
                    </div>
                  );
              })}
            </div>
          </div>
        ))
        ) : (
          <div className="py-20 bg-white rounded-2xl border border-dashed border-zinc-200 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mb-4">
              <Home size={32} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">Không tìm thấy phòng</h3>
            <p className="text-zinc-500 text-sm mt-1">Thử thay đổi từ khóa tìm kiếm hoặc thêm phòng mới.</p>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa phòng"
        message="Bạn có chắc muốn xóa phòng này?"
      />

      <ConfirmModal 
        isOpen={isCheckoutConfirmOpen}
        onClose={() => setIsCheckoutConfirmOpen(false)}
        onConfirm={handleCheckoutConfirm}
        title="Xác nhận trả phòng"
        message="Bạn có chắc chắn muốn trả phòng này? Hợp đồng sẽ bị kết thúc và thông tin người thuê sẽ được gỡ bỏ."
      />

      <Modal 
        isOpen={!!selectedRoomForDetail} 
        onClose={() => setSelectedRoomForDetail(null)} 
        title="Chi tiết phòng"
      >
        {selectedRoomForDetail && (
          <div className="space-y-6">
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-zinc-100">
              {selectedRoomForDetail.imageUrl ? (
                <img 
                  src={selectedRoomForDetail.imageUrl} 
                  alt={selectedRoomForDetail.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-zinc-50 flex items-center justify-center text-zinc-200">
                  <Home size={64} />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border border-white/20 backdrop-blur-md",
                  selectedRoomForDetail.status === 'AVAILABLE' ? "bg-amber-500 text-white" : "bg-green-500 text-white"
                )}>
                  {selectedRoomForDetail.status === 'AVAILABLE' ? 'Còn trống' : 'Đã thuê'}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-zinc-900 tracking-tight">{selectedRoomForDetail.name}</h3>
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{selectedRoomForDetail.area} m² diện tích sử dụng</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">Giá thuê hàng tháng</p>
                <p className="text-3xl font-black text-green-600 tracking-tighter">
                  {(selectedRoomForDetail.price || 0).toLocaleString()}
                  <span className="text-sm ml-1 font-bold">đ</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Mô tả phòng</h4>
                  <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                    {selectedRoomForDetail.description || 'Chưa có mô tả chi tiết cho phòng này.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Thông tin người thuê</h4>
                  {selectedRoomForDetail.status === 'OCCUPIED' ? (
                    <div className="space-y-3">
                      {tenants.filter(t => t.roomId === selectedRoomForDetail.id).map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                            <Users size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900">{t.name}</p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.phone}</p>
                          </div>
                        </div>
                      ))}
                      {tenants.filter(t => t.roomId === selectedRoomForDetail.id).length === 0 && (
                        <p className="text-sm text-zinc-500 italic">Đang cập nhật thông tin người thuê...</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-3">
                        <Home size={24} />
                      </div>
                      <p className="text-sm font-bold text-zinc-900">Phòng đang trống</p>
                      <p className="text-xs text-zinc-500 mt-1">Sẵn sàng để đón người thuê mới.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="pt-4 flex gap-3">
                <Button 
                  className="flex-1 h-12 rounded-2xl text-base font-bold"
                  onClick={() => {
                    setEditingRoom(selectedRoomForDetail);
                    setFormData(selectedRoomForDetail);
                    setImagePreview(selectedRoomForDetail.imageUrl || null);
                    setIsModalOpen(true);
                    setSelectedRoomForDetail(null);
                  }}
                >
                  <Edit2 size={18} /> Chỉnh sửa thông tin
                </Button>
                {selectedRoomForDetail.status === 'OCCUPIED' && (
                  <Button 
                    variant="outline"
                    className="flex-1 h-12 rounded-2xl text-base font-bold border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      setRoomToCheckout(selectedRoomForDetail.id);
                      setIsCheckoutConfirmOpen(true);
                      setSelectedRoomForDetail(null);
                    }}
                  >
                    <LogOut size={18} /> Trả phòng
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingRoom ? "Sửa thông tin phòng" : "Thêm phòng mới"}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Ảnh phòng</label>
            <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors">
              {imagePreview ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => { setImagePreview(null); setFormData({ ...formData, image: undefined }); }}
                    className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur-sm rounded-full text-red-500 hover:bg-white"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-zinc-400">
                  <Plus size={32} className="mb-2" />
                  <span className="text-xs font-medium">Nhấn để chọn ảnh phòng</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                className="hidden"
                id="room-image-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({ ...formData, image: file });
                    const reader = new FileReader();
                    reader.onloadend = () => setImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="secondary" 
                size="sm"
                onClick={() => document.getElementById('room-image-upload')?.click()}
              >
                {imagePreview ? "Thay đổi ảnh" : "Chọn ảnh"}
              </Button>
            </div>
          </div>
          <Input label="Tên phòng" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: Phòng 101" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Mô tả phòng</label>
            <textarea 
              placeholder="Mô tả chi tiết về phòng (tiện nghi, nội thất...)"
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 min-h-[100px] text-sm"
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Diện tích (m²)" 
              numeric
              min="0"
              value={formData.area ?? ''} 
              onChange={e => setFormData({ ...formData, area: e.target.value === '' ? undefined : Number(e.target.value) })} 
            />
            <Input 
              label="Giá thuê (VNĐ)" 
              numeric
              min="0"
              value={formData.price ?? ''} 
              onChange={e => setFormData({ ...formData, price: e.target.value === '' ? undefined : Number(e.target.value) })} 
            />
          </div>
          <Select 
            label="Trạng thái" 
            value={formData.status || 'AVAILABLE'} 
            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
            options={[
              { value: 'AVAILABLE', label: 'Còn trống' },
              { value: 'OCCUPIED', label: 'Đã thuê' }
            ]}
          />
          <Button type="submit" className="w-full mt-4">
            {editingRoom ? "Lưu thay đổi" : "Thêm phòng"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
