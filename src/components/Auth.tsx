import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, User as UserIcon, Lock, Mail, Phone, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Select } from './UI';
import { Role, User } from '../types';
import { apiFetch } from '../lib/api';

interface AuthProps {
  users: User[];
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onUpdateUser: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export function Auth({ users, onLogin, onRegister, onUpdateUser }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('TENANT');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [debugLink, setDebugLink] = useState('');

  // Load remembered credentials on mount
  useEffect(() => {
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    if (savedRememberMe) {
      setRememberMe(true);
      const savedUsername = localStorage.getItem('username');
      const savedPassword = localStorage.getItem('password');
      if (savedUsername) setUsername(savedUsername);
      if (savedPassword) setPassword(savedPassword);
    }
  }, []);

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('RESET_PASSWORD');
      // Clean up URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Clear messages when mode changes
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [mode]);

  const handleBack = () => {
    setMode('LOGIN');
  };

  const handleSubmit = () => {
    setError('');
    setSuccess('');

    if (mode === 'LOGIN') {
      setIsLoading(true);
      console.log(`[Auth] Attempting login for username: ${username}`);
      
      const performLogin = async () => {
        try {
          const user = await apiFetch<User>('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username: username.trim(), password })
          });

          if (user.status === 'LOCKED') {
            throw new Error('Tài khoản của bạn đã bị khóa!');
          }
          
          // Handle Remember Me
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('username', username);
            localStorage.setItem('password', password);
          } else {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('username');
            localStorage.removeItem('password');
          }

          onLogin(user);
        } catch (err: any) {
          console.error('[Auth] Login error:', err);
          setError(err.message || 'Lỗi đăng nhập!');
        } finally {
          setIsLoading(false);
        }
      };
      
      performLogin();
    } else if (mode === 'REGISTER') {
      if (!username || !password || !name || !phone || !email) {
        setError('Vui lòng điền đầy đủ thông tin bao gồm cả email!');
        return;
      }

      if (password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự!');
        return;
      }

      if (phone.replace(/\D/g, '').length < 10) {
        setError('Số điện thoại phải có ít nhất 10 chữ số!');
        return;
      }

      setIsLoading(true);
      const performRegister = async () => {
        try {
          const newUser = await apiFetch<User>('/api/users', {
            method: 'POST',
            body: JSON.stringify({
              username,
              password,
              role: users.length === 0 ? 'ADMIN' : role,
              name,
              email,
              phone,
              address: '',
              status: 'ACTIVE',
            })
          });
          
          onRegister(newUser);
          setMode('LOGIN');
          setSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
        } catch (err: any) {
          setError(err.message || 'Lỗi đăng ký!');
        } finally {
          setIsLoading(false);
        }
      };
      performRegister();
    } else if (mode === 'FORGOT_PASSWORD') {
      if (!email) {
        setError('Vui lòng nhập email!');
        return;
      }
      setIsLoading(true);
      setDebugLink('');
      
      const performForgot = async () => {
        try {
          const result = await apiFetch<{ message: string, token?: string }>('/api/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
          });
          
          setSuccess(result.message || 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.');
          
          if (result.token) {
            const link = `${window.location.origin}/reset-password?token=${result.token}`;
            setDebugLink(link);
            console.log('Debug Link:', link);
          }
        } catch (err: any) {
          setError(err.message || 'Lỗi khi gửi yêu cầu.');
        } finally {
          setIsLoading(false);
        }
      };
      
      performForgot();
    } else if (mode === 'RESET_PASSWORD') {
      if (!newPassword || !confirmPassword) {
        setError('Vui lòng nhập đầy đủ thông tin!');
        return;
      }
      if (newPassword.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự!');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp!');
        return;
      }
      setIsLoading(true);
      
      const performReset = async () => {
        try {
          await apiFetch('/api/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token: resetToken, newPassword })
          });
          setSuccess('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
          setTimeout(() => setMode('LOGIN'), 3000);
        } catch (err: any) {
          setError(err.message || 'Link đã hết hạn hoặc không hợp lệ');
        } finally {
          setIsLoading(false);
        }
      };
      
      performReset();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-green-100/40 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-green-900/5 border border-zinc-100 overflow-hidden relative">
          {mode !== 'LOGIN' && (
            <button 
              onClick={handleBack}
              className="absolute top-8 left-8 p-2.5 text-zinc-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all duration-300 z-10"
              title="Quay lại"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          
          <div className="p-8 sm:p-12">
            <div className="mb-10 text-center">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-green-200/50"
              >
                <Home size={36} />
              </motion.div>
              <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Quản lý nhà trọ</h1>
              <p className="text-zinc-500 mt-2 font-medium">
                {mode === 'LOGIN' ? 'Chào mừng bạn quay trở lại!' : 
                 mode === 'REGISTER' ? 'Bắt đầu quản lý ngay hôm nay' : 
                 mode === 'FORGOT_PASSWORD' ? 'Khôi phục quyền truy cập' : 'Thiết lập mật khẩu mới'}
              </p>
            </div>

            <form 
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-semibold text-center flex items-center justify-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-sm font-semibold text-center flex flex-col items-center justify-center gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                    {success}
                  </div>
                  {debugLink && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-green-200 w-full">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Link khôi phục (Dành cho thử nghiệm):</p>
                      <a 
                        href={debugLink} 
                        className="text-xs font-mono text-green-600 break-all hover:underline"
                      >
                        {debugLink}
                      </a>
                    </div>
                  )}
                </motion.div>
              )}

              {mode === 'REGISTER' && (
                <>
                  <Input label="Họ và tên" icon={<UserIcon size={18} />} value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Nguyễn Văn A" />
                  <Input label="Email" type="email" icon={<Mail size={18} />} value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="name@example.com" />
                  <Input label="Số điện thoại" numeric icon={<Phone size={18} />} value={phone} onChange={e => { setPhone(e.target.value); setError(''); }} placeholder="0987654321" />
                </>
              )}

              {mode === 'FORGOT_PASSWORD' && (
                <Input 
                  label="Email đăng ký" 
                  type="email"
                  icon={<Mail size={18} />}
                  value={email} 
                  onChange={e => { setEmail(e.target.value); setError(''); }} 
                  placeholder="name@example.com"
                />
              )}

              {mode === 'RESET_PASSWORD' && (
                <>
                  <Input 
                    label="Mật khẩu mới" 
                    type={showPassword ? "text" : "password"}
                    icon={<Lock size={18} />}
                    rightIcon={
                      <button type="button" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    value={newPassword} 
                    onChange={e => { setNewPassword(e.target.value); setError(''); }} 
                  />
                  <Input 
                    label="Xác nhận mật khẩu mới" 
                    type={showPassword ? "text" : "password"}
                    icon={<Lock size={18} />}
                    rightIcon={
                      <button type="button" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    value={confirmPassword} 
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }} 
                  />
                </>
              )}

              {(mode === 'LOGIN' || mode === 'REGISTER') && (
                <>
                  {users.length === 0 && mode === 'LOGIN' && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs font-bold text-center space-y-2">
                      <p className="uppercase tracking-wider">Hệ thống mới khởi tạo</p>
                      <p className="font-medium normal-case opacity-80">Vui lòng "Đăng ký ngay" để tạo tài khoản Quản trị viên đầu tiên.</p>
                    </div>
                  )}
                  <Input 
                    label="Tên đăng nhập" 
                    icon={<UserIcon size={18} />}
                    value={username || ''} 
                    onChange={e => { setUsername(e.target.value); setError(''); }} 
                    placeholder="admin_boarding"
                  />
                  <Input 
                    label="Mật khẩu" 
                    type={showPassword ? "text" : "password"} 
                    icon={<Lock size={18} />}
                    rightIcon={
                      <button type="button" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    value={password || ''} 
                    onChange={e => { setPassword(e.target.value); setError(''); }} 
                    placeholder="••••••••"
                  />
                </>
              )}
              
              {mode === 'LOGIN' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                      />
                      <div className="w-5 h-5 border-2 border-zinc-200 rounded-lg bg-white peer-checked:bg-green-600 peer-checked:border-green-600 transition-all duration-200" />
                      <div className="absolute opacity-0 peer-checked:opacity-100 transition-opacity duration-200">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-700 transition-colors uppercase tracking-wider">Ghi nhớ đăng nhập</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setMode('FORGOT_PASSWORD')}
                    className="text-xs font-bold text-zinc-400 hover:text-green-600 transition-colors uppercase tracking-wider"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-green-200/50 mt-2" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {mode === 'LOGIN' ? <LogIn size={20} /> : <UserPlus size={20} />}
                    <span>
                      {mode === 'LOGIN' ? 'Đăng nhập' : 
                       mode === 'REGISTER' ? 'Đăng ký tài khoản' : 
                       mode === 'FORGOT_PASSWORD' ? 'Gửi mã xác nhận' : 'Cập nhật mật khẩu'}
                    </span>
                  </div>
                )}
              </Button>

              {mode !== 'FORGOT_PASSWORD' && mode !== 'RESET_PASSWORD' && (
                <div className="text-center mt-6">
                  <button 
                    type="button"
                    onClick={() => setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
                    className="text-sm font-semibold text-zinc-500 hover:text-green-600 transition-colors"
                  >
                    {mode === 'LOGIN' ? (
                      <>Chưa có tài khoản? <span className="text-green-600 font-bold hover:text-green-700 transition-colors">Đăng ký ngay</span></>
                    ) : (
                      <>Đã có tài khoản? <span className="text-green-600 font-bold hover:text-green-700 transition-colors">Đăng nhập</span></>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
          
          <div className="bg-zinc-50/50 p-6 border-t border-zinc-100 text-center">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">
              &copy; 2026 Hệ thống Quản lý nhà trọ
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
