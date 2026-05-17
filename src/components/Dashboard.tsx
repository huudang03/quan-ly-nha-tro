import React, { useMemo } from 'react';
import { Room, Tenant, Invoice, Contract } from '../types';
import { Card, cn } from './UI';
import { Home, CheckCircle2, XCircle, DollarSign, FileText, Calendar } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format } from 'date-fns';
import { formatDate } from '../lib/dateUtils';

interface DashboardProps {
  rooms: Room[];
  tenants: Tenant[];
  invoices: Invoice[];
  contracts: Contract[];
  isAdmin: boolean;
  currentUser: any;
  onViewContract?: () => void;
}

export function Dashboard({ rooms, tenants, invoices, contracts, isAdmin, currentUser, onViewContract }: DashboardProps) {
  const stats = useMemo(() => {
    if (isAdmin) {
      if (!Array.isArray(rooms) || !Array.isArray(invoices)) {
        return { totalRooms: 0, occupiedRooms: 0, availableRooms: 0, totalRevenue: 0, unpaidInvoices: 0 };
      }
      const totalRooms = rooms.length;
      const occupiedRooms = rooms.filter(r => r && r.status === 'OCCUPIED').length;
      const availableRooms = totalRooms - occupiedRooms;
      const totalRevenue = invoices
        .filter(inv => inv && inv.status === 'PAID')
        .reduce((acc, inv) => acc + (inv.total || 0), 0);
      const unpaidInvoices = invoices.filter(inv => inv && inv.status === 'UNPAID').length;

      return { totalRooms, occupiedRooms, availableRooms, totalRevenue, unpaidInvoices };
    } else {
      const myTenant = tenants.find(t => t.id === currentUser.tenantId);
      const tenantInvoices = invoices.filter(inv => inv.tenantId === currentUser.tenantId || (myTenant?.roomId === inv.roomId));
      const unpaidInvoices = tenantInvoices.filter(inv => inv.status === 'UNPAID' || inv.status === 'OVERDUE');
      const totalPaid = tenantInvoices
        .filter(inv => inv.status === 'PAID')
        .reduce((acc, inv) => acc + inv.total, 0);
      const pendingAmount = unpaidInvoices.reduce((acc, inv) => acc + inv.total, 0);
      
      const myRooms = rooms.filter(r => r.tenantId === currentUser.tenantId || (myTenant?.roomId === r.id));
      const myContract = contracts.find(c => c.tenantId === currentUser.tenantId && c.status === 'ACTIVE');
      
      return { unpaidInvoices: unpaidInvoices.length, totalPaid, pendingAmount, myRooms, myContract };
    }
  }, [rooms, invoices, contracts, isAdmin, currentUser]);

  const chartData = isAdmin ? [
    { name: 'Đã thuê', value: (stats as any).occupiedRooms, color: '#10b981' },
    { name: 'Trống', value: (stats as any).availableRooms, color: '#f4f4f5' },
  ] : [];

  const revenueData = useMemo(() => {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const currentYear = new Date().getFullYear();
    
    return months.map(m => {
      const monthStr = `${currentYear}-${m}`;
      const myTenant = tenants.find(t => t.id === currentUser.tenantId);
      const filteredInvoices = isAdmin 
        ? invoices 
        : invoices.filter(inv => inv.tenantId === currentUser.tenantId || (myTenant?.roomId === inv.roomId));

      const paid = filteredInvoices
        .filter(inv => inv.month === monthStr && inv.status === 'PAID')
        .reduce((acc, inv) => acc + (inv.total || 0), 0);
      const unpaid = filteredInvoices
        .filter(inv => inv.month === monthStr && (inv.status === 'UNPAID' || inv.status === 'OVERDUE'))
        .reduce((acc, inv) => acc + (inv.total || 0), 0);
      
      return { 
        name: `T${m}`, 
        'Đã thu': paid, 
        'Chờ thu': unpaid 
      };
    });
  }, [invoices, isAdmin, currentUser]);

  if (!isAdmin) {
    return (
      <div className="space-y-8 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-zinc-900 tracking-tight">Xin chào, {currentUser.name}</h2>
            <p className="text-zinc-500 mt-1 text-sm font-medium">Chào mừng bạn trở lại với hệ thống quản lý cư dân.</p>
          </div>
          <div className="text-xs font-bold text-zinc-500 bg-white px-5 py-3 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300">
            {formatDate(new Date().toISOString())}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            icon={<Home size={22} />} 
            label="Phòng của tôi" 
            value={(stats as any).myRooms.length > 0 
              ? ((stats as any).myRooms.length > 1 
                  ? `${(stats as any).myRooms.length} Phòng` 
                  : (stats as any).myRooms[0].name)
              : 'Chưa nhận phòng'} 
            variant="emerald"
            trend={{ value: "Active", label: "Trạng thái", positive: true }}
          />
          <StatCard 
            icon={<XCircle size={22} />} 
            label="Hóa đơn chờ" 
            value={(stats as any).unpaidInvoices} 
            trend={{ value: (stats as any).pendingAmount.toLocaleString() + 'đ', label: "Tổng tiền chờ", positive: false }}
            variant="amber"
          />
          <StatCard 
            icon={<CheckCircle2 size={22} />} 
            label="Tổng đã đóng" 
            value={(stats as any).totalPaid.toLocaleString() + 'đ'} 
            variant="green"
            trend={{ value: "Thanh toán tốt", label: "Lịch sử", positive: true }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-zinc-100 shadow-xl shadow-zinc-200/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-zinc-900 tracking-tight">Thông tin phòng</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Chi tiết nơi ở</p>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
            </div>
            {(stats as any).myRooms.length > 0 ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  {(stats as any).myRooms.map((room: any) => (
                    <div key={room.id} className="p-4 bg-green-50/30 rounded-2xl border border-green-100/50 space-y-3 hover:border-green-300 hover:bg-green-50/50 transition-all duration-300 group">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-black text-zinc-900 tracking-tight group-hover:text-green-700 transition-colors">{room.name}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[9px] font-black uppercase tracking-widest shadow-sm shadow-green-200">Active</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Giá thuê</span>
                          <span className="text-sm font-black text-zinc-900">{room.price.toLocaleString()}đ</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Diện tích</span>
                          <span className="text-sm font-black text-zinc-900">{room.area} m²</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {(stats as any).myContract ? (
                  <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-[2rem] space-y-6 shadow-2xl shadow-zinc-900/30 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                      <FileText size={120} />
                    </div>
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Hợp đồng hiện tại</p>
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                          <FileText size={16} className="text-green-400" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Bắt đầu</p>
                          <p className="text-sm font-black tracking-tight">{formatDate((stats as any).myContract.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Kết thúc</p>
                          <p className="text-sm font-black tracking-tight">{formatDate((stats as any).myContract.endDate)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={onViewContract}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:from-green-600 hover:to-emerald-700 active:scale-[0.98] transition-all duration-300 shadow-xl shadow-green-500/20"
                      >
                        Chi tiết hợp đồng
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-zinc-50 border border-dashed border-zinc-200 rounded-[2rem] text-center">
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Không có hợp đồng hoạt động</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-zinc-200 rounded-[2rem] bg-zinc-50/50">
                <p className="text-xs text-zinc-400 font-black uppercase tracking-widest">Chưa có thông tin phòng</p>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2 border-zinc-100 shadow-xl shadow-zinc-200/50 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-zinc-900 tracking-tight">Lịch sử tài chính</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Thanh toán theo tháng</p>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-200" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Đã đóng</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chờ đóng</span>
                </div>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc', radius: 8 }}
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: 'none', 
                      borderRadius: '16px',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    formatter={(value: number) => [value.toLocaleString() + 'đ', '']}
                  />
                  <Bar dataKey="Đã thu" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={32} stackId="a" animationDuration={1500} />
                  <Bar dataKey="Chờ thu" fill="#dcfce7" radius={[6, 6, 0, 0]} barSize={32} stackId="a" animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-3 border-zinc-100 shadow-xl shadow-zinc-200/50">
            <div className="mb-8">
              <h3 className="text-lg font-black text-zinc-900 tracking-tight">Hóa đơn chưa thanh toán</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Cần xử lý ngay</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const myTenant = tenants.find(t => t.id === currentUser.tenantId);
                const pendingInvoices = invoices.filter(inv => (inv.tenantId === currentUser.tenantId || (myTenant?.roomId === inv.roomId)) && (inv.status === 'UNPAID' || inv.status === 'OVERDUE'));
                
                if (pendingInvoices.length > 0) {
                  return pendingInvoices
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .slice(0, 3)
                    .map(inv => (
                      <div key={inv.id} className="p-6 bg-white border border-zinc-100 rounded-[2rem] hover:border-green-500 hover:shadow-2xl hover:shadow-green-500/10 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-8">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-500 group-hover:scale-110",
                            inv.status === 'OVERDUE' ? "bg-rose-50 text-rose-600 shadow-rose-100" : "bg-amber-50 text-amber-600 shadow-amber-100"
                          )}>
                            <DollarSign size={24} />
                          </div>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm",
                            inv.status === 'OVERDUE' ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                          )}>
                            {inv.status === 'OVERDUE' ? 'Quá hạn' : 'Chưa đóng'}
                          </span>
                        </div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tháng {inv.month}</p>
                        <p className="text-3xl font-black text-zinc-900 mt-1 tracking-tighter">{inv.total.toLocaleString()}đ</p>
                        <div className="mt-6 pt-6 border-t border-zinc-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-zinc-400" />
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Hạn: {formatDate(inv.dueDate)}</span>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <CheckCircle2 size={14} />
                          </div>
                        </div>
                      </div>
                    ));
                }
                return (
                  <div className="col-span-3 text-center py-16 border border-dashed border-zinc-200 rounded-[2rem] bg-zinc-50/50">
                    <p className="text-xs text-zinc-400 font-black uppercase tracking-widest">Không có hóa đơn tồn đọng</p>
                  </div>
                );
              })()}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-extrabold text-zinc-900 tracking-tight">Hệ thống quản trị</h2>
          <p className="text-zinc-500 mt-1.5 text-sm font-medium">Chào mừng trở lại! Đây là tóm tắt hoạt động của bạn hôm nay.</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-green-600 bg-white px-6 py-3.5 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          {formatDate(new Date().toISOString())}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Home size={22} />} 
          label="Tổng số phòng" 
          value={(stats as any).totalRooms} 
          trend={{ value: "100%", label: "Công suất", positive: true }}
          variant="green"
        />
        <StatCard 
          icon={<CheckCircle2 size={22} />} 
          label="Đã thuê" 
          value={(stats as any).occupiedRooms} 
          trend={{ value: `${Math.round(((stats as any).occupiedRooms / ((stats as any).totalRooms || 1)) * 100)}%`, label: "Tỷ lệ lấp đầy", positive: true }}
          variant="emerald"
        />
        <StatCard 
          icon={<XCircle size={22} />} 
          label="Còn trống" 
          value={(stats as any).availableRooms} 
          trend={{ value: (stats as any).availableRooms.toString(), label: "Phòng sẵn sàng", positive: (stats as any).availableRooms > 0 }}
          variant="amber"
        />
        <StatCard 
          icon={<DollarSign size={22} />} 
          label="Doanh thu" 
          value={(stats as any).totalRevenue.toLocaleString() + 'đ'} 
          trend={{ value: "+12.5%", label: "So với tháng trước", positive: true }}
          variant="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-zinc-100 shadow-xl shadow-zinc-200/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-zinc-900 tracking-tight">Trạng thái lấp đầy</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Phân bổ hiện tại</p>
            </div>
          </div>
          <div className="h-64 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={75}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                    animationDuration={1500}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f4f4f5" />
                  </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none', 
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-zinc-900 tracking-tighter">{(stats as any).totalRooms}</span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tổng phòng</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {chartData.map((item, idx) => (
              <div key={item.name} className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:bg-white transition-all duration-300 group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: idx === 0 ? '#10b981' : '#d4d4d8' }} />
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.name}</span>
                </div>
                <p className="text-2xl font-black text-zinc-900 tracking-tight">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 border-zinc-100 shadow-xl shadow-zinc-200/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-zinc-900 tracking-tight">Dòng tiền hệ thống</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Xu hướng tài chính (VNĐ)</p>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-200" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Đã thu</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chờ thu</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none', 
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                  formatter={(value: number) => [value.toLocaleString() + 'đ', '']}
                />
                <Bar dataKey="Đã thu" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={32} animationDuration={1500} />
                <Bar dataKey="Chờ thu" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={32} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, variant = 'emerald', className }: { icon: React.ReactNode, label: string, value: string | number, trend?: { value: string, label: string, positive?: boolean }, variant?: 'green' | 'emerald' | 'amber' | 'rose', className?: string }) {
  const variants = {
    green: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 text-green-600',
    emerald: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 text-emerald-600',
    amber: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 text-amber-600',
    rose: 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100 text-rose-600'
  };

  const iconVariants = {
    green: 'bg-white text-green-600 shadow-green-100',
    emerald: 'bg-white text-emerald-600 shadow-emerald-100',
    amber: 'bg-white text-amber-600 shadow-amber-100',
    rose: 'bg-white text-rose-600 shadow-rose-100'
  };

  return (
    <div className={cn(
      "p-6 rounded-[2rem] border shadow-sm hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-500 group",
      variants[variant],
      className
    )}>
      <div className="flex items-center justify-between mb-6">
        <div className={cn(
          "p-3.5 rounded-2xl shadow-sm transition-all duration-500 group-hover:rotate-6 group-hover:scale-110",
          iconVariants[variant]
        )}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            "text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm",
            trend.positive === true ? "bg-green-500 text-white" : 
            trend.positive === false ? "bg-rose-500 text-white" : "bg-white text-zinc-600 border border-zinc-100"
          )}>
            {trend.value}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1.5">{label}</p>
        <p className="text-3xl font-black text-zinc-900 tracking-tighter">{value}</p>
        {trend && (
          <p className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">{trend.label}</p>
        )}
      </div>
    </div>
  );
}
