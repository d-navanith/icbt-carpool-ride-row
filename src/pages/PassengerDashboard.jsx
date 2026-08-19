import React, { useState, useEffect } from 'react';
import {
  MapPin, Calendar, Fuel, RefreshCw, MessageSquare,
  Users, Star, Siren, ChevronDown, ChevronUp, Filter,
  Search, X, Clock, CreditCard, ArrowRight, Sparkles, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RideCard from '../components/RideCard';
import InteractiveMap from '../components/InteractiveMap';
import BookingModal from '../components/BookingModal';
import ChatDrawer from '../components/ChatDrawer';
import OddEvenBadge from '../components/OddEvenBadge';
import FuelSavingsCalculator from '../components/FuelSavingsCalculator';
import RatingModal from '../components/RatingModal';
import SOSAlertModal from '../components/SOSAlertModal';

export default function PassengerDashboard() {
  const { token } = useAuth();
  const [rides, setRides] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');

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
    if (!window.confirm('Are you sure you want to cancel this booking request?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (res.ok) {
        fetchMyBookings();
        fetchRides();
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
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
    <div className="max-w-7xl mx-auto space-y-6">

      <OddEvenBadge />

      {/* Header + Glass Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Find a Campus Carpool</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Admin-verified university rideshares aligned with fuel quota schedules
          </p>
        </div>

        <div className="flex p-1 rounded-2xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-xl self-start">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              activeTab === 'browse'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Browse Rides <span className="text-blue-200/80 ml-1">({rides.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('my-bookings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              activeTab === 'my-bookings'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>My Bookings</span>
            {myBookings.length > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {myBookings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'browse' && (
        <div className="space-y-5">
          {/* Glass Search Card */}
          <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.1] shadow-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              {/* Origin */}
              <div className="relative flex-1 flex items-center">
                <div className="absolute left-4 w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="From — pickup town or junction (e.g. Gampaha)"
                  value={searchOrigin}
                  onChange={e => setSearchOrigin(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none bg-transparent"
                />
              </div>

              <div className="hidden sm:block w-px bg-white/[0.08] self-stretch" />
              <div className="block sm:hidden h-px bg-white/[0.08] mx-4" />

              {/* Destination */}
              <div className="relative flex-1 flex items-center">
                <div className="absolute left-4 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="To — destination (e.g. ICBT Colombo Campus)"
                  value={searchDestination}
                  onChange={e => setSearchDestination(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none bg-transparent"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2 px-4 py-3 sm:py-0 border-t sm:border-t-0 sm:border-l border-white/[0.08]">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    showFilters || filterDate || filterOddEven
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                      : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter</span>
                  {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {hasFilters && (
                  <button
                    onClick={resetFilters}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Glass Filter Options */}
            {showFilters && (
              <div className="border-t border-white/[0.08] bg-black/20 px-5 py-3.5 flex flex-wrap gap-3">
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="pl-8 pr-3 py-2 rounded-xl border border-white/10 text-xs bg-white/[0.07] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="relative">
                  <Fuel className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={filterOddEven}
                    onChange={e => setFilterOddEven(e.target.value)}
                    className="pl-8 pr-3 py-2 rounded-xl border border-white/10 text-xs bg-slate-900 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Plate Tags</option>
                    <option value="ODD">ODD Plate Rule</option>
                    <option value="EVEN">EVEN Plate Rule</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Map Toggle */}
          <button
            onClick={() => setShowMap(!showMap)}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.06] text-slate-300 text-xs font-bold border border-white/10 hover:bg-white/[0.1] transition"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>{showMap ? 'Hide Route Map' : 'Show Live Route Map'}</span>
            {showMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Main Grid: Map & Ride Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Interactive Map Column */}
            <div className={`lg:col-span-5 lg:sticky lg:top-6 space-y-3 ${showMap ? 'block' : 'hidden lg:block'}`}>
              <InteractiveMap selectedRide={selectedRide} rides={rides} />
              {selectedRide && (
                <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 px-4 py-3 text-xs text-slate-300 flex items-center gap-2.5 shadow-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-bold text-white truncate">{selectedRide.origin}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-bold text-blue-300 truncate">{selectedRide.destination || 'ICBT Colombo Campus'}</span>
                </div>
              )}
            </div>

            {/* Ride Cards Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-slate-200">
                  {loading ? 'Searching campus carpools…' : `${rides.length} available carpool${rides.length !== 1 ? 's' : ''}`}
                </p>
                <button
                  onClick={fetchRides}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition"
                  title="Refresh rides"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-12 text-center backdrop-blur-xl">
                  <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-lg shadow-blue-500/30" />
                  <p className="text-xs font-semibold text-slate-400">Finding available carpools…</p>
                </div>
              ) : rides.length === 0 ? (
                <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-12 text-center space-y-3 backdrop-blur-xl">
                  <div className="w-14 h-14 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto border border-white/10">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <h4 className="font-extrabold text-white text-base">No carpools found</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Try adjusting your pickup area, checking another date, or clearing active filters.
                  </p>
                  <button onClick={resetFilters} className="btn-primary text-xs px-5 py-2.5">
                    Clear Filters
                  </button>
                </div>
              ) : (
                rides.map(ride => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    isSelected={selectedRide?.id === ride.id}
                    onSelect={r => { setSelectedRide(r); setShowMap(true); }}
                    onBook={r => setBookingRide(r)}
                    onChat={r => setChatRide(r)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-bookings' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white text-base">
              Your Reserved Boarding Passes <span className="text-slate-400 font-normal text-sm">({myBookings.length})</span>
            </h3>
            <span className="text-xs text-slate-400 hidden sm:block">
              Present your verification code to the driver upon pickup
            </span>
          </div>

          {myBookings.length === 0 ? (
            <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-12 text-center space-y-3 backdrop-blur-xl">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
              <h4 className="font-extrabold text-white">No active bookings yet</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Search available carpool rides and reserve your seat to travel safely to ICBT campus.
              </p>
              <button onClick={() => setActiveTab('browse')} className="btn-primary text-xs px-5 py-2.5">
                Find a Ride
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myBookings.map(b => (
                <div
                  key={b.id}
                  className="rounded-3xl bg-white/[0.04] border border-white/10 shadow-xl overflow-hidden backdrop-blur-xl hover:border-white/20 transition"
                >
                  <div className={`h-1.5 w-full ${
                    b.status === 'confirmed'
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : b.status === 'pending'
                      ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                      : b.status === 'rejected'
                      ? 'bg-red-400'
                      : 'bg-slate-600'
                  }`} />
                  
                  <div className="p-5 space-y-4">
                    {/* Top Row: Route & Boarding Code */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`badge ${
                          b.status === 'confirmed'
                            ? 'badge-green'
                            : b.status === 'pending'
                            ? 'badge-amber'
                            : b.status === 'rejected'
                            ? 'badge-red'
                            : 'badge-slate'
                        }`}>
                          {b.status === 'pending'
                            ? '⏳ Pending Approval'
                            : b.status === 'confirmed'
                            ? '✓ Confirmed'
                            : b.status === 'rejected'
                            ? '✕ Rejected'
                            : 'Cancelled'}
                        </span>
                        <h4 className="font-extrabold text-white text-base mt-2 leading-tight">
                          {b.origin} <span className="text-blue-400">→</span> {b.destination}
                        </h4>
                      </div>

                      {/* Boarding Code Box */}
                      <div className="shrink-0 text-center bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2">
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                          {b.status === 'confirmed' ? 'Boarding Code' : 'Ref Code'}
                        </p>
                        <p className={`font-mono font-black text-sm tracking-wider ${b.status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {b.booking_code}
                        </p>
                      </div>
                    </div>

                    {/* Status helper note */}
                    {b.status === 'pending' && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between">
                        <span>Awaiting driver review & confirmation.</span>
                        {isCancellationLocked(b) ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Cancellation window closed (within 2h of departure)</span>
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

                    {b.status === 'rejected' && (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200">
                        <span>The driver declined this booking request. Your reserved seat quota has been released.</span>
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
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" /> {b.price_per_seat > 0 ? `LKR ${b.price_per_seat * b.seats_booked} (${b.seats_booked}x)` : 'Free'}
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
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => setRatingBooking(b)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 transition"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rate
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
    </div>
  );
}
