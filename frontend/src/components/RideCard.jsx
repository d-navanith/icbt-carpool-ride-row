import React, { useState } from 'react';
import { Users, Clock, Calendar, ShieldCheck, Fuel, ArrowRight, MessageSquare, ChevronRight, Sparkles } from 'lucide-react';

export default function RideCard({ ride, onSelect, onBook, onChat, isSelected }) {
  const isOdd = ride.odd_even_tag === 'ODD';
  const availPct = ride.available_seats / (ride.total_seats || 1);
  const seatBadge = availPct > 0.5 ? 'badge-green' : availPct > 0 ? 'badge-amber' : 'badge-red';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect?.(ride)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative rounded-3xl cursor-pointer transition-all duration-200 overflow-hidden
        backdrop-blur-xl border
        ${isSelected
          ? 'bg-white/[0.08] border-blue-500/80 shadow-[0_12px_40px_rgba(37,99,235,0.25)] ring-1 ring-blue-400/40'
          : 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.07] hover:border-white/[0.2] shadow-lg shadow-black/20'}
      `}
    >
      {/* Left Active Glow Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-l-full shadow-lg shadow-blue-500/50" />
      )}

      <div className="p-5">
        {/* Top Header: Driver Profile & Price */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(ride.driver_name || '')}`}
                alt={ride.driver_name}
                className="w-10 h-10 rounded-2xl bg-slate-800 border border-white/20 shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#0b0f19]">
                <ShieldCheck className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-tight">{ride.driver_name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[170px]">
                {ride.vehicle_model || 'Campus vehicle'}
              </p>
              {/* Star Rating */}
              {ride.avg_rating > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map(star => (
                    <svg key={star} className={`w-3 h-3 ${
                      star <= Math.round(ride.avg_rating) ? 'text-amber-400' : 'text-slate-600'
                    }`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-[10px] text-slate-400 ml-0.5">{ride.avg_rating.toFixed(1)} ({ride.total_reviews})</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="font-black text-white text-xl leading-none">
              {ride.price_per_seat > 0 ? `LKR ${ride.price_per_seat}` : 'Free'}
            </p>
            <p className="text-[10px] text-blue-300/80 font-bold uppercase tracking-wider mt-1">per seat</p>
          </div>
        </div>

        {/* Luminous Route Visualiser */}
        <div className="flex gap-3 mb-4 p-3 rounded-2xl bg-black/20 border border-white/[0.06]">
          <div className="flex flex-col items-center pt-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
            <div className="flex-1 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-400 to-indigo-400 my-1 min-h-[16px]" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{ride.origin}</p>
            {ride.route_waypoints?.length > 0 && (
              <div className="flex flex-wrap gap-1 my-1.5">
                {ride.route_waypoints.slice(0, 3).map((wp, i) => (
                  <span key={i} className="text-[10px] font-semibold text-slate-400 bg-white/[0.06] rounded-md px-2 py-0.5 border border-white/5">{wp}</span>
                ))}
                {ride.route_waypoints.length > 3 && (
                  <span className="text-[10px] text-slate-500">+{ride.route_waypoints.length - 3}</span>
                )}
              </div>
            )}
            <p className="text-xs font-bold text-blue-300 truncate">{ride.destination || 'ICBT Colombo Campus'}</p>
          </div>
        </div>

        {/* Meta Chips */}
        <div className="flex items-center flex-wrap gap-2 mb-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300 bg-white/[0.05] px-2.5 py-1 rounded-xl border border-white/10 font-medium">
            <Calendar className="w-3 h-3 text-blue-400" />
            {ride.departure_date}
          </span>
          <span className="flex items-center gap-1.5 text-slate-300 bg-white/[0.05] px-2.5 py-1 rounded-xl border border-white/10 font-medium">
            <Clock className="w-3 h-3 text-blue-400" />
            {ride.departure_time}
          </span>
          {/* Seat Capacity Visual */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-medium">Seats:</span>
            <div className="flex gap-0.5">
              {Array.from({ length: ride.total_seats || 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-sm border text-[8px] flex items-center justify-center ${
                    i < (ride.total_seats - ride.available_seats)
                      ? 'bg-slate-600 border-slate-500 text-slate-400'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {i < (ride.total_seats - ride.available_seats) ? '✕' : '○'}
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-emerald-400">{ride.available_seats} free</span>
          </div>
          <span className={`ml-auto badge ${isOdd ? 'badge-amber' : 'badge-blue'}`}>
            <Fuel className="w-3 h-3" />
            {ride.odd_even_tag} Tag
          </span>
        </div>

        {/* Actions Row */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08]">
          {onChat && (
            <button
              onClick={e => { e.stopPropagation(); onChat(ride); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 transition shrink-0"
              title="Chat with driver"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onBook(ride); }}
            disabled={ride.available_seats <= 0}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150
              ${ride.available_seats > 0
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 border border-white/20'
                : 'bg-white/[0.05] text-slate-500 border border-white/5 cursor-not-allowed'}
            `}
          >
            {ride.available_seats > 0 ? (
              <><span>Join Carpool</span><ArrowRight className="w-4 h-4" /></>
            ) : (
              'Fully Booked'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
