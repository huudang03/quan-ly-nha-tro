/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Home, 
  Users, 
  FileText, 
  Zap, 
  Receipt, 
  LogOut, 
  Menu,
  User as UserIcon,
  Bell,
  Settings,
  Search,
  UserCircle,
  CheckCircle2,
  X,
  RefreshCcw,
  History,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

import { 
  User, 
  Room, 
  Tenant, 
  Contract, 
  Invoice, 
  UtilityReading,
  Notification,
  SystemConfig
} from './types';
import { 
  INITIAL_CONFIG,
} from './constants';

import { cn, Toast } from './components/UI';
import { Auth } from './components/Auth';
import { Profile } from './components/Profile';
import { UserManagement } from './components/UserManagement';
import { SystemManagement } from './components/SystemManagement';
import { Notifications } from './components/Notifications';

// Re-using existing components logic but modularized
import { Dashboard } from './components/Dashboard';
import { RoomManagement } from './components/RoomManagement';
import { TenantManagement } from './components/TenantManagement';
import { ContractManagement } from './components/ContractManagement';
import { UtilityManagement } from './components/UtilityManagement';
import { InvoiceManagement } from './components/InvoiceManagement';

import { apiFetch } from './lib/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [propertyName, setPropertyName] = useState('Quản lý nhà trọ');
  const [initialInvoiceId, setInitialInvoiceId] = useState<string | null>(null);
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const invoicesRef = useRef<Invoice[]>([]);
  const roomsRef = useRef<Room[]>([]);
  const processedRef = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('processedPayments') || '[]'))
  );

  // Data State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [
        roomsData, 
        tenantsData, 
        contractsData, 
        invoicesData, 
        readingsData, 
        usersData, 
        configData,
        notificationsData
      ] = await Promise.all([
        apiFetch<Room[]>('/api/rooms'),
        apiFetch<Tenant[]>('/api/tenants'),
        apiFetch<Contract[]>('/api/contracts'),
        apiFetch<Invoice[]>('/api/invoices'),
        apiFetch<UtilityReading[]>('/api/utility-readings'),
        apiFetch<User[]>('/api/users'),
        apiFetch<SystemConfig>('/api/system-config'),
        currentUser ? apiFetch<Notification[]>('/api/notifications') : Promise.resolve([])
      ]);

      setRooms(roomsData);
      setTenants(tenantsData);
      setContracts(contractsData);
      setInvoices(invoicesData);
      setReadings(readingsData);
      setUsers(usersData);
      if (configData) {
        setConfig(configData);
        if (configData.propertyName) setPropertyName(configData.propertyName);
      }
      if (notificationsData) {
        const filteredNotifs = currentUser?.role === 'ADMIN' 
          ? notificationsData 
          : notificationsData.filter(n => n.userId === currentUser?.id);
        setNotifications(filteredNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (err) {
      console.error('[App] Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [currentUser?.id]);

  const createNotification = async (notification: Notification) => {
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(notification)
      });
      fetchData();
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const createNotifications = async (newNotifs: Notification[]) => {
    try {
      await Promise.all(newNotifs.map(n => 
        apiFetch('/api/notifications', {
          method: 'POST',
          body: JSON.stringify(n)
        })
      ));
      fetchData();
    } catch (error) {
      console.error('Error creating notifications:', error);
    }
  };

  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isVisible: false, message: '', type: 'success' });

  useEffect(() => {
    if (config && config.propertyName) {
      setPropertyName(config.propertyName);
    }
  }, [config]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ isVisible: true, message, type });
  };

  const removeAccents = (str: string) => {
    return str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  const [isPaid, setIsPaid] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkPaymentStatus = async (code: string) => {
    if (!code) return { status: 'unpaid', ok: false };
    
    const invoice = invoices.find(inv => inv.code === code);
    if (invoice && invoice.status === 'PAID') {
      if (!isPaid) {
        setIsPaid(true);
        setShowSuccessBanner(true);
        showToast("🔥 ĐÃ THANH TOÁN THÀNH CÔNG!", "success");
      }
      return { status: 'paid', ok: true };
    }
    return { status: 'unpaid', ok: false };
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // WebSocket for Real-time Payment Updates
  useEffect(() => {
    if (!currentUser) return;

    const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws') + '/ws-payment';
    
    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATUS_UPDATED' && data.payload?.status === 'paid') {
            const { invoiceId, roomId } = data.payload;
            
            // Mark as processed
            processedRef.current.add(invoiceId);
            localStorage.setItem('processedPayments', JSON.stringify([...processedRef.current]));

            // Update state
            setInvoices(prev => prev.map(inv => 
              inv.id === invoiceId ? { ...inv, status: 'PAID' } : inv
            ));

            showToast(`Thanh toán thành công!`, 'success');
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [currentUser]);

  // --- Automatic Payment Polling (Fallback) ---
  useEffect(() => {
    if (!currentUser) return;

    const pollInterval = setInterval(async () => {
      const currentInvoices = invoicesRef.current;
      const currentRooms = roomsRef.current;

      const targetInvoices = currentInvoices
        .filter(inv => 
          isAdmin 
            ? inv.status === 'PENDING'
            : inv.status === 'UNPAID' || inv.status === 'OVERDUE'
        )
        .slice(0, 20); // 🔥 giới hạn 20 cái

      if (targetInvoices.length === 0) return;

      // Xử lý theo batch (tối đa 5 request song song)
      const batchSize = 5;
      for (let i = 0; i < targetInvoices.length; i += batchSize) {
        const batch = targetInvoices.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (inv) => {
          if (processedRef.current.has(inv.id)) return;

          const room = currentRooms.find(r => r.id === inv.roomId);
          if (!room) return;
          
          const code = inv.code || `HD${room.name.match(/\d+/)?.[0] || room.name}T${inv.month.split('-')[1] || ''}`;
          
          const monthStr = inv.month.split('-')[1] || '';
          
          try {
            const apiBaseUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiBaseUrl}/api/check-payment/${code}`);
            const data = await response.json();
            
            if (data?.status === 'paid' && inv.status !== 'PAID') {
              // Đánh dấu đã xử lý để chống spam
              processedRef.current.add(inv.id);
              localStorage.setItem(
                'processedPayments',
                JSON.stringify([...processedRef.current])
              );

              // Cập nhật trạng thái trong state local ngay lập tức
              setInvoices(prev => prev.map(item => 
                item.id === inv.id ? { ...item, status: 'PAID' } : item
              ));
              
              setShowSuccessBanner(true);
              showToast("🔥 ĐÃ THANH TOÁN THÀNH CÔNG!", "success");
              
              const newNotif: Notification = {
                id: Math.random().toString(36).substr(2, 9),
                userId: inv.tenantId,
                title: "Thanh toán thành công",
                content: `Hóa đơn phòng ${room.name} tháng ${monthStr} đã được thanh toán thành công.`,
                type: "INVOICE",
                isRead: false,
                createdAt: new Date().toISOString()
              };
              
              setNotifications(prev => [newNotif, ...prev]);
              
              // 🔥 GỌI API NGẦM (không await)
              apiFetch(`/api/invoices/${inv.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'PAID' })
              }).catch(() => {});

              apiFetch('/api/notifications', {
                method: 'POST',
                body: JSON.stringify(newNotif)
              }).catch(() => {});
            }
          } catch (err) {
            // Bỏ qua lỗi mạng
          }
        }));
      }
    }, 10000); // 🔥 10s

    return () => clearInterval(pollInterval);
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    if (currentUser) {
      console.log(`[App] Current user: ${currentUser.username}, Role: ${currentUser.role}, isAdmin: ${isAdmin}`);
    }
  }, [currentUser, isAdmin]);

  // --- Sync currentUser with users list (in case Admin updates info) ---
  // Replaced by broader persistence effect below

  // --- Billing Logic ---
  const generateMonthlyInvoices = async (targetMonth?: string) => {
    const month = targetMonth || format(new Date(), 'yyyy-MM');
    setIsLoading(true);
    try {
      const result = await apiFetch<{ count: number }>('/api/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ month })
      });
      
      if (result.count > 0) {
        showToast(`Đã tạo thành công ${result.count} hóa đơn cho tháng ${month}`, 'success');
        fetchData();
      } else {
        showToast(`Không có hóa đơn mới nào được tạo cho tháng ${month}`, 'info');
      }
      return result.count;
    } catch (error: any) {
      console.error('Error generating invoices:', error);
      showToast(error.message || 'Lỗi khi tạo hóa đơn hàng loạt', 'error');
      return 0;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-check on the 5th and check for overdue
  useEffect(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Check for overdue invoices - only update if status actually changes to avoid infinite loop
    setInvoices(prev => {
      let hasChanges = false;
      const next = prev.map(inv => {
        if (inv.status === 'UNPAID' && inv.dueDate < todayStr) {
          hasChanges = true;
          return { ...inv, status: 'OVERDUE' as const };
        }
        return inv;
      });
      return hasChanges ? next : prev;
    });

    if (today.getDate() >= 5) {
      const currentMonth = format(today, 'yyyy-MM');
      // Only generate if we haven't checked this month yet in this session
      const lastChecked = sessionStorage.getItem('lastInvoiceCheck');
      if (lastChecked !== currentMonth) {
        sessionStorage.setItem('lastInvoiceCheck', currentMonth);
        generateMonthlyInvoices(currentMonth);
      }
    }
  }, [rooms, readings, config, users]); // Removed invoices from dependencies

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Persistence
  useEffect(() => {
    // Sync currentUser with users list (in case Admin updated the user record)
    if (currentUser && users.length > 0) {
      const updatedUser = users.find(u => u.id === currentUser.id);
      if (updatedUser) {
        if (updatedUser.status === 'LOCKED') {
          handleLogout();
        } else if (JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
          setCurrentUser(updatedUser);
        }
      } else {
        handleLogout();
      }
    }
  }, [users, currentUser]);

  const handleUpdateProfile = (updatedUser: User) => {
    apiFetch<User>(`/api/users/${updatedUser.id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedUser)
    }).then((res) => {
      setCurrentUser(res);
      showToast('Cập nhật thông tin thành công!', 'success');
      fetchData();
    }).catch(err => {
      console.error('Error updating profile:', err);
      showToast(err.message || 'Lỗi khi cập nhật thông tin!', 'error');
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-8 h-8 text-green-600 animate-spin" />
          <p className="text-zinc-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Auth 
        users={users}
        onLogin={user => setCurrentUser(user)} 
        onRegister={user => {
          setCurrentUser(user);
          fetchData();
        }} 
        onUpdateUser={updatedUser => {
          handleUpdateProfile(updatedUser);
        }}
      />
    );
  }

  const unreadNotifs = notifications.filter(n => !n.isRead && n.userId === currentUser.id).length;

  return (
    <div className="min-h-screen bg-[#f9fafb] flex relative">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-zinc-200 transition-all duration-300 flex flex-col z-50 fixed lg:static h-full",
        isSidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:translate-x-0 lg:w-72"
      )}>
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200/50">
            <Home size={22} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold text-lg tracking-tight truncate text-zinc-900">{propertyName}</span>
            <span className="text-[10px] text-green-600 font-bold uppercase tracking-[0.2em]">Hệ thống quản lý</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pt-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Tổng quan" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} collapsed={false} />
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Quản lý chính</p>
          </div>
          <NavItem icon={<Home size={20} />} label="Phòng trọ" active={activeTab === 'rooms'} onClick={() => { setActiveTab('rooms'); setIsSidebarOpen(false); }} collapsed={false} />
          
          {isAdmin ? (
            <>
              <NavItem icon={<UserCircle size={20} />} label="Tài khoản" active={activeTab === 'users'} onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} collapsed={false} />
              <NavItem icon={<Users size={20} />} label="Người thuê" active={activeTab === 'tenants'} onClick={() => { setActiveTab('tenants'); setIsSidebarOpen(false); }} collapsed={false} />
              <NavItem icon={<FileText size={20} />} label="Hợp đồng" active={activeTab === 'contracts'} onClick={() => { setActiveTab('contracts'); setIsSidebarOpen(false); }} collapsed={false} />
              <NavItem icon={<Zap size={20} />} label="Điện nước" active={activeTab === 'utilities'} onClick={() => { setActiveTab('utilities'); setIsSidebarOpen(false); }} collapsed={false} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Hệ thống</p>
              </div>
              <NavItem icon={<Settings size={20} />} label="Cấu hình" active={activeTab === 'system'} onClick={() => { setActiveTab('system'); setIsSidebarOpen(false); }} collapsed={false} />
            </>
          ) : (
            <>
              <NavItem icon={<FileText size={20} />} label="Hợp đồng của tôi" active={activeTab === 'contracts'} onClick={() => { setActiveTab('contracts'); setIsSidebarOpen(false); }} collapsed={false} />
              <NavItem icon={<Zap size={20} />} label="Điện nước" active={activeTab === 'utilities'} onClick={() => { setActiveTab('utilities'); setIsSidebarOpen(false); }} collapsed={false} />
            </>
          )}
          
          <NavItem icon={<Receipt size={20} />} label="Hóa đơn" active={activeTab === 'invoices'} onClick={() => { setActiveTab('invoices'); setIsSidebarOpen(false); }} collapsed={false} />
          <NavItem 
            icon={<Bell size={20} />} 
            label="Thông báo" 
            active={activeTab === 'notifications'} 
            onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); }} 
            collapsed={false} 
            badge={unreadNotifs > 0 ? unreadNotifs : undefined}
          />
          <NavItem icon={<UserIcon size={20} />} label="Cá nhân" active={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }} collapsed={false} />
        </nav>

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all duration-200 font-semibold text-sm">
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="min-h-20 h-auto bg-white border-b border-zinc-100 px-6 lg:px-10 flex items-center justify-between shrink-0 py-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors lg:hidden text-zinc-600">
            <Menu size={22} />
          </button>
          
          <div className="flex-1 lg:flex-none" />
          
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-extrabold text-zinc-900 tracking-tight">{currentUser.name}</p>
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">{isAdmin ? 'Quản trị viên' : 'Người thuê'}</p>
            </div>
            <div className="w-11 h-11 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 border border-green-100 cursor-pointer hover:bg-green-100 transition-all duration-200 shadow-sm" onClick={() => setActiveTab('profile')}>
              <UserIcon size={22} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-zinc-50/50">
          {showSuccessBanner && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-green-600 text-white rounded-xl shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} />
                <div>
                  <p className="font-bold">ĐÃ THANH TOÁN - THÀNH CÔNG!</p>
                  <p className="text-xs opacity-90">Hệ thống đã ghi nhận giao dịch của bạn. Cảm ơn bạn!</p>
                </div>
              </div>
              <button onClick={() => setShowSuccessBanner(false)} className="p-1 hover:bg-white/20 rounded">
                <X size={20} />
              </button>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  rooms={rooms} 
                  tenants={tenants} 
                  invoices={invoices} 
                  contracts={contracts}
                  isAdmin={isAdmin} 
                  currentUser={currentUser} 
                  onViewContract={() => setActiveTab('contracts')}
                />
              )}
              {activeTab === 'rooms' && <RoomManagement rooms={rooms} setRooms={setRooms} isAdmin={isAdmin} currentUser={currentUser} tenants={tenants} setTenants={setTenants} contracts={contracts} setContracts={setContracts} setNotifications={setNotifications} createNotification={createNotification} users={users} onRefresh={fetchData} showToast={showToast} />}
              {activeTab === 'users' && isAdmin && <UserManagement users={users} setUsers={setUsers} tenants={tenants} rooms={rooms} onRefresh={fetchData} />}
              {activeTab === 'tenants' && isAdmin && <TenantManagement tenants={tenants} setTenants={setTenants} rooms={rooms} setRooms={setRooms} contracts={contracts} setContracts={setContracts} users={users} setUsers={setUsers} setNotifications={setNotifications} createNotification={createNotification} onRefresh={fetchData} />}
              {activeTab === 'contracts' && <ContractManagement contracts={contracts} setContracts={setContracts} rooms={rooms} setRooms={setRooms} tenants={tenants} setTenants={setTenants} isAdmin={isAdmin} currentUser={currentUser} users={users} setNotifications={setNotifications} createNotification={createNotification} onRefresh={fetchData} />}
              {activeTab === 'utilities' && (
                <UtilityManagement 
                  readings={readings} 
                  setReadings={setReadings}
                  rooms={rooms}
                  invoices={invoices}
                  setInvoices={setInvoices}
                  tenants={tenants}
                  config={config}
                  isAdmin={isAdmin}
                  currentUser={currentUser}
                  setNotifications={setNotifications}
                  createNotifications={createNotifications}
                  users={users}
                  initialRoomId={initialRoomId}
                  onClearInitialRoomId={() => setInitialRoomId(null)}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'invoices' && (
                <InvoiceManagement 
                  invoices={invoices} 
                  setInvoices={setInvoices} 
                  isAdmin={isAdmin} 
                  currentUser={currentUser} 
                  rooms={rooms} 
                  tenants={tenants} 
                  onGenerateInvoices={generateMonthlyInvoices} 
                  setNotifications={setNotifications} 
                  createNotification={createNotification}
                  users={users} 
                  initialInvoiceId={initialInvoiceId} 
                  onClearInitialInvoiceId={() => setInitialInvoiceId(null)} 
                  config={config}
                  onCheckPayment={checkPaymentStatus}
                  isChecking={isChecking}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'notifications' && (
                <Notifications 
                  notifications={notifications} 
                  setNotifications={setNotifications} 
                  users={users} 
                  rooms={rooms}
                  tenants={tenants}
                  currentUser={currentUser} 
                  onViewInvoice={(id) => { setInitialInvoiceId(id); setActiveTab('invoices'); }} 
                  onViewUtility={(roomId) => { setInitialRoomId(roomId); setActiveTab('utilities'); }}
                  onRefresh={fetchData}
                  showToast={showToast}
                />
              )}
              {activeTab === 'profile' && <Profile user={currentUser} onUpdate={handleUpdateProfile} />}
              {activeTab === 'system' && isAdmin && <SystemManagement config={config} setConfig={setConfig} propertyName={propertyName} setPropertyName={setPropertyName} users={users} setNotifications={setNotifications} createNotifications={createNotifications} onRefresh={fetchData} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 relative group",
        active 
          ? "bg-green-100 text-green-700 shadow-sm" 
          : "text-zinc-500 hover:text-green-700 hover:bg-green-50"
      )}
    >
      {active && (
        <motion.div 
          layoutId="activeNav"
          className="absolute left-0 w-1 h-6 bg-green-600 rounded-r-full"
        />
      )}
      <span className={cn("shrink-0 transition-transform duration-300 group-hover:scale-110", active ? "text-green-600" : "text-zinc-400 group-hover:text-green-600")}>{icon}</span>
      {!collapsed && <span className="font-bold text-sm tracking-tight">{label}</span>}
      {badge !== undefined && (
        <span className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center shadow-sm",
          collapsed && "right-1 top-1"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}
