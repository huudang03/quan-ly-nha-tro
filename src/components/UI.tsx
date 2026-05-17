import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, CheckCircle2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import { parseISO, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'warning',
  size?: 'sm' | 'md' | 'lg' | 'icon'
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-200/50 active:scale-95 transition-all duration-300',
    secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 active:scale-95 transition-all duration-300',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-100 active:scale-95 transition-all duration-300',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-100 active:scale-95 transition-all duration-300',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-100 active:scale-95 transition-all duration-300',
    ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100 active:scale-95 transition-all duration-300',
    outline: 'bg-transparent text-zinc-900 border border-zinc-200 hover:bg-zinc-50 active:scale-95 transition-all duration-300'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2.5'
  };

  return (
    <button 
      className={cn(
        'rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ 
  label, 
  icon, 
  rightIcon, 
  className, 
  numeric,
  onChange,
  ...props 
}: React.InputHTMLAttributes<HTMLInputElement> & { 
  label?: string, 
  icon?: React.ReactNode, 
  rightIcon?: React.ReactNode,
  numeric?: boolean
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (numeric) {
      e.target.value = e.target.value.replace(/\D/g, "");
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold text-zinc-700 ml-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors z-10">
            {icon}
          </div>
        )}
        <input 
          className={cn(
            "w-full px-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder:text-zinc-400 text-sm",
            className,
            icon && "pl-11",
            rightIcon && "pr-11"
          )}
          inputMode={numeric ? "numeric" : props.inputMode}
          pattern={numeric ? "[0-9]*" : props.pattern}
          onChange={handleChange}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors z-10">
            {rightIcon}
          </div>
        )}
      </div>
    </div>
  );
};

export const DateInput = ({ label, icon, value, onChange, className, min, disabled, ...props }: any) => {
  // value is yyyy-MM-dd string
  const selectedDate = value ? parseISO(value) : null;
  const minDate = min ? parseISO(min) : undefined;

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold text-zinc-700 ml-1">{label}</label>}
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors z-10 pointer-events-none">
          {icon || <Calendar size={18} />}
        </div>
        <DatePicker
          selected={selectedDate}
          onChange={(date: Date | null) => {
            if (date) {
              // Format to yyyy-MM-dd for backend consistency
              onChange(format(date, 'yyyy-MM-dd'));
            } else {
              onChange('');
            }
          }}
          dateFormat="dd/MM/yyyy"
          placeholderText="dd/MM/yyyy"
          minDate={minDate}
          disabled={disabled}
          autoComplete="off"
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          className={cn(
            "w-full pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white transition-all duration-200 placeholder:text-zinc-400 text-sm",
            className,
            "pl-11"
          )}
          {...props}
        />
      </div>
    </div>
  );
};

export const Select = ({ label, icon, options, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, icon?: React.ReactNode, options: { value: string, label: string }[] }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-semibold text-zinc-700 ml-1">{label}</label>}
    <div className="relative group">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors z-10">
          {icon}
        </div>
      )}
      <select 
        className={cn(
          "w-full px-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white transition-all duration-200 text-sm appearance-none cursor-pointer",
          className,
          icon && "pl-11"
        )}
        {...props}
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  </div>
);

export const Card = ({ 
  children, 
  className, 
  title,
  subtitle,
  variant = 'default',
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { title?: string, subtitle?: string, variant?: 'default' | 'green' | 'emerald' | 'amber' | 'rose' }) => {
  const variants = {
    default: 'bg-white border-zinc-200',
    green: 'bg-green-50/50 border-green-100',
    emerald: 'bg-emerald-50/50 border-emerald-100',
    amber: 'bg-amber-50/50 border-amber-100',
    rose: 'bg-rose-50/50 border-rose-100'
  };

  return (
    <div 
      className={cn(
        "border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300", 
        variants[variant],
        className
      )}
      {...props}
    >
      {title && (
        <div className={cn(
          "px-6 py-5 border-b bg-white/50",
          variant === 'default' ? 'border-zinc-100' : 
          variant === 'green' ? 'border-green-100' :
          variant === 'emerald' ? 'border-emerald-100' :
          variant === 'amber' ? 'border-amber-100' : 'border-rose-100'
        )}>
          <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export const Table = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm", className)}>
    <table className="w-full text-left border-collapse">
      {children}
    </table>
  </div>
);

export const THead = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-zinc-50 border-b border-zinc-200">
    {children}
  </thead>
);

export const TBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="divide-y divide-zinc-100">
    {children}
  </tbody>
);

export const TH = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <th className={cn("px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider", className)}>
    {children}
  </th>
);

export const TR = ({ children, className, hover = true, zebra = false }: { children: React.ReactNode, className?: string, hover?: boolean, zebra?: boolean }) => (
  <tr className={cn(
    "transition-colors",
    hover && "hover:bg-gray-50",
    zebra && "odd:bg-white even:bg-zinc-50/30",
    className
  )}>
    {children}
  </tr>
);

export const TD = ({ children, className, colSpan }: { children: React.ReactNode, className?: string, colSpan?: number }) => (
  <td className={cn("px-6 py-4 text-sm text-zinc-600", className)} colSpan={colSpan}>
    {children}
  </td>
);

export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 40 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-100"
        >
          <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2.5 hover:bg-zinc-200 rounded-full transition-colors text-zinc-500">
              <X size={20} />
            </button>
          </div>
          <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Xác nhận", 
  cancelText = "Hủy",
  variant = "danger"
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string,
  confirmText?: string,
  cancelText?: string,
  variant?: 'primary' | 'danger'
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title}>
    <div className="space-y-6">
      <p className="text-zinc-600 leading-relaxed">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>{cancelText}</Button>
        <Button variant={variant} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
      </div>
    </div>
  </Modal>
);

export const Toast = ({ message, type = 'success', isVisible, onClose }: { message: string, type?: 'success' | 'error' | 'info', isVisible: boolean, onClose: () => void }) => {
  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  const typeStyles = {
    success: "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-xl shadow-emerald-200",
    error: "bg-rose-600 text-white shadow-xl shadow-rose-200",
    info: "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl shadow-green-200"
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={cn(
            "fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-2xl z-[100] flex items-center gap-3 font-medium",
            typeStyles[type]
          )}
        >
          {type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
