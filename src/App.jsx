import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import TopNavbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DriverVerificationModal from './components/DriverVerificationModal';
import ProfilePage from './pages/ProfilePage';
import ToastContainer from './components/ToastContainer';

import ErrorBoundary from './components/ErrorBoundary';

function MainLayout() {
  const { user, loading, activeMode } = useAuth();
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-cyan-500/30" />
          <p className="text-slate-300 text-sm font-bold tracking-wide">Loading Ride Row…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white relative flex flex-col overflow-x-hidden">
      
      {/* ── Ambient Glowing Glass Orbs Backdrop ── */}
      <div className="fixed top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-blue-600/20 to-indigo-500/15 blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-indigo-600/15 via-blue-600/10 to-teal-400/10 blur-[160px] pointer-events-none z-0" />
      <div className="fixed top-[45%] right-[25%] w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[130px] pointer-events-none z-0" />

      {/* Top Glass Navbar */}
      <TopNavbar
        onOpenDriverVerification={() => setDriverModalOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        {activeMode === 'admin' ? (
          <ErrorBoundary><AdminDashboard /></ErrorBoundary>
        ) : activeMode === 'driver' ? (
          <ErrorBoundary><DriverDashboard onOpenVerification={() => setDriverModalOpen(true)} /></ErrorBoundary>
        ) : (
          <ErrorBoundary><PassengerDashboard /></ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <footer className="glass-panel border-t border-white/[0.08] py-5 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">© 2026 Ride Row — Campus Carpool & Rideshare Network</span>
          <span className="text-slate-500">Odd-Even Fuel Quota Compliance • Campus Security Verified</span>
        </div>
      </footer>

      {/* Modals */}
      <DriverVerificationModal
        isOpen={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
      />
      {profileOpen && (
        <ProfilePage onClose={() => setProfileOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainLayout />
        <ToastContainer />
      </SocketProvider>
    </AuthProvider>
  );
}
