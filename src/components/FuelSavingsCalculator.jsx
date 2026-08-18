import React, { useState } from 'react';
import { Fuel, Zap, Leaf, TrendingDown, Sparkles } from 'lucide-react';

const FUEL_TYPES = [
  { value: 'petrol',  label: 'Petrol',        efficiency: 12, price: 370 },
  { value: 'hybrid',  label: 'Hybrid Petrol',  efficiency: 18, price: 370 },
  { value: 'diesel',  label: 'Diesel',         efficiency: 14, price: 340 },
];

export default function FuelSavingsCalculator() {
  const [distanceKm, setDistanceKm] = useState(35);
  const [passengers, setPassengers] = useState(3);
  const [fuelType, setFuelType] = useState('petrol');

  const fuel = FUEL_TYPES.find(f => f.value === fuelType);
  const dailyLiters = (distanceKm * 2) / fuel.efficiency;
  const dailySolo = dailyLiters * fuel.price;
  const dailyCarpool = dailySolo / (passengers + 1);
  const monthlySavings = Math.round((dailySolo - dailyCarpool) * 22);
  const monthlyFuelSaved = Math.round(dailyLiters * (passengers / (passengers + 1)) * 22);
  const co2SavedKg = Math.round(monthlyFuelSaved * 2.31); // ~2.31 kg CO2 per litre petrol

  return (
    <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">Fuel & Cost Savings Calculator</h3>
            <p className="text-xs text-slate-400 mt-0.5">Estimate your monthly commute expenses saved through campus carpooling</p>
          </div>
        </div>
        <span className="badge badge-green text-xs font-bold px-3 py-1">
          <Leaf className="w-3.5 h-3.5" /> Eco Impact
        </span>
      </div>

      {/* Controls */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
            One-way commute distance (km)
          </label>
          <div className="space-y-2">
            <input
              type="range" min={5} max={120} value={distanceKm}
              onChange={e => setDistanceKm(Number(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-white/[0.1] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>5 km</span>
              <span className="text-white font-black text-sm bg-blue-600/30 px-2.5 py-0.5 rounded-lg border border-blue-500/30">{distanceKm} km</span>
              <span>120 km</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
            Co-passengers sharing
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setPassengers(n)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  passengers === n
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 border border-blue-400/40'
                    : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.12] hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
            Vehicle powertrain
          </label>
          <div className="space-y-1.5">
            {FUEL_TYPES.map(f => (
              <button
                key={f.value}
                onClick={() => setFuelType(f.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  fuelType === f.value
                    ? 'bg-blue-600/25 border border-blue-500/50 text-white'
                    : 'bg-white/[0.05] border border-transparent text-slate-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {f.value === 'hybrid' ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Fuel className="w-3.5 h-3.5 text-blue-400" />}
                <span>{f.label}</span>
                <span className="ml-auto text-slate-500 text-[10px]">{f.efficiency} km/L</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-6 pb-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 text-center bg-white/[0.05] border border-white/10 shadow-md">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Monthly Saved</p>
          <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">
            {monthlySavings.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">LKR / month</p>
        </div>
        <div className="rounded-2xl p-4 text-center bg-white/[0.05] border border-white/10 shadow-md">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Fuel Conserved</p>
          <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{monthlyFuelSaved}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Litres / month</p>
        </div>
        <div className="rounded-2xl p-4 text-center bg-white/[0.05] border border-white/10 shadow-md">
          <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
            <Leaf className="w-3 h-3" /> CO₂ Reduced
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{co2SavedKg}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">kg / month</p>
        </div>
      </div>
    </div>
  );
}
