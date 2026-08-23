import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function AdminLoginPage() {
  const { adminLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminLogin(email, password);
    } catch (err) {
      setError(err.message || 'Administrator authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#0b0f19] overflow-hidden">
      <div className="absolute top-[-10%] right-[-8%] w-[540px] h-[540px] rounded-full bg-gradient-to-br from-indigo-600/25 to-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-12%] left-[-8%] w-[560px] h-[560px] rounded-full bg-gradient-to-tr from-blue-700/20 to-purple-600/10 blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg rounded-3xl backdrop-blur-2xl bg-white/[0.04] border border-white/[0.12] shadow-[0_20px_70px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <Logo size="md" subtitle="Administrator Portal" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-400/30 text-purple-300 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="mb-7">
            <p className="text-[10px] uppercase tracking-[0.22em] font-black text-purple-300 mb-2">Restricted Access</p>
            <h1 className="text-3xl font-black text-white tracking-tight">Campus Admin Sign In</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              This portal is reserved for authorised ICBT administrators. Driver and passenger accounts must use the standard Ride Row login.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Administrator Email</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@icbt.edu.lk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Administrator Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl py-3 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3.5 text-slate-400 hover:text-white transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-extrabold shadow-lg shadow-indigo-600/30 border border-white/20 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Enter Admin Portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => window.location.assign('/login')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.05] transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to User Portal
          </button>

          <div className="mt-7 pt-5 border-t border-white/[0.08]">
            <p className="text-[11px] text-slate-500 text-center">
              Administrator access is authenticated separately from passenger and driver accounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
