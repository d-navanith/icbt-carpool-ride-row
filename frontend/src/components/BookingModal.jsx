import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, ShieldCheck, MapPin, Calendar, Clock, CreditCard, Minus, Plus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BookingModal({ ride, isOpen, onClose, onBookingSuccess }) {
  const { token } = useAuth();
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  useEffect(() => {
    if (ride && isOpen) {
      setPickupPoint(ride.origin || '');
      setSeats(1);
      setError('');
      setConfirmedBooking(null);
    }
  }, [ride, isOpen]);

  if (!isOpen || !ride) return null;

  const availableSeats = Number(ride.available_seats) || 0;
  const stops = [ride.origin, ...(ride.route_waypoints || [])].filter(Boolean);
  const totalPrice = (ride.price_per_seat || 0) * seats;

  const handleDecreaseSeats = () => {
    setSeats(prev => Math.max(1, prev - 1));
  };

  const handleIncreaseSeats = () => {
    setSeats(prev => Math.min(availableSeats, prev + 1));
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setError('');

    const chosenPickup = pickupPoint || ride.origin || stops[0] || 'Start Point';

    if (!ride?.id || !chosenPickup) {
      setError('Please select a valid boarding stop.');
      return;
    }

    if (!seats || isNaN(seats) || seats < 1) {
      setError('Please select at least 1 seat to reserve.');
      return;
    }

    if (seats > availableSeats) {
      setError(`Cannot reserve more than ${availableSeats} available seat${availableSeats !== 1 ? 's' : ''}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ride_id: Number(ride.id),
          seats: Number(seats),
          seats_booked: Number(seats),
          pickup_location: chosenPickup
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setConfirmedBooking(data.booking);
      onBookingSuccess?.(data.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl">
      <div className="rounded-3xl bg-[#0b0f19]/95 border border-white/20 shadow-2xl w-full max-w-md overflow-hidden animate-in text-white">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.04]">
          <div>
            <h3 className="font-extrabold text-white text-base">Reserve Your Campus Seat</h3>
            <p className="text-xs text-slate-400 mt-0.5">{ride.origin} → {ride.destination || 'ICBT Campus'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedBooking ? (
          /* ── Request Submitted State (Pending Driver Approval) ── */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
              <Clock className="w-9 h-9 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Pending Driver Approval
              </div>
              <h4 className="font-black text-white text-xl">Seat Request Submitted!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your request has been sent to <strong>{ride.driver_name}</strong>. Once approved, your seat will be confirmed.
              </p>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-5 text-center shadow-inner">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Reservation Reference Code</p>
              <p className="font-mono font-black text-3xl text-amber-400 tracking-[0.25em]">{confirmedBooking.booking_code}</p>
              <p className="text-[10px] text-slate-500 mt-1">Present this code to the driver upon pickup once confirmed</p>
            </div>

            <div className="bg-white/[0.04] rounded-2xl p-4 text-xs text-slate-300 text-left space-y-1.5 border border-white/10">
              <p><span className="text-slate-400">Driver:</span> <strong className="text-white">{ride.driver_name}</strong></p>
              <p><span className="text-slate-400">Pickup Stop:</span> <strong className="text-white">{pickupPoint}</strong></p>
              <p><span className="text-slate-400">Seats Requested:</span> <strong className="text-amber-300 font-bold">{confirmedBooking.seats_booked || seats} seat{(confirmedBooking.seats_booked || seats) > 1 ? 's' : ''}</strong></p>
              <p><span className="text-slate-400">Departure:</span> <strong className="text-white">{ride.departure_date} at {ride.departure_time}</strong></p>
            </div>

            <button onClick={onClose} className="btn-primary w-full py-3 text-xs">
              Done (View in My Bookings)
            </button>
          </div>
        ) : (
          /* ── Form State ── */
          <form onSubmit={handleBooking} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-2xl text-xs text-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Ride summary */}
            <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Driver</span>
                <span className="flex items-center gap-1 font-bold text-white">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {ride.driver_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Vehicle</span>
                <span className="font-semibold text-white">{ride.vehicle_model || 'Campus Vehicle'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Departure</span>
                <span className="font-semibold text-white">{ride.departure_date} · {ride.departure_time}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Plate Quota</span>
                <span className={`badge ${ride.odd_even_tag === 'ODD' ? 'badge-amber' : 'badge-blue'}`}>{ride.odd_even_tag}</span>
              </div>
            </div>

            {/* Pickup stop */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Your Boarding Stop *
              </label>
              <select
                value={pickupPoint || ride.origin || ''}
                onChange={e => setPickupPoint(e.target.value)}
                className="w-full bg-slate-900 border border-white/15 rounded-xl py-3 px-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                {stops.map((stop, i) => (
                  <option key={i} value={stop}>{i === 0 ? `[Start Point] ${stop}` : `[Way Stop ${i}] ${stop}`}</option>
                ))}
              </select>
            </div>

            {/* Seats Stepper */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Seats to reserve
                </label>
                <span className="text-xs font-semibold text-slate-400">
                  Available seats: <strong className="text-emerald-400 font-bold">{availableSeats}</strong>
                </span>
              </div>

              <div className="flex items-center justify-between bg-black/40 border border-white/15 rounded-2xl p-2.5">
                <button
                  type="button"
                  onClick={handleDecreaseSeats}
                  disabled={seats <= 1}
                  className="w-10 h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center font-black transition border border-white/10"
                  aria-label="Decrease seat count"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-2xl font-black text-white tabular-nums tracking-wide">{seats}</span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {seats === 1 ? 'seat' : 'seats'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleIncreaseSeats}
                  disabled={seats >= availableSeats}
                  className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center font-black transition shadow-md shadow-blue-600/30"
                  aria-label="Increase seat count"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fare Calculation */}
            <div className="flex items-center justify-between p-4 bg-blue-600/20 border border-blue-500/30 rounded-2xl shadow-sm">
              <div>
                <p className="text-xs font-bold text-blue-200">Total Fuel Share</p>
                <p className="text-[10px] text-blue-300/80 mt-0.5">LKR {ride.price_per_seat} × {seats} seat{seats !== 1 ? 's' : ''}</p>
              </div>
              <p className="font-black text-2xl text-white">
                {totalPrice > 0 ? `LKR ${totalPrice}` : 'Free'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-xs">Cancel</button>
              <button
                type="submit"
                disabled={loading || availableSeats < 1}
                className="btn-primary flex-1 py-3 text-xs"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting Request…
                  </span>
                ) : (
                  `Request ${seats} Seat${seats > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
