import React, { useState, useEffect } from 'react';
import {
  Car, ShieldCheck, ShieldAlert, Clock, PlusCircle, Users, Check,
  X, AlertTriangle, MessageSquare, MapPin, Calendar, Fuel, ArrowRight,
  Siren, CalendarDays, Sparkles, Bell, RefreshCw, CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import DriverVerificationModal from '../components/DriverVerificationModal';
import ChatDrawer from '../components/ChatDrawer';
import OddEvenBadge from '../components/OddEvenBadge';
import SOSAlertModal from '../components/SOSAlertModal';
import OddEvenScheduleModal from '../components/OddEvenScheduleModal';

export default function DriverDashboard({ onOpenVerification }) {
  const { user, token, isApprovedDriver, driverStatus, switchMode } = useAuth();
  const { socket, addToast } = useSocket();

  const [myRides, setMyRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRideForBookings, setSelectedRideForBookings] = useState(null);
  const [rideBookings, setRideBookings] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [chatRide, setChatRide] = useState(null);
  const [sosRide, setSosRide] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // New Ride Form State
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');

  const [rideForm, setRideForm] = useState({
    origin: 'Gampaha Town',
    destination: 'ICBT Colombo Campus',
    route_waypoints_input: 'Miriswatta, Kiribathgoda, Kelaniya, Orugodawatta',
    departure_date: new Date().toISOString().split('T')[0],
    departure_time: '07:30',
    return_time: '17:00',
    total_seats: 3,
    price_per_seat: 300,
    notes: 'AC carpool to campus. Non-smoking. Pickup along main road.'
  });

  useEffect(() => {
    fetchMyRides();
    fetchAllRequests();
  }, [token]);

  // Real-Time WebSocket Synchronization for Incoming Bookings & Status Updates
  useEffect(() => {
    if (!socket) return;

    const handleNewBooking = (bookingData) => {
      fetchAllRequests();
      fetchMyRides();
      if (selectedRideForBookings) {
        fetchRideBookings(selectedRideForBookings);
      }
    };

    const handleStatusUpdate = (statusData) => {
      fetchAllRequests();
      fetchMyRides();
      if (selectedRideForBookings) {
        fetchRideBookings(selectedRideForBookings);
      }
    };

    socket.on('new_booking_request', handleNewBooking);
    socket.on('booking_created', handleNewBooking);
    socket.on('booking_status_updated', handleStatusUpdate);
    socket.on('booking_status_changed', handleStatusUpdate);

    return () => {
      socket.off('new_booking_request', handleNewBooking);
      socket.off('booking_created', handleNewBooking);
      socket.off('booking_status_updated', handleStatusUpdate);
      socket.off('booking_status_changed', handleStatusUpdate);
    };
  }, [socket, selectedRideForBookings]);

  const fetchMyRides = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/rides/my-rides', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const rides = data.rides || [];
        setMyRides(rides);
        if (rides.length > 0 && !selectedRideForBookings) {
          fetchRideBookings(rides[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching driver rides:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/bookings/driver/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllRequests(data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching all driver requests:', err);
    }
  };

  const fetchRideBookings = async (rideId) => {
    try {
      setSelectedRideForBookings(rideId);
      const res = await fetch(`/api/bookings/ride/${rideId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRideBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching ride bookings:', err);
    }
  };

  const handlePublishRide = async (e) => {
    e.preventDefault();
    setPublishError('');
    setPublishSuccess('');
    setPublishLoading(true);

    const waypointsArray = rideForm.route_waypoints_input
      .split(',')
      .map(w => w.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          origin: rideForm.origin,
          destination: rideForm.destination,
          route_waypoints: waypointsArray,
          departure_date: rideForm.departure_date,
          departure_time: rideForm.departure_time,
          return_time: rideForm.return_time,
          total_seats: Number(rideForm.total_seats),
          price_per_seat: Number(rideForm.price_per_seat),
          notes: rideForm.notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish ride');
      }

      setPublishSuccess('Carpool published to campus ride network!');
      fetchMyRides();
      fetchAllRequests();
      setTimeout(() => {
        setShowPublishForm(false);
        setPublishSuccess('');
      }, 1500);
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleBookingAction = async (bookingId, newStatus) => {
    // Capture previous state for rollback
    const prevRequests = allRequests;
    const prevBookings = rideBookings;
    
    try {
      // Optimistic update
      setAllRequests(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setRideBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));

      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        throw new Error((await res.json()).error || 'Failed to update booking');
      }
      
      fetchAllRequests();
      fetchMyRides();
      if (selectedRideForBookings) fetchRideBookings(selectedRideForBookings);
      
      addToast?.({
        type: newStatus === 'confirmed' ? 'success' : 'info',
        title: newStatus === 'confirmed' ? '✓ Booking Accepted' : '✕ Booking Rejected',
        message: `Booking has been ${newStatus}.`,
        duration: 4000
      });
    } catch (err) {
      // Rollback optimistic update
      setAllRequests(prevRequests);
      setRideBookings(prevBookings);
      addToast?.({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not update booking. Please try again.',
        duration: 5000
      });
      console.error('Failed to update booking status:', err);
    }
  };

  const handleRideComplete = async (rideId) => {
    if (!confirm('Mark this ride as completed? This will notify all passengers and enable rating.')) return;
    try {
      const res = await fetch(`/api/rides/${rideId}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMyRides();
        fetchAllRequests();
        addToast?.({
          type: 'success',
          title: '✓ Ride Completed',
          message: 'Passengers have been notified and can now rate their experience.',
          duration: 5000
        });
      } else {
        const d = await res.json();
        addToast?.({ type: 'error', title: 'Failed', message: d.error || 'Could not complete ride.', duration: 4000 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRideCancel = async (rideId) => {
    if (!confirm('Cancel this ride? All passengers will be notified and their bookings cancelled.')) return;
    try {
      const res = await fetch(`/api/rides/${rideId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMyRides();
        fetchAllRequests();
        addToast?.({
          type: 'info',
          title: 'Ride Cancelled',
          message: 'All passengers have been notified.',
          duration: 5000
        });
      } else {
        const d = await res.json();
        addToast?.({ type: 'error', title: 'Failed', message: d.error || 'Could not cancel ride.', duration: 4000 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sort newest pending requests first
  const pendingRequests = allRequests
    .filter(b => b.status === 'pending')
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner */}
      <OddEvenBadge />

      {/* Driver Verification Status Banner */}
      {!isApprovedDriver ? (
        <div className="rounded-3xl p-6 sm:p-8 border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-600/10 to-transparent backdrop-blur-xl shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-lg">
                {driverStatus === 'pending' ? <Clock className="w-6 h-6 animate-pulse" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-lg text-white">
                    {driverStatus === 'pending'
                      ? 'Driver Verification Pending Admin Review'
                      : 'Driver Verification Required to Offer Rides'}
                  </h3>
                  <span className="badge badge-amber text-[10px] font-bold uppercase">
                    {driverStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {driverStatus === 'pending'
                    ? 'Your driver license and vehicle documents are currently under review by Campus Security. Once approved, you can publish carpools and offer seats.'
                    : 'To ensure campus security and quota compliance, all drivers must submit their Driving License and Vehicle Number Plate for Admin verification.'}
                </p>
                {user?.driver_verification?.admin_comment && (
                  <p className="text-xs font-semibold text-amber-200 mt-2 bg-amber-500/15 p-2.5 rounded-xl border border-amber-500/30 inline-block">
                    💬 Admin Note: {user.driver_verification.admin_comment}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={onOpenVerification}
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{driverStatus === 'pending' ? 'Review Submitted Docs' : 'Submit Driver Verification'}</span>
              </button>

              {user?.system_role === 'admin' && (
                <button
                  onClick={() => switchMode('admin')}
                  className="px-4 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-xs border border-white/10 transition"
                >
                  Admin Approvals ➔
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Approved Driver Glass Banner */
        <div className="rounded-3xl p-6 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-transparent backdrop-blur-xl border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white">Verified Campus Driver (Active)</h3>
                <span className="badge badge-green text-[10px] uppercase font-bold">
                  Approved
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Vehicle: <strong>{user?.driver_verification?.vehicle_model}</strong> | Plate: <span className="font-mono text-blue-300 font-bold">{user?.driver_verification?.vehicle_plate}</span> ({user?.driver_verification?.odd_even_type} Tag)
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowPublishForm(!showPublishForm)}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/35 border border-white/20 flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showPublishForm ? 'Close Form' : 'Publish New Carpool Ride'}</span>
          </button>
        </div>
      )}

      {/* ── PRIORITY TOP PANEL: Pending Booking Requests ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Pending Booking Requests
                {pendingRequests.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/30">
                    {pendingRequests.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Review and approve passenger reservations for your campus carpools
              </p>
            </div>
          </div>

          <button
            onClick={() => { fetchAllRequests(); fetchMyRides(); }}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition border border-white/10 text-xs font-bold flex items-center gap-1.5"
            title="Refresh requests"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 flex items-center justify-between text-slate-400 text-xs backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs">✓</div>
              <span className="text-slate-300 font-medium">No pending booking requests</span>
            </div>
            <span className="text-slate-500 hidden sm:inline">Incoming passenger requests will appear here instantly</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((b) => (
              <div
                key={b.id}
                className="rounded-3xl bg-gradient-to-b from-[#151c2e] to-[#0d1322] border border-amber-500/40 p-5 shadow-xl shadow-amber-950/20 backdrop-blur-xl space-y-4 animate-in"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={b.passenger_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(b.passenger_name || '')}`}
                        alt={b.passenger_name}
                        className="w-11 h-11 rounded-2xl bg-slate-800 border border-amber-500/40 shadow-md"
                      />
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-white text-sm truncate">{b.passenger_name}</h4>
                        <span className="text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 shrink-0">
                          NEW REQUEST
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        ID: {b.student_staff_id || 'Campus Member'} {b.passenger_phone ? `• ${b.passenger_phone}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-black bg-black/50 border border-white/10 px-2.5 py-1 rounded-xl text-amber-400 shrink-0">
                    {b.booking_code}
                  </span>
                </div>

                {/* Ride route & details box */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-200 font-bold">
                    <span className="truncate">{b.origin}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate text-blue-300">{b.destination}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1.5 border-t border-white/5">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Pickup: <strong>{b.pickup_location}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Seats: <strong className="text-amber-300 font-bold">{b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{b.departure_date} • {b.departure_time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{b.price_per_seat > 0 ? `LKR ${b.price_per_seat * b.seats_booked}` : 'Free'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={() => handleBookingAction(b.id, 'confirmed')}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept Request</span>
                  </button>
                  <button
                    onClick={() => handleBookingAction(b.id, 'rejected')}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/30 font-extrabold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject Request</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Publish New Ride Glass Form */}
      {showPublishForm && isApprovedDriver && (
        <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl animate-in">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/[0.08]">
            <div>
              <h3 className="font-black text-white text-lg">Offer a New Carpool to Campus</h3>
              <p className="text-xs text-slate-400 mt-0.5">Post route stops, departure schedule, and passenger seat quota</p>
            </div>
            <button
              onClick={() => setShowPublishForm(false)}
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {publishError && (
            <div className="p-3.5 bg-red-500/15 border border-red-500/30 text-red-200 rounded-xl text-xs flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{publishError}</span>
            </div>
          )}

          {publishSuccess && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 rounded-xl text-xs flex items-center gap-2 mb-4">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{publishSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePublishRide} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  From — Starting Point *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gampaha Town, Negombo, Moratuwa"
                  value={rideForm.origin}
                  onChange={(e) => setRideForm({ ...rideForm, origin: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  To — Destination *
                </label>
                <input
                  type="text"
                  required
                  value={rideForm.destination}
                  onChange={(e) => setRideForm({ ...rideForm, destination: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Route Waypoints / Pickup Stops (Comma-separated) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Miriswatta, Kiribathgoda, Kelaniya, Orugodawatta"
                value={rideForm.route_waypoints_input}
                onChange={(e) => setRideForm({ ...rideForm, route_waypoints_input: e.target.value })}
                className="glass-input"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Passengers along these stops will be able to select their exact boarding spot on the map.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Departure Date *
                </label>
                <input
                  type="date"
                  required
                  value={rideForm.departure_date}
                  onChange={(e) => setRideForm({ ...rideForm, departure_date: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Departure Time *
                </label>
                <input
                  type="time"
                  required
                  value={rideForm.departure_time}
                  onChange={(e) => setRideForm({ ...rideForm, departure_time: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Return Time (Optional)
                </label>
                <input
                  type="time"
                  value={rideForm.return_time}
                  onChange={(e) => setRideForm({ ...rideForm, return_time: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Available Passenger Seats *
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  required
                  value={rideForm.total_seats}
                  onChange={(e) => setRideForm({ ...rideForm, total_seats: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Fuel Share Price Per Seat (LKR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 300 (0 for free)"
                  value={rideForm.price_per_seat}
                  onChange={(e) => setRideForm({ ...rideForm, price_per_seat: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Trip Notes / Commute Guidelines
              </label>
              <textarea
                rows="2"
                placeholder="e.g. Air-conditioned vehicle. Departure punctual at 7:30 sharp."
                value={rideForm.notes}
                onChange={(e) => setRideForm({ ...rideForm, notes: e.target.value })}
                className="glass-input resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowPublishForm(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={publishLoading}
                className="btn-primary text-xs"
              >
                {publishLoading ? 'Publishing...' : 'Publish Carpool Ride'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Driver Rides & Incoming Passenger Bookings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Driver's Offered Rides */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white text-base">Your Published Carpools ({myRides.length})</h3>
            <span className="text-xs text-slate-400">Click a ride to review requests</span>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-white/[0.03] p-10 border border-white/10 text-center text-xs text-slate-400 backdrop-blur-xl">
              Loading rides...
            </div>
          ) : myRides.length === 0 ? (
            <div className="rounded-3xl bg-white/[0.03] p-10 border border-white/10 text-center space-y-3 backdrop-blur-xl">
              <Car className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-xs font-bold text-slate-300">No carpool rides published yet</p>
              {isApprovedDriver ? (
                <button
                  onClick={() => setShowPublishForm(true)}
                  className="btn-primary text-xs px-4 py-2"
                >
                  Publish Your First Ride
                </button>
              ) : (
                <p className="text-xs text-amber-300">Complete Admin verification to start offering carpool trips.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {myRides.map((ride) => (
                <div
                  key={ride.id}
                  onClick={() => fetchRideBookings(ride.id)}
                  className={`rounded-3xl p-5 border backdrop-blur-xl transition-all cursor-pointer ${
                    selectedRideForBookings === ride.id
                      ? 'bg-white/[0.08] border-blue-500/80 ring-1 ring-blue-400/40 shadow-lg'
                      : 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.07] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        ride.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        ride.status === 'completed' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {ride.status}
                      </span>
                      <h4 className="font-extrabold text-white text-base mt-2">{ride.origin} ➔ {ride.destination}</h4>
                    </div>
                    <span className="font-black text-sm text-blue-400">
                      {ride.price_per_seat > 0 ? `LKR ${ride.price_per_seat} / seat` : 'Free'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300 border-t border-white/[0.06] pt-3">
                    <span>{ride.departure_date} at <strong>{ride.departure_time}</strong></span>
                    <span className="font-bold text-slate-200">
                      {ride.available_seats} of {ride.total_seats} seats free
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{ride.confirmed_passengers_count || 0} Confirmed</span>
                      </span>
                      {Number(ride.pending_requests_count || 0) > 0 && (
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{ride.pending_requests_count} Pending Request{Number(ride.pending_requests_count) !== 1 ? 's' : ''}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSosRide(ride); }}
                        className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold flex items-center gap-1 border border-red-500/30 transition"
                      >
                        <Siren className="w-3.5 h-3.5" />
                        <span>SOS</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatRide({ id: ride.id, origin: ride.origin, destination: ride.destination, driver_name: user?.name, departure_time: ride.departure_time });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-blue-600/30 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                      {ride.status === 'active' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRideComplete(ride.id); }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition border border-emerald-500/30"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRideCancel(ride.id); }}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 text-xs font-bold flex items-center gap-1 transition border border-red-500/20"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel Ride</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Bookings for Selected Ride */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white text-base">
              Passenger Seat Bookings ({rideBookings.length})
            </h3>
            <span className="text-xs text-slate-400">Review & Manage Requests</span>
          </div>

          {!selectedRideForBookings ? (
            <div className="rounded-3xl bg-white/[0.03] p-10 border border-white/10 text-center text-xs text-slate-400 backdrop-blur-xl">
              Select a carpool on the left to review booked passengers and pending requests.
            </div>
          ) : rideBookings.length === 0 ? (
            <div className="rounded-3xl bg-white/[0.03] p-10 border border-white/10 text-center space-y-2 backdrop-blur-xl">
              <Users className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs font-bold text-slate-300">No Passenger Reservations Yet</p>
              <p className="text-[11px] text-slate-500">
                Your ride is live on the campus commuter radar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rideBookings.map((b) => (
                <div key={b.id} className="rounded-3xl bg-white/[0.04] p-5 border border-white/10 shadow-lg space-y-3 backdrop-blur-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={b.passenger_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(b.passenger_name)}`}
                        alt={b.passenger_name}
                        className="w-10 h-10 rounded-2xl bg-slate-800 border border-white/15"
                      />
                      <div>
                        <h4 className="font-bold text-white text-sm">{b.passenger_name}</h4>
                        <span className="text-[11px] text-slate-400">ID: {b.student_staff_id || 'Student'} | {b.passenger_phone || 'Phone'}</span>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-black bg-black/40 border border-white/10 px-2.5 py-1 rounded-xl text-blue-400">
                      {b.booking_code}
                    </span>
                  </div>

                  <div className="bg-black/20 p-3 rounded-2xl border border-white/5 text-xs space-y-1 text-slate-300">
                    <p><strong>Pickup Spot:</strong> {b.pickup_location}</p>
                    <p><strong>Seats Requested:</strong> <span className="font-bold text-amber-300 ml-1">{b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''}</span></p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
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

                    {b.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBookingAction(b.id, 'confirmed')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/30 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleBookingAction(b.id, 'rejected')}
                          className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-xl transition border border-red-500/30 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Real-time Chat Drawer */}
      <ChatDrawer
        ride={chatRide}
        isOpen={Boolean(chatRide)}
        onClose={() => setChatRide(null)}
      />

      {/* Emergency SOS Modal */}
      <SOSAlertModal
        ride={sosRide}
        isOpen={Boolean(sosRide)}
        onClose={() => setSosRide(null)}
      />

      {/* Odd/Even Fuel Schedule */}
      <OddEvenScheduleModal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />

    </div>
  );
}
