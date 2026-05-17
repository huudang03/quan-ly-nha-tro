import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { getAIResponse, AIChatMessage } from '../services/geminiService';
import { Room, Tenant, Invoice, UtilityReading, User } from '../types';
import { Card, Button, ConfirmModal } from './UI';

interface AIAssistantProps {
  rooms: Room[];
  tenants: Tenant[];
  invoices: Invoice[];
  readings: UtilityReading[];
  currentUser: User;
}

export function AIAssistant({ rooms, tenants, invoices, readings, currentUser }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    { role: 'model', text: 'Chào bạn! Tôi là Trợ lý AI Quản lý Nhà trọ. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi tôi về doanh thu, công nợ, hoặc nhờ tôi phân tích dữ liệu tháng này.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await getAIResponse(userMessage, messages, {
        rooms,
        tenants,
        invoices,
        readings,
        currentUser
      });
      
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error("AI Assistant Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([
      { role: 'model', text: 'Chào bạn! Tôi là Trợ lý AI Quản lý Nhà trọ. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi tôi về doanh thu, công nợ, hoặc nhờ tôi phân tích dữ liệu tháng này.' }
    ]);
    setIsClearConfirmOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-4 w-[350px] sm:w-[400px] h-[500px] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-zinc-200 bg-white"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 p-5 flex items-center justify-between text-white flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">AI Admin Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Trực tuyến</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all duration-200"
                  title="Xóa lịch sử"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all duration-200"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-tr-none shadow-lg shadow-green-200/50' 
                      : 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-none shadow-xl shadow-zinc-200/50'
                  }`}>
                    <div className="markdown-body prose prose-sm max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-zinc-100 p-4 rounded-2xl rounded-tl-none shadow-xl shadow-zinc-200/50 flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-green-500" />
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">AI đang suy nghĩ...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-5 bg-white border-t border-zinc-100">
              <div className="flex items-center gap-3">
                <input 
                  type="text"
                  placeholder="Hỏi AI về nhà trọ của bạn..."
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all duration-200"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <Button 
                  size="icon" 
                  className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-200/50"
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                >
                  <Send size={20} />
                </Button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-3 text-center flex items-center justify-center gap-1.5 font-medium">
                <Sparkles size={12} className="text-green-500" />
                Sử dụng Gemini AI để phân tích dữ liệu
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={clearHistory}
        title="Xác nhận xóa lịch sử"
        message="Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện với AI không?"
      />

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-[2rem] shadow-2xl flex items-center justify-center transition-all duration-500 relative group ${
          isOpen ? 'bg-zinc-900 text-white rotate-90' : 'bg-gradient-to-br from-green-600 to-emerald-600 text-white hover:scale-110 hover:-rotate-6 shadow-green-200/50'
        }`}
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && (
          <>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-4 border-white animate-bounce" />
            <span className="absolute inset-0 rounded-[2rem] bg-green-500 animate-ping opacity-20 group-hover:hidden" />
          </>
        )}
      </button>
    </div>
  );
}
