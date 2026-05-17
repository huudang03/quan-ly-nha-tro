import React, { useState, useMemo } from 'react';
import { UtilityReading, Room, Invoice, Tenant, SystemConfig, Notification, User } from '../types';
import { Card, Button, Input, Select, Modal, ConfirmModal, Toast, Table, THead, TBody, TH, TR, TD, cn } from './UI';
import { Plus, Zap, Droplets, Search, Edit2, Trash2, Calendar, BarChart3, Home, Info, TrendingUp, Filter, AlertCircle, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { formatMonth } from '../lib/dateUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiFetch } from '../lib/api';

interface UtilityManagementProps {
  readings: UtilityReading[];
  setReadings: React.Dispatch<React.SetStateAction<UtilityReading[]>>;
  rooms: Room[];
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  tenants: Tenant[];
  config: SystemConfig;
  isAdmin: boolean;
  currentUser: any;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  createNotifications: (notifications: Notification[]) => Promise<void>;
  users: User[];
  initialRoomId?: string | null;
  onClearInitialRoomId?: () => void;
  onRefresh: () => void;
}

export function UtilityManagement({ readings, setReadings, rooms, invoices, setInvoices, tenants, config, isAdmin, currentUser, setNotifications, createNotifications, users, initialRoomId, onClearInitialRoomId, onRefresh }: UtilityManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [readingToDelete, setReadingToDelete] = useState<string | null>(null);
  const [editingReading, setEditingReading] = useState<UtilityReading | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Set initial month filter to the latest month available
  React.useEffect(() => {
    if (readings.length > 0 && !monthFilter) {
      const latest = [...readings].sort((a, b) => b.month.localeCompare(a.month))[0].month;
      setMonthFilter(latest);
    }
  }, [readings, monthFilter]);

  const [formData, setFormData] = useState({ 
    roomId: '', 
    month: format(new Date(), 'yyyy-MM'), 
    electricityIndex: 0, 
    waterIndex: 0,
    prevElectricityIndex: 0,
    prevWaterIndex: 0
  });

  const openModal = (reading?: UtilityReading | any) => {
    if (!isAdmin) return;
    
    // Ensure we only treat it as a reading if it's not a React event
    const isActualReading = reading && typeof reading === 'object' && 'id' in reading && !('nativeEvent' in reading);

    if (isActualReading) {
      const r = reading as UtilityReading;
      setEditingReading(r);
      
      // Find previous reading to get previous indexes
      const prevReading = readings
        .filter(read => read.roomId === r.roomId && read.month < r.month)
        .sort((a, b) => b.month.localeCompare(a.month))[0];

      setFormData({
        roomId: r.roomId,
        month: r.month,
        electricityIndex: r.electricityIndex,
        waterIndex: r.waterIndex,
        prevElectricityIndex: prevReading ? prevReading.electricityIndex : 0,
        prevWaterIndex: prevReading ? prevReading.waterIndex : 0
      });
    } else {
      setEditingReading(null);
      setFormData({ 
        roomId: '', 
        month: format(new Date(), 'yyyy-MM'), 
        electricityIndex: 0, 
        waterIndex: 0,
        prevElectricityIndex: 0,
        prevWaterIndex: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleRoomChange = (roomId: string) => {
    const prevReading = readings
      .filter(r => r.roomId === roomId)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    
    setFormData({
      ...formData,
      roomId,
      prevElectricityIndex: prevReading ? prevReading.electricityIndex : 0,
      prevWaterIndex: prevReading ? prevReading.waterIndex : 0
    });
  };

  const handleSave = async () => {
    if (!isAdmin) return;

    if (!formData.roomId) {
      setToast({ message: 'Vui lòng chọn phòng!', type: 'error', isVisible: true });
      return;
    }

    if (formData.electricityIndex === undefined || formData.waterIndex === undefined || !formData.month) {
      setToast({ message: 'Vui lòng nhập đầy đủ chỉ số và chọn tháng!', type: 'error', isVisible: true });
      return;
    }

    try {
      if (editingReading) {
        await apiFetch(`/api/utility-readings/${editingReading.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            roomId: formData.roomId,
            month: formData.month,
            electricityIndex: Number(formData.electricityIndex),
            waterIndex: Number(formData.waterIndex)
          })
        });
      } else {
        await apiFetch('/api/utility-readings', {
          method: 'POST',
          body: JSON.stringify({
            roomId: formData.roomId,
            month: formData.month,
            electricityIndex: Number(formData.electricityIndex),
            waterIndex: Number(formData.waterIndex)
          })
        });
      }

      onRefresh();
      setIsModalOpen(false);
      setEditingReading(null);
      setToast({ message: editingReading ? 'Cập nhật chỉ số thành công!' : 'Lưu chỉ số thành công!', type: 'success', isVisible: true });
      setSearchTerm('');
      setMonthFilter('');
    } catch (err: any) {
      console.error('Error saving utility reading:', err);
      setToast({ message: err.message || 'Lỗi khi lưu chỉ số', type: 'error', isVisible: true });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!isAdmin) return;
    if (readingToDelete) {
      try {
        await apiFetch(`/api/utility-readings/${readingToDelete}`, { method: 'DELETE' });
        onRefresh();
        setReadingToDelete(null);
        setToast({ message: 'Đã xóa chỉ số thành công!', type: 'success', isVisible: true });
      } catch (err: any) {
        console.error('Error deleting utility reading:', err);
        setToast({ message: err.message || 'Lỗi khi xóa chỉ số', type: 'error', isVisible: true });
      }
    }
  };

  const sortedRooms = useMemo(() => {
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

  const myRooms = useMemo(() => {
    if (isAdmin) return [];
    // A tenant should see readings for any room they are currently assigned to
    return sortedRooms.filter(room => {
      const isPrimary = room.tenantId === currentUser.tenantId;
      const isOccupant = tenants.some(t => t.id === currentUser.tenantId && t.roomId === room.id);
      return isPrimary || isOccupant;
    });
  }, [sortedRooms, tenants, isAdmin, currentUser]);

  // Set initial selected room for tenants
  React.useEffect(() => {
    if (!isAdmin && myRooms.length > 0) {
      if (initialRoomId && myRooms.some(r => r.id === initialRoomId)) {
        setSelectedRoomId(initialRoomId);
        if (onClearInitialRoomId) onClearInitialRoomId();
      } else if (!selectedRoomId) {
        // Prefer the room with the latest reading
        const latestReadingForMyRooms = readings.find(r => myRooms.some(mr => mr.id === r.roomId));
        if (latestReadingForMyRooms) {
          setSelectedRoomId(latestReadingForMyRooms.roomId);
        } else {
          setSelectedRoomId(myRooms[0].id);
        }
      }
    }
  }, [isAdmin, myRooms, selectedRoomId, initialRoomId, readings]);

  const filteredReadings = useMemo(() => {
    let result = readings;
    
    if (!isAdmin) {
      if (!currentUser.tenantId) {
        return []; // No tenant linked, no readings to show
      }
      const myRoomIds = myRooms.map(r => r.id);
      result = result.filter(r => myRoomIds.includes(r.roomId));
    }

    result = result.filter(r => {
      const room = rooms.find(room => room.id === r.roomId);
      if (!room) return false;
      
      const roomName = room.name.toLowerCase();
      const roomId = room.id.toLowerCase();
      const search = searchTerm.toLowerCase();
      
      // Flexible search: matches name or ID
      const matchesSearch = 
        roomName.includes(search) || 
        roomId.includes(search) ||
        search.includes(roomName) ||
        `phòng ${roomName}`.includes(search) ||
        search.includes(`phòng ${roomName}`);
        
      const matchesMonth = monthFilter ? r.month === monthFilter : true;
      return matchesSearch && matchesMonth;
    });
    
    // Sort by month descending, then by room name numerically ascending
    return [...result].sort((a, b) => {
      const monthCompare = b.month.localeCompare(a.month);
      if (monthCompare !== 0) return monthCompare;
      
      const roomA = rooms.find(r => r.id === a.roomId);
      const roomB = rooms.find(r => r.id === b.roomId);
      
      if (!roomA || !roomB) return b.id.localeCompare(a.id);
      
      const getNum = (name: string) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0]) : 999999;
      };
      
      return getNum(roomA.name) - getNum(roomB.name);
    });
  }, [readings, rooms, searchTerm, monthFilter, isAdmin, currentUser, myRooms]);

  const roomHistory = useMemo(() => {
    if (!formData.roomId) return [];
    return readings
      .filter(r => r.roomId === formData.roomId)
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 3);
  }, [readings, formData.roomId]);

  const latestReading = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    
    // For Admin, if no specific room is filtered, we'll show the very latest reading entered
    if (isAdmin) {
      return filteredReadings[0];
    }
    
    // For Tenant, use the selected room
    let targetReadings = filteredReadings;
    if (selectedRoomId) {
      targetReadings = filteredReadings.filter(r => r.roomId === selectedRoomId);
    }
    
    return targetReadings[0] || null;
  }, [filteredReadings, isAdmin, selectedRoomId]);

  const chartData = useMemo(() => {
    if (filteredReadings.length === 0) return [];
    
    let targetReadings = filteredReadings;
    
    // For Admin, if multiple rooms are visible, the chart might be confusing, 
    // but we'll show the data for the latest room by default or the filtered one.
    if (isAdmin) {
      const uniqueRoomIds = new Set(filteredReadings.map(r => r.roomId));
      if (uniqueRoomIds.size !== 1) {
        // If multiple rooms, filter chart to the latest room's history
        const latestRoomId = filteredReadings[0].roomId;
        targetReadings = filteredReadings.filter(r => r.roomId === latestRoomId);
      }
    } else if (selectedRoomId) {
      targetReadings = filteredReadings.filter(r => r.roomId === selectedRoomId);
    }

    return [...targetReadings]
      .reverse() // Oldest to newest for chart
      .slice(-6) // Last 6 months
      .map(r => ({
        month: r.month,
        'Điện (kWh)': r.electricityIndex - (r.previousElectricityIndex || 0),
        'Nước (m³)': r.waterIndex - (r.previousWaterIndex || 0)
      }));
  }, [filteredReadings, isAdmin, selectedRoomId]);

  const totalStats = useMemo(() => {
    if (!isAdmin) return null;
    
    // Determine which month to show totals for
    // If monthFilter is set, use it. Otherwise, use the month of the latest reading.
    const targetMonth = monthFilter || (readings.length > 0 ? [...readings].sort((a, b) => b.month.localeCompare(a.month))[0].month : null);
    
    if (!targetMonth) return null;
    
    const readingsInMonth = readings.filter(r => r.month === targetMonth);
    
    const totalElectricity = readingsInMonth.reduce((sum, r) => {
      const consumed = r.electricityIndex - (r.previousElectricityIndex || 0);
      return sum + Math.max(0, consumed);
    }, 0);
    
    const totalWater = readingsInMonth.reduce((sum, r) => {
      const consumed = r.waterIndex - (r.previousWaterIndex || 0);
      return sum + Math.max(0, consumed);
    }, 0);
    
    return {
      month: targetMonth,
      totalElectricity,
      totalWater,
      count: readingsInMonth.length
    };
  }, [readings, monthFilter, isAdmin]);

  const globalChartData = useMemo(() => {
    if (!isAdmin) return [];
    
    // Get all unique months and sort them
    const allMonths = [...new Set(readings.map(r => r.month))].sort();
    const last6Months = allMonths.slice(-6);
    
    return last6Months.map(m => {
      const readingsInMonth = readings.filter(r => r.month === m);
      const totalElec = readingsInMonth.reduce((sum, r) => sum + Math.max(0, r.electricityIndex - (r.previousElectricityIndex || 0)), 0);
      const totalWater = readingsInMonth.reduce((sum, r) => sum + Math.max(0, r.waterIndex - (r.previousWaterIndex || 0)), 0);
      return {
        month: m,
        'Điện (kWh)': totalElec,
        'Nước (m³)': totalWater
      };
    });
  }, [readings, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Chỉ số điện nước</h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Theo dõi và quản lý tiêu thụ điện nước hàng tháng.</p>
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
              <Plus size={18} /> Nhập chỉ số mới
            </Button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-6 space-y-4">
          {myRooms.length > 0 ? (
            <>
              <div className="bg-green-50/50 border border-green-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                    <Home size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-0.5">Phòng đang thuê</p>
                    <p className="text-lg font-black text-green-900 tracking-tight">
                      {myRooms.map(r => r.name).join(', ')}
                    </p>
                  </div>
                </div>
                {myRooms.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-green-600 font-black uppercase tracking-widest">Xem phòng:</span>
                    <select 
                      className="bg-white border border-green-200 rounded-xl px-4 py-2 text-sm font-bold text-green-900 focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all"
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                    >
                      {myRooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                <Info size={24} />
              </div>
              <div>
                <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-0.5">Thông tin cần lưu ý</p>
                <div className="text-sm font-bold text-amber-900">
                  {!currentUser.tenantId ? (
                    'Tài khoản của bạn chưa được liên kết với thông tin người thuê phòng.'
                  ) : (
                    <div className="flex flex-col gap-1">
                      <p>Đã liên kết (ID: {currentUser.tenantId}) nhưng Admin chưa xếp bạn vào phòng nào.</p>
                      <p className="text-[10px] font-medium text-amber-700 italic mt-1">* Admin cần vào mục "Phòng trọ" {"->"} Sửa phòng {"->"} Chọn bạn làm người thuê.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State for Admin (Only if no readings at all) */}
      {isAdmin && readings.length === 0 && (
        <Card className="p-12 text-center border-dashed border-zinc-200 bg-zinc-50/30 mb-8">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
              <Plus size={32} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">Bắt đầu nhập chỉ số</h3>
            <p className="text-sm text-zinc-500">
              Hệ thống chưa có dữ liệu điện nước. Hãy nhấn nút "Nhập chỉ số mới" để bắt đầu quản lý cho các phòng.
            </p>
          </div>
        </Card>
      )}

      {/* Empty State for Tenant */}
      {!isAdmin && !latestReading && rooms.filter(r => r.tenantId === currentUser.tenantId).length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
            <Zap size={32} />
          </div>
          <h3 className="text-lg font-bold text-amber-900">Chưa có dữ liệu điện nước</h3>
          <p className="text-amber-700 text-sm mt-2 max-w-md mx-auto">
            Hệ thống đã xác nhận bạn ở phòng <strong>{rooms.find(r => r.tenantId === currentUser.tenantId)?.name}</strong> (Mã: {rooms.find(r => r.tenantId === currentUser.tenantId)?.id}), nhưng Admin chưa nhập chỉ số cho mã phòng này.
          </p>
          <p className="text-amber-600 text-xs mt-4 italic">
            * Admin hãy kiểm tra xem đã nhập chỉ số cho đúng mã phòng trên chưa.
          </p>
        </div>
      )}

      {/* Dashboard Section - Visible to Tenants and Admins */}
      {(latestReading || totalStats) && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              {isAdmin && !searchTerm 
                ? `Tổng quan hệ thống: Tháng ${formatMonth(totalStats?.month)}` 
                : isAdmin && searchTerm 
                  ? `Kết quả tìm kiếm: ${searchTerm}`
                  : `Chi tiết: ${rooms.find(r => r.id === latestReading?.roomId)?.name}`}
            </h3>
            {isAdmin && !searchTerm && (
              <span className="text-[10px] text-zinc-400 italic">* Đang hiển thị tổng cộng của {totalStats?.count} phòng</span>
            )}
            {isAdmin && searchTerm && (
              <span className="text-[10px] text-zinc-400 italic">* Đang hiển thị phòng khớp với tìm kiếm</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-800 text-white border-none overflow-hidden relative shadow-xl shadow-zinc-900/20">
              <div className="relative z-10">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Tháng hiển thị</p>
                <h3 className="text-4xl font-black mb-5 tracking-tight">{isAdmin && !searchTerm ? formatMonth(totalStats?.month) : formatMonth(latestReading?.month)}</h3>
                <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {isAdmin && !searchTerm ? `Đã có ${totalStats?.count} phòng cập nhật` : 'Đã cập nhật chỉ số'}
                </div>
              </div>
              <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12">
                <Calendar size={140} />
              </div>
            </Card>

            <Card className="p-6 border-zinc-200 hover:border-amber-500/30 transition-all duration-300">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm shadow-amber-100">
                  <Zap size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-0.5">Điện tiêu thụ</p>
                  <p className="text-2xl font-black text-zinc-900 tracking-tight">
                    {isAdmin && !searchTerm 
                      ? totalStats?.totalElectricity 
                      : (latestReading?.electricityIndex || 0) - (latestReading?.previousElectricityIndex || 0)} <span className="text-sm font-bold text-zinc-400 ml-0.5 uppercase">kWh</span>
                  </p>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 pt-4 border-t border-zinc-100 font-bold uppercase tracking-wider">
                {isAdmin && !searchTerm ? (
                  <span className="text-zinc-400">Tổng cộng cho {totalStats?.count} phòng</span>
                ) : (
                  <>
                    <span>Mới: <strong className="text-zinc-900">{latestReading?.electricityIndex}</strong></span>
                    <span>Cũ: <strong className="text-zinc-900">{latestReading?.previousElectricityIndex || 0}</strong></span>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-6 border-zinc-200 hover:border-green-500/30 transition-all duration-300">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shadow-sm shadow-green-100">
                  <Droplets size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-0.5">Nước tiêu thụ</p>
                  <p className="text-2xl font-black text-zinc-900 tracking-tight">
                    {isAdmin && !searchTerm 
                      ? totalStats?.totalWater 
                      : (latestReading?.waterIndex || 0) - (latestReading?.previousWaterIndex || 0)} <span className="text-sm font-bold text-zinc-400 ml-0.5 uppercase">m³</span>
                  </p>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 pt-4 border-t border-zinc-100 font-bold uppercase tracking-wider">
                {isAdmin && !searchTerm ? (
                  <span className="text-zinc-400">Tổng cộng cho {totalStats?.count} phòng</span>
                ) : (
                  <>
                    <span>Mới: <strong className="text-zinc-900">{latestReading?.waterIndex}</strong></span>
                    <span>Cũ: <strong className="text-zinc-900">{latestReading?.previousWaterIndex || 0}</strong></span>
                  </>
                )}
              </div>
            </Card>
          </div>

          {((isAdmin && globalChartData.length > 1) || (!isAdmin && chartData.length > 1)) && (
            <Card className="p-6 border-zinc-200">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={20} className="text-zinc-400" />
                <h3 className="font-bold text-zinc-900">
                  {isAdmin && !searchTerm ? 'Biểu đồ tiêu thụ toàn hệ thống (6 tháng)' : 'Biểu đồ tiêu thụ 6 tháng gần nhất'}
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={isAdmin && !searchTerm ? globalChartData : chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#71717a', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#71717a', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: 'none', 
                        borderRadius: '16px',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Legend verticalAlign="top" height={48} iconType="circle" wrapperStyle={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                    <Line 
                      type="monotone" 
                      dataKey="Điện (kWh)" 
                      stroke="#f59e0b" 
                      strokeWidth={4} 
                      dot={{ r: 5, fill: '#f59e0b', strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Nước (m³)" 
                      stroke="#22c55e" 
                      strokeWidth={4} 
                      dot={{ r: 5, fill: '#22c55e', strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="p-2 bg-zinc-50/50 border-zinc-200/60">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên phòng..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="relative w-full md:w-56 group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="month"
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-bold"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
            />
          </div>
          {monthFilter && (
            <Button variant="ghost" onClick={() => setMonthFilter('')} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">Xóa lọc</Button>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-zinc-200 shadow-none">
        <div className="overflow-x-auto">
          {filteredReadings.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Phòng</TH>
                  <TH>Tháng</TH>
                  <TH>Chỉ số điện</TH>
                  <TH>Chỉ số nước</TH>
                  <TH>Thành tiền</TH>
                  {isAdmin && <TH className="text-right">Thao tác</TH>}
                </TR>
              </THead>
              <TBody>
                {(() => {
                  let currentMonth = '';
                  return filteredReadings.map((reading, index) => {
                    const isNewMonth = reading.month !== currentMonth;
                    if (isNewMonth) {
                      currentMonth = reading.month;
                    }

                    const prevReadingInHistory = readings
                      .filter(r => r.roomId === reading.roomId && r.month < reading.month)
                      .sort((a, b) => b.month.localeCompare(a.month))[0];
                    
                    const elecConsumed = reading.electricityIndex - (reading.previousElectricityIndex ?? prevReadingInHistory?.electricityIndex ?? 0);
                    const waterConsumed = reading.waterIndex - (reading.previousWaterIndex ?? prevReadingInHistory?.waterIndex ?? 0);
                    const totalCost = (elecConsumed * reading.electricityPrice) + (waterConsumed * reading.waterPrice);

                    return (
                      <React.Fragment key={reading.id}>
                        {isNewMonth && (
                          <TR hover={false} className="bg-zinc-50/80 border-y border-zinc-200">
                            <TD colSpan={isAdmin ? 6 : 5} className="py-2.5 px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar size={14} className="text-zinc-400" />
                                  <span className="text-xs font-black text-zinc-900 uppercase tracking-widest">
                                    Tháng {formatMonth(reading.month)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400 bg-white px-2 py-0.5 rounded border border-zinc-100 uppercase tracking-tighter">
                                  {filteredReadings.filter(r => r.month === reading.month).length} bản ghi
                                </span>
                              </div>
                            </TD>
                          </TR>
                        )}
                        <TR>
                          <TD>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400">
                                <Home size={14} />
                              </div>
                              <span className="font-bold text-zinc-900">{rooms.find(r => r.id === reading.roomId)?.name}</span>
                            </div>
                          </TD>
                          <TD>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-widest border border-zinc-200">
                              {formatMonth(reading.month)}
                            </span>
                          </TD>
                          <TD>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 text-zinc-900 font-mono text-sm font-bold">
                                <Zap size={14} className="text-amber-500" /> {reading.electricityIndex} <span className="text-[10px] text-zinc-400 uppercase font-sans">kWh</span>
                              </div>
                              <span className="text-[10px] text-zinc-400 font-medium">Cũ: {reading.previousElectricityIndex ?? prevReadingInHistory?.electricityIndex ?? 0}</span>
                            </div>
                          </TD>
                          <TD>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 text-zinc-900 font-mono text-sm font-bold">
                                <Droplets size={14} className="text-green-500" /> {reading.waterIndex} <span className="text-[10px] text-zinc-400 uppercase font-sans">m³</span>
                              </div>
                              <span className="text-[10px] text-zinc-400 font-medium">Cũ: {reading.previousWaterIndex ?? prevReadingInHistory?.waterIndex ?? 0}</span>
                            </div>
                          </TD>
                          <TD>
                            <div className="text-sm font-black text-zinc-900 tracking-tight">
                              {Math.max(0, totalCost).toLocaleString()}đ
                            </div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">
                              {Math.max(0, elecConsumed)} điện, {Math.max(0, waterConsumed)} nước
                            </div>
                          </TD>
                          {isAdmin && (
                            <TD className="text-right">
                              <div className="flex justify-end gap-1">
                                <button 
                                  onClick={() => setSearchTerm(rooms.find(r => r.id === reading.roomId)?.name || '')}
                                  className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-900 transition-all"
                                  title="Xem lịch sử phòng này"
                                >
                                  <Search size={18} />
                                </button>
                                <button onClick={() => openModal(reading)} className="p-2 hover:bg-green-50 rounded-xl text-zinc-400 hover:text-green-600 transition-all">
                                  <Edit2 size={18} />
                                </button>
                                <button onClick={() => {
                                  setReadingToDelete(reading.id);
                                  setIsConfirmOpen(true);
                                }} className="p-2 hover:bg-rose-50 rounded-xl text-zinc-400 hover:text-rose-600 transition-all">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </TD>
                          )}
                        </TR>
                      </React.Fragment>
                    );
                  });
                })()}
              </TBody>
            </Table>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mb-4">
              {(!isAdmin && !currentUser.tenantId) || (readings.length > 0 && filteredReadings.length === 0) ? <Info size={32} /> : <Zap size={32} />}
            </div>
            <h3 className="text-lg font-bold text-zinc-900">
              {readings.length > 0 && filteredReadings.length === 0 
                ? 'Không tìm thấy kết quả' 
                : !isAdmin && !currentUser.tenantId 
                  ? 'Tài khoản chưa được liên kết' 
                  : 'Chưa có dữ liệu điện nước'}
            </h3>
            <div className="text-zinc-500 text-sm mt-1 max-w-md">
              {readings.length > 0 && filteredReadings.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p>Không có chỉ số nào khớp với bộ lọc hiện tại.</p>
                  <Button 
                    variant="ghost" 
                    onClick={() => { setSearchTerm(''); setMonthFilter(''); }} 
                    size="sm" 
                    className="mt-2 mx-auto"
                  >
                    Xóa tất cả bộ lọc
                  </Button>
                </div>
              ) : isAdmin ? (
                <div className="flex flex-col gap-2">
                  <p>Chưa có chỉ số nào được ghi nhận.</p>
                  <Button onClick={() => openModal()} size="sm" className="mt-2 mx-auto">
                    <Plus size={16} /> Nhập chỉ số đầu tiên ngay
                  </Button>
                </div>
              ) : !currentUser.tenantId ? (
                'Vui lòng liên hệ Admin để liên kết tài khoản của bạn.'
              ) : rooms.filter(r => r.tenantId === currentUser.tenantId).length === 0 ? (
                'Bạn đã được liên kết nhưng Admin chưa xếp bạn vào phòng cụ thể nào.'
              ) : (
                <div className="flex flex-col gap-2">
                  <p>Hệ thống đã nhận diện bạn ở phòng <strong>{rooms.find(r => r.tenantId === currentUser.tenantId)?.name}</strong> (Mã: {rooms.find(r => r.tenantId === currentUser.tenantId)?.id}).</p>
                  <p className="text-amber-600 font-medium">Tuy nhiên, Admin chưa nhập chỉ số điện nước cho mã phòng này.</p>
                  <p className="text-[10px] text-zinc-400 italic">* Admin hãy kiểm tra xem đã nhập chỉ số cho đúng mã phòng trên chưa.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa chỉ số"
        message="Bạn có chắc chắn muốn xóa chỉ số điện nước này không?"
      />

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReading ? "Cập nhật chỉ số điện nước" : "Nhập chỉ số & Tạo hóa đơn"}>
        <div className="space-y-6">
          <div className="space-y-5">
            <Select 
              label="1. Chọn phòng" 
              icon={<Home size={18} className="text-green-500" />}
              value={formData.roomId || ''} 
              onChange={e => handleRoomChange(e.target.value)}
              className="rounded-xl border-zinc-200 px-4 py-2.5 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
              options={[
                { value: '', label: 'Chọn phòng' },
                ...sortedRooms.map(r => ({ 
                  value: r.id, 
                  label: `${r.name} - ${r.status === 'OCCUPIED' ? 'Đã thuê 🏠' : 'Còn trống ✨'}` 
                }))
              ]}
            />

            <div className="grid grid-cols-2 gap-5 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-inner">
              <Input 
                label="Chỉ số điện cũ" 
                numeric
                icon={<Zap size={16} className="text-amber-500" />}
                value={formData.prevElectricityIndex ?? ''} 
                onChange={e => setFormData({ ...formData, prevElectricityIndex: e.target.value === '' ? undefined : Number(e.target.value) })} 
                className="rounded-xl border-zinc-200 bg-white"
              />
              <Input 
                label="Chỉ số nước cũ" 
                numeric
                icon={<Droplets size={16} className="text-green-500" />}
                value={formData.prevWaterIndex ?? ''} 
                onChange={e => setFormData({ ...formData, prevWaterIndex: e.target.value === '' ? undefined : Number(e.target.value) })} 
                className="rounded-xl border-zinc-200 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Input 
                label="2. Chỉ số điện mới" 
                numeric
                icon={<Zap size={18} className="text-amber-500" />}
                value={formData.electricityIndex ?? ''} 
                onChange={e => setFormData({ ...formData, electricityIndex: e.target.value === '' ? undefined : Number(e.target.value) })} 
                placeholder="Nhập số điện..."
                className="rounded-xl border-zinc-200 px-4 py-2.5 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
              />
              <Input 
                label="3. Chỉ số nước mới" 
                numeric
                icon={<Droplets size={18} className="text-green-500" />}
                value={formData.waterIndex ?? ''} 
                onChange={e => setFormData({ ...formData, waterIndex: e.target.value === '' ? undefined : Number(e.target.value) })} 
                placeholder="Nhập số nước..."
                className="rounded-xl border-zinc-200 px-4 py-2.5 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
              />
            </div>

            <Input 
              label="4. Chọn tháng" 
              type="month" 
              icon={<Calendar size={18} className="text-green-500" />}
              value={formData.month || ''} 
              onChange={e => setFormData({ ...formData, month: e.target.value })} 
              className="rounded-xl border-zinc-200 px-4 py-2.5 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
            />
          </div>
          
          <div className="space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Lịch sử sử dụng</p>
            {formData.roomId ? (
              <div className="space-y-3">
                {roomHistory.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                    <table className="w-full text-[11px]">
                      <thead className="bg-zinc-50 border-b border-zinc-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-black text-zinc-400 uppercase tracking-widest">Tháng</th>
                          <th className="px-4 py-2 text-left font-black text-zinc-400 uppercase tracking-widest">Điện</th>
                          <th className="px-4 py-2 text-left font-black text-zinc-400 uppercase tracking-widest">Nước</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {roomHistory.map(h => (
                          <tr key={h.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-4 py-2.5 text-zinc-600 font-bold">{h.month}</td>
                            <td className="px-4 py-2.5 font-mono text-zinc-900 font-bold">{h.electricityIndex}</td>
                            <td className="px-4 py-2.5 font-mono text-zinc-900 font-bold">{h.waterIndex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-center">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Chưa có lịch sử cho phòng này</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-center">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Chọn phòng để xem lịch sử & chỉ số cũ</p>
              </div>
            )}
          </div>

          {formData.roomId && (
            <div className="p-5 bg-zinc-900 text-white rounded-2xl space-y-3 shadow-xl shadow-zinc-900/20 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                <TrendingUp size={80} />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  <span>Tiêu thụ điện:</span>
                  <span className="font-mono text-emerald-400">{Math.max(0, formData.electricityIndex - formData.prevElectricityIndex)} kWh</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  <span>Tiêu thụ nước:</span>
                  <span className="font-mono text-green-400">{Math.max(0, formData.waterIndex - formData.prevWaterIndex)} m³</span>
                </div>
                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest">Tổng tiền dự kiến:</span>
                  <span className="text-xl font-black text-amber-400 tracking-tight">
                    {(
                      (rooms.find(r => r.id === formData.roomId)?.price || 0) +
                      (Math.max(0, formData.electricityIndex - formData.prevElectricityIndex) * config.electricityPrice) +
                      (Math.max(0, formData.waterIndex - formData.prevWaterIndex) * config.waterPrice) +
                      config.internetPrice + 
                      config.trashPrice || 0
                    ).toLocaleString()}đ
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button className="w-full mt-4 shadow-lg shadow-green-200 rounded-2xl h-12 text-base font-bold" onClick={handleSave}>
            {editingReading ? "Cập nhật chỉ số" : "Lưu & Tạo hóa đơn ngay"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
