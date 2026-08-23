import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, IdCard, Car, Star, ShieldCheck,
  Clock, Edit3, Check, X, Fuel, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, Leaf, Trophy, Save, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const renderStars = (rating) =>
  Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
  ));

export default function ProfilePage({ onClose }) {
  const { user, token, isApprovedDriver, driverStatus, updateProfile } = useAuth();

  // Stats
  const [reviews, setReviews] = useState([]);
  const [myRidesCount, setMyRidesCount] = useState(0);
  const [myBookingsCount, setMyBookingsCount] = useState(0);
  const [avgRating, setAvgRating] = useState(null);

  // Tabs: 'overview' | 'edit' | 'password' | 'reviews'
  const [tab, setTab] = useState('overview');

  // Edit form
  const [editForm, setEditForm] = useState({ name: '', phone: '', student_staff_id: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Password form
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    if (!token || !user) return;
    fetchStats();
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      student_staff_id: user.student_staff_id || ''
    });
  }, [token, user]);

  const fetchStats = async () => {
    try {
      const h = { Authorization: `Bearer ${token}` };
      const [revRes, ridesRes, bookRes] = await Promise.all([
        fetch(`/api/reviews/user/${user.id}`, { headers: h }),
        fetch('/api/rides/my-rides', { headers: h }),
        fetch('/api/bookings/my-bookings', { headers: h })
      ]);
      if (revRes.ok)   { const d = await revRes.json();   setAvgRating(d.avgRating); setReviews(d.reviews || []); }
      if (ridesRes.ok) { const d = await ridesRes.json(); setMyRidesCount((d.rides || []).length); }
      if (bookRes.ok)  { const d = await bookRes.json();  setMyBookingsCount((d.bookings || []).length); }
    } catch (err) { console.error(err); }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditError(''); setEditSuccess('');
    if (!editForm.name.trim()) { setEditError('Name cannot be empty.'); return; }
    setEditLoading(true);
    try {
      await updateProfile({ name: editForm.name.trim(), phone: editForm.phone, student_staff_id: editForm.student_staff_id });
      setEditSuccess('Profile updated successfully!');
      setTimeout(() => setEditSuccess(''), 3000);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.new_password !== pwForm.confirm_password) { setPwError('New passwords do not match.'); return; }
    if (pwForm.new_password.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    setPwLoading(true);
    try {
      await updateProfile({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwSuccess('Password changed successfully!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user?.name || 'User')}`;

  const roleLabel = isApprovedDriver ? 'Verified Driver' : driverStatus === 'pending' ? 'Pending Review' : 'Campus Passenger';
  const roleClass = isApprovedDriver ? 'badge-green' : driverStatus === 'pending' ? 'badge-amber' : 'badge-blue';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'edit',     label: 'Edit Profile' },
    { id: 'password', label: 'Password' },
    { id: 'reviews',  label: `Reviews${reviews.length ? ` (${reviews.length})` : ''}` },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="rounded-3xl bg-[#0b0f19]/95 border border-white/20 shadow-2xl max-w-xl w-full overflow-hidden animate-in my-4 sm:my-0 text-white">

        {/* Glass Header */}
        <div className="p-6 sm:p-7 border-b border-white/[0.08] relative bg-gradient-to-b from-white/[0.05] to-transparent">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-white/[0.1] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt={user?.name}
                className="w-20 h-20 rounded-2xl border-2 border-white/20 bg-slate-800 shadow-xl"
              />
              {isApprovedDriver && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-[#0b0f19] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-slate-950 font-black" />
                </div>
              )}
            </div>

            {/* Name + role */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-black text-white leading-tight">{user?.name || 'Campus User'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
              <div className="mt-2.5 flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <span className={`badge ${roleClass}`}>
                  {isApprovedDriver ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  {roleLabel}
                </span>
                <span className="badge badge-slate capitalize font-bold">{user?.role || 'Student'}</span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex sm:flex-col gap-5 sm:gap-2 text-center bg-white/[0.04] p-3 rounded-2xl border border-white/10 shrink-0">
              {avgRating !== null && (
                <div>
                  <div className="text-lg font-black text-amber-400 tabular-nums">{Number(avgRating).toFixed(1)}★</div>
                  <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Rating</div>
                </div>
              )}
              {isApprovedDriver && (
                <div>
                  <div className="text-lg font-black text-white tabular-nums">{myRidesCount}</div>
                  <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Rides</div>
                </div>
              )}
              <div>
                <div className="text-lg font-black text-blue-400 tabular-nums">{myBookingsCount}</div>
                <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Bookings</div>
              </div>
            </div>
          </div>

          {/* Segmented Glass Tab Bar */}
          <div className="flex p-1 rounded-2xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-xl">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 border border-blue-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Info rows */}
              <div>
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Personal Credentials</h3>
                <div className="space-y-2">
                  {[
                    { icon: User,   label: 'Full Name',       value: user?.name },
                    { icon: Mail,   label: 'University Email', value: user?.email },
                    { icon: Phone,  label: 'Phone Contact',   value: user?.phone || 'Not provided' },
                    { icon: IdCard, label: 'Student / Staff ID', value: user?.student_staff_id || 'Not assigned' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3.5 p-3.5 bg-white/[0.04] rounded-2xl border border-white/10">
                      <div className="w-8 h-8 rounded-xl bg-white/[0.07] border border-white/10 text-slate-300 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
                        <span className="text-xs font-bold text-white truncate block mt-0.5">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Driver profile */}
              {(isApprovedDriver || driverStatus) && (
                <div>
                  <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Vehicle Profile</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { icon: Car,        label: 'Vehicle',      value: user?.vehicle_desc || user?.vehicle_model || '—' },
                      { icon: IdCard,     label: 'Plate Number', value: user?.vehicle_plate || '—' },
                      { icon: Fuel,       label: 'Quota Tag',    value: user?.vehicle_plate ? (parseInt(user.vehicle_plate.replace(/\D/g, '').slice(-1)) % 2 !== 0 ? 'ODD Quota' : 'EVEN Quota') : '—' },
                      { icon: ShieldCheck, label: 'Audit Status', value: driverStatus === 'approved' ? '✓ Verified' : driverStatus === 'pending' ? 'Pending Review' : 'Unverified' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="p-3.5 bg-white/[0.04] rounded-2xl border border-white/10">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Icon className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                        </div>
                        <span className="text-xs font-extrabold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Achievements */}
              <div>
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Badges & Commute Milestones</h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { emoji: '🌿', label: 'Eco Commuter',   earned: myBookingsCount >= 1 },
                    { emoji: '⛽', label: 'Fuel Saver',     earned: myBookingsCount >= 2 },
                    { emoji: '🏅', label: 'First Ride',     earned: myBookingsCount >= 1 || myRidesCount >= 1 },
                    { emoji: '⭐', label: 'Top Rated',      earned: avgRating >= 4.5 },
                    { emoji: '🚗', label: 'Campus Driver',  earned: isApprovedDriver },
                    { emoji: '🎓', label: 'Ride Row Member', earned: true },
                  ].map(({ emoji, label, earned }) => (
                    <div key={label} className={`p-3 rounded-2xl border text-center transition ${earned ? 'bg-white/[0.08] border-blue-500/40 shadow-sm' : 'bg-white/[0.02] border-white/5 opacity-40'}`}>
                      <div className="text-xl mb-1">{emoji}</div>
                      <div className={`text-[10px] font-bold ${earned ? 'text-white' : 'text-slate-500'}`}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setTab('edit')}
                className="btn-primary w-full py-3 text-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile Details</span>
              </button>
            </div>
          )}

          {/* ── EDIT PROFILE (CRYSTAL CLEAR HIGH CONTRAST INPUTS) ── */}
          {tab === 'edit' && (
            <form onSubmit={handleEditSave} className="space-y-4">
              <p className="text-xs text-slate-400">
                Update your display name, phone number, and campus student ID. University email is locked to your ICBT identity.
              </p>

              {editError && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-2xl text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    name="name"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your Full Name"
                    className="w-full bg-white/[0.08] border border-white/[0.15] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                  />
                </div>
              </div>

              {/* Email (Disabled / Read-only) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  University Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center justify-center text-slate-500 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Campus email address cannot be modified.</span>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="phone"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+94 77 123 4567"
                    className="w-full bg-white/[0.08] border border-white/[0.15] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                  />
                </div>
              </div>

              {/* Student / Staff ID */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Student / Staff ID Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                    <IdCard className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="student_staff_id"
                    value={editForm.student_staff_id}
                    onChange={e => setEditForm(f => ({ ...f, student_staff_id: e.target.value }))}
                    placeholder="ICBT-ST-2024-001"
                    className="w-full bg-white/[0.08] border border-white/[0.15] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTab('overview')}
                  className="btn-secondary flex-1 py-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="btn-primary flex-1 py-3 text-xs"
                >
                  {editLoading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Save Changes</>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── CHANGE PASSWORD ── */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your current password, then specify a new password (minimum 6 characters).
              </p>

              {pwError && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-2xl text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{pwError}</span>
                </div>
              )}
              {pwSuccess && (
                <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{pwSuccess}</span>
                </div>
              )}

              {[
                { key: 'current', label: 'Current Password', field: 'current_password' },
                { key: 'new',     label: 'New Password',     field: 'new_password' },
                { key: 'confirm', label: 'Confirm New Password', field: 'confirm_password' },
              ].map(({ key, label, field }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {label} *
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      value={pwForm[field]}
                      onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder="••••••••"
                      required
                      className="w-full bg-white/[0.08] border border-white/[0.15] rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-3.5 text-slate-400 hover:text-white transition"
                    >
                      {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Password strength indicator */}
              {pwForm.new_password && (
                <div className="space-y-1">
                  <div className="flex gap-1.5">
                    {[6, 8, 12].map(len => (
                      <div
                        key={len}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          pwForm.new_password.length >= len ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {pwForm.new_password.length < 6 ? 'Too short' : pwForm.new_password.length < 8 ? 'Weak' : pwForm.new_password.length < 12 ? 'Good' : 'Strong'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTab('overview')}
                  className="btn-secondary flex-1 py-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="btn-primary flex-1 py-3 text-xs"
                >
                  {pwLoading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating…
                    </span>
                  ) : (
                    <><Lock className="w-3.5 h-3.5" /> Update Password</>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── REVIEWS ── */}
          {tab === 'reviews' && (
            <div className="space-y-3">
              {avgRating !== null && (
                <div className="bg-white/[0.05] p-5 rounded-3xl border border-white/10 flex items-center justify-between shadow-lg">
                  <div>
                    <div className="text-3xl font-black text-white tabular-nums">{Number(avgRating).toFixed(1)}★</div>
                    <div className="flex items-center gap-1 mt-1.5">{renderStars(avgRating)}</div>
                    <div className="text-xs text-slate-400 mt-1">{reviews.length} passenger review{reviews.length !== 1 ? 's' : ''}</div>
                  </div>
                  <Star className="w-12 h-12 text-amber-400 fill-amber-400 opacity-25" />
                </div>
              )}

              {reviews.length === 0 ? (
                <div className="text-center py-12 space-y-2 bg-white/[0.02] rounded-3xl border border-white/5">
                  <Star className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-300">No commuter reviews yet</p>
                  <p className="text-[11px] text-slate-500">Complete university carpool trips to build your campus rating</p>
                </div>
              ) : (
                reviews.map((r, i) => (
                  <div key={i} className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {renderStars(r.rating)}
                        <span className="text-xs font-extrabold text-white ml-1.5">{r.rating}/5</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{r.created_at?.split('T')[0]}</span>
                    </div>
                    {r.comment && <p className="text-xs text-slate-300 leading-relaxed">"{r.comment}"</p>}
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">— Verified Campus Commuter</p>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
