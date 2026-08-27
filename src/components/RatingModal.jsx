import React, { useState } from 'react';
import { Star, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function RatingModal({ booking, isOpen, onClose, onReviewSubmitted }) {
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !booking) return null;

  const displayRating = hoverRating || rating;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ride_id: booking.ride_id, reviewee_id: booking.driver_id || 2, rating, comment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review');
      setSuccess(true);
      onReviewSubmitted?.();
      setTimeout(() => { setSuccess(false); onClose(); }, 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl">
      <div className="rounded-3xl bg-[#0b0f19]/95 border border-white/20 shadow-2xl w-full max-w-sm overflow-hidden animate-in text-white">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.04]">
          <div>
            <h3 className="font-black text-white text-base">Rate Driver Performance</h3>
            <p className="text-xs text-slate-400 mt-0.5">Driver: {booking.driver_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.1] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-2xl text-xs text-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Commuter rating recorded — thank you!</span>
            </div>
          )}

          {/* Driver avatar */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(booking.driver_name || '')}`}
              alt={booking.driver_name}
              className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-lg bg-slate-800"
            />
            <p className="font-extrabold text-white text-sm">{booking.driver_name}</p>
            <p className="text-xs text-slate-400">{booking.origin} → {booking.destination}</p>
          </div>

          {/* Star picker */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      displayRating >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {LABELS[displayRating]} · {displayRating}/5 Stars
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Trip Feedback <span className="text-slate-500 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Punctual pickup, polite driver, smooth highway drive…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="glass-input resize-none text-xs"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-xs">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 text-xs">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
