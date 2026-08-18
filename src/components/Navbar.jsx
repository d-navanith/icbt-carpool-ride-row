import React, { useState } from 'react';
import {
  Car, Users, Shield, ShieldCheck, Clock, LogOut, User,
  Fuel, Menu, X, ChevronRight, Sparkles, Bell, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import OddEvenScheduleModal from './OddEvenScheduleModal';
import Logo from './Logo';

export default function TopNavbar({ onOpenDriverVerification, onOpenProfile }) {
  const { user, logout, activeMode, switchMode, isApprovedDriver, driverStatus, isAdmin } = useAuth();
  const { notifications = [], markAllNotificationsAsRead } = useSocket() || {};
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    {
      id: 'passenger',
      icon: Users,
      label: 'Passenger',
      show: true,
    },
    {
      id: 'driver',
      icon: Car,
      label: 'Driver',
      show: true,
      badge: isApprovedDriver ? '✓' : driverStatus === 'pending' ? '…' : null
    },
    {
      id: 'admin',
      icon: Shield,
      label: 'Admin Control',
      show: isAdmin,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#0b0f19]/90 backdrop-blur-2xl border-b border-white/[0.08] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between gap-4">
          
          {/* Left: Brand Logo */}
          <Logo size="md" subtitle="Campus Transit" />

          {/* Center: Desktop Nav Switcher */}
          <nav className="hidden md:flex items-center p-1 rounded-2xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-xl">
            {navItems.filter(n => n.show).map(({ id, icon: Icon, label, badge }) => {
              const active = activeMode === id;
              return (
                <button
                  key={id}
                  onClick={() => switchMode(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 border border-white/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                      badge === '✓' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Tools & User Profile & Log Out */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  if (!notifOpen && unreadCount > 0) {
                    markAllNotificationsAsRead?.();
                  }
                }}
                className={`relative p-2.5 rounded-xl border transition ${
                  unreadCount > 0
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-md shadow-amber-950/30'
                    : 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.1]'
                }`}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-3xl bg-[#0e1424]/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 space-y-3 z-50 text-white animate-in">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span className="font-extrabold text-sm">Notifications</span>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => markAllNotificationsAsRead?.()}
                        className="text-[10px] text-slate-400 hover:text-blue-300 font-bold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-slate-500 mx-auto" />
                      <p>No new notifications</p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setNotifOpen(false);
                            if (n.type === 'booking_request') switchMode('driver');
                            if (n.type === 'booking_status') switchMode('passenger');
                          }}
                          className={`p-3 rounded-2xl border text-xs cursor-pointer transition ${
                            n.type === 'booking_request'
                              ? 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/20'
                              : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-white leading-tight">{n.title}</span>
                            <span className="text-[9px] text-slate-400 shrink-0">Just now</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-snug">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isApprovedDriver && (
                    <button
                      onClick={() => {
                        setNotifOpen(false);
                        switchMode('driver');
                      }}
                      className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition text-center shadow-md shadow-blue-600/30"
                    >
                      View All Driver Requests ➔
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Fuel Schedule */}
            <button
              onClick={() => setScheduleOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 hover:text-amber-200 text-xs font-bold border border-amber-500/20 transition"
              title="View Fuel Quota Calendar"
            >
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span>Fuel Quota</span>
            </button>

            {/* Driver Register / Status */}
            {!isAdmin && (
              <button
                onClick={onOpenDriverVerification}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  isApprovedDriver
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                    : driverStatus === 'pending'
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border-white/10'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isApprovedDriver ? 'Verified Driver' : driverStatus === 'pending' ? 'Driver Pending' : 'Become Driver'}</span>
              </button>
            )}

            {/* Profile Avatar & Name */}
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-left transition"
              title="Edit Profile"
            >
              <div className="relative shrink-0">
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user?.name || '')}`}
                  alt="avatar"
                  className="w-8 h-8 rounded-xl bg-slate-800 border border-white/15"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0b0f19]" />
              </div>
              <div className="min-w-0 pr-1">
                <span className="block text-xs font-extrabold text-white truncate max-w-[110px] leading-tight">
                  {user?.name}
                </span>
                <span className="block text-[10px] text-slate-400 truncate capitalize">
                  {user?.role || 'Student'}
                </span>
              </div>
            </button>

            {/* Prominent Log Out Button */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 text-xs font-extrabold border border-red-500/30 shadow-md shadow-red-950/20 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={logout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-300 text-xs font-bold border border-red-500/30"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/[0.08] bg-[#0b0f19]/95 backdrop-blur-2xl p-4 space-y-3 animate-in">
            {/* User Details */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.05] border border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user?.name || '')}`}
                  alt="avatar"
                  className="w-9 h-9 rounded-xl bg-slate-800 border border-white/15"
                />
                <div>
                  <span className="block text-xs font-bold text-white">{user?.name}</span>
                  <span className="block text-[10px] text-slate-400 capitalize">{user?.role || 'Student'}</span>
                </div>
              </div>

              <button
                onClick={() => { onOpenProfile?.(); setMobileMenuOpen(false); }}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Profile
              </button>
            </div>

            {/* Portal Switcher */}
            <div className="grid grid-cols-2 gap-2">
              {navItems.filter(n => n.show).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => { switchMode(id); setMobileMenuOpen(false); }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-bold transition ${
                    activeMode === id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Utility Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setScheduleOpen(true); setMobileMenuOpen(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-bold border border-amber-500/30"
              >
                <Fuel className="w-3.5 h-3.5" />
                <span>Fuel Quota</span>
              </button>
              
              {!isAdmin && (
                <button
                  onClick={() => { onOpenDriverVerification?.(); setMobileMenuOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-bold border border-emerald-500/30"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isApprovedDriver ? 'Verified' : 'Drive'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <OddEvenScheduleModal isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </>
  );
}
