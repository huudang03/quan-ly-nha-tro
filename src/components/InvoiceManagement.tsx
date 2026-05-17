import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Room, Tenant, User, Notification, SystemConfig } from '../types';
import { Card, Button, Modal, ConfirmModal, Toast, Input, DateInput, Select, cn } from './UI';
import { apiFetch } from '../lib/api';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  Search, 
  Download, 
  Zap, 
  Droplets, 
  Edit2, 
  Trash2, 
  AlertCircle,
  BarChart3,
  TrendingUp,
  Filter,
  Calendar,
  Plus,
  Loader2,
  RefreshCcw,
  ArrowRight,
  X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { formatDate, formatMonth } from '../lib/dateUtils';

interface InvoiceManagementProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  rooms: Room[];
  tenants: Tenant[];
  isAdmin: boolean;
  currentUser: User;
  config: SystemConfig;
  onGenerateInvoices?: (month?: string) => Promise<number>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  createNotification: (notification: Notification) => Promise<void>;
  users: User[];
  initialInvoiceId?: string | null;
  onClearInitialInvoiceId?: () => void;
  onCheckPayment?: (code: string) => void;
  isChecking?: boolean;
  onRefresh: () => void;
}

export function InvoiceManagement({ 
  invoices, 
  setInvoices, 
  rooms, 
  tenants, 
  isAdmin, 
  currentUser, 
  config,
  onGenerateInvoices, 
  setNotifications, 
  createNotification,
  users,
  initialInvoiceId,
  onClearInitialInvoiceId,
  onCheckPayment,
  isChecking,
  onRefresh
}: InvoiceManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice> | null>(null);
  const [newInvoiceData, setNewInvoiceData] = useState({
    roomId: '',
    month: format(new Date(), 'yyyy-MM'),
    otherCosts: 0,
    dueDate: format(new Date(), 'yyyy-MM-10')
  });
  const [showStats, setShowStats] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', isVisible: boolean }>({ message: '', type: 'success', isVisible: false });

  const getFriendlyInvoiceCode = (invoice: Invoice | Partial<Invoice>) => {
    if (!invoice.month || !invoice.roomId) return 'HD-???';
    const room = rooms.find(r => r.id === invoice.roomId);
    if (!room) return 'HD-???';
    
    // Extract numbers from room name (e.g., "Phòng 101" -> "101")
    const roomCode = room.name.match(/\d+/)?.[0] || room.name.replace(/\s+/g, '');
    
    // Format month year from "2026-05" -> "0526"
    const [year, month] = invoice.month.split('-');
    const shortYear = year.slice(2);
    
    return `HD-${roomCode}-${month}${shortYear}`;
  };

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

  React.useEffect(() => {
    if (initialInvoiceId) {
      const inv = invoices.find(i => i.id === initialInvoiceId);
      if (inv) {
        setSelectedInvoice(inv);
        if (onClearInitialInvoiceId) onClearInitialInvoiceId();
      }
    }
  }, [initialInvoiceId, invoices, onClearInitialInvoiceId]);

  // Polling for payment status when QR modal is open
  React.useEffect(() => {
    let interval: any;
    if (isQRModalOpen && selectedInvoice && selectedInvoice.status !== 'PAID') {
      const room = rooms.find(r => r.id === selectedInvoice.roomId);
      if (room) {
        const roomNumber = room.name.match(/\d+/)?.[0] || room.name;
        const monthStr = selectedInvoice.month.split('-')[1] || '';
        const code = `HD${roomNumber}T${monthStr}`;
        
        interval = setInterval(() => {
          console.log(`[Polling] Checking payment for ${code}...`);
          if (onCheckPayment) onCheckPayment(code);
          
          // Check local invoices state (which is real-time)
          const inv = invoices.find(i => i.code === code);
          if (inv && inv.status === 'PAID') {
            setToast({ message: 'Thanh toán thành công!', type: 'success', isVisible: true });
            setIsQRModalOpen(false);
            setSelectedInvoice(null);
            clearInterval(interval);
          }
        }, 3000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isQRModalOpen, selectedInvoice, rooms, onRefresh]);

  const handleMarkAsPaid = async (id: string) => {
    try {
      const result = await apiFetch<Invoice>(`/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAID' })
      });
      
      // Update local state immediately
      if (setInvoices) {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...result } : inv));
      }
      
      onRefresh();
      setSelectedInvoice(null);
      setToast({ message: 'Đã xác nhận thanh toán hóa đơn!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Error marking invoice as paid:', err);
      setToast({ message: err.message || 'Lỗi khi xác nhận thanh toán', type: 'error', isVisible: true });
    }
  };

  const handleConfirmPayment = async (id: string) => {
    try {
      const result = await apiFetch<Invoice>(`/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PENDING' })
      });
      
      // Update local state immediately
      if (setInvoices) {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...result } : inv));
      }
      
      onRefresh();
      setIsQRModalOpen(false);
      setSelectedInvoice(null);
      setToast({ message: 'Đã gửi yêu cầu xác nhận thanh toán. Vui lòng chờ Admin kiểm tra!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      setToast({ message: err.message || 'Lỗi khi gửi yêu cầu xác nhận', type: 'error', isVisible: true });
    }
  };

  const handleGenerate = async () => {
    if (onGenerateInvoices) {
      try {
        const count = await onGenerateInvoices();
        if (count > 0) {
          setToast({ message: `Đã tự động tạo ${count} hóa đơn cho tháng này!`, type: 'success', isVisible: true });
        }
      } catch (err: any) {
        console.error('Error generating invoices:', err);
        setToast({ message: err.message || 'Lỗi khi tạo hóa đơn', type: 'error', isVisible: true });
      }
    }
  };

  const handleDelete = async () => {
    if (invoiceToDelete) {
      try {
        await apiFetch(`/api/invoices/${invoiceToDelete}`, { method: 'DELETE' });
        await onRefresh();
        setInvoiceToDelete(null);
        setIsDeleteConfirmOpen(false);
        setToast({ message: 'Đã xóa hóa đơn!', type: 'success', isVisible: true });
      } catch (err: any) {
        console.error('Error deleting invoice:', err);
        setToast({ message: err.message || 'Lỗi khi xóa hóa đơn', type: 'error', isVisible: true });
      }
    }
  };

  const handleSaveEdit = async () => {
    if (editingInvoice && editingInvoice.id) {
      try {
        // Recalculate total before sending to server to ensure consistency
        const updatedTotal = 
          (editingInvoice.roomPrice || 0) + 
          (editingInvoice.electricityCost || 0) + 
          (editingInvoice.waterCost || 0) + 
          (editingInvoice.internetCost || 0) + 
          (editingInvoice.trashCost || 0) + 
          (editingInvoice.otherCosts || 0);
          
        const payload = {
          ...editingInvoice,
          total: updatedTotal
        };

        const updatedResult = await apiFetch<Invoice>(`/api/invoices/${editingInvoice.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        
        // Update local state immediately for snappy UI
        setInvoices(prev => prev.map(inv => inv.id === updatedResult.id ? { ...inv, ...updatedResult } : inv));
        
        // Still call onRefresh to ensure background sync across the whole app
        onRefresh();
        
        setIsEditModalOpen(false);
        setEditingInvoice(null);
        setToast({ message: 'Đã cập nhật hóa đơn!', type: 'success', isVisible: true });
      } catch (err: any) {
        console.error('Error saving invoice edit:', err);
        setToast({ message: err.message || 'Lỗi khi cập nhật hóa đơn', type: 'error', isVisible: true });
      }
    }
  };

  const handleCreateInvoice = async () => {
    const room = rooms.find(r => r.id === newInvoiceData.roomId);
    if (!room || !room.tenantId) {
      setToast({ message: 'Phòng phải có người thuê mới tạo được hóa đơn!', type: 'error', isVisible: true });
      return;
    }

    try {
      const result = await apiFetch<Invoice>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(newInvoiceData)
      });
      
      // Update local state immediately
      setInvoices(prev => [result, ...prev]);
      
      onRefresh();
      setIsCreateModalOpen(false);
      setToast({ message: 'Đã tạo hóa đơn!', type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      let errorMsg = err.message || 'Lỗi khi tạo hóa đơn';
      if (errorMsg.includes('already exists')) {
        const room = rooms.find(r => r.id === newInvoiceData.roomId);
        const [year, month] = newInvoiceData.month.split('-');
        errorMsg = `Hóa đơn cho ${room?.name || 'phòng này'} trong tháng ${month}/${year} đã tồn tại!`;
      }
      setToast({ message: errorMsg, type: 'error', isVisible: true });
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    return (amount || 0).toLocaleString();
  };

  const handleExport = () => {
    if (filteredInvoices.length === 0) {
      setToast({ message: 'Không có dữ liệu để xuất!', type: 'error', isVisible: true });
      return;
    }

    const headers = ['Mã HĐ', 'Phòng', 'Người thuê', 'Tháng', 'Tổng tiền', 'Trạng thái', 'Ngày tạo'];
    const csvData = filteredInvoices.map(inv => [
      getFriendlyInvoiceCode(inv),
      rooms.find(r => r.id === inv.roomId)?.name || 'N/A',
      tenants.find(t => t.id === inv.tenantId)?.name || 'N/A',
      formatMonth(inv.month),
      inv.total,
      inv.status === 'PAID' ? 'Đã thanh toán' : (inv.status === 'OVERDUE' ? 'Quá hạn' : 'Chưa thanh toán'),
      formatDate(inv.createdAt)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hoa_don_${format(new Date(), 'dd_MM_yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Đã xuất file CSV thành công!', type: 'success', isVisible: true });
  };

  const removeAccents = (str: string) => {
    return str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    try {
      const doc = new jsPDF();
      const room = rooms.find(r => r.id === invoice.roomId);
      const tenant = tenants.find(t => t.id === invoice.tenantId);
      
      // Add title
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(removeAccents(config.propertyName || 'HOA DON THANH TOAN'), 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Thang: ${invoice.month}`, 105, 30, { align: 'center' });
      
      // Info section
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.text(`Ma hoa don: ${getFriendlyInvoiceCode(invoice)}`, 20, 45);
      doc.text(`Ngay tao: ${formatDate(invoice.createdAt)}`, 20, 52);
      doc.text(`Han thanh toan: ${formatDate(invoice.dueDate)}`, 20, 59);
      
      doc.text(`Phong: ${removeAccents(room?.name || 'N/A')}`, 120, 45);
      doc.text(`Nguoi thue: ${removeAccents(tenant?.name || 'N/A')}`, 120, 52);
      doc.text(`Trang thai: ${invoice.status === 'PAID' ? 'DA THANH TOAN' : 'CHUA THANH TOAN'}`, 120, 59);
      
      // Table
      const tableRows = [
        ['Tien phong', formatCurrency(invoice.roomPrice)],
        ['Tien dien', formatCurrency(invoice.electricityCost)],
        ['Tien nuoc', formatCurrency(invoice.waterCost)],
        ['Internet', formatCurrency(invoice.internetCost)],
        ['Rac', formatCurrency(invoice.trashCost)],
        ['Phi khac', formatCurrency(invoice.otherCosts)],
        ['TONG CONG', formatCurrency(invoice.total)]
      ];
      
      autoTable(doc, {
        startY: 70,
        head: [['Noi dung', 'So tien (VND)']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      
      // Footer
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(10);
      doc.text('Cam on ban da su dung dich vu!', 105, finalY + 20, { align: 'center' });
      
      doc.save(`HoaDon_${removeAccents(room?.name || 'Phong')}_Thang${invoice.month}.pdf`);
      setToast({ message: 'Đã tải hóa đơn PDF thành công!', type: 'success', isVisible: true });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      setToast({ message: 'Lỗi: ' + (error.message || 'Không thể tạo file PDF'), type: 'error', isVisible: true });
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

  const filteredInvoices = useMemo(() => {
    if (!Array.isArray(invoices)) return [];

    let result = isAdmin
      ? invoices.filter(inv => {
          if (!inv) return false;
          const room = rooms.find(r => r.id === inv.roomId);
          const tenant = tenants.find(t => t.id === inv.tenantId);
          const roomName = room?.name?.toLowerCase() || '';
          const tenantName = tenant?.name?.toLowerCase() || '';
          const friendlyCode = getFriendlyInvoiceCode(inv).toLowerCase();
          const search = searchTerm.toLowerCase();
          return roomName.includes(search) || tenantName.includes(search) || friendlyCode.includes(search);
        })
      : invoices.filter(inv => {
          if (!inv) return false;
          // Show invoice if the tenant is the one on the invoice 
          // OR if the tenant is currently living in the room the invoice belongs to
          const myTenant = tenants.find(t => t.id === currentUser.tenantId);
          return inv.tenantId === currentUser.tenantId || (myTenant?.roomId === inv.roomId);
        });

    if (statusFilter !== 'ALL') {
      result = result.filter(inv => inv.status === statusFilter);
    }

    if (monthFilter) {
      result = result.filter(inv => inv.month === monthFilter);
    }

    return [...result].sort((a, b) => {
      const monthCompare = (b.month || '').localeCompare(a.month || '');
      if (monthCompare !== 0) return monthCompare;
      
      const roomA = rooms.find(r => r.id === a.roomId);
      const roomB = rooms.find(r => r.id === b.roomId);
      
      if (!roomA || !roomB) return (b.id || '').localeCompare(a.id || '');
      
      const getNum = (name: string) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0]) : 999999;
      };
      
      return getNum(roomA.name) - getNum(roomB.name);
    });
  }, [invoices, isAdmin, rooms, tenants, searchTerm, statusFilter, monthFilter, currentUser]);

  const stats = useMemo(() => {
    if (!Array.isArray(invoices)) return { totalRevenue: 0, pendingRevenue: 0, paidCount: 0, unpaidCount: 0 };
    
    const paid = invoices.filter(inv => inv && inv.status === 'PAID');
    const unpaid = invoices.filter(inv => inv && (inv.status === 'UNPAID' || inv.status === 'OVERDUE'));
    const totalRevenue = paid.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const pendingRevenue = unpaid.reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    return {
      totalRevenue,
      pendingRevenue,
      paidCount: paid.length,
      unpaidCount: unpaid.length
    };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Quản lý hóa đơn</h2>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Theo dõi và quản lý các khoản thanh toán của người thuê.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="secondary"
            onClick={handleRefresh}
            title="Làm mới dữ liệu"
            disabled={isRefreshing}
          >
            <RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} />
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setShowStats(!showStats)}>
                <BarChart3 size={18} /> {showStats ? 'Ẩn thống kê' : 'Xem thống kê'}
              </Button>
              <Button variant="outline" onClick={handleGenerate}>
                <Zap size={18} /> Chốt hóa đơn tháng này
              </Button>
              <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg shadow-green-200/50">
                <Plus size={18} /> Tạo hóa đơn mới
              </Button>
            </>
          )}
        </div>
      </div>

      {showStats && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5 bg-emerald-50 border-emerald-100 shadow-none">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Doanh thu đã thu</p>
            <p className="text-2xl font-black text-emerald-900">{formatCurrency(stats.totalRevenue)}đ</p>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mt-3">
              <TrendingUp size={14} /> {stats.paidCount} hóa đơn đã thanh toán
            </div>
          </Card>
          <Card className="p-5 bg-amber-50 border-amber-100 shadow-none">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Doanh thu chờ thu</p>
            <p className="text-2xl font-black text-amber-900">{formatCurrency(stats.pendingRevenue)}đ</p>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 mt-3">
              <Clock size={14} /> {stats.unpaidCount} hóa đơn chưa thanh toán
            </div>
          </Card>
          <Card className="p-5 bg-zinc-900 text-white shadow-none border-none">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Tổng doanh thu dự kiến</p>
            <p className="text-2xl font-black">{formatCurrency(stats.totalRevenue + stats.pendingRevenue)}đ</p>
            <p className="text-[10px] font-bold text-zinc-500 mt-3 uppercase tracking-wider">Dựa trên tất cả hóa đơn</p>
          </Card>
          <Card className="p-5 bg-white border-zinc-200 shadow-none">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Tỷ lệ thanh toán</p>
            <p className="text-2xl font-black text-zinc-900">
              {invoices.length > 0 ? Math.round((stats.paidCount / invoices.length) * 100) : 0}%
            </p>
            <div className="w-full bg-zinc-100 h-2 rounded-full mt-4 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-700 ease-out" 
                style={{ width: `${invoices.length > 0 ? (stats.paidCount / invoices.length) * 100 : 0}%` }}
              />
            </div>
          </Card>
        </div>
      )}

      <Card className="p-2 bg-zinc-50/50 border-zinc-200/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên phòng hoặc người thuê..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-44">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
              <select 
                className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl appearance-none focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-medium cursor-pointer"
                value={statusFilter || 'ALL'}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PAID">Đã thanh toán</option>
                <option value="PENDING">Chờ xác nhận</option>
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="OVERDUE">Quá hạn</option>
              </select>
            </div>
            <div className="relative w-48">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
              <input 
                type="month"
                className="w-full pl-10 pr-10 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200 text-sm font-bold cursor-pointer"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
              />
              {monthFilter && (
                <button 
                  onClick={() => setMonthFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                  title="Xóa lọc tháng"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button variant="secondary" size="icon" onClick={handleExport} title="Xuất CSV" className="h-12 w-12 rounded-xl">
              <Download size={18} />
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        {filteredInvoices.length > 0 ? (
          (() => {
            const groups: { month: string, items: Invoice[] }[] = [];
            filteredInvoices.forEach(inv => {
              const lastGroup = groups[groups.length - 1];
              if (lastGroup && lastGroup.month === inv.month) {
                lastGroup.items.push(inv);
              } else {
                groups.push({ month: inv.month, items: [inv] });
              }
            });

            return groups.map(group => (
              <div key={group.month} className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <div className="h-px flex-1 bg-zinc-200" />
                  <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">
                    Tháng {formatMonth(group.month)}
                  </span>
                  <div className="h-px flex-1 bg-zinc-200" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {group.items.map(invoice => (
                    <div key={invoice.id} className="group">
                      <Card 
                        className={cn(
                          "p-6 rounded-2xl border border-zinc-200 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer bg-white",
                          invoice.status === 'PAID' ? "border-l-4 border-l-green-400" : 
                          invoice.status === 'UNPAID' ? "border-l-4 border-l-red-400" :
                          invoice.status === 'OVERDUE' ? "border-l-4 border-l-orange-400" : ""
                        )}
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-6">
                          {/* Left: Icon */}
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                            <FileText size={24} />
                          </div>

                          {/* Middle: Info */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-zinc-900">
                                {rooms.find(r => r.id === invoice.roomId)?.name}
                              </h4>
                              {invoice.status === 'UNPAID' && <AlertCircle size={14} className="text-red-500" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                              <span className="font-mono text-[11px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-600">
                                {getFriendlyInvoiceCode(invoice)}
                              </span>
                              <span>•</span>
                              <span>Hạn: {formatDate(invoice.dueDate)}</span>
                              {invoice.status === 'UNPAID' && invoice.dueDate && (
                                (() => {
                                  const daysLeft = differenceInDays(parseISO(invoice.dueDate), new Date());
                                  if (daysLeft >= 0 && daysLeft < 3) {
                                    return <span className="text-red-500 font-bold ml-1">• Sắp đến hạn</span>;
                                  }
                                  return null;
                                })()
                              )}
                            </div>
                          </div>

                          {/* Right: Money + Status + Actions */}
                          <div className="flex flex-col md:items-end gap-3">
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-600">
                                {(invoice.total || 0).toLocaleString()}đ
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-3">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                                invoice.status === 'PAID' ? "bg-green-100 text-green-600" : 
                                invoice.status === 'OVERDUE' ? "bg-orange-100 text-orange-600" : 
                                invoice.status === 'UNPAID' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                              )}>
                                {invoice.status === "PAID" ? 'ĐÃ THANH TOÁN' : 
                                 invoice.status === 'OVERDUE' ? 'QUÁ HẠN' : 
                                 invoice.status === 'PENDING' ? 'CHỜ XÁC NHẬN' : 'CHƯA THANH TOÁN'}
                              </span>
                              
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInvoice(invoice);
                                  }}
                                  className="bg-black text-white hover:bg-zinc-800 rounded-lg px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap"
                                >
                                  CHI TIẾT
                                </button>

                                {!isAdmin && invoice.status !== 'PAID' && invoice.status !== 'PENDING' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedInvoice(invoice);
                                      setIsQRModalOpen(true);
                                    }}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                                  >
                                    Thanh toán
                                  </button>
                                )}

                                {isAdmin && (
                                  <div className="flex items-center gap-1">
                                    {invoice.status === 'PENDING' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMarkAsPaid(invoice.id);
                                        }}
                                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                                      >
                                        Duyệt
                                      </button>
                                    )}
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingInvoice(invoice);
                                        setIsEditModalOpen(true);
                                      }}
                                      className="p-2 hover:bg-zinc-100 rounded text-zinc-400 transition-colors"
                                      title="Sửa"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInvoiceToDelete(invoice.id);
                                        setIsDeleteConfirmOpen(true);
                                      }}
                                      className="p-2 hover:bg-zinc-100 rounded text-zinc-400 transition-colors"
                                      title="Xóa"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()
        ) : (
          <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-zinc-200">
            <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-200 mx-auto mb-6">
              <FileText size={40} />
            </div>
            <p className="text-zinc-900 font-bold text-lg">Chưa có hóa đơn nào</p>
            <p className="text-zinc-500 text-sm mt-1">Hệ thống sẽ tự động tạo hóa đơn vào đầu mỗi tháng.</p>
          </div>
        )}
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />

      <ConfirmModal 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa hóa đơn"
        message="Bạn có chắc chắn muốn xóa hóa đơn này? Hành động này không thể hoàn tác."
      />

      <Modal 
        isOpen={!!selectedInvoice} 
        onClose={() => setSelectedInvoice(null)} 
        title="Chi tiết hóa đơn"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{rooms.find(r => r.id === selectedInvoice.roomId)?.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-zinc-500">Tháng {formatMonth(selectedInvoice.month)}</p>
                  <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded font-mono font-bold">
                    {getFriendlyInvoiceCode(selectedInvoice)}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Người thuê: {tenants.find(t => t.id === selectedInvoice.tenantId)?.name}</p>
              </div>
              <div className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
                selectedInvoice.status === 'PAID' ? "bg-green-100 text-green-700" : 
                selectedInvoice.status === 'OVERDUE' ? "bg-rose-100 text-rose-700" :
                selectedInvoice.status === 'PENDING' ? "bg-amber-100 text-amber-700" :
                "bg-zinc-100 text-zinc-600"
              )}>
                {selectedInvoice.status === "PAID" ? 'Đã thanh toán' : 
                 selectedInvoice.status === 'OVERDUE' ? 'Quá hạn' :
                 selectedInvoice.status === 'PENDING' ? 'Chờ xác nhận' : 'Chưa thanh toán'}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Tiền phòng:</span>
                <span className="font-medium text-zinc-900">{formatCurrency(selectedInvoice.roomPrice)} VNĐ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Tiền điện:</span>
                <span className="font-medium text-zinc-900">{formatCurrency(selectedInvoice.electricityCost)} VNĐ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Tiền nước:</span>
                <span className="font-medium text-zinc-900">{formatCurrency(selectedInvoice.waterCost)} VNĐ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Internet:</span>
                <span className="font-medium text-zinc-900">{formatCurrency(selectedInvoice.internetCost)} VNĐ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Rác:</span>
                <span className="font-medium text-zinc-900">{formatCurrency(selectedInvoice.trashCost)} VNĐ</span>
              </div>
              {selectedInvoice.otherCosts > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Phí phát sinh:</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(selectedInvoice.otherCosts)} VNĐ</span>
                </div>
              )}
              <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
                <span className="font-bold text-zinc-900">Tổng cộng:</span>
                <span className="text-xl font-bold text-zinc-900">{formatCurrency(selectedInvoice.total)} VNĐ</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg space-y-1">
              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Thông tin thanh toán</p>
              <p className="text-xs text-zinc-600">Hạn thanh toán: <span className="font-bold">{formatDate(selectedInvoice.dueDate)}</span></p>
              <p className="text-xs text-zinc-600">Ngày tạo: {formatDate(selectedInvoice.createdAt)}</p>
            </div>

            {isAdmin && selectedInvoice.status !== 'PAID' && (
              <Button className="w-full" onClick={() => handleMarkAsPaid(selectedInvoice.id)}>
                {selectedInvoice.status === 'PENDING' ? 'Xác nhận đã nhận tiền' : 'Xác nhận đã thanh toán'}
              </Button>
            )}

            {!isAdmin && selectedInvoice.status === 'UNPAID' && (
              <Button className="w-full" onClick={() => setIsQRModalOpen(true)}>
                Thanh toán ngay (QR Code)
              </Button>
            )}
            
            {!isAdmin && selectedInvoice.status === 'PENDING' && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-xs text-center font-medium">
                Đang chờ Admin xác nhận thanh toán...
              </div>
            )}
            
            <Button variant="outline" className="w-full" onClick={() => handleDownloadPDF(selectedInvoice)}>
              <Download size={16} /> Tải hóa đơn (PDF)
            </Button>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={isQRModalOpen} 
        onClose={() => setIsQRModalOpen(false)} 
        title="Thanh toán qua QR Code"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-zinc-500 uppercase tracking-widest font-mono">Số tiền cần thanh toán</p>
              <p className="text-4xl font-bold text-zinc-900 font-mono tracking-tighter">
                {selectedInvoice.total.toLocaleString()}đ
              </p>
            </div>

            <div className="p-4 bg-white border-2 border-zinc-100 rounded-2xl inline-block mx-auto w-full text-center">
              {config.bankQrUrl ? (
                <img 
                  src={config.bankQrUrl} 
                  alt="Bank QR Code" 
                  className="w-64 h-auto mx-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img 
                  src={`https://img.vietqr.io/image/${config.bankName || 'MB'}-${config.bankAccount || '0123456789'}-compact.png?amount=${Math.round(selectedInvoice.total)}&addInfo=${encodeURIComponent(selectedInvoice.code || `HD${rooms.find(r => r.id === selectedInvoice.roomId)?.name.match(/\d+/)?.[0] || rooms.find(r => r.id === selectedInvoice.roomId)?.name.replace(/\s+/g, '')}T${selectedInvoice.month.split('-')[1]}`)}&accountName=${encodeURIComponent(config.bankAccountName || 'NGUYEN VAN A')}`} 
                  alt="VietQR Code" 
                  className="w-64 h-auto mx-auto"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="space-y-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-mono uppercase text-[10px]">Ngân hàng</span>
                <span className="font-bold text-zinc-900">{config.bankName || 'MB Bank'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-mono uppercase text-[10px]">Số tài khoản</span>
                <span className="font-bold text-zinc-900 font-mono">{config.bankAccount || '0123456789'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-mono uppercase text-[10px]">Chủ tài khoản</span>
                <span className="font-bold text-zinc-900">{config.bankAccountName || 'NGUYEN VAN A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-mono uppercase text-[10px]">Nội dung</span>
                <span className="font-bold text-zinc-900 font-mono uppercase">{selectedInvoice.code || `HD${rooms.find(r => r.id === selectedInvoice.roomId)?.name.match(/\d+/)?.[0] || rooms.find(r => r.id === selectedInvoice.roomId)?.name.replace(/\s+/g, '')}T${selectedInvoice.month.split('-')[1]}`}</span>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                className="w-full bg-zinc-900 text-white font-mono uppercase tracking-widest py-4"
                onClick={() => handleConfirmPayment(selectedInvoice.id)}
              >
                <CheckCircle2 size={18} /> Tôi đã chuyển khoản xong
              </Button>
              
              <Button 
                variant="outline"
                className="w-full font-mono uppercase tracking-widest py-4"
                onClick={() => {
                  const room = rooms.find(r => r.id === selectedInvoice.roomId);
                  if (!room) return;
                  const roomNumber = room.name.match(/\d+/)?.[0] || room.name;
                  const monthStr = selectedInvoice.month.split('-')[1] || '';
                  const code = `HD${roomNumber}T${monthStr}`;
                  if (onCheckPayment) onCheckPayment(code);
                }}
                disabled={isChecking}
              >
                {isChecking ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
                {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái thanh toán'}
              </Button>
              
              <p className="text-[10px] text-zinc-400 text-center uppercase tracking-wider">
                * Sau khi nhấn, hệ thống sẽ gửi yêu cầu xác nhận đến chủ trọ.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Tạo hóa đơn thủ công"
      >
        <div className="space-y-4">
          <Select 
            label="Phòng" 
            value={newInvoiceData.roomId || ''} 
            onChange={e => setNewInvoiceData({ ...newInvoiceData, roomId: e.target.value })}
            options={[
              { value: '', label: 'Chọn phòng' },
              ...sortedRooms.filter(r => r.status === 'OCCUPIED').map(r => ({ value: r.id, label: r.name }))
            ]}
          />
          <Input 
            label="Tháng" 
            type="month" 
            value={newInvoiceData.month || ''} 
            onChange={e => {
              const selectedMonth = e.target.value;
              setNewInvoiceData({ 
                ...newInvoiceData, 
                month: selectedMonth,
                dueDate: selectedMonth ? `${selectedMonth}-10` : ''
              });
            }} 
          />
          <Input 
            label="Phí phát sinh khác (VNĐ)" 
            numeric
            value={newInvoiceData.otherCosts ?? ''} 
            onChange={e => setNewInvoiceData({ ...newInvoiceData, otherCosts: e.target.value === '' ? 0 : Number(e.target.value) })} 
          />
          <DateInput 
            label="Hạn thanh toán" 
            value={newInvoiceData.dueDate || ''} 
            onChange={(val: string) => setNewInvoiceData({ ...newInvoiceData, dueDate: val })} 
            min={new Date().toISOString().split('T')[0]}
          />
          <Button className="w-full mt-4" onClick={handleCreateInvoice}>Tạo hóa đơn</Button>
        </div>
      </Modal>

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingInvoice(null);
        }} 
        title="Chỉnh sửa hóa đơn"
      >
        {editingInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Tiền điện (VNĐ)" 
                numeric
                value={editingInvoice.electricityCost ?? ''} 
                onChange={e => setEditingInvoice({ ...editingInvoice, electricityCost: e.target.value === '' ? 0 : Number(e.target.value) })} 
              />
              <Input 
                label="Tiền nước (VNĐ)" 
                numeric
                value={editingInvoice.waterCost ?? ''} 
                onChange={e => setEditingInvoice({ ...editingInvoice, waterCost: e.target.value === '' ? 0 : Number(e.target.value) })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Internet (VNĐ)" 
                numeric
                value={editingInvoice.internetCost ?? ''} 
                onChange={e => setEditingInvoice({ ...editingInvoice, internetCost: e.target.value === '' ? 0 : Number(e.target.value) })} 
              />
              <Input 
                label="Rác (VNĐ)" 
                numeric
                value={editingInvoice.trashCost ?? ''} 
                onChange={e => setEditingInvoice({ ...editingInvoice, trashCost: e.target.value === '' ? 0 : Number(e.target.value) })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Chi phí khác (VNĐ)" 
                numeric
                value={editingInvoice.otherCosts ?? ''} 
                onChange={e => setEditingInvoice({ ...editingInvoice, otherCosts: e.target.value === '' ? 0 : Number(e.target.value) })} 
              />
              <Input 
                label="Tiền phòng (VNĐ)" 
                numeric
                value={editingInvoice.roomPrice ?? ''} 
                onChange={e => setEditingInvoice({ ...editingInvoice, roomPrice: e.target.value === '' ? 0 : Number(e.target.value) })} 
              />
            </div>
            <Input 
              label="Hạn thanh toán" 
              type="date" 
              value={editingInvoice.dueDate ? (editingInvoice.dueDate.includes('T') ? editingInvoice.dueDate.split('T')[0] : editingInvoice.dueDate) : ''} 
              onChange={e => setEditingInvoice({ ...editingInvoice, dueDate: e.target.value })} 
            />
            
            <div className="p-4 bg-zinc-900 text-white rounded-xl flex justify-between items-center">
              <span className="text-sm font-medium opacity-70">Tổng tiền mới:</span>
              <span className="text-xl font-bold">
                {(
                  (editingInvoice.roomPrice || 0) + 
                  (editingInvoice.electricityCost || 0) + 
                  (editingInvoice.waterCost || 0) + 
                  (editingInvoice.internetCost || 0) + 
                  (editingInvoice.trashCost || 0) + 
                  (editingInvoice.otherCosts || 0)
                ).toLocaleString()} VNĐ
              </span>
            </div>

            <Button className="w-full mt-4" onClick={handleSaveEdit}>Lưu thay đổi</Button>
          </div>
        )}
      </Modal>

      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}
