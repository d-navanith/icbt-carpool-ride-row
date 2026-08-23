import React, { useState, useEffect } from 'react';
import {
  MapPin, Calendar, Fuel, RefreshCw, MessageSquare,
  Users, Star, Siren, ChevronDown, ChevronUp, Filter,
  Search, X, Clock, CreditCard, ArrowRight, Sparkles, AlertTriangle, FileText, CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import RideCard from '../components/RideCard';
import InteractiveMap from '../components/InteractiveMap';
import BookingModal from '../components/BookingModal';
import ChatDrawer from '../components/ChatDrawer';
import OddEvenBadge from '../components/OddEvenBadge';
import FuelSavingsCalculator from '../components/FuelSavingsCalculator';
import RatingModal from '../components/RatingModal';
import SOSAlertModal from '../components/SOSAlertModal';
import ReceiptModal from '../components/ReceiptModal';

export default function PassengerDashboard() {
  const { token } = useAuth();
  const { socket, addToast } = useSocket() || {};
  const [rides, setRides] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');

  const [receiptData, setReceiptData] = useState(null);
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState(null);

  const isCancellationLocked = (booking) => {
    if (!booking.departure_date || !booking.departure_time) return false;
    const departure = new Date(booking.departure_date + 'T' + booking.departure_time);
    const hoursUntil = (departure - new Date()) / (1000 * 60 * 60);
    return hoursUntil < 2 && hoursUntil > -1;
  };

  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDestination, setSearchDestination] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOddEven, setFilterOddEven] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRide, setSelectedRide] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const [bookingRide, setBookingRide] = useState(null);
  const [chatRide, setChatRide] = useState(null);
  const [ratingBooking, setRatingBooking] = useState(null);
  const [sosBooking, setSosBooking] = useState(null);

  useEffect(() => {
    fetchRides();
    fetchMyBookings();
  }, [searchOrigin, searchDestination, filterDate, filterOddEven]);

  // Real-Time Socket Listener for Payment Confirmation & Ride Completion
  useEffect(() => {
    if (!socket) return;

    const handlePaymentConfirmed = (data) => {
      fetchMyBookings();
      fetchRides();
      addToast?.({
        type: 'success',
        title: '🎉 Payment Confirmed & Drop-Off Done!',
        message: data.message || 'The driver verified your payment. Thank you for riding with Ride Row! Please rate your driver experience.',
        duration: 8000
      });
      if (data.receipt) {
        setReceiptData(data.receipt);
        setSelectedReceiptBooking(data.receipt);
      }
    };

    socket.on('payment_confirmed', handlePaymentConfirmed);
    socket.on('ride_completed', () => {
      fetchMyBookings();
      fetchRides();
    });

    return () => {
      socket.off('payment_confirmed', handlePaymentConfirmed);
      socket.off('ride_completed');
    };
  }, [socket]);

  const fetchRides = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchOrigin) params.append('origin', searchOrigin);
      if (searchDestination) params.append('destination', searchDestination);
      if (filterDate) params.append('date', filterDate);
      if (filterOddEven) params.append('oddEven', filterOddEven);
      const res = await fetch(`/api/rides?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.rides || [];
        setRides(list);
        if (list.length > 0) setSelectedRide(list[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/bookings/my-bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking request?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchMyBookings();
        fetchRides();
        addToast?.({
          type: 'info',
          title: 'Booking Cancelled',
          message: 'Your booking has been cancelled and seat quota returned to the carpool.',
          duration: 4000
        });
      } else {
        addToast?.({
          type: 'error',
          title: 'Cancellation Failed',
          message: data.error || 'Could not cancel booking.',
          duration: 5000
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewReceipt = async (booking) => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}/receipt`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReceiptData(data.receipt);
        setSelectedReceiptBooking(booking);
      } else {
        // Fallback construct
        setReceiptData({
          receiptNumber: `RR-REC-2026-${String(booking.id).padStart(6, '0')}`,
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          origin: booking.origin,
          destination: booking.destination,
          pickupLocation: booking.pickup_location,
          departureDate: booking.departure_date,
          departureTime: booking.departure_time,
          seatsBooked: booking.seats_booked,
          pricePerSeat: booking.price_per_seat || 0,
          subtotal: (booking.price_per_seat || 0) * booking.seats_booked,
          totalPaid: (booking.price_per_seat || 0) * booking.seats_booked,
          paymentMethod: booking.payment_method || 'Cash Payment',
          paymentStatus: 'PAID',
          driverName: booking.driver_name,
          driverPhone: booking.driver_phone,
          vehicleModel: booking.vehicle_desc || booking.vehicle_model || 'Campus Carpool',
          vehiclePlate: booking.vehicle_plate || 'CAMPUS-POOL',
          completedAt: booking.completed_at || booking.created_at
        });
        setSelectedReceiptBooking(booking);
      }
    } catch (err) {
      console.error('Error fetching receipt:', err);
    }
  };

  const resetFilters = () => {
    setSearchOrigin('');
    setSearchDestination('');
    setFilterDate('');
    setFilterOddEven('');
  };

  const hasFilters = searchOrigin || searchDestination || filterDate || filterOddEven;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      <OddEvenBadge />

      {/* Header + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Find a <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400">Ride</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Admin-verified campus carpools — safe, affordable, Odd/Even synchronized
          </p>
        </div>

        <div className="flex p-1 rounded-2xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-xl self-start">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              activeTab === 'browse'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Browse Rides <span className="ml-1 opacity-70">({rides.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('my-bookings')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              activeTab === 'my-bookings'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            My Bookings
            {myBookings.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black">
                {myBookings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Search Card */}
          <div className="bg-white/[0.04] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 flex items-center">
                <div className="absolute left-4 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="From — pickup town or area (e.g. Gampaha, Negombo)"
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none bg-white/[0.04] border border-white/10 rounded-2xl focus:border-cyan-500/50 transition"
                />
              </div>

              <div className="relative flex-1 flex items-center">
                <div className="absolute left-4 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="To — destination (e.g. Campus, Colombo)"
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none bg-white/[0.04] border border-white/10 rounded-2xl focus:border-cyan-500/50 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-4 py-3.5 rounded-2xl text-xs font-extrabold transition border ${
                    showFilters || filterDate || filterOddEven
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-white/[0.05] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.1]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {hasFilters && (
                  <button
                    onClick={resetFilters}
                    className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl border border-white/10 transition"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Filters */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-white/[0.08] flex flex-wrap gap-3">
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="pl-9 pr-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="relative">
                  <Fuel className="w-3.5 h-3.5 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={filterOddEven}
                    onChange={(e) => setFilterOddEven(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">All Plate Tags</option>
                    <option value="ODD">ODD Plates (1, 3, 5, 7, 9)</option>
                    <option value="EVEN">EVEN Plates (0, 2, 4, 6, 8)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Map Switcher Button */}
          <button
            onClick={() => setShowMap(!showMap)}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-bold text-slate-300 hover:text-white"
          >
            <MapPin className="w-4 h-4 text-cyan-400" />
            {showMap ? 'Hide Map Radar' : 'Show Transit Route Map'}
          </button>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Interactive Map */}
            <div className={`lg:col-span-5 lg:sticky lg:top-24 space-y-2.5 ${showMap ? 'block' : 'hidden lg:block'}`}>
              <InteractiveMap selectedRide={selectedRide} rides={rides} />
              {selectedRide && (
                <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 text-xs text-slate-300 flex items-center justify-between gap-2 backdrop-blur-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="font-bold text-white truncate">{selectedRide.origin}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-bold text-cyan-300 truncate">{selectedRide.destination || 'Campus'}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
                    {selectedRide.departure_time}
                  </span>
                </div>
              )}
            </div>

            {/* Ride List */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                  {loading ? 'Scanning Corridor Carpools…' : `${rides.length} Available Carpool${rides.length !== 1 ? 's' : ''}`}
                </p>
                <button
                  onClick={fetchRides}
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition border border-white/5"
                  title="Refresh Carpools"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-12 text-center backdrop-blur-xl space-y-3">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">Matching campus carpool drivers…</p>
                </div>
              ) : rides.length === 0 ? (
                <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-12 text-center space-y-4 backdrop-blur-xl">
                  <div className="w-14 h-14 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto border border-white/10">
                    <Search className="w-7 h-7 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-base">No Matching Carpools Found</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Try searching another pickup town or adjusting your departure date filter.
                    </p>
                  </div>
                  {hasFilters && (
                    <button onClick={resetFilters} className="btn-primary text-xs px-5 py-2.5">
                      Clear Search Filters
                    </button>
                  )}
                </div>
              ) : (
                rides.map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    isSelected={selectedRide?.id === ride.id}
                    onSelect={(r) => { setSelectedRide(r); setShowMap(true); }}
                    onBook={(r) => setBookingRide(r)}
                    onChat={(r) => setChatRide(r)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white text-base">
              Your Campus Bookings <span className="text-slate-500 font-normal">({myBookings.length})</span>
            </h3>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Present your boarding code or digital receipt to the driver at pickup
            </span>
          </div>

          {myBookings.length === 0 ? (
            <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-12 text-center space-y-4 backdrop-blur-xl">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto border border-cyan-500/20 text-cyan-400">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">No Bookings Yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Browse available carpools to campus and reserve your seat in seconds.
                </p>
              </div>
              <button onClick={() => setActiveTab('browse')} className="btn-primary text-xs px-5 py-2.5">
                Browse Campus Rides
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myBookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-3xl bg-white/[0.04] border border-white/10 shadow-xl overflow-hidden backdrop-blur-xl hover:border-cyan-500/30 transition-all space-y-4 p-5"
                >
                  {/* Top Status Strip */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`badge ${
                        b.status === 'completed'
                          ? 'badge-green'
                          : b.status === 'confirmed'
                          ? 'badge-green'
                          : b.status === 'pending'
                          ? 'badge-amber'
                          : b.status === 'rejected'
                          ? 'badge-red'
                          : 'badge-slate'
                      }`}>
                        {b.status === 'completed'
                          ? '✓ Paid & Completed'
                          : b.status === 'confirmed'
                          ? '✓ Confirmed • Ready'
                          : b.status === 'pending'
                          ? '⏳ Awaiting Driver'
                          : b.status === 'rejected'
                          ? '✕ Declined'
                          : 'Cancelled'}
                      </span>
                      <h4 className="font-extrabold text-white text-base mt-2 leading-tight">
                        {b.origin} <span className="text-cyan-400">→</span> {b.destination}
                      </h4>
                    </div>

                    {/* Boarding Code Box */}
                    <div className="shrink-0 text-center bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2">
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                        {b.status === 'completed' ? 'Receipt Ref' : b.status === 'confirmed' ? 'Boarding Code' : 'Ref Code'}
                      </p>
                      <p className={`font-mono font-black text-sm tracking-wider ${
                        b.status === 'completed' || b.status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {b.booking_code}
                      </p>
                    </div>
                  </div>

                  {/* Status Notes */}
                  {b.status === 'pending' && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between">
                      <span>Awaiting driver review & confirmation.</span>
                      {isCancellationLocked(b) ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Locked (within 2h)</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[11px] transition border border-red-500/30"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  )}

                  {b.status === 'completed' && (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Payment Verified: <strong>LKR {b.paid_amount || (b.price_per_seat * b.seats_booked)}</strong></span>
                      </div>
                      <button
                        onClick={() => handleViewReceipt(b)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[11px] transition border border-cyan-500/30 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> View e-Receipt
                      </button>
                    </div>
                  )}

                  {/* Details Chips */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300 bg-white/[0.05] rounded-xl px-3 py-1 border border-white/5">
                      <Users className="w-3.5 h-3.5 text-amber-400" /> Seats: <strong>{b.seats_booked}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-300 bg-white/[0.05] rounded-xl px-3 py-1 border border-white/5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {b.pickup_location}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-300 bg-white/[0.05] rounded-xl px-3 py-1 border border-white/5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" /> {b.departure_date} · {b.departure_time}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-300 bg-white/[0.05] rounded-xl px-3 py-1 border border-white/5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" /> {b.price_per_seat > 0 ? `LKR ${b.price_per_seat * b.seats_booked}` : 'Free'}
                    </span>
                  </div>

                  {/* Driver Row */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-400 pt-2 border-t border-white/[0.06]">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(b.driver_name || '')}`}
                      className="w-7 h-7 rounded-xl bg-slate-800 border border-white/10"
                      alt=""
                    />
                    <span className="font-semibold text-slate-200">{b.driver_name}</span>
                    {b.driver_phone && <span className="text-slate-500">· {b.driver_phone}</span>}
                    {b.vehicle_desc && <span className="ml-auto text-slate-400 font-mono">{b.vehicle_desc}</span>}
                  </div>

                  {/* Action Row */}
                  <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08]">
                    {b.status === 'confirmed' && (
                      <button
                        onClick={() => setSosBooking({ id: b.ride_id, driver_name: b.driver_name, vehicle_desc: b.vehicle_desc })}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold border border-red-500/30 transition"
                      >
                        <Siren className="w-3.5 h-3.5" /> SOS
                      </button>
                    )}

                    {b.status === 'completed' && (
                      <button
                        onClick={() => handleViewReceipt(b)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition"
                      >
                        <FileText className="w-3.5 h-3.5" /> Receipt
                      </button>
                    )}

                    {(b.status === 'confirmed' || b.status === 'completed') && (
                      <button
                        onClick={() => setRatingBooking(b)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 transition"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rate Driver
                      </button>
                    )}

                    {b.status !== 'cancelled' && b.status !== 'rejected' && (
                      <button
                        onClick={() => setChatRide({ id: b.ride_id, origin: b.origin, destination: b.destination, driver_name: b.driver_name, departure_time: b.departure_time })}
                        className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {myBookings.length > 0 && <FuelSavingsCalculator />}
        </div>
      )}

      {/* Modals */}
      <BookingModal
        ride={bookingRide}
        isOpen={Boolean(bookingRide)}
        onClose={() => setBookingRide(null)}
        onBookingSuccess={() => { fetchRides(); fetchMyBookings(); }}
      />
      <ChatDrawer
        ride={chatRide}
        isOpen={Boolean(chatRide)}
        onClose={() => setChatRide(null)}
      />
      <RatingModal
        booking={ratingBooking}
        isOpen={Boolean(ratingBooking)}
        onClose={() => setRatingBooking(null)}
        onReviewSubmitted={fetchMyBookings}
      />
      <SOSAlertModal
        ride={sosBooking}
        isOpen={Boolean(sosBooking)}
        onClose={() => setSosBooking(null)}
      />
      <ReceiptModal
        receipt={receiptData}
        isOpen={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        onOpenRating={() => setRatingBooking(selectedReceiptBooking)}
      />
    </div>
  );
}
