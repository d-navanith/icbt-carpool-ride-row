import React, { useState } from 'react';
import {
  Car, ShieldCheck, Fuel, Users, ArrowRight, Lock,
  Mail, Phone, User, Check, AlertCircle, Sparkles, Key, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    student_staff_id: '',
    phone: '',
    emergency_contact: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Quick fill helper for demonstration
  const handleQuickFill = (email, password) => {
    setFormData(prev => ({ ...prev, email, password }));
    setIsLogin(true);
    setError('');
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#0b0f19] overflow-hidden">

      {/* ── Ambient Glowing Orbs Background (Glassmorphism Effect) ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-600/25 to-blue-600/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-600/25 via-cyan-500/20 to-teal-400/15 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[350px] h-[350px] rounded-full bg-purple-600/15 blur-[120px] pointer-events-none" />

      {/* Subtle Grid Lines */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '36px 36px'
        }}
      />

      {/* ── Main Glassmorphism Container ── */}
      <div className="relative z-10 w-full max-w-5xl rounded-3xl backdrop-blur-2xl bg-white/[0.04] border border-white/[0.12] shadow-[0_20px_70px_rgba(0,0,0,0.55)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 animate-in">

        {/* ── Left Column: Brand Showcase ── */}
        <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
          
          <div>
            {/* Logo Badge */}
            <Logo size="lg" subtitle="Campus Carpool Network" className="mb-8" />

            {/* Main Headline */}
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-snug tracking-tight mb-3">
              Smart, verified & affordable <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">campus rides.</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed mb-8">
              Daily university transit synchronized with Sri Lanka Odd/Even fuel quotas for campus students and academic staff.
            </p>

            {/* Glass Feature Cards */}
            <div className="space-y-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Admin-Verified Drivers',
                  desc: 'Vetted with campus registry & driving license',
                  glow: 'from-blue-500/20 to-blue-600/5'
                },
                {
                  icon: Fuel,
                  title: 'Odd/Even Fuel Quota Matching',
                  desc: 'Save up to 40% monthly commute expenses',
                  glow: 'from-amber-500/20 to-amber-600/5'
                },
                {
                  icon: Users,
                  title: 'Live Seat Booking & Chat',
                  desc: 'Boarding passes, in-app messaging & SOS safety',
                  glow: 'from-emerald-500/20 to-emerald-600/5'
                }
              ].map(({ icon: Icon, title, desc, glow }) => (
                <div
                  key={title}
                  className={`flex items-start gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r ${glow} border border-white/[0.08] backdrop-blur-md`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/[0.1] flex items-center justify-center shrink-0 border border-white/15">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">{title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Demo Accounts Pill */}
          <div className="mt-8 pt-6 border-t border-white/[0.08]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              ⚡ Quick Demo Logins:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('kamal.driver@icbt.edu.lk', 'driver123')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition"
              >
                Verified Driver
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('nimal.student@icbt.edu.lk', 'student123')}
                className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-bold border border-blue-500/30 transition"
              >
                Student
              </button>
            </div>
          </div>

        </div>

        {/* ── Right Column: Glassmorphic Auth Form ── */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center bg-white/[0.02] backdrop-blur-3xl">
          
          <div className="max-w-md w-full mx-auto space-y-6">

            {/* Header */}
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isLogin ? 'Welcome Back' : 'Create Campus Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isLogin
                  ? 'Sign in to access your carpool routes, bookings & driver console.'
                  : 'Join the verified Ride Row carpooling & fuel-share network.'}
              </p>
            </div>

            {/* Segmented Switcher */}
            <div className="flex p-1 rounded-2xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isLogin
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  !isLogin
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center gap-2.5 animate-in">
                <Lock className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {!isLogin && (
                <>
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
                        placeholder="Kasun Bandara"
                        value={formData.name}
                        onChange={update('name')}
                        className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                      />
                    </div>
                  </div>

                  {/* Role & ID Number Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        University Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={update('role')}
                        className="w-full bg-slate-900 border border-white/[0.12] rounded-xl py-3 px-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Academic / Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        ID Number
                      </label>
                      <input
                        type="text"
                        placeholder="ICBT-ST-2024-01"
                        value={formData.student_staff_id}
                        onChange={update('student_staff_id')}
                        className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Contact Phone
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="+94 77 123 4567"
                        value={formData.phone}
                        onChange={update('phone')}
                        className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* University Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  University Email *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="you@icbt.edu.lk"
                    value={formData.email}
                    onChange={update('email')}
                    className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center justify-center text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={update('password')}
                    className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-extrabold shadow-lg shadow-blue-600/35 border border-white/20 transition-all duration-150 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Authenticating…
                  </span>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In to Dashboard' : 'Create Student Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

            <p className="text-center text-[11px] text-slate-500">
              Administrative access is provided through the dedicated Campus Admin Portal.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}
