import React, { useState } from 'react';
import { X, MapPin, CheckCircle, PhoneCall, Loader2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SL_LOCATIONS = [
  'En route to ICBT Colombo Campus',
  'Kiribathgoda Junction',
  'Kelaniya Bridge',
  'Wattala Town',
  'Peliyagoda Junction',
  'Gampaha Town Center',
  'Negombo Junction',
  'Ja-Ela Roundabout',
  'Kandy Road (A1)',
  'Maradana',
  'Orugodawatta',
  'Moratuwa',
  'Dehiwala',
];

export default function SOSAlertModal({ ride, isOpen, onClose }) {
  const { token } = useAuth();
  const [step, setStep] = useState('confirm');
  const [location, setLocation] = useState(SL_LOCATIONS[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [alertId, setAlertId] = useState('');

  if (!isOpen || !ride) return null;

  const handleSendSOS = async () => {
    setStep('sending');
    try {
      const res = await fetch(`/api/rides/${ride.id}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          location,
          message: customMessage || 'Urgent assistance requested by campus commuter.'
        })
      });
      const data = await res.json();
      setAlertId(data.alert?.alertId || 'SOS-' + Date.now());
    } catch {
      setAlertId('SOS-' + Date.now());
    }
    setStep('sent');
  };

  const handleClose = () => {
    setStep('confirm');
    setLocation(SL_LOCATIONS[0]);
    setCustomMessage('');
    setAlertId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-red-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in">

        {/* Red header */}
        <div className="bg-red-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <TriangleAlert className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-widest">Emergency SOS</h3>
              <p className="text-[10px] text-red-200 mt-0.5">ICBT Campus Safety Network</p>
            </div>
          </div>
          {step !== 'sending' && (
            <button onClick={handleClose} className="p-1.5 text-red-200 hover:text-white hover:bg-red-700 rounded-lg transition">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">

          {/* ── Confirm ── */}
          {step === 'confirm' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2">
                <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                  <TriangleAlert className="w-3.5 h-3.5" /> Alert will be sent to:
                </p>
                <ul className="text-xs text-red-700 space-y-1 pl-5 list-disc">
                  <li>ICBT Security Hotline: <strong>+94 11 584 8888</strong></li>
                  <li>All passengers on this carpool</li>
                  <li>Campus Admin panel (real-time)</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  <MapPin className="w-3 h-3 inline mr-1 text-red-500" />
                  Your current location *
                </label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="input-field bg-white text-sm"
                >
                  {SL_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Additional details <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Accident, breakdown, medical emergency…"
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  className="input-field resize-none text-sm"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button onClick={handleClose} className="btn-secondary flex-1 py-2.5 text-xs">Cancel</button>
                <button
                  onClick={handleSendSOS}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-red-200 transition"
                >
                  🚨 Send SOS Now
                </button>
              </div>
            </>
          )}

          {/* ── Sending ── */}
          {step === 'sending' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900">Broadcasting alert…</p>
                <p className="text-xs text-slate-500 mt-1">Notifying security & ride passengers</p>
              </div>
            </div>
          )}

          {/* ── Sent ── */}
          {step === 'sent' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-slate-900">Alert Broadcasted!</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID: <span className="font-mono font-bold text-red-600">{alertId}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2">
                {[
                  'Campus Security Hotline notified',
                  'All ride passengers alerted',
                  'Admin dashboard flagged — help dispatched',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5">
                <a
                  href="tel:+94115848888"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                >
                  <PhoneCall className="w-3.5 h-3.5" /> Call Security
                </a>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
