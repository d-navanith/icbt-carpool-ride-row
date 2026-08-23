import React from 'react';
import logoImg from '../assets/riderow_logo.jpg';

export default function Logo({
  size = 'md',
  showText = true,
  showSubtitle = true,
  subtitle = 'Campus Transit',
  className = '',
  imageOnly = false
}) {
  const iconDimensions = {
    xs: 'w-8 h-8',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const textDimensions = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const subDimensions = {
    xs: 'text-[8px]',
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-xs'
  };

  if (imageOnly) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20 ${className}`}>
        <img
          src={logoImg}
          alt="Ride Row"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none shrink-0 ${className}`}>
      {/* Exact Uploaded Logo Image */}
      <div
        className={`relative ${iconDimensions[size] || 'w-11 h-11'} rounded-2xl bg-[#0b0f19] border border-cyan-400/40 p-0.5 shadow-lg shadow-cyan-500/25 flex items-center justify-center shrink-0 overflow-hidden group transition-all duration-300 hover:scale-105 hover:border-cyan-300 hover:shadow-cyan-400/40`}
        style={{ aspectRatio: '1 / 1' }}
      >
        {/* Glow backdrop pulse */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-blue-600/25 blur-sm pointer-events-none group-hover:opacity-100 transition-opacity" />

        <img
          src={logoImg}
          alt="Ride Row Logo"
          className="w-full h-full object-cover rounded-[14px] relative z-10"
        />
      </div>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black text-white tracking-tight ${textDimensions[size] || 'text-lg'} whitespace-nowrap`}
            >
              Ride{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
                Row
              </span>
            </span>
          </div>

          {showSubtitle && (
            <span
              className={`${subDimensions[size] || 'text-[10px]'} font-bold uppercase tracking-wider text-cyan-300/85 mt-1 whitespace-nowrap`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
