import React, { useState } from 'react';
import { ShieldCheck, Car, FileText, Upload, AlertTriangle, CheckCircle, Clock, X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DriverVerificationModal({ isOpen, onClose }) {
  const { user, submitDriverVerification, refreshProfile } = useAuth();

  const [formData, setFormData] = useState({
    license_number: user?.driver_verification?.license_number || '',
    vehicle_model: user?.driver_verification?.vehicle_model || '',
    vehicle_plate: user?.driver_verification?.vehicle_plate || '',
    seats: user?.driver_verification?.seats || 3,
    fuel_type: user?.driver_verification?.fuel_type || 'Petrol',
    license_doc_url: user?.driver_verification?.license_doc_url || '',
    vehicle_photo_url: user?.driver_verification?.vehicle_photo_url || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Real-time calculation of Odd/Even
  const getCalculatedTag = (plate) => {
    const nums = (plate || '').replace(/\D/g, '');
    if (!nums) return '—';
    const lastDigit = parseInt(nums.slice(-1), 10);
    return lastDigit % 2 === 0 ? 'EVEN' : 'ODD';
  };

  const currentTag = getCalculatedTag(formData.vehicle_plate);
  const existingStatus = user?.driver_verification?.status;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await submitDriverVerification(formData);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to submit verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="rounded-3xl bg-[#0b0f19]/95 border border-white/20 shadow-2xl max-w-lg w-full overflow-hidden animate-in text-white">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 border border-white/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white leading-tight">Driver & Vehicle Verification</h3>
              <p className="text-xs text-slate-400">Required by Campus Security to publish university carpools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.1] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status alert */}
        {existingStatus === 'pending' && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-3.5 flex items-center gap-3 text-amber-200 text-xs">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold">Application Under Admin Review</span>
              <p className="text-slate-300 text-[11px] mt-0.5">Your credentials are being audited by Campus Security. Once approved, you can offer rides.</p>
            </div>
          </div>
        )}

        {existingStatus === 'approved' && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-3.5 flex items-center gap-3 text-emerald-200 text-xs">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">Verified Driver Account</span>
              <p className="text-slate-300 text-[11px] mt-0.5">Your driving license and vehicle registration are verified by Campus Administration.</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 rounded-2xl text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Verification submitted! Awaiting Admin approval.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Driving License Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. B-9876543-LK"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                className="glass-input text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Vehicle Plate Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WP-CBH-4521"
                value={formData.vehicle_plate}
                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })}
                className="glass-input text-xs font-mono uppercase font-bold text-blue-300"
              />
            </div>
          </div>

          {/* Odd/Even Quota Live Tag */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-300 font-bold block">Sri Lanka Odd/Even Plate Quota Tag:</span>
              <p className="text-slate-500 text-[11px]">Calculated automatically from your plate's last digit</p>
            </div>
            <span className={`badge text-xs font-black ${
              currentTag === 'ODD' ? 'badge-amber' :
              currentTag === 'EVEN' ? 'badge-blue' : 'badge-slate'
            }`}>
              {currentTag} PLATE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Vehicle Make & Model *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Toyota Aqua / Suzuki Alto"
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                className="glass-input text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Fuel Powertrain
              </label>
              <select
                value={formData.fuel_type}
                onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                className="w-full bg-slate-900 border border-white/15 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Petrol">Petrol</option>
                <option value="Hybrid">Hybrid (Petrol)</option>
                <option value="Electric">Electric (EV)</option>
                <option value="Diesel">Diesel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Passenger Seats (Excluding Driver)
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={formData.seats}
                onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                className="glass-input text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                License Photo / Link
              </label>
              <input
                type="text"
                placeholder="License photo link (optional)"
                value={formData.license_doc_url}
                onChange={(e) => setFormData({ ...formData, license_doc_url: e.target.value })}
                className="glass-input text-xs"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Once submitted, the ICBT Security & Admin Office will verify your vehicle registration against the campus permit database.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-2.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs px-5 py-2.5"
            >
              {loading ? 'Submitting...' : existingStatus === 'pending' ? 'Update Documents' : 'Submit for Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
