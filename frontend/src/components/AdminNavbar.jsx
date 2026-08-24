import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Car,
  ChevronDown,
  KeyRound,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const initialProfile = {
  name: '',
  phone: '',
  student_staff_id: '',
};

const initialPassword = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

const initialNewAdmin = {
  name: '',
  email: '',
  role: 'staff',
  student_staff_id: '',
  phone: '',
  password: '',
  current_password: '',
};

function AccountModal({ open, onClose }) {
  const { user, token, refreshProfile, adminLogout } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(initialProfile);
  const [password, setPassword] = useState(initialPassword);
  const [newAdmin, setNewAdmin] = useState(initialNewAdmin);
  const [administrators, setAdministrators] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      student_staff_id: user?.student_staff_id || '',
    });
    setPassword(initialPassword);
    setNewAdmin(initialNewAdmin);
    setTab('profile');
    setMessage('');
    setError('');
    loadManagementData();
  }, [open, user?.id]);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const loadManagementData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [adminsRes, usersRes] = await Promise.all([
        fetch('/api/admin/administrators', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (adminsRes.ok) {
        setAdministrators((await adminsRes.json()).administrators || []);
      }
      if (usersRes.ok) {
        setUsers((await usersRes.json()).users || []);
      }
    } catch (err) {
      setError('Unable to load administrator management data.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const runAction = async (action, successMessage) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await action();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Request failed.');
      }
      setMessage(successMessage || data.message || 'Saved successfully.');
      return data;
    } catch (err) {
      setError(err.message || 'Request failed.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const data = await runAction(
      () => fetch('/api/admin/account/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(profile),
      }),
      'Administrator profile updated successfully.',
    );
    if (data) await refreshProfile();
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const data = await runAction(
      () => fetch('/api/admin/account/password', {
        method: 'POST',
        headers,
        body: JSON.stringify(password),
      }),
      'Password changed. Please sign in again with the new password.',
    );

    if (data) {
      setPassword(initialPassword);
      setTimeout(() => adminLogout(), 700);
    }
  };

  const createAdministrator = async (event) => {
    event.preventDefault();
    const data = await runAction(
      () => fetch('/api/admin/administrators', {
        method: 'POST',
        headers,
        body: JSON.stringify(newAdmin),
      }),
      'New administrator account created successfully.',
    );
    if (data) {
      setNewAdmin(initialNewAdmin);
      await loadManagementData();
    }
  };

  const promoteUser = async (targetUser) => {
    const currentPassword = window.prompt(
      `Confirm your current administrator password to promote ${targetUser.name}.`,
    );
    if (!currentPassword) return;

    const data = await runAction(
      () => fetch(`/api/admin/users/${targetUser.id}/promote`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ current_password: currentPassword }),
      }),
      `${targetUser.name} is now an administrator.`,
    );
    if (data) await loadManagementData();
  };

  const promotableUsers = users.filter((item) => item.system_role !== 'admin' && !item.suspended);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close account settings"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0d1422]/95 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300 font-black">Administrator account</p>
            <h2 className="text-xl font-black">Account & Security Settings</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[190px,1fr] min-h-[520px]">
          <aside className="border-b md:border-b-0 md:border-r border-white/10 p-4 space-y-2 bg-white/[0.02]">
            {[['profile', UserCog, 'My Profile'], ['password', KeyRound, 'Change Password'], ['administrators', ShieldCheck, 'Manage Admins']].map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTab(id); setMessage(''); setError(''); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-extrabold transition ${tab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </aside>

          <section className="overflow-y-auto p-6">
            {message && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">{message}</div>}
            {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">{error}</div>}

            {tab === 'profile' && (
              <form onSubmit={saveProfile} className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-lg font-black">My Profile</h3>
                  <p className="text-xs text-slate-400 mt-1">Update your administrator contact details. Email and system role remain controlled server-side.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">Full name</span>
                    <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full input-field" maxLength={100} required />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">Email</span>
                    <input value={user?.email || ''} readOnly className="w-full input-field opacity-70 cursor-not-allowed" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">Phone</span>
                    <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="w-full input-field" maxLength={30} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">Staff / Student ID</span>
                    <input value={profile.student_staff_id} onChange={(e) => setProfile({ ...profile, student_staff_id: e.target.value })} className="w-full input-field" maxLength={100} />
                  </label>
                </div>

                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-xs font-black">
                  <Settings className="w-4 h-4" /> Save Profile
                </button>
              </form>
            )}

            {tab === 'password' && (
              <form onSubmit={changePassword} className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-lg font-black">Change Password</h3>
                  <p className="text-xs text-slate-400 mt-1">A successful password change signs you out so the new credentials are immediately required.</p>
                </div>

                <div className="space-y-4">
                  {[
                    ['current_password', 'Current password'],
                    ['new_password', 'New password'],
                    ['confirm_password', 'Confirm new password'],
                  ].map(([key, label]) => (
                    <label key={key} className="space-y-1.5 block">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide">{label}</span>
                      <input
                        type="password"
                        value={password[key]}
                        onChange={(e) => setPassword({ ...password, [key]: e.target.value })}
                        className="w-full input-field"
                        minLength={key !== 'current_password' ? 8 : 1}
                        required
                      />
                    </label>
                  ))}
                </div>

                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-xs font-black">
                  <KeyRound className="w-4 h-4" /> Change Password
                </button>
              </form>
            )}

            {tab === 'administrators' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black">Manage Administrators</h3>
                  <p className="text-xs text-slate-400 mt-1">Add a new administrator or promote an existing active campus account. Your current admin password is required for privileged changes.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <form onSubmit={createAdministrator} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-cyan-300" />
                      <h4 className="font-black">Create Administrator</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className="input-field" placeholder="Full name" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} required />
                      <input className="input-field" type="email" placeholder="University email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} required />
                      <select className="input-field" value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}>
                        <option value="staff">Staff</option>
                        <option value="student">Student</option>
                      </select>
                      <input className="input-field" placeholder="Staff / Student ID" value={newAdmin.student_staff_id} onChange={(e) => setNewAdmin({ ...newAdmin, student_staff_id: e.target.value })} />
                      <input className="input-field" placeholder="Phone" value={newAdmin.phone} onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })} />
                      <input className="input-field" type="password" placeholder="Temporary password (8+)" minLength={8} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} required />
                      <input className="input-field sm:col-span-2" type="password" placeholder="Your current admin password" value={newAdmin.current_password} onChange={(e) => setNewAdmin({ ...newAdmin, current_password: e.target.value })} required />
                    </div>
                    <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-xs font-black">
                      <Plus className="w-4 h-4" /> Create Admin
                    </button>
                  </form>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        <h4 className="font-black">Current Administrators</h4>
                      </div>
                      <span className="text-[10px] font-black text-slate-500">{administrators.length}</span>
                    </div>
                    {loading ? (
                      <p className="text-xs text-slate-500">Loading…</p>
                    ) : administrators.length === 0 ? (
                      <p className="text-xs text-slate-500">No administrators found.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {administrators.map((admin) => (
                          <div key={admin.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-black truncate">{admin.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{admin.email}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[9px] font-black text-purple-300">ADMIN</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-blue-300" />
                    <h4 className="font-black">Promote Existing Campus User</h4>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {promotableUsers.length === 0 ? (
                      <p className="text-xs text-slate-500">No eligible non-admin users available.</p>
                    ) : promotableUsers.map((campusUser) => (
                      <div key={campusUser.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">{campusUser.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{campusUser.email} • {campusUser.role}</p>
                        </div>
                        <button onClick={() => promoteUser(campusUser)} disabled={saving} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-[10px] font-black text-blue-300 disabled:opacity-50">
                          Promote
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminNavbar() {
  const { user, adminLogout } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const navigate = (tab) => {
    window.dispatchEvent(new CustomEvent('admin:navigate', { detail: tab }));
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0b0f19]/90 backdrop-blur-2xl shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button onClick={() => navigate('analytics')} className="flex items-center gap-3 text-left min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-black text-white truncate">Ride Row</p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300">Admin Portal</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            {[
              ['analytics', BarChart3, 'Dashboard'],
              ['verifications', ShieldCheck, 'Verifications'],
              ['rides', Car, 'Rides'],
              ['users', Users, 'Users'],
              ['sos', ShieldCheck, 'SOS'],
            ].map(([id, Icon, label]) => (
              <button key={id} onClick={() => navigate(id)} className="px-3 py-2 rounded-xl text-[11px] font-black text-slate-400 hover:text-white hover:bg-white/5 inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </nav>

          <div className="relative flex items-center gap-2">
            <button onClick={() => setAccountOpen(true)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2">
              <img src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user?.name || '')}`} alt="Admin avatar" className="w-7 h-7 rounded-lg bg-slate-800" />
              <span className="hidden sm:block text-left">
                <span className="block text-[11px] font-black text-white max-w-[120px] truncate">{user?.name}</span>
                <span className="block text-[9px] text-purple-300 font-black uppercase tracking-wide">Administrator</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button onClick={() => setOpen((value) => !value)} className="md:hidden p-2 rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              <ChevronDown className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-12 w-52 rounded-2xl border border-white/10 bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl p-2 md:hidden">
                {[
                  ['analytics', 'Dashboard'],
                  ['verifications', 'Verifications'],
                  ['rides', 'Rides'],
                  ['users', 'Users'],
                  ['sos', 'SOS'],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => { setOpen(false); navigate(id); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5">{label}</button>
                ))}
                <button onClick={() => { setOpen(false); setAccountOpen(true); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5">Account settings</button>
              </div>
            )}

            <button onClick={() => adminLogout()} title="Sign out" className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
