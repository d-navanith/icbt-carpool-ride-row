import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, Check, X, Users, Car, Fuel, AlertCircle,
  RefreshCw, Trash2, Search, FileText, CheckCircle2, TrendingUp, Siren,
  PhoneCall, Filter, ExternalLink, Eye, CheckSquare, Sparkles, MapPin,
  Download, Activity, BarChart3, LineChart as LineChartIcon, Award, DollarSign,
  Calendar, Clock, ChevronRight, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import OddEvenBadge from '../components/OddEvenBadge';

// Helper for SVG smooth sparkline paths
const Sparkline = ({ data = [12, 18, 15, 25, 22, 30, 28], color = '#3b82f6', height = 36, width = 90 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: height - ((d - min) / range) * (height - 8) - 4
  }));

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, '');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${width},${height} L 0,${height} Z`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function AdminDashboard() {
  const { token, user, refreshProfile } = useAuth();
  const { socket, notifications } = useSocket();
  const [sosAlerts, setSosAlerts] = useState([]);

  useEffect(() => {
    if (!socket) return;
    const handleSOS = (alert) => {
      setSosAlerts(prev => [{ ...alert, resolved: false, receivedAt: new Date().toISOString() }, ...prev].slice(0, 20));
    };
    socket.on('campus_sos_alert', handleSOS);
    return () => socket.off('campus_sos_alert', handleSOS);
  }, [socket]);

  const resolveAlert = (alertId) => {
    setSosAlerts(prev => prev.map(a => a.alertId === alertId ? { ...a, resolved: true } : a));
  };

  const [stats, setStats] = useState(null);
  const [verifications, setVerifications] = useState({ driverVerifications: [], passengerVerifications: [] });
  const [allRides, setAllRides] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'verifications' | 'rides' | 'users' | 'sos'

  useEffect(() => {
    const handleAdminNavigation = (event) => {
      const nextTab = event.detail;
      if (['analytics', 'verifications', 'rides', 'users', 'sos'].includes(nextTab)) {
        setActiveTab(nextTab);
      }
    };

    window.addEventListener('admin:navigate', handleAdminNavigation);
    return () => window.removeEventListener('admin:navigate', handleAdminNavigation);
  }, []);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [adminComment, setAdminComment] = useState({});

  // Analytics Chart State
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('7d'); // 'today' | '7d' | '30d'
  const [activeChartMetric, setActiveChartMetric] = useState('savings'); // 'savings' | 'rides' | 'fuel'
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);

  // Filtering states
  const [verifSearch, setVerifSearch] = useState('');
  const [verifStatusFilter, setVerifStatusFilter] = useState('all');
  const [ridesSearch, setRidesSearch] = useState('');
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('all');

  // Inspection modal
  const [inspectedDriver, setInspectedDriver] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, verifRes, ridesRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/verifications', { headers }),
        fetch('/api/admin/rides', { headers }),
        fetch('/api/admin/users', { headers })
      ]);

      if (statsRes.ok) setStats((await statsRes.json()).stats);
      if (verifRes.ok) setVerifications(await verifRes.json());
      if (ridesRes.ok) setAllRides((await ridesRes.json()).rides);
      if (usersRes.ok) setAllUsers((await usersRes.json()).users);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDriverAction = async (verificationId, action) => {
    try {
      setActionLoading(verificationId);
      const comment = adminComment[verificationId] || (action === 'approved' ? 'Verified by campus admin office' : 'Documentation rejected');

      const res = await fetch(`/api/admin/verifications/driver/${verificationId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, comment })
      });

      if (res.ok) {
        await fetchAllData();
        await refreshProfile();
        if (inspectedDriver?.id === verificationId) {
          setInspectedDriver(null);
        }
      }
    } catch (err) {
      console.error('Failed to update driver status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRide = async (rideId) => {
    if (!window.confirm('Are you sure you want to remove this carpool ride from the system?')) return;
    try {
      const res = await fetch(`/api/admin/rides/${rideId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error('Failed to delete ride:', err);
    }
  };

  // Filtered Driver Verifications
  const filteredVerifications = (verifications.driverVerifications || []).filter(dv => {
    const matchStatus = verifStatusFilter === 'all' || dv.status === verifStatusFilter;
    const matchSearch = !verifSearch ||
      dv.user_name?.toLowerCase().includes(verifSearch.toLowerCase()) ||
      dv.user_email?.toLowerCase().includes(verifSearch.toLowerCase()) ||
      dv.vehicle_plate?.toLowerCase().includes(verifSearch.toLowerCase()) ||
      dv.license_number?.toLowerCase().includes(verifSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Filtered Rides
  const filteredRides = allRides.filter(r => {
    if (!ridesSearch) return true;
    const term = ridesSearch.toLowerCase();
    return (
      r.origin?.toLowerCase().includes(term) ||
      r.destination?.toLowerCase().includes(term) ||
      r.driver_name?.toLowerCase().includes(term) ||
      r.odd_even_tag?.toLowerCase().includes(term)
    );
  });

  // Filtered Users
  const filteredUsers = allUsers.filter(u => {
    const matchRole = usersRoleFilter === 'all' ||
      (usersRoleFilter === 'driver' && u.driver_status === 'approved') ||
      (usersRoleFilter === 'pending' && u.driver_status === 'pending') ||
      (usersRoleFilter === 'student' && u.role === 'student') ||
      (usersRoleFilter === 'staff' && u.role === 'staff');

    const matchSearch = !usersSearch ||
      u.name?.toLowerCase().includes(usersSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(usersSearch.toLowerCase()) ||
      u.student_staff_id?.toLowerCase().includes(usersSearch.toLowerCase());

    return matchRole && matchSearch;
  });

  // Mock Trend Chart Series for different filters
  const chartDatasets = {
    '7d': {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      savings: [1200, 1850, 2400, 3100, 4200, 3800, 4736],
      rides: [2, 3, 5, 6, 8, 5, 6],
      fuel: [4.2, 5.8, 7.5, 9.1, 11.4, 10.2, 12.8],
      labelPrefix: 'LKR ',
      unit: 'LKR'
    },
    '30d': {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      savings: [8500, 14200, 19800, 26400],
      rides: [14, 22, 31, 38],
      fuel: [22.5, 38.2, 54.0, 71.4],
      labelPrefix: 'LKR ',
      unit: 'LKR'
    },
    'today': {
      labels: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
      savings: [300, 950, 1600, 2100, 2800, 3900, 4736],
      rides: [1, 2, 3, 4, 5, 6, 6],
      fuel: [1.2, 3.4, 5.1, 7.0, 9.2, 11.5, 12.8],
      labelPrefix: 'LKR ',
      unit: 'LKR'
    }
  };

  const activeDataset = chartDatasets[analyticsTimeRange];
  const activeSeries = activeDataset[activeChartMetric];
  const maxVal = Math.max(...activeSeries);
  const minVal = Math.min(...activeSeries);
  const chartHeight = 220;
  const chartWidth = 600;

  // Compute SVG coordinates for interactive area chart
  const chartPoints = activeSeries.map((val, idx) => {
    const x = (idx / (activeSeries.length - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - ((val - (minVal * 0.8)) / (maxVal * 1.15 - minVal * 0.8)) * (chartHeight - 40) - 20;
    return { x, y, val, label: activeDataset.labels[idx] };
  });

  const chartPathD = chartPoints.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = chartPoints[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, '');

  const areaPathD = `${chartPathD} L ${chartPoints[chartPoints.length - 1].x},${chartHeight} L ${chartPoints[0].x},${chartHeight} Z`;

  // Top Drivers Leaderboard
  const topDrivers = [
    {
      name: 'Kamal Perera',
      avatar: 'Kamal Perera',
      role: 'Staff / Driver',
      trips: 42,
      successRate: '98%',
      rating: 4.9,
      vehicle: 'Toyota Aqua (WP-CAB-1234)'
    },
    {
      name: 'Sunil Shantha',
      avatar: 'Sunil Shantha',
      role: 'Staff / Driver',
      trips: 36,
      successRate: '94%',
      rating: 4.8,
      vehicle: 'Suzuki Alto (WP-KX-5678)'
    },
    {
      name: 'Dr. Nuwan Silva',
      avatar: 'Nuwan Silva',
      role: 'Senior Lecturer',
      trips: 28,
      successRate: '96%',
      rating: 5.0,
      vehicle: 'Honda Vezel (WP-CBE-9012)'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Top Glass Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/10 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 border border-white/20 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white">Campus Security & Admin Control</h1>
              <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-0.5 rounded-full border border-purple-500/30 font-extrabold uppercase">
                Admin Officer
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Verify driver documents, monitor live campus transit corridors, and oversee odd/even fuel quota compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/admin/export/rides-csv"
            download
            className="btn-secondary text-xs px-3.5 py-2.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <button
            onClick={fetchAllData}
            className="btn-secondary text-xs px-3.5 py-2.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* ── KPI METRICS WITH EMBEDDED WAVE SPARKLINE VISUALIZATIONS ── */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          
          {/* Card 1: Pending Drivers */}
          <div className="rounded-3xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 border-l-4 border-l-amber-400 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pending Review</span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Clock className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className={`text-2xl font-black tabular-nums block ${stats.pendingDriverVerifications > 0 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                  {stats.pendingDriverVerifications}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Verification queue</span>
              </div>
              <Sparkline data={[1, 3, 2, 4, 3, 2, stats.pendingDriverVerifications || 1]} color="#f59e0b" width={70} height={28} />
            </div>
          </div>

          {/* Card 2: Verified Drivers */}
          <div className="rounded-3xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 border-l-4 border-l-emerald-400 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Active Drivers</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Car className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-black text-emerald-400 tabular-nums block">{stats.totalDrivers}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Campus fleet</span>
              </div>
              <Sparkline data={[1, 1, 2, 2, 2, 3, stats.totalDrivers || 2]} color="#10b981" width={70} height={28} />
            </div>
          </div>

          {/* Card 3: Active Rides */}
          <div className="rounded-3xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 border-l-4 border-l-blue-400 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Active Rides</span>
              <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                <Activity className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-black text-blue-400 tabular-nums block">{stats.activeRides}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Today's routes</span>
              </div>
              <Sparkline data={[2, 3, 5, 4, 6, 5, stats.activeRides || 6]} color="#3b82f6" width={70} height={28} />
            </div>
          </div>

          {/* Card 4: Total Bookings */}
          <div className="rounded-3xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 border-l-4 border-l-purple-400 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Bookings</span>
              <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                <Users className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-black text-purple-300 tabular-nums block">{stats.totalBookings}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Seats reserved</span>
              </div>
              <Sparkline data={[1, 2, 4, 3, 5, 4, stats.totalBookings || 4]} color="#a855f7" width={70} height={28} />
            </div>
          </div>

          {/* Card 5: Fuel Conserved */}
          <div className="rounded-3xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 border-l-4 border-l-teal-400 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Fuel Conserved</span>
              <div className="w-6 h-6 rounded-lg bg-teal-500/15 flex items-center justify-center text-teal-400">
                <Fuel className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-black text-teal-300 tabular-nums block">{stats.estimatedLitersSaved}<span className="text-sm font-semibold ml-0.5">L</span></span>
                <span className="text-[10px] text-slate-500 font-semibold">Eco quota metric</span>
              </div>
              <Sparkline data={[3.2, 5.4, 7.8, 9.2, 11.0, 12.8]} color="#14b8a6" width={70} height={28} />
            </div>
          </div>

          {/* Card 6: Est Cost Saved */}
          <div className="rounded-3xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 border-l-4 border-l-slate-400 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Commute Saved</span>
              <div className="w-6 h-6 rounded-lg bg-slate-500/15 flex items-center justify-center text-slate-300">
                <DollarSign className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-lg font-black text-white tabular-nums block truncate">LKR {stats.estimatedCostSavedLKR?.toLocaleString?.() ?? stats.estimatedCostSavedLKR}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Student savings</span>
              </div>
              <Sparkline data={[1200, 2100, 2900, 3600, 4200, 4736]} color="#94a3b8" width={70} height={28} />
            </div>
          </div>

        </div>
      )}

      {/* Real-time SOS Alert Panel */}
      {sosAlerts.filter(a => !a.resolved).length > 0 && (
        <div className="rounded-3xl border border-red-500/50 bg-red-500/10 backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Siren className="w-5 h-5 text-red-400 animate-pulse" />
            <h2 className="font-extrabold text-red-300 text-base">Active Emergency SOS Alerts</h2>
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-black">{sosAlerts.filter(a => !a.resolved).length}</span>
          </div>
          <div className="space-y-2">
            {sosAlerts.filter(a => !a.resolved).map(alert => (
              <div key={alert.alertId} className="flex items-center justify-between p-3 rounded-2xl bg-red-500/15 border border-red-500/30">
                <div className="text-xs">
                  <span className="font-bold text-red-200">{alert.userName}</span>
                  <span className="text-slate-300 ml-2">{alert.location}</span>
                  <span className="text-slate-500 ml-2 font-mono">#{alert.alertId}</span>
                </div>
                <button
                  onClick={() => resolveAlert(alert.alertId)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Glass Tab Navigation */}
      <div className="flex p-1 rounded-2xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-xl flex-wrap gap-1 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Visual Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('verifications')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'verifications' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Driver Audits ({verifications.driverVerifications?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('rides')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'rides' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Car className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Carpool Fleet ({allRides.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Commuters ({allUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sos')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sos' ? 'bg-red-600 text-white shadow-lg shadow-red-600/40' : 'text-slate-400 hover:text-red-300'
          }`}
        >
          <Siren className={`w-3.5 h-3.5 inline mr-1.5 ${sosAlerts.length > 0 && activeTab !== 'sos' ? 'animate-pulse text-red-400' : ''}`} />
          <span>Emergency SOS {sosAlerts.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full inline-flex items-center justify-center font-black">{sosAlerts.length}</span>}</span>
        </button>
      </div>

      {/* ── TAB 0: VISUAL ANALYTICS DASHBOARD ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Main Visualizer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 8-cols: Interactive Trend Wave Chart */}
            <div className="lg:col-span-8 rounded-3xl p-6 sm:p-7 bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
              
              {/* Chart Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-white text-lg tracking-tight">Campus Transit & Savings Trajectory</h3>
                  <p className="text-xs text-slate-400">Live analytics of fuel cost reductions and commuter volume</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Metric Switcher */}
                  <div className="flex p-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs">
                    <button
                      onClick={() => setActiveChartMetric('savings')}
                      className={`px-3 py-1 rounded-lg font-bold transition ${activeChartMetric === 'savings' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      Cost (LKR)
                    </button>
                    <button
                      onClick={() => setActiveChartMetric('fuel')}
                      className={`px-3 py-1 rounded-lg font-bold transition ${activeChartMetric === 'fuel' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      Fuel (L)
                    </button>
                    <button
                      onClick={() => setActiveChartMetric('rides')}
                      className={`px-3 py-1 rounded-lg font-bold transition ${activeChartMetric === 'rides' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      Rides
                    </button>
                  </div>

                  {/* Time Range Pills */}
                  <div className="flex p-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs">
                    {['today', '7d', '30d'].map(r => (
                      <button
                        key={r}
                        onClick={() => setAnalyticsTimeRange(r)}
                        className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] transition ${analyticsTimeRange === r ? 'bg-white/[0.15] text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {r === '7d' ? '7 Days' : r === '30d' ? 'Month' : 'Today'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive SVG Chart Container */}
              <div className="relative pt-4 pb-2">
                
                {/* Floating Metric Highlight */}
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Recorded</span>
                    <p className="text-2xl sm:text-3xl font-black text-white">
                      {activeChartMetric === 'savings' ? `LKR ${stats?.estimatedCostSavedLKR?.toLocaleString() || '4,736'}` :
                       activeChartMetric === 'fuel' ? `${stats?.estimatedLitersSaved || '12.8'} Litres` :
                       `${stats?.totalBookings || '4'} Commutes`}
                    </p>
                  </div>
                  <span className="badge badge-green text-xs font-bold">
                    <TrendingUp className="w-3.5 h-3.5" /> +28.4% this week
                  </span>
                </div>

                {/* SVG Area Chart */}
                <div className="w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56 overflow-visible">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeChartMetric === 'fuel' ? '#14b8a6' : activeChartMetric === 'rides' ? '#a855f7' : '#3b82f6'} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={activeChartMetric === 'fuel' ? '#14b8a6' : activeChartMetric === 'rides' ? '#a855f7' : '#3b82f6'} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines */}
                    {[0.25, 0.5, 0.75, 1].map((pct, i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={chartHeight * pct}
                        x2={chartWidth}
                        y2={chartHeight * pct}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Gradient Area Fill */}
                    <path
                      d={areaPathD}
                      fill="url(#chartGradient)"
                    />

                    {/* Smooth Spline Curve */}
                    <path
                      d={chartPathD}
                      fill="none"
                      stroke={activeChartMetric === 'fuel' ? '#14b8a6' : activeChartMetric === 'rides' ? '#a855f7' : '#3b82f6'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Data Nodes */}
                    {chartPoints.map((p, idx) => (
                      <g key={idx} className="cursor-pointer group">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          className="fill-slate-950 stroke-blue-400 stroke-2 transition-all group-hover:r-7 group-hover:fill-blue-500"
                        />
                        {/* Hover Tooltip Box */}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <rect
                            x={p.x - 35}
                            y={p.y - 38}
                            width="70"
                            height="26"
                            rx="8"
                            fill="rgba(15, 23, 42, 0.95)"
                            stroke="rgba(255,255,255,0.2)"
                          />
                          <text
                            x={p.x}
                            y={p.y - 21}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                          >
                            {activeChartMetric === 'savings' ? `LKR ${p.val}` : p.val}
                          </text>
                        </g>
                      </g>
                    ))}
                  </svg>
                </div>

                {/* Bottom Timeline Axis Labels */}
                <div className="flex justify-between text-[11px] font-bold text-slate-400 px-2 mt-2">
                  {activeDataset.labels.map((l, i) => (
                    <span key={i}>{l}</span>
                  ))}
                </div>

              </div>

            </div>

            {/* Right 4-cols: Transit Corridor Breakdown */}
            <div className="lg:col-span-4 rounded-3xl p-6 bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl space-y-5 flex flex-col justify-between">
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black text-white text-base">Corridor Demand</h3>
                  <span className="badge badge-blue text-[10px]">High Density</span>
                </div>
                <p className="text-xs text-slate-400">Weekly student traffic volume by Sri Lankan transit corridors</p>
              </div>

              {/* Corridor Progress Bars */}
              <div className="space-y-4">
                {[
                  { corridor: 'Gampaha ➔ ICBT Colombo', pct: 42, color: 'from-blue-500 to-indigo-500', trips: '18 daily rides' },
                  { corridor: 'Negombo ➔ ICBT Colombo', pct: 28, color: 'from-emerald-500 to-teal-500', trips: '12 daily rides' },
                  { corridor: 'Kandy / Kadawatha ➔ ICBT', pct: 18, color: 'from-purple-500 to-indigo-500', trips: '8 daily rides' },
                  { corridor: 'Galle / Moratuwa ➔ ICBT', pct: 12, color: 'from-amber-500 to-orange-500', trips: '5 daily rides' },
                ].map(({ corridor, pct, color, trips }) => (
                  <div key={corridor} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white truncate max-w-[180px]">{corridor}</span>
                      <span className="text-slate-300 tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>ODD & EVEN compliant</span>
                      <span>{trips}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quota Compliance Card */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Fuel className="w-4 h-4" />
                  <span>Fuel Quota Audit Aligned</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  100% of campus carpools comply with Sri Lanka National Fuel Pass schedules.
                </p>
              </div>

            </div>

          </div>

          {/* Bottom Row: Top Campus Drivers Leaderboard */}
          <div className="rounded-3xl p-6 sm:p-7 bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-base">Top Campus Drivers Leaderboard</h3>
                <p className="text-xs text-slate-400">Punctuality, safety ratings, and carpool trip completion rates</p>
              </div>
              <span className="badge badge-green text-xs font-bold">
                <Award className="w-3.5 h-3.5" /> High Reliability
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topDrivers.map((driver, idx) => (
                <div
                  key={driver.name}
                  className="rounded-2xl p-4 bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(driver.avatar)}`}
                        alt={driver.name}
                        className="w-11 h-11 rounded-2xl bg-slate-800 border border-white/15"
                      />
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[10px] flex items-center justify-center border border-white/20">
                        #{idx + 1}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-white text-xs">{driver.name}</h4>
                      <p className="text-[10px] text-slate-400">{driver.vehicle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-amber-400">★ {driver.rating}</span>
                        <span className="text-[10px] text-slate-500">· {driver.trips} rides</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-400">{driver.successRate}</span>
                    <span className="text-[9px] text-slate-400 block uppercase font-bold">Punctuality</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 1: VERIFICATION QUEUE ── */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          
          {/* Glass Search / Filter Bar */}
          <div className="p-3.5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search driver by name, plate, license..."
                value={verifSearch}
                onChange={(e) => setVerifSearch(e.target.value)}
                className="glass-input pl-10"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending Review' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setVerifStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    verifStatusFilter === f.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredVerifications.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-2 backdrop-blur-xl">
              <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-xs font-bold text-slate-300">No driver verification applications matching criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVerifications.map((dv) => {
                const isPending = dv.status === 'pending';
                const isApproved = dv.status === 'approved';

                return (
                  <div
                    key={dv.id}
                    className={`rounded-3xl p-5 border backdrop-blur-xl shadow-lg transition-all ${
                      isPending
                        ? 'bg-amber-500/[0.05] border-amber-500/30 ring-1 ring-amber-500/20'
                        : isApproved
                        ? 'bg-white/[0.04] border-white/10'
                        : 'bg-red-500/[0.05] border-red-500/20 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                      {/* Driver Info */}
                      <div className="flex items-start gap-3.5">
                        <img
                          src={dv.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(dv.user_name)}`}
                          alt={dv.user_name}
                          className="w-12 h-12 rounded-2xl object-cover bg-slate-800 border border-white/15 shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-white text-base">{dv.user_name}</h4>
                            <span className={`badge ${isApproved ? 'badge-green' : isPending ? 'badge-amber' : 'badge-red'}`}>
                              {dv.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {dv.student_staff_id || 'ICBT Member'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">
                            {dv.user_email} | Phone: <strong>{dv.user_phone || 'N/A'}</strong>
                          </p>

                          {/* Vehicle Specs Chips */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <span className="bg-white/[0.06] px-2.5 py-0.5 rounded-xl text-slate-200 font-semibold border border-white/10">
                              🚗 {dv.vehicle_model}
                            </span>
                            <span className="bg-black/40 text-blue-300 font-mono px-2.5 py-0.5 rounded-xl font-bold border border-white/10">
                              {dv.vehicle_plate}
                            </span>
                            <span className={`badge ${dv.odd_even_type === 'ODD' ? 'badge-amber' : 'badge-blue'}`}>
                              {dv.odd_even_type} Tag
                            </span>
                            <span className="bg-white/[0.06] px-2.5 py-0.5 rounded-xl text-slate-300 border border-white/10 font-mono">
                              License: {dv.license_number}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5 shrink-0">
                        <button
                          onClick={() => setInspectedDriver(dv)}
                          className="btn-secondary text-xs px-3 py-2"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Docs</span>
                        </button>

                        <div className="w-full sm:w-56">
                          <input
                            type="text"
                            placeholder="Admin notes..."
                            value={adminComment[dv.id] !== undefined ? adminComment[dv.id] : (dv.admin_comment || '')}
                            onChange={(e) => setAdminComment({ ...adminComment, [dv.id]: e.target.value })}
                            className="glass-input text-xs py-2"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDriverAction(dv.id, 'approved')}
                            disabled={actionLoading === dv.id || isApproved}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/30 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => handleDriverAction(dv.id, 'rejected')}
                            disabled={actionLoading === dv.id}
                            className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-xl transition border border-red-500/30 flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CARPOOL FLEET ── */}
      {activeTab === 'rides' && (
        <div className="rounded-3xl p-6 bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-white text-base">Active & Historical Campus Rides ({filteredRides.length})</h3>
              <p className="text-xs text-slate-400">Monitor active driver routes, seats booked, and departure times</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search route or driver..."
                value={ridesSearch}
                onChange={(e) => setRidesSearch(e.target.value)}
                className="glass-input pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-white/[0.06] text-slate-300 font-extrabold uppercase tracking-wider text-[10px] border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Seats</th>
                  <th className="px-4 py-3">Fuel Tag</th>
                  <th className="px-4 py-3">Fare</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredRides.map((ride) => (
                  <tr key={ride.id} className="hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3 font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{ride.origin} ➔ {ride.destination}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">{ride.driver_name}</td>
                    <td className="px-4 py-3">{ride.departure_date} @ <strong>{ride.departure_time}</strong></td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">{ride.available_seats}</span> / {ride.total_seats} free
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ride.odd_even_tag === 'ODD' ? 'badge-amber' : 'badge-blue'}`}>
                        {ride.odd_even_tag}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-white">
                      {ride.price_per_seat > 0 ? `LKR ${ride.price_per_seat}` : 'Free'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ride.status === 'active' ? 'badge-green' : 'badge-slate'}`}>
                        {ride.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRide(ride.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/15 rounded-xl transition"
                        title="Remove ride"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: COMMUTER REGISTRY ── */}
      {activeTab === 'users' && (
        <div className="rounded-3xl p-6 bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-white text-base">Campus Commuter Registry ({filteredUsers.length})</h3>
              <p className="text-xs text-slate-400">View registered students, staff, verified drivers and system roles</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user by name, ID..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="glass-input pl-10"
                />
              </div>

              <select
                value={usersRoleFilter}
                onChange={(e) => setUsersRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-white/10 bg-slate-900 text-white font-bold focus:outline-none"
              >
                <option value="all">All Members</option>
                <option value="driver">Verified Drivers</option>
                <option value="pending">Pending Drivers</option>
                <option value="student">Students</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-white/[0.06] text-slate-300 font-extrabold uppercase tracking-wider text-[10px] border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">University ID</th>
                  <th className="px-4 py-3">Driver Status</th>
                  <th className="px-4 py-3">Plate & Quota</th>
                  <th className="px-4 py-3">System Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3 font-bold text-white flex items-center gap-2.5">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.name)}`}
                        alt={u.name}
                        className="w-7 h-7 rounded-xl bg-slate-800 border border-white/10"
                      />
                      <div>
                        <span className="block text-white">{u.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal capitalize">{u.role}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{u.email}</td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-300">{u.student_staff_id || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.driver_status === 'approved' ? 'badge-green' : u.driver_status === 'pending' ? 'badge-amber' : 'badge-slate'}`}>
                        {u.driver_status || 'Unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {u.vehicle_plate ? (
                        <span className="font-bold text-white">
                          {u.vehicle_plate} <span className="text-slate-400 font-normal">({u.odd_even_type || 'ODD'})</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`capitalize font-bold px-2 py-0.5 rounded-lg ${
                        u.system_role === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                      }`}>
                        {u.system_role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: SOS ALERTS ── */}
      {activeTab === 'sos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center">
                <Siren className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Emergency SOS Dispatch Monitor</h3>
                <p className="text-xs text-slate-400">Live campus emergency broadcasts received via WebSocket</p>
              </div>
            </div>
            <a
              href="tel:+94115848888"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Campus Security: +94 11 584 8888</span>
            </a>
          </div>

          {sosAlerts.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-3 backdrop-blur-xl">
              <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <p className="font-black text-white text-base">All Clear — No Active SOS Alerts</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Emergency alerts triggered from commuter dashboards will sound here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sosAlerts.map((alert, i) => (
                <div key={alert.alertId || i} className="rounded-3xl p-5 bg-red-500/10 border-2 border-red-500/30 shadow-xl space-y-3 backdrop-blur-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-600/50">
                        <Siren className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-red-200 text-sm">URGENT ALERT — {alert.userName}</span>
                          <span className="text-[10px] bg-red-700 text-white px-2 py-0.5 rounded font-bold uppercase">
                            {alert.userRole}
                          </span>
                        </div>
                        <p className="text-xs text-red-300 mt-0.5 font-medium">{alert.message}</p>
                      </div>
                    </div>
                    <span className="text-xs text-red-400 font-mono font-bold shrink-0">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-black/30 rounded-2xl p-3 border border-red-500/20">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Location</span>
                      <span className="font-bold text-white">{alert.location}</span>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-red-500/20">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Contact Phone</span>
                      <span className="font-bold text-white">{alert.userPhone || '—'}</span>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-red-500/20">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Vehicle Description</span>
                      <span className="font-bold text-white">{alert.vehicleDesc || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-red-500/20">
                    <span className="text-xs font-mono text-red-400">Incident ID: {alert.alertId}</span>
                    <a
                      href={`tel:${alert.userPhone}`}
                      className="btn-primary text-xs bg-red-600 hover:bg-red-500 shadow-red-600/40"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      Direct Call Driver
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DRIVER INSPECTION GLASS MODAL ── */}
      {inspectedDriver && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="rounded-3xl bg-slate-900/95 border border-white/20 shadow-2xl max-w-lg w-full overflow-hidden animate-in text-white">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
              <div>
                <h3 className="font-black text-white text-base">Driver Credentials Audit</h3>
                <p className="text-xs text-slate-400">{inspectedDriver.user_name} ({inspectedDriver.user_email})</p>
              </div>
              <button
                onClick={() => setInspectedDriver(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/[0.05] p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">License Number</span>
                  <span className="font-mono font-black text-white text-sm">{inspectedDriver.license_number}</span>
                </div>
                <div className="bg-white/[0.05] p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Plate Number</span>
                  <span className="font-mono font-black text-blue-400 text-sm">{inspectedDriver.vehicle_plate}</span>
                </div>
                <div className="bg-white/[0.05] p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehicle Make</span>
                  <span className="font-bold text-white">{inspectedDriver.vehicle_model}</span>
                </div>
                <div className="bg-white/[0.05] p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Fuel Tag</span>
                  <span className={`font-bold ${inspectedDriver.odd_even_type === 'ODD' ? 'text-amber-300' : 'text-blue-300'}`}>
                    {inspectedDriver.odd_even_type} Plate Quota
                  </span>
                </div>
              </div>

              {/* Document previews */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">Submitted Photo Credentials</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400">Driver License Photo</span>
                    <img
                      src={inspectedDriver.license_doc_url || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80'}
                      alt="Driver License"
                      className="w-full h-28 object-cover rounded-2xl border border-white/15 shadow-md"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400">Vehicle Front Photo</span>
                    <img
                      src={inspectedDriver.vehicle_photo_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80'}
                      alt="Vehicle Photo"
                      className="w-full h-28 object-cover rounded-2xl border border-white/15 shadow-md"
                    />
                  </div>
                </div>
              </div>

              {/* Decision */}
              <div className="flex gap-2.5 pt-3 border-t border-white/10">
                <button
                  onClick={() => handleDriverAction(inspectedDriver.id, 'rejected')}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition"
                >
                  Reject Application
                </button>
                <button
                  onClick={() => handleDriverAction(inspectedDriver.id, 'approved')}
                  className="btn-primary flex-1 py-2.5 text-xs"
                >
                  Approve Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
