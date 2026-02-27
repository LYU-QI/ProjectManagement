import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, LayoutDashboard, Search, Sparkles, Loader2, Trash2 } from 'lucide-react';
import type { ViewKey } from '../AstraeaLayout';
import { chatWithAi, type ChatMessage } from '../../api/ai';

interface GlobalAiChatbotProps {
  onViewChange: (view: ViewKey) => void;
}

export default function GlobalAiChatbot({ onViewChange }: GlobalAiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const INITIAL_MESSAGE: ChatMessage = { role: 'assistant', content: '您好！我是 Astraea 助理，随时准备协助您的项目管理。试试下方的快捷指令或直接问我吧！' };
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleClearHistory = () => {
    if (confirm('确认清除所有对话记录吗？')) {
      setMessages([INITIAL_MESSAGE]);
    }
  };

  // 快捷键监听
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // 滚动到底部
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (overrideInput?: string) => {
    const text = (overrideInput || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // 只携带最近 10 条历史以保持上下文并节省 tokens
      const history = messages.slice(-10);
      const res = await chatWithAi(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.content }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `抱歉，我遇到了点问题：${err instanceof Error ? err.message : '未知错误'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = (view: ViewKey, replyMsg: string) => {
    onViewChange(view);
    setIsOpen(false);
    // 如果想在聊天历史里也记录一下，可以取消下面注释
    // handleSend(replyMsg);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="chatbot-fab"
            onClick={() => setIsOpen(true)}
          >
            <Bot size={24} color="#fff" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="chatbot-panel"
          >
            {/* Header */}
            <div className="chatbot-header">
              <div className="chatbot-title">
                <Sparkles size={16} className="glow-icon" />
                Astraea AI Assistant
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn" title="清除历史" onClick={handleClearHistory}>
                  <Trash2 size={18} />
                </button>
                <button className="icon-btn" onClick={() => setIsOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Chips */}
            <div className="chatbot-chips">
              <button onClick={() => executeAction('dashboard', '带我去总览大屏瞧瞧')}>
                <LayoutDashboard size={12} /> 指挥中心
              </button>
              <button onClick={() => executeAction('requirements', '我想写一个新需求')}>
                <Search size={12} /> 需求流
              </button>
              <button onClick={() => executeAction('ai', '帮我跑一份深度体检报告')}>
                <Bot size={12} /> 项目体检
              </button>
            </div>

            {/* Messages */}
            <div className="chatbot-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role === 'assistant' ? 'chat-ai' : 'chat-user'}`}>
                  {m.content}
                </div>
              ))}
              {isLoading && (
                <div className="chat-bubble chat-ai chat-loading">
                  <Loader2 className="animate-spin" size={14} />
                  <span>正在思考...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="chatbot-input-area">
              <input
                type="text"
                placeholder={isLoading ? "正在思考中..." : "在此输入您的疑问或意图..."}
                value={input}
                disabled={isLoading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button className="send-btn" onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .chatbot-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--glow-blue), var(--glow-purple));
          box-shadow: 0 8px 20px rgba(21, 94, 239, 0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9999;
          transition: transform 0.2s;
        }
        .chatbot-fab:hover {
          transform: scale(1.05);
        }

        .chatbot-panel {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 48px);
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          box-shadow: 0 16px 36px rgba(16, 24, 40, 0.16);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Rajdhani', sans-serif;
        }

        .chatbot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-muted);
        }

        .chatbot-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-primary);
          font-weight: 600;
          letter-spacing: 0;
        }

        .glow-icon {
          color: var(--color-primary);
        }

        .icon-btn {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .icon-btn:hover {
          color: var(--color-text-primary);
          background: var(--color-bg-surface);
        }

        .chatbot-chips {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          overflow-x: auto;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-muted);
        }
        .chatbot-chips::-webkit-scrollbar {
          display: none;
        }

        .chatbot-chips button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          background: var(--color-primary-soft);
          border: 1px solid #bfd1ff;
          color: var(--color-primary);
          padding: 6px 12px;
          border-radius: 100px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chatbot-chips button:hover {
          background: #dbe7ff;
        }

        .chatbot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-bubble {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
          word-break: break-word;
        }

        .chat-ai {
          align-self: flex-start;
          background: var(--color-bg-muted);
          color: var(--color-text-primary);
          border-bottom-left-radius: 2px;
          border: 1px solid var(--color-border);
        }

        .chat-user {
          align-self: flex-end;
          background: var(--glow-blue);
          color: #fff;
          border-bottom-right-radius: 2px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        .chat-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-style: italic;
          color: var(--text-muted);
          background: var(--color-bg-muted);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .chatbot-input-area {
          padding: 16px;
          background: var(--color-bg-muted);
          border-top: 1px solid var(--color-border);
          display: flex;
          gap: 12px;
        }

        .chatbot-input-area input {
          flex: 1;
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 10px 16px;
          color: var(--color-text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .chatbot-input-area input:focus {
          border-color: var(--color-primary);
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: var(--glow-blue);
          border: none;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .send-btn:disabled {
          background: var(--color-bg-muted);
          color: var(--color-text-muted);
          cursor: not-allowed;
        }
        .send-btn:not(:disabled):hover {
          filter: brightness(1.2);
        }
      `}</style>
    </>
  );
}
