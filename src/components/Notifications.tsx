import React, { useState } from 'react';
import { Notification, User, Room, Tenant } from '../types';
import { Card, Button, Input, Select, Modal, ConfirmModal, cn } from './UI';
import { Bell, Send, CheckCircle2, Clock, Info, Trash2, FileText, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';

interface NotificationsProps {
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  users: User[];
  rooms: Room[];
  tenants: Tenant[];
  currentUser: User;
  onViewInvoice?: (invoiceId: string) => void;
  onViewUtility?: (roomId: string) => void;
  onRefresh: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function Notifications({ notifications, setNotifications, users, rooms, tenants, currentUser, onViewInvoice, onViewUtility, onRefresh, showToast }: NotificationsProps) {
  const isAdmin = currentUser.role === 'ADMIN';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [notifToDelete, setNotifToDelete] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeView, setActiveView] = useState<'INBOX' | 'SENT'>(isAdmin ? 'SENT' : 'INBOX');
  const [viewingNotif, setViewingNotif] = useState<Notification | null>(null);
  const [formData, setFormData] = useState<Partial<Notification>>({
    userId: '',
    title: '',
    content: '',
    type: 'SYSTEM',
    invoiceId: ''
  });

  const rawNotifications = notifications
    .filter(n => {
      if (activeView === 'SENT') return n.senderId === currentUser.id;
      return n.userId === currentUser.id;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getRoomNameForUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    // 1. Check direct roomIds on user (if set)
    if (user.roomIds && user.roomIds.length > 0) {
      const room = rooms.find(r => user.roomIds?.includes(r.id));
      if (room) return room.name;
    }

    // 2. Check tenantId link
    if (user.tenantId) {
      const tenant = tenants.find(t => t.id === user.tenantId);
      if (tenant && tenant.roomId) {
        const room = rooms.find(r => r.id === tenant.roomId);
        if (room) return room.name;
      }
    }

    return null;
  };

  // Group notifications for Sent History
  const groupedSentNotifications = React.useMemo(() => {
    if (activeView !== 'SENT') return [];
    
    const groups: {
      key: string;
      title: string;
      content: string;
      type: string;
      createdAt: string;
      recipients: string[];
      invoiceId?: string;
      roomId?: string;
      isRead: boolean;
    }[] = [];

    rawNotifications.forEach(n => {
      // Group by title, content, type and time (within 10 seconds)
      const timeGroup = Math.floor(new Date(n.createdAt).getTime() / 10000);
      const groupKey = `${n.title}-${n.content}-${n.type}-${timeGroup}`;
      
      const existingGroup = groups.find(g => g.key === groupKey);
      const recipientUser = users.find(u => u.id === n.userId);
      const roomName = getRoomNameForUser(n.userId);
      const displayRoom = roomName 
        ? (roomName.toLowerCase().startsWith('phòng') ? roomName : `Phòng ${roomName}`)
        : null;
      const recipientName = recipientUser 
        ? (displayRoom ? `${recipientUser.name} (${displayRoom})` : recipientUser.name)
        : 'Người dùng ẩn';

      if (existingGroup) {
        if (!existingGroup.recipients.includes(recipientName)) {
          existingGroup.recipients.push(recipientName);
        }
      } else {
        groups.push({
          key: groupKey,
          title: n.title,
          content: n.content,
          type: n.type,
          createdAt: n.createdAt,
          recipients: [recipientName],
          invoiceId: n.invoiceId,
          roomId: n.roomId,
          isRead: true // Sent items don't have an "unread" status for the sender usually
        });
      }
    });

    return groups;
  }, [rawNotifications, activeView, users]);

  const displayedNotifications = activeView === 'SENT' ? groupedSentNotifications : rawNotifications;

  const handleSend = async () => {
    if (!formData.userId) {
      showToast('Vui lòng chọn người nhận!', 'error');
      return;
    }
    if (!formData.title?.trim()) {
      showToast('Vui lòng nhập tiêu đề!', 'error');
      return;
    }
    if (!formData.content?.trim()) {
      showToast('Vui lòng nhập nội dung!', 'error');
      return;
    }

    try {
      if (formData.userId === 'ALL') {
        const tenantIds = users.filter(u => u.role === 'TENANT').map(u => u.id);
        if (tenantIds.length === 0) {
          showToast('Không có người thuê nào để gửi thông báo!', 'error');
          return;
        }
        await apiFetch('/api/notifications/batch', {
          method: 'POST',
          body: JSON.stringify({
            userIds: tenantIds,
            senderId: currentUser.id,
            title: formData.title,
            content: formData.content,
            type: formData.type,
            invoiceId: formData.invoiceId
          })
        });
      } else {
        await apiFetch('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            senderId: currentUser.id
          })
        });
      }
      showToast('Đã gửi thông báo thành công!', 'success');
      onRefresh();
      setIsModalOpen(false);
      setFormData({
        userId: '',
        title: '',
        content: '',
        type: 'SYSTEM',
        invoiceId: ''
      });
    } catch (err: any) {
      console.error('Error sending notification:', err);
      showToast('Lỗi khi gửi thông báo: ' + (err.message || 'Lỗi không xác định'), 'error');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isRead: true })
      });
      onRefresh();
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
      onRefresh();
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const clearAll = async () => {
    try {
      await apiFetch('/api/notifications/clear-all', { method: 'DELETE' });
      onRefresh();
      setIsClearConfirmOpen(false);
    } catch (err: any) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (notifToDelete) {
      try {
        await apiFetch(`/api/notifications/${notifToDelete}`, { method: 'DELETE' });
        onRefresh();
        setIsDeleteConfirmOpen(false);
        setNotifToDelete(null);
      } catch (err: any) {
        console.error('Error deleting notification:', err);
      }
    }
  };

  const handleViewDetail = (notif: Notification) => {
    setViewingNotif(notif);
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
  };

  const safeFormatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'HH:mm dd/MM/yyyy');
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-zinc-900">Thông báo</h2>
          {isAdmin && (
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl w-fit mt-2">
              <button 
                onClick={() => setActiveView('INBOX')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider",
                  activeView === 'INBOX' ? "bg-white text-green-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Hộp thư đến
              </button>
              <button 
                onClick={() => setActiveView('SENT')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider",
                  activeView === 'SENT' ? "bg-white text-green-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Lịch sử đã gửi
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {displayedNotifications.length > 0 && activeView === 'INBOX' && (
            <>
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCircle2 size={16} /> Đánh dấu tất cả đã đọc
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsClearConfirmOpen(true)} className="text-red-600 hover:bg-red-50">
                <Trash2 size={16} /> Xóa tất cả
              </Button>
            </>
          )}
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)}>
                <Info size={18} /> Hướng dẫn
              </Button>
              <Button onClick={() => setIsModalOpen(true)} className="shadow-lg shadow-green-200/50">
                <Send size={18} /> Gửi thông báo mới
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {displayedNotifications.map((notif: any) => {
          const isSentView = activeView === 'SENT';
          const sentToText = isSentView ? (
            notif.recipients.length === 1 
              ? `Bạn đã gửi thông báo cho ${notif.recipients[0]}`
              : `Bạn đã gửi thông báo đến ${notif.recipients.length} người khác`
          ) : null;

          return (
            <Card 
              key={notif.id || notif.key} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                notif.isRead ? 'opacity-70' : 'border-l-4 border-l-green-600 shadow-sm bg-green-50/30'
              )}
              onClick={() => handleViewDetail(notif)}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className={`p-2 rounded-lg ${notif.isRead ? 'bg-zinc-100 text-zinc-400' : 'bg-gradient-to-br from-green-600 to-emerald-600 text-white shadow-sm shadow-green-200'}`}>
                    {isSentView ? <Send size={20} /> : <Bell size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-900">{isSentView ? sentToText : notif.title}</h4>
                      {!notif.isRead && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                    </div>
                    {isSentView && <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Tiêu đề: {notif.title}</div>}
                    <p className="text-sm text-zinc-600 mt-1 line-clamp-2 whitespace-pre-wrap">{notif.content}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 uppercase tracking-widest">
                        Xem chi tiết
                      </button>
                      {notif.invoiceId && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onViewInvoice) onViewInvoice(notif.invoiceId!);
                            if (!isSentView) markAsRead(notif.id);
                          }}
                          className="text-[10px] font-bold text-green-600 hover:underline flex items-center gap-1 uppercase tracking-widest"
                        >
                          <FileText size={10} /> Hóa đơn
                        </button>
                      )}
                      {notif.roomId && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onViewUtility) onViewUtility(notif.roomId!);
                            if (!isSentView) markAsRead(notif.id);
                          }}
                          className="text-[10px] font-bold text-green-600 hover:underline flex items-center gap-1 uppercase tracking-widest"
                        >
                          <Zap size={10} /> Điện nước
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><Clock size={10} /> {safeFormatDate(notif.createdAt)}</span>
                      {!isSentView && isAdmin && notif.userId !== currentUser.id && (
                        <span className="flex items-center gap-1">
                          <Info size={10} /> Gửi cho: {(() => {
                            const u = users.find(u => u.id === notif.userId);
                            const r = getRoomNameForUser(notif.userId);
                            const dr = r ? (r.toLowerCase().startsWith('phòng') ? r : `Phòng ${r}`) : null;
                            return u ? (dr ? `${u.name} (${dr})` : u.name) : 'N/A';
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notif.isRead && !isSentView && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif.id);
                      }} 
                      className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-emerald-600"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  {!isSentView && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotifToDelete(notif.id);
                        setIsDeleteConfirmOpen(true);
                      }} 
                      className="p-2 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {displayedNotifications.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-zinc-300">
            <Bell size={48} className="mx-auto text-zinc-200 mb-4" />
            <p className="text-zinc-500 font-medium">Không có thông báo nào.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gửi thông báo">
        <div className="space-y-4">
          <Select 
            label="Người nhận" 
            value={formData.userId} 
            onChange={e => setFormData({ ...formData, userId: e.target.value })}
            options={[
              { value: '', label: 'Chọn người nhận' },
              { value: 'ALL', label: 'Tất cả người thuê' },
              ...users
                .filter(u => u.role === 'TENANT')
                .map(u => {
                  const roomName = getRoomNameForUser(u.id);
                  return { 
                    id: u.id,
                    name: u.name,
                    roomName: roomName 
                  };
                })
                .sort((a, b) => {
                  // If both have rooms, compare room names
                  if (a.roomName && b.roomName) {
                    return a.roomName.localeCompare(b.roomName, undefined, { numeric: true, sensitivity: 'base' });
                  }
                  // Put people without rooms at the end
                  if (a.roomName) return -1;
                  if (b.roomName) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map(u => {
                  const roomName = u.roomName;
                  const displayRoom = roomName 
                    ? (roomName.toLowerCase().startsWith('phòng') ? roomName : `Phòng ${roomName}`)
                    : null;
                  return { 
                    value: u.id, 
                    label: displayRoom ? `${u.name} (${displayRoom})` : u.name 
                  };
                })
            ]}
          />
          <Select 
            label="Loại thông báo" 
            value={formData.type} 
            onChange={e => setFormData({ ...formData, type: e.target.value as any })}
            options={[
              { value: 'SYSTEM', label: 'Hệ thống' },
              { value: 'INVOICE', label: 'Hóa đơn' },
              { value: 'CONTRACT', label: 'Hợp đồng' }
            ]}
          />
          <Input label="Tiêu đề" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          {formData.type === 'INVOICE' && (
            <Input label="ID Hóa đơn (Tùy chọn)" value={formData.invoiceId || ''} onChange={e => setFormData({ ...formData, invoiceId: e.target.value })} placeholder="VD: INV123..." />
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nội dung</label>
            <textarea 
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/10 transition-all min-h-[100px]"
              value={formData.content || ''}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
            />
          </div>
          <Button className="w-full mt-4 shadow-lg shadow-green-200/50" onClick={handleSend}>Gửi ngay</Button>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={clearAll}
        title="Xác nhận xóa tất cả"
        message="Bạn có chắc chắn muốn xóa tất cả thông báo của mình không? Thao tác này không thể hoàn tác."
      />

      <ConfirmModal 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa thông báo"
        message="Bạn có chắc chắn muốn xóa thông báo này không?"
      />

      <Modal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} title="Hướng dẫn gửi thông báo">
        <div className="space-y-6 text-sm text-zinc-600 leading-relaxed">
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900">1. Để người thuê nhận được thông báo HÓA ĐƠN tự động:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Vào mục <span className="font-bold">"Tài khoản"</span> → Sửa tài khoản người thuê.</li>
              <li>Chọn đúng <span className="font-bold">"Liên kết người thuê"</span> tương ứng.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900">2. Để gửi thông báo THỦ CÔNG:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nhấn <span className="font-bold">"Gửi thông báo mới"</span>.</li>
              <li>Chọn người nhận cụ thể hoặc <span className="font-bold">"Tất cả người thuê"</span>.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900">3. Khi Admin Duyệt thanh toán:</h4>
            <p>Hệ thống sẽ tự động gửi thông báo xác nhận cho người thuê.</p>
          </div>
          <Button className="w-full mt-4 shadow-lg shadow-green-200/50" onClick={() => setIsGuideOpen(false)}>Đã hiểu</Button>
        </div>
      </Modal>

      <Modal 
        isOpen={!!viewingNotif} 
        onClose={() => setViewingNotif(null)} 
        title="Chi tiết thông báo"
      >
        {viewingNotif && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">{viewingNotif.title}</h3>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">
                  {safeFormatDate(viewingNotif.createdAt)}
                </p>
              </div>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
              <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {viewingNotif.content}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {viewingNotif.invoiceId && (
                <Button 
                  className="w-full justify-start gap-3" 
                  onClick={() => {
                    if (onViewInvoice) onViewInvoice(viewingNotif.invoiceId!);
                    setViewingNotif(null);
                  }}
                >
                  <FileText size={18} /> Xem chi tiết hóa đơn & Thanh toán
                </Button>
              )}
              {viewingNotif.roomId && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3" 
                  onClick={() => {
                    if (onViewUtility) onViewUtility(viewingNotif.roomId!);
                    setViewingNotif(null);
                  }}
                >
                  <Zap size={18} /> Xem chỉ số điện nước
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setViewingNotif(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
