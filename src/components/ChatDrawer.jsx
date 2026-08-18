import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Wifi, WifiOff, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function ChatDrawer({ ride, isOpen, onClose }) {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !ride) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/messages/${ride.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    setTimeout(() => inputRef.current?.focus(), 100);

    if (socket) {
      // Secure Join: Identity verified server-side via handshake JWT
      socket.emit('join_ride_room', { rideId: ride.id });

      const handleRoomJoined = (data) => {
        if (data.rideId === ride.id) {
          setConnected(true);
        }
      };

      const handleNewMessage = (newMsg) => {
        if (newMsg.ride_id === ride.id) {
          setMessages((prev) => [...prev, newMsg]);
        }
      };

      const handleChatError = (err) => {
        console.warn('Socket chat error:', err.message);
        setConnected(false);
      };

      socket.on('room_joined', handleRoomJoined);
      socket.on('new_message', handleNewMessage);
      socket.on('chat_error', handleChatError);

      return () => {
        socket.emit('leave_ride_room', { rideId: ride.id });
        socket.off('room_joined', handleRoomJoined);
        socket.off('new_message', handleNewMessage);
        socket.off('chat_error', handleChatError);
        setConnected(false);
      };
    }
  }, [isOpen, ride, socket, token, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    if (socket && connected) {
      // Server derives senderId, senderName, senderAvatar securely from verified JWT
      socket.emit('send_message', {
        rideId: ride.id,
        text
      });
    } else {
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ride_id: ride.id, text })
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, data.message]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatTime = (ts) => {
    if (!ts) return 'Now';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen || !ride) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] flex flex-col bg-white shadow-2xl border-l border-slate-200 animate-in">

        {/* Header */}
        <div className="flex-shrink-0 bg-[#0f172a] px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm leading-tight">Ride Chat</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                  {ride.origin} → {ride.destination || 'ICBT Campus'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context strip */}
          <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2 text-[11px]">
            <span className="text-slate-400">
              Driver: <span className="text-white font-semibold">{ride.driver_name}</span>
            </span>
            <span className="flex items-center gap-1.5">
              {connected ? (
                <><Wifi className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Live</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-slate-500" /><span className="text-slate-500">Offline</span></>
              )}
            </span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Loading messages…</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
              <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">No messages yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                  Coordinate pickup points, timing, and campus gate entry here.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id;
              const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);

              return (
                <div key={msg.id || i} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  {!isMe && (
                    <div className="flex-shrink-0 w-7">
                      {showAvatar ? (
                        <img
                          src={msg.sender_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(msg.sender_name || 'User')}`}
                          alt=""
                          className="w-7 h-7 rounded-full border border-slate-200 bg-white"
                        />
                      ) : null}
                    </div>
                  )}

                  <div className={`max-w-[72%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {showAvatar && !isMe && (
                      <span className="text-[10px] text-slate-500 font-medium px-1">{msg.sender_name}</span>
                    )}
                    <div className={`
                      px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed
                      ${isMe
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm'}
                    `}>
                      {msg.text}
                    </div>
                    <span className={`text-[9px] text-slate-400 px-1 flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-3 bg-white border-t border-slate-100"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 border border-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-300 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
}
