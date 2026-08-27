import React from 'react';
import {
  X, CheckCircle, Printer, Download, MapPin, Calendar, Clock,
  Car, User, ShieldCheck, CreditCard, Sparkles, Star, ArrowRight, Fuel
} from 'lucide-react';
import Logo from './Logo';

export default function ReceiptModal({ receipt, isOpen, onClose, onOpenRating }) {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="rounded-3xl bg-[#0e1424] border border-cyan-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.85)] w-full max-w-lg overflow-hidden animate-in text-white my-8 relative">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/15 blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.03] relative z-10">
          <Logo size="sm" subtitle="Official e-Receipt" />
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.1] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div id="ride-row-receipt" className="p-6 space-y-5 relative z-10">
          
          {/* Status & Receipt Number Banner */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="badge badge-green text-[10px] font-black uppercase tracking-wider">
                  ✓ {receipt.paymentStatus || 'PAID & COMPLETED'}
                </span>
                <p className="text-xs font-bold text-white mt-0.5">Ride Payment Verified</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono">Receipt No</span>
              <span className="font-mono text-xs font-black text-cyan-300">
                {receipt.receiptNumber || `RR-REC-2026-${receipt.bookingId || '001'}`}
              </span>
            </div>
          </div>

          {/* Route Card */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
              <span>Commute Corridor</span>
              <span className="font-mono text-amber-300 font-bold">Code: {receipt.bookingCode || 'CP-POOL'}</span>
            </div>

            <div className="flex items-center gap-2.5 text-sm font-extrabold text-white">
              <span className="truncate">{receipt.origin}</span>
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="truncate text-cyan-300">{receipt.destination}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Pickup: <strong>{receipt.pickupLocation}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{receipt.departureDate} • {receipt.departureTime}</span>
              </div>
            </div>
          </div>

          {/* Driver & Vehicle Card */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Driver Details</span>
              <p className="font-bold text-white truncate">{receipt.driverName || 'Verified Driver'}</p>
              <p className="text-[11px] text-slate-400">{receipt.driverPhone || 'Campus Commuter'}</p>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Vehicle & Plate</span>
              <p className="font-bold text-cyan-300 truncate">{receipt.vehicleModel || 'Hybrid Carpool'}</p>
              <p className="font-mono text-[11px] text-slate-300 font-bold">{receipt.vehiclePlate || 'WP-POOL'}</p>
            </div>
          </div>

          {/* Itemized Fare Table */}
          <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2.5 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block border-b border-white/5 pb-1.5">
              Fare & Fuel Share Breakdown
            </span>

            <div className="flex items-center justify-between text-slate-300">
              <span>Fuel Contribution ({receipt.seatsBooked || 1} Seat × LKR {receipt.pricePerSeat || 0})</span>
              <span className="font-mono font-bold text-white">LKR {receipt.subtotal || 0}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Campus Sustainability Carbon Credit</span>
              <span className="text-emerald-400 font-semibold">Included</span>
            </div>

            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Payment Mode</span>
              <span className="text-slate-200 font-semibold">{receipt.paymentMethod || 'Cash Payment'}</span>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm font-black">
              <span className="text-white">Total Paid</span>
              <span className="font-mono text-cyan-400 text-base">LKR {receipt.totalPaid || 0}</span>
            </div>
          </div>

          {/* Security & Timestamp Footer Note */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Verified by Ride Row Transit
            </span>
            <span>{new Date(receipt.completedAt || Date.now()).toLocaleDateString()}</span>
          </div>

        </div>

        {/* Modal Action Buttons */}
        <div className="p-6 bg-black/40 border-t border-white/[0.08] flex items-center gap-3 relative z-10">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-xs border border-white/15 transition flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>

          {onOpenRating && (
            <button
              onClick={() => {
                onClose();
                onOpenRating();
              }}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4 fill-slate-950" />
              <span>Rate Driver</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
