import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Search, Sparkles, Loader2, Trash2 } from 'lucide-react';
import type { ViewKey } from '../AstraeaLayout';
import { chatWithAi, type ChatMessage } from '../../api/ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GlobalAiChatbotProps {
  onViewChange: (view: ViewKey) => void;
}

export default function GlobalAiChatbot({ onViewChange }: GlobalAiChatbotProps) {
  const FAB_SIZE = 56;
  const PANEL_WIDTH = 380;
  const PANEL_HEIGHT = 600;
  const EDGE_GAP = 0;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const INITIAL_MESSAGE: ChatMessage = { role: 'assistant', content: '您好！我是 Astraea 助理，随时准备协助您的项目管理。试试下方的快捷指令或直接问我吧！' };
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fabPosition, setFabPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 24, y: 24 };
    return {
      x: window.innerWidth - FAB_SIZE - 24,
      y: window.innerHeight - FAB_SIZE - 24
    };
  });
  const [panelPosition, setPanelPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 24, y: 24 };
    return {
      x: window.innerWidth - PANEL_WIDTH - 24,
      y: window.innerHeight - PANEL_HEIGHT - 24
    };
  });
  const dragRef = useRef<{
    type: 'fab' | 'panel';
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [draggingType, setDraggingType] = useState<'fab' | 'panel' | null>(null);
  const [panelMovedSinceOpen, setPanelMovedSinceOpen] = useState(false);

  const getViewportSize = () => {
    const vv = window.visualViewport;
    if (vv) {
      return { width: vv.width, height: vv.height };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  };

  const clampPosition = (x: number, y: number, type: 'fab' | 'panel') => {
    const width = type === 'panel' ? PANEL_WIDTH : FAB_SIZE;
    const height = type === 'panel' ? PANEL_HEIGHT : FAB_SIZE;
    const viewport = getViewportSize();
    const maxX = Math.max(EDGE_GAP, viewport.width - width - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, viewport.height - height - EDGE_GAP);
    return {
      x: Math.min(Math.max(EDGE_GAP, x), maxX),
      y: Math.min(Math.max(EDGE_GAP, y), maxY)
    };
  };

  const stickToNearestEdge = (x: number, y: number, type: 'fab' | 'panel') => {
    const clamped = clampPosition(x, y, type);
    const width = type === 'panel' ? PANEL_WIDTH : FAB_SIZE;
    const height = type === 'panel' ? PANEL_HEIGHT : FAB_SIZE;
    const viewport = getViewportSize();
    const maxX = Math.max(EDGE_GAP, viewport.width - width - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, viewport.height - height - EDGE_GAP);

    const distances = [
      { edge: 'left', value: Math.abs(clamped.x - EDGE_GAP) },
      { edge: 'right', value: Math.abs(maxX - clamped.x) },
      { edge: 'top', value: Math.abs(clamped.y - EDGE_GAP) },
      { edge: 'bottom', value: Math.abs(maxY - clamped.y) }
    ] as const;
    const nearest = distances.reduce((best, item) => (item.value < best.value ? item : best), distances[0]);

    if (nearest.edge === 'left') return { x: EDGE_GAP, y: clamped.y };
    if (nearest.edge === 'right') return { x: maxX, y: clamped.y };
    if (nearest.edge === 'top') return { x: clamped.x, y: EDGE_GAP };
    return { x: clamped.x, y: maxY };
  };

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

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { type, startX, startY, originX, originY } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
      }
      const next = stickToNearestEdge(originX + dx, originY + dy, type);
      if (type === 'panel') {
        setPanelPosition(next);
      } else {
        setFabPosition(next);
      }
    };

    const handlePointerUp = () => {
      if (!dragRef.current) return;
      const ended = dragRef.current;
      dragRef.current = null;
      setDraggingType(null);
      if (ended.type === 'fab' && !ended.moved) {
        setIsOpen(true);
      }
      if (ended.type === 'panel' && ended.moved) {
        setPanelMovedSinceOpen(true);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPanelPosition((prev) => {
        const hasPrev = prev.x !== 24 || prev.y !== 24;
        return hasPrev ? stickToNearestEdge(prev.x, prev.y, 'panel') : stickToNearestEdge(fabPosition.x, fabPosition.y, 'panel');
      });
      setPanelMovedSinceOpen(false);
      return;
    }
    if (panelMovedSinceOpen) {
      setFabPosition(stickToNearestEdge(panelPosition.x, panelPosition.y, 'fab'));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setFabPosition((prev) => stickToNearestEdge(prev.x, prev.y, 'fab'));
      setPanelPosition((prev) => stickToNearestEdge(prev.x, prev.y, 'panel'));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrag = (type: 'fab' | 'panel', clientX: number, clientY: number) => {
    const origin = type === 'panel' ? panelPosition : fabPosition;
    dragRef.current = {
      type,
      startX: clientX,
      startY: clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false
    };
    setDraggingType(type);
  };

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
            style={{ left: `${fabPosition.x}px`, top: `${fabPosition.y}px` }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              startDrag('fab', e.clientX, e.clientY);
            }}
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
            style={{ left: `${panelPosition.x}px`, top: `${panelPosition.y}px` }}
          >
            {/* Header */}
            <div
              className="chatbot-header"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                e.preventDefault();
                startDrag('panel', e.clientX, e.clientY);
              }}
            >
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
              <button onClick={() => executeAction('global', '带我去全局检索')}>
                <Search size={12} /> 全局搜索
              </button>
            </div>

            {/* Messages */}
            <div className="chatbot-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role === 'assistant' ? 'chat-ai' : 'chat-user'}`}>
                  {m.role === 'assistant' ? (
                    <div className="chat-markdown markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content || '-'}
                      </ReactMarkdown>
                    </div>
                  ) : m.content}
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
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background:
            linear-gradient(160deg, color-mix(in srgb, var(--glass-specular) 52%, transparent 48%), transparent 46%),
            linear-gradient(135deg, var(--glow-blue), var(--glow-purple));
          box-shadow: 0 10px 24px color-mix(in srgb, var(--glow-blue) 34%, transparent 66%);
          border: 1px solid color-mix(in srgb, var(--glass-border) 45%, #ffffff 55%);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9999;
          transition: transform 0.2s;
          touch-action: none;
        }
        .chatbot-fab:hover {
          transform: scale(1.05);
        }
        .chatbot-fab:active {
          cursor: ${draggingType === 'fab' ? 'grabbing' : 'grab'};
        }

        .chatbot-panel {
          position: fixed;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 48px);
          background:
            linear-gradient(170deg, color-mix(in srgb, var(--glass-specular) 24%, transparent 76%), transparent 42%),
            color-mix(in srgb, var(--glass-bg) 88%, var(--color-bg-surface) 12%);
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          box-shadow: var(--glass-shadow);
          backdrop-filter: saturate(132%) blur(var(--glass-blur));
          -webkit-backdrop-filter: saturate(132%) blur(var(--glass-blur));
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Rajdhani', sans-serif;
          touch-action: none;
        }

        .chatbot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--glass-border);
          background: color-mix(in srgb, var(--glass-bg) 72%, transparent 28%);
          cursor: ${draggingType === 'panel' ? 'grabbing' : 'grab'};
          user-select: none;
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
          background: color-mix(in srgb, var(--glass-bg-hover) 72%, transparent 28%);
        }

        .chatbot-chips {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          overflow-x: auto;
          border-bottom: 1px solid var(--glass-border);
          background: color-mix(in srgb, var(--glass-bg) 64%, transparent 36%);
        }
        .chatbot-chips::-webkit-scrollbar {
          display: none;
        }

        .chatbot-chips button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          background: color-mix(in srgb, var(--glass-tint-primary) 64%, var(--glass-bg) 36%);
          border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--glass-border) 65%);
          color: var(--color-primary);
          padding: 6px 12px;
          border-radius: 100px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chatbot-chips button:hover {
          background: color-mix(in srgb, var(--glass-tint-primary) 78%, var(--glass-bg) 22%);
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

        .chat-markdown {
          font-size: 14px;
          line-height: 1.5;
        }
        .chat-markdown :first-child {
          margin-top: 0;
        }
        .chat-markdown :last-child {
          margin-bottom: 0;
        }
        .chat-markdown p {
          margin: 0 0 8px;
        }
        .chat-markdown ul,
        .chat-markdown ol {
          margin: 0 0 8px;
          padding-left: 18px;
        }
        .chat-markdown li + li {
          margin-top: 4px;
        }
        .chat-markdown h1,
        .chat-markdown h2,
        .chat-markdown h3,
        .chat-markdown h4 {
          margin: 8px 0 6px;
          font-size: 14px;
          line-height: 1.4;
        }
        .chat-markdown code {
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 1px 5px;
          font-size: 12px;
        }
        .chat-markdown pre {
          margin: 8px 0;
          padding: 10px;
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow-x: auto;
        }
        .chat-markdown pre code {
          border: none;
          background: transparent;
          padding: 0;
        }
        .chat-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        .chat-markdown th,
        .chat-markdown td {
          border: 1px solid var(--color-border);
          padding: 6px;
          text-align: left;
          font-size: 12px;
        }

        .chat-ai {
          align-self: flex-start;
          background: color-mix(in srgb, var(--glass-bg) 72%, var(--color-bg-muted) 28%);
          color: var(--color-text-primary);
          border-bottom-left-radius: 2px;
          border: 1px solid var(--glass-border);
        }

        .chat-user {
          align-self: flex-end;
          background:
            linear-gradient(155deg, color-mix(in srgb, #ffffff 36%, transparent 64%), transparent 42%),
            linear-gradient(135deg, var(--glow-blue), color-mix(in srgb, var(--glow-blue) 72%, #8dbdff 28%));
          color: #fff;
          border-bottom-right-radius: 2px;
          box-shadow: 0 8px 18px color-mix(in srgb, var(--glow-blue) 28%, transparent 72%);
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
          background: color-mix(in srgb, var(--glass-bg) 68%, transparent 32%);
          border-top: 1px solid var(--glass-border);
          display: flex;
          gap: 12px;
        }

        .chatbot-input-area input {
          flex: 1;
          background: color-mix(in srgb, var(--glass-bg) 80%, var(--color-bg-surface) 20%);
          border: 1px solid var(--glass-border);
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
          background:
            linear-gradient(155deg, color-mix(in srgb, #ffffff 40%, transparent 60%), transparent 44%),
            linear-gradient(135deg, var(--glow-blue), color-mix(in srgb, var(--glow-blue) 70%, #8dbdff 30%));
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
