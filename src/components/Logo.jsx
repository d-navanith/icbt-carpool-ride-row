import React from 'react';

export default function Logo({
  size = 'md',
  showText = true,
  showSubtitle = true,
  subtitle = 'Campus Transit',
  className = '',
  useImage = true
}) {
  // Strict standard Tailwind dimensions
  const iconSizes = {
    xs: 'w-7 h-7',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14'
  };

  const textSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  const subSizes = {
    xs: 'text-[8px]',
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
    xl: 'text-xs'
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none shrink-0 ${className}`}>
      {/* Icon Emblem Container with strict size constraint */}
      <div
        className={`relative ${iconSizes[size] || iconSizes.md} rounded-2xl bg-[#090d16] border border-cyan-400/40 p-1 shadow-lg shadow-cyan-500/25 flex items-center justify-center shrink-0 overflow-hidden group transition-all duration-300 hover:shadow-cyan-400/50 hover:border-cyan-300 hover:scale-105`}
        style={{ aspectRatio: '1 / 1' }}
      >
        {/* Glow backdrop pulse */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/30 to-indigo-600/30 blur-sm pointer-events-none group-hover:opacity-100 transition-opacity" />

        {useImage ? (
          <img
            src="/riderow_logo.jpg"
            alt="Ride Row"
            className="w-full h-full object-cover rounded-xl relative z-10"
            onError={(e) => {
              // Fallback to SVG if image fails
              e.target.style.display = 'none';
              e.target.nextElementSibling && (e.target.nextElementSibling.style.display = 'block');
            }}
          />
        ) : null}

        {/* Crisp Geometric SVG Icon Fallback */}
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full relative z-10 ${useImage ? 'hidden' : 'block'} drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]`}
        >
          <defs>
            <linearGradient id="rrGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="rrGradIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>

          {/* Connected road lines forming Double R */}
          <path
            d="M8 32V8H18C22.4 8 25 10.6 25 14C25 17.4 22.4 20 18 20H8"
            stroke="url(#rrGradCyan)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 20L26 32"
            stroke="url(#rrGradCyan)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M20 12C24 12 32 14 32 20C32 24.5 28 27 24 27"
            stroke="url(#rrGradIndigo)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M26 27L33 32"
            stroke="url(#rrGradIndigo)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="25" cy="14" r="1.5" fill="#38bdf8" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col justify-center min-w-0">
          <span
            className={`font-black text-white tracking-tight ${textSizes[size] || textSizes.md} leading-none whitespace-nowrap`}
          >
            Ride{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
              Row
            </span>
          </span>
          {showSubtitle && (
            <span
              className={`${subSizes[size] || subSizes.md} text-cyan-300/80 font-bold uppercase tracking-wider mt-1 whitespace-nowrap`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
