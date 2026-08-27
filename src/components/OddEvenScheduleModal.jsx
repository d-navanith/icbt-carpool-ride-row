import React from 'react';
import { Fuel, Calendar, X, ShieldCheck, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function OddEvenScheduleModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const today = new Date();
  const currentDayOfMonth = today.getDate();

  // Generate 7 days schedule starting today
  const scheduleDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayNum = d.getDate();
    const isOdd = dayNum % 2 !== 0;
    return {
      dateObj: d,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateFormatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      quotaType: isOdd ? 'ODD' : 'EVEN',
      digitsAllowed: isOdd ? '1, 3, 5, 7, 9' : '0, 2, 4, 6, 8',
      isToday: i === 0
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Sri Lanka National Fuel Quota Schedule</h3>
              <p className="text-xs text-slate-300">Weekly Odd / Even Number Plate Refueling Calendar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-blue-950">How the Odd-Even Quota System Works:</span>
              <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                Under national energy regulations, vehicles may only refuel at Ceylon Petroleum / LIOC stations on designated days matching their license plate's final numerical digit. Ride Row aligns drivers and passengers to ensure zero disruption during study and exam weeks.
              </p>
            </div>
          </div>

          {/* Weekly Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {scheduleDays.map((day, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  day.isToday
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase block ${day.isToday ? 'text-blue-200' : 'text-slate-500'}`}>
                  {day.dayName}
                </span>
                <span className="text-xs font-black block mt-0.5">{day.dateFormatted}</span>
                
                <div className={`mt-2 py-1 px-1.5 rounded-lg text-[10px] font-bold ${
                  day.isToday
                    ? 'bg-white text-blue-900 shadow-xs'
                    : day.quotaType === 'ODD'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                }`}>
                  {day.quotaType} Plate
                </div>

                <span className={`text-[9px] mt-1 block font-mono ${day.isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                  Last: {day.digitsAllowed}
                </span>
              </div>
            ))}
          </div>

          {/* Guidelines */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
            <h4 className="font-bold text-slate-900">Campus Commuter Best Practices:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Pair with drivers whose plate matches tomorrow's fuel day</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Split petrol costs fairly via in-app fuel share</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Avoid peak queue hours near Bambalapitiya & Kandy Rd</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Campus security registers all vehicle plate details</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
            >
              Close Calendar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
