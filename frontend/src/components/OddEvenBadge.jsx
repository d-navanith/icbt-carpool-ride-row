import React from 'react';
import { Fuel, ShieldCheck, Sparkles } from 'lucide-react';

export default function OddEvenBadge({ compact = false }) {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const isOddDay = dayOfMonth % 2 !== 0;
  const todayQuota = isOddDay ? 'ODD' : 'EVEN';
  const dayStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border backdrop-blur-md ${
        isOddDay
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-xs'
          : 'bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-xs'
      }`}>
        <Fuel className="w-3.5 h-3.5" />
        <span>{todayQuota} Quota Tag</span>
      </span>
    );
  }

  return (
    <div className={`rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border backdrop-blur-xl shadow-lg ${
      isOddDay
        ? 'bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent border-amber-500/30 shadow-amber-950/20'
        : 'bg-gradient-to-r from-blue-500/15 via-indigo-600/10 to-transparent border-blue-500/30 shadow-blue-950/20'
    }`}>
      <div className="flex items-center gap-3.5">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-md border ${
          isOddDay
            ? 'bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 border-amber-300/40 shadow-amber-500/30'
            : 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white border-blue-400/40 shadow-blue-600/30'
        }`}>
          {todayQuota.slice(0, 1)}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-extrabold ${isOddDay ? 'text-amber-200' : 'text-blue-200'}`}>
              Today is an <strong>{todayQuota} Plate</strong> Fuel Day
            </span>
            <span className="badge badge-green text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Rule Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {dayStr} · Vehicles ending with {isOddDay ? 'ODD (1,3,5,7,9)' : 'EVEN (0,2,4,6,8)'} numbers authorized.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/[0.06] backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shrink-0">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Campus Verified Carpools</span>
      </div>
    </div>
  );
}
