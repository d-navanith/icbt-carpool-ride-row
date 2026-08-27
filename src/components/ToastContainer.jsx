import React from 'react';
import { X, AlertTriangle, Info, CheckCircle, Siren } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

function Toast({ toast, onDismiss }) {
  const isSOS = toast.type === 'sos';
  const isSuccess = toast.type === 'success';
  const isInfo = toast.type === 'info';

  const styles = isSOS
    ? 'bg-red-700 border-red-500 text-white shadow-2xl shadow-red-900/50'
    : isSuccess
    ? 'bg-emerald-700 border-emerald-500 text-white shadow-lg'
    : 'bg-slate-900 border-slate-700 text-white shadow-lg';

  const Icon = isSOS ? Siren : isSuccess ? CheckCircle : Info;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border max-w-sm w-full ${styles} animate-in slide-in-from-right-4 duration-300`}
    >
      <div className={`shrink-0 mt-0.5 ${isSOS ? 'animate-pulse' : ''}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs">{toast.title}</p>
        <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{toast.message}</p>
        {isSOS && toast.alertId && (
          <p className="text-[10px] font-mono opacity-60 mt-1">ID: {toast.alertId}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useSocket();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
