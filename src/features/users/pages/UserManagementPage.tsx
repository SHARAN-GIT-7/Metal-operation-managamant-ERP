import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Users,
  RefreshCw,
  UserPlus,
  Edit,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  fetchUsers,
  addUser,
  updateUserProfile,
  updateUserPassword,
  deleteUser,
  sendResetEmail,
} from '../services/userManagement.service';
import type { UserEntry, UserFormData } from '../types/userManagement.types';
import { useAuth } from '../../../context/AuthContext';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Active: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  Inactive: { color: '#dc2626', bg: '#fff5f5', border: '#fecaca' },
};

const StatusChip = ({ status }: { status: 'Active' | 'Inactive' }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Active;
  return (
    <span
      className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      {status}
    </span>
  );
};

// ─── Role Badge Config ────────────────────────────────────────────────────────
const getRoleBadgeStyle = (role: string | undefined) => {
  const lower = (role || '').toLowerCase();
  if (lower.includes('admin')) {
    return { color: '#b45309', bg: '#fef3c7', border: '#fcd34d', icon: <ShieldCheck size={11} /> };
  } else if (lower.includes('manager')) {
    return { color: '#1e3a8a', bg: '#dbeafe', border: '#bfdbfe', icon: <Shield size={11} /> };
  } else {
    return { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0', icon: <ShieldAlert size={11} /> };
  }
};

const RoleBadge = ({ role }: { role: string | undefined }) => {
  const cfg = getRoleBadgeStyle(role);
  return (
    <span
      className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.icon}
      {role || 'User'}
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
  loading?: boolean;
}

const KpiCard = ({ icon, label, value, sub, color, bg, loading }: KpiCardProps) => (
  <Card sx={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', height: '100%' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, background: bg, color, display: 'flex', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5 }}>
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={85} height={28} />
          ) : (
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {value}
            </Typography>
          )}
          {sub && !loading && (
            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25, fontWeight: 500 }}>
              {sub}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// ─── Main Page Component ──────────────────────────────────────────────────────
const UserManagementPage = () => {
  const { user: currentAuthUser } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [tableMaximized, setTableMaximized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Sorting state
  const [sortKey, setSortKey] = useState<keyof UserEntry>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Obscure passwords map (userId -> boolean)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Active user target for edit/delete/password change
  const [selectedUser, setSelectedUser] = useState<UserEntry | null>(null);

  // Form states
  const [addForm, setAddForm] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'Production Manager',
    status: 'Active',
  });
  const [editForm, setEditForm] = useState<Partial<UserFormData>>({
    name: '',
    role: '',
    status: 'Active',
  });
  const [newPassword, setNewPassword] = useState('');
  const [currentPasswordOverride, setCurrentPasswordOverride] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [deletePasswordOverride, setDeletePasswordOverride] = useState('');
  const [showDeleteOverride, setShowDeleteOverride] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load users
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to fetch users from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filter & Sort
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const nameMatch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const queryMatch = nameMatch || emailMatch;

      const roleMatch = !roleFilter || u.role === roleFilter;
      const statusMatch = !statusFilter || u.status === statusFilter;

      return queryMatch && roleMatch && statusMatch;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => {
    const arr = [...filteredUsers];
    arr.sort((a, b) => {
      let av = (a[sortKey] || '').toString().toLowerCase();
      let bv = (b[sortKey] || '').toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredUsers, sortKey, sortDir]);

  // Unique roles for filtering
  const uniqueRoles = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.role).filter(Boolean))).sort();
  }, [users]);

  // Paginated users
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, pageSize]);

  // KPIs
  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => (u.status || '') === 'Active').length;
    const inactive = total - active;
    const admins = users.filter((u) => (u.role || '').toLowerCase().includes('admin')).length;
    return { total, active, inactive, admins };
  }, [users]);

  // Sort requester
  const handleSort = (key: keyof UserEntry) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Visibility toggle
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Actions
  const handleOpenAdd = () => {
    setAddForm({
      name: '',
      email: '',
      password: '',
      role: 'Production Manager',
      status: 'Active',
    });
    setFormError(null);
    setAddDialogOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!addForm.name.trim()) return setFormError('Name is required.');
    if (!addForm.email.trim()) return setFormError('Email is required.');
    if (!addForm.password || addForm.password.length < 6) {
      return setFormError('Password must be at least 6 characters.');
    }
    
    setSubmitting(true);
    try {
      await addUser(addForm);
      setAddDialogOpen(false);
      await load();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to create user. Verify if email already exists.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserEntry) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      status: user.status,
    });
    setFormError(null);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);
    if (!editForm.name?.trim()) return setFormError('Name is required.');
    if (!editForm.role?.trim()) return setFormError('Role is required.');

    setSubmitting(true);
    try {
      await updateUserProfile(selectedUser.id, editForm);
      setEditDialogOpen(false);
      await load();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to update user profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPassword = (user: UserEntry) => {
    setSelectedUser(user);
    setNewPassword('');
    setCurrentPasswordOverride('');
    setShowOverrideInput(!user.password);
    setFormError(null);
    setPasswordDialogOpen(true);
  };

  const handleSendResetEmail = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await sendResetEmail(selectedUser.email);
      alert(`A password reset link has been successfully sent to ${selectedUser.email}.`);
      setPasswordDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to send password reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);
    if (!newPassword || newPassword.length < 6) {
      return setFormError('Password must be at least 6 characters.');
    }

    setSubmitting(true);
    try {
      // Re-authenticates under isolated instance, updates Auth + updates Firestore password
      await updateUserPassword(
        selectedUser.id,
        selectedUser.email,
        selectedUser.password || '',
        newPassword,
        currentPasswordOverride || undefined
      );
      setPasswordDialogOpen(false);
      await load();
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('MISSING_CURRENT_PASSWORD')) {
        setShowOverrideInput(true);
        setFormError('This user does not have a password stored in Firestore. To update their credentials in Firebase Auth, please type their current password, or use the "Send Reset Email" option.');
      } else if (err.message.includes('AUTH_SYNC_FAILED')) {
        setShowOverrideInput(true);
        setFormError('Authentication Sync failed. The password provided is incorrect. Please double check the user\'s current password or send them a password reset email.');
      } else {
        setFormError(err.message || 'Failed to sync and change password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (user: UserEntry) => {
    setSelectedUser(user);
    setDeletePasswordOverride('');
    setShowDeleteOverride(!user.password);
    setFormError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setFormError(null);
    setSubmitting(true);
    try {
      // Deletes Auth first via re-auth, then deletes Firestore doc
      await deleteUser(
        selectedUser.id,
        selectedUser.email,
        selectedUser.password || '',
        deletePasswordOverride || undefined
      );
      setDeleteDialogOpen(false);
      await load();
    } catch (err: any) {
      console.error(err);
      // Even if there is an error (like Auth sync failure), the service removes it from database
      // but throws to warn us. We catch the warning, close dialog, and reload to see final state.
      setFormError(err.message || 'Failed to complete full user deletion.');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const SortTh = ({ label, colKey }: { label: string; colKey: keyof UserEntry }) => (
    <th
      onClick={() => handleSort(colKey)}
      className="px-4 py-3 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors select-none font-bold uppercase tracking-wider text-[10px] text-slate-600"
    >
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown size={10} className="opacity-40" />
      </div>
    </th>
  );

  const stickyHead = 'bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]';
  const bodyCell = 'px-4 py-3 border-b border-slate-50 text-xs text-slate-700 whitespace-nowrap';

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%' }}>
      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ p: 1, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', borderRadius: 2, display: 'flex' }}>
              <Users size={22} color="#fff" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>
              User Management
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#64748b', ml: { xs: 0, sm: 6 }, mt: { xs: 0.5, sm: 0 } }}>
            Manage access credentials, change passwords, assign system roles and statuses
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            onClick={load}
            disabled={loading}
            startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', flex: { xs: 1, sm: 'initial' } }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={handleOpenAdd}
            startIcon={<UserPlus size={14} />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              flex: { xs: 1, sm: 'initial' },
              background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
              '&:hover': { background: 'linear-gradient(135deg,#6d28d9,#5b21b6)' },
              boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
            }}
          >
            Add New User
          </Button>
        </Box>
      </Box>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={<Users size={20} />}
          label="Total Users"
          loading={loading}
          value={kpis.total}
          sub="registered accounts"
          color="#7c3aed"
          bg="#f5f3ff"
        />
        <KpiCard
          icon={<CheckCircle2 size={20} />}
          label="Active Users"
          loading={loading}
          value={kpis.active}
          sub="with access rights"
          color="#16a34a"
          bg="#f0fdf4"
        />
        <KpiCard
          icon={<AlertOctagon size={20} />}
          label="Inactive Users"
          loading={loading}
          value={kpis.inactive}
          sub="suspended access"
          color="#dc2626"
          bg="#fff5f5"
        />
        <KpiCard
          icon={<ShieldCheck size={20} />}
          label="Admins"
          loading={loading}
          value={kpis.admins}
          sub="elevated permission"
          color="#d97706"
          bg="#fffbeb"
        />
      </div>

      {/* ── Filters & Search ── */}
      <Card sx={{ mb: 2.5, borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
        <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
            {/* Search query input */}
            <div className="relative flex-1 min-w-[200px] w-full">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
              />
            </div>

            {/* Role Filter dropdown */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Role</InputLabel>
              <Select
                label="Role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                sx={{ fontSize: '0.75rem' }}
              >
                <MenuItem value=""><em>All Roles</em></MenuItem>
                {uniqueRoles.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Status Filter dropdown */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ fontSize: '0.75rem' }}
              >
                <MenuItem value=""><em>All Statuses</em></MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </div>
        </CardContent>
      </Card>

      {tableMaximized && (
        <div
          onClick={() => setTableMaximized(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1290,
          }}
        />
      )}

      {/* ── Users Table ── */}
      <div 
        className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden"
        style={tableMaximized ? {
          position: 'fixed',
          top: '5vh',
          left: '5vw',
          width: '90vw',
          height: '90vh',
          zIndex: 1300,
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backgroundColor: isDark ? '#161b27' : '#fff',
          borderColor: isDark ? '#2d3748' : '#e2e8f0',
        } : {
          backgroundColor: isDark ? '#161b27' : '#fff',
          borderColor: isDark ? '#2d3748' : '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: isDark ? '1px solid #2d3748' : '1px solid #e2e8f0', backgroundColor: isDark ? '#1a2130' : '#f8fafc' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {tableMaximized ? 'User Directory (Expanded View)' : 'User Directory'}
          </Typography>
          <Tooltip title={tableMaximized ? "Close / Minimize" : "Maximize Table"}>
            <IconButton size="small" onClick={() => setTableMaximized(!tableMaximized)} sx={{ color: 'text.secondary' }}>
              {tableMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </IconButton>
          </Tooltip>
        </div>
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}
        <div 
          className="overflow-x-auto"
          style={{ maxHeight: tableMaximized ? 'calc(90vh - 55px)' : '600px' }}
        >
          <table className="min-w-full text-left border-collapse">
            <thead className={`${stickyHead} sticky top-0 z-20 shadow-sm`}>
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 w-12 text-center bg-slate-100">#</th>
                <SortTh label="Name" colKey="name" />
                <SortTh label="Email Address" colKey="email" />
                <SortTh label="Role" colKey="role" />
                <SortTh label="Status" colKey="status" />
                <th className="px-4 py-3 border-b border-slate-200 w-44">Password Credentials</th>
                <th className="px-4 py-3 border-b border-slate-200 text-center w-32 bg-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-xs">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton height={14} /></td>
                    ))}
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                    No users found. Try adding a user or modifying the filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const showPass = visiblePasswords[row.id] || false;
                  
                  return (
                    <tr key={row.id} className={`hover:bg-violet-50/20 transition-colors group ${isEven ? 'bg-white' : 'bg-slate-50/20'}`}>
                      <td className={`${bodyCell} text-center text-slate-400 font-mono font-bold group-hover:bg-violet-50/20`}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className={`${bodyCell} font-semibold text-slate-800`}>
                        {row.name}
                      </td>
                      <td className={bodyCell}>
                        {row.email}
                      </td>
                      <td className={bodyCell}>
                        <RoleBadge role={row.role} />
                      </td>
                      <td className={bodyCell}>
                        <StatusChip status={row.status} />
                      </td>
                      <td className={bodyCell}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600 min-w-[100px]">
                            {showPass ? row.password : '••••••••'}
                          </span>
                          <IconButton
                            size="small"
                            onClick={() => togglePasswordVisibility(row.id)}
                            sx={{ color: '#64748b', p: 0.5 }}
                          >
                            {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                          </IconButton>
                        </div>
                      </td>
                      <td className={`${bodyCell} text-center`}>
                        <div className="flex justify-center items-center gap-1">
                          <Tooltip title="Edit Profile">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEdit(row)}
                              sx={{ color: '#7c3aed', '&:hover': { background: '#f5f3ff' } }}
                            >
                              <Edit size={13} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Sync & Change Password">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenPassword(row)}
                              sx={{ color: '#d97706', '&:hover': { background: '#fffbeb' } }}
                            >
                              <Key size={13} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Account">
                            <span>
                              <IconButton
                                size="small"
                                disabled={currentAuthUser?.uid === row.id} // Cannot delete oneself
                                onClick={() => handleOpenDelete(row)}
                                sx={{ color: '#dc2626', '&:hover': { background: '#fff5f5' } }}
                              >
                                <Trash2 size={13} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {!loading && sortedUsers.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-2 py-1"
                >
                  {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span>users</span>
              </div>
              <span>|</span>
              <span>
                Showing {Math.min((currentPage - 1) * pageSize + 1, sortedUsers.length)}–{Math.min(currentPage * pageSize, sortedUsers.length)} of {sortedUsers.length}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`px-2.5 py-1.5 border rounded transition-colors ${p === currentPage ? 'bg-violet-600 border-violet-600 text-white font-bold' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog: Add User ── */}
      <Dialog
        open={addDialogOpen}
        onClose={() => !submitting && setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        slotProps={{ paper: { className: 'rounded-2xl text-slate-800' } }}
      >
        <form onSubmit={handleAddSubmit}>
          <DialogTitle className="flex items-center justify-between border-b border-slate-100 py-4 px-6 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-violet-600 text-white rounded-lg">
                <UserPlus size={16} />
              </div>
              <div>
                <Typography className="font-bold text-base leading-tight">Add New User</Typography>
                <Typography className="text-xs text-slate-500 font-normal">
                  Creates standard auth credentials and syncs to database
                </Typography>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !submitting && setAddDialogOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </DialogTitle>

          <DialogContent className="py-5 px-6">
            {formError && (
              <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{formError}</Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <TextField
                label="Full Name"
                required
                fullWidth
                size="small"
                value={addForm.name}
                onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
              />

              <TextField
                label="Email Address"
                type="email"
                required
                fullWidth
                size="small"
                value={addForm.email}
                onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
              />

              <TextField
                label="Password (min 6 characters)"
                type="text"
                required
                fullWidth
                size="small"
                value={addForm.password}
                onChange={(e) => setAddForm((prev) => ({ ...prev, password: e.target.value }))}
                helperText="Credentials will be synced directly with Firebase Auth"
              />

              <FormControl fullWidth size="small" required>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  value={addForm.role}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <MenuItem value="Admin">Admin</MenuItem>
                  <MenuItem value="Production Manager">Production Manager</MenuItem>
                  <MenuItem value="Supervisor">Supervisor</MenuItem>
                  <MenuItem value="Accounts Manager">
                    Accounts Manager
                    <span style={{ marginLeft: 8, fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#d1fae5', color: '#065f46' }}>ACCOUNTS PORTAL</span>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={addForm.status}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, status: e.target.value as 'Active' | 'Inactive' }))}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>

          <DialogActions className="border-t border-slate-100 py-3 px-6 gap-2 bg-slate-50/50">
            <Button
              type="button"
              onClick={() => setAddDialogOpen(false)}
              variant="outlined"
              disabled={submitting}
              className="text-slate-600 border-slate-300 rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-6 font-semibold"
            >
              {submitting ? <CircularProgress size={16} className="text-white" /> : 'Create User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Dialog: Edit Profile ── */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !submitting && setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        slotProps={{ paper: { className: 'rounded-2xl text-slate-800' } }}
      >
        <form onSubmit={handleEditSubmit}>
          <DialogTitle className="flex items-center justify-between border-b border-slate-100 py-4 px-6 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-violet-600 text-white rounded-lg">
                <Edit size={16} />
              </div>
              <div>
                <Typography className="font-bold text-base leading-tight">Edit User Profile</Typography>
                <Typography className="text-xs text-slate-500 font-normal">
                  Update database records for {selectedUser?.email}
                </Typography>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !submitting && setEditDialogOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </DialogTitle>

          <DialogContent className="py-5 px-6">
            {formError && (
              <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{formError}</Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <TextField
                label="Full Name"
                required
                fullWidth
                size="small"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              />

              <FormControl fullWidth size="small" required>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <MenuItem value="Admin">Admin</MenuItem>
                  <MenuItem value="Production Manager">Production Manager</MenuItem>
                  <MenuItem value="Supervisor">Supervisor</MenuItem>
                  <MenuItem value="Accounts Manager">
                    Accounts Manager
                    <span style={{ marginLeft: 8, fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#d1fae5', color: '#065f46' }}>ACCOUNTS PORTAL</span>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as 'Active' | 'Inactive' }))}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>

          <DialogActions className="border-t border-slate-100 py-3 px-6 gap-2 bg-slate-50/50">
            <Button
              type="button"
              onClick={() => setEditDialogOpen(false)}
              variant="outlined"
              disabled={submitting}
              className="text-slate-600 border-slate-300 rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-6 font-semibold"
            >
              {submitting ? <CircularProgress size={16} className="text-white" /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Dialog: Change Password ── */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => !submitting && setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        slotProps={{ paper: { className: 'rounded-2xl text-slate-800' } }}
      >
        <form onSubmit={handlePasswordSubmit}>
          <DialogTitle className="flex items-center justify-between border-b border-slate-100 py-4 px-6 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500 text-white rounded-lg">
                <Key size={16} />
              </div>
              <div>
                <Typography className="font-bold text-base leading-tight">Change User Password</Typography>
                <Typography className="text-xs text-slate-500 font-normal">
                  Sets new password in Firebase Authentication and DB for {selectedUser?.name}
                </Typography>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !submitting && setPasswordDialogOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </DialogTitle>

          <DialogContent className="py-5 px-6">
            {formError && (
              <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{formError}</Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium leading-relaxed">
                <strong>Important:</strong> Changing the password here will re-authenticate the user's account momentarily under a secondary instance to update their credentials in Firebase Auth, then store the new plaintext value in Firestore.
              </div>

              {showOverrideInput && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg font-medium leading-relaxed">
                  <strong>No database password found:</strong> We need to authenticate this user to update their credentials in Firebase Auth. Please type their <strong>current password</strong> below, or click the button to send them a reset email directly.
                </div>
              )}

              {showOverrideInput && (
                <TextField
                  label="Current Password"
                  type="password"
                  required
                  fullWidth
                  size="small"
                  value={currentPasswordOverride}
                  onChange={(e) => setCurrentPasswordOverride(e.target.value)}
                />
              )}

              <TextField
                label="New Password (min 6 characters)"
                type="text"
                required
                fullWidth
                size="small"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Box className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="outlined"
                  color="warning"
                  size="small"
                  onClick={handleSendResetEmail}
                  disabled={submitting}
                  className="text-xs font-semibold rounded-lg"
                >
                  Send Password Reset Email Instead
                </Button>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions className="border-t border-slate-100 py-3 px-6 gap-2 bg-slate-50/50">
            <Button
              type="button"
              onClick={() => setPasswordDialogOpen(false)}
              variant="outlined"
              disabled={submitting}
              className="text-slate-600 border-slate-300 rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 font-semibold"
            >
              {submitting ? <CircularProgress size={16} className="text-white" /> : 'Update Password'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Dialog: Delete User Confirmation ── */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !submitting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        slotProps={{ paper: { className: 'rounded-2xl text-slate-800' } }}
      >
        <DialogTitle className="flex items-center justify-between border-b border-slate-100 py-4 px-6 bg-red-50/20">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-600 text-white rounded-lg">
              <Trash2 size={16} />
            </div>
            <div>
              <Typography className="font-bold text-base leading-tight">Delete User Account</Typography>
              <Typography className="text-xs text-slate-500 font-normal">
                Permanent operation
              </Typography>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && setDeleteDialogOpen(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </DialogTitle>

        <DialogContent className="py-5 px-6 space-y-3">
          {formError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>
          )}

          <Typography className="text-sm text-slate-700">
            Are you sure you want to permanently delete user <strong>{selectedUser?.name}</strong> (<strong>{selectedUser?.email}</strong>)?
          </Typography>
          
          <Typography className="text-xs text-slate-500 leading-relaxed">
            This will delete their user profile document from Firestore. We will also attempt to remove their login credentials from Firebase Authentication.
          </Typography>

          {showDeleteOverride && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg font-medium leading-relaxed mt-2">
              <strong>Optional:</strong> This user has no password stored in Firestore. To also delete their account from Firebase Authentication automatically, please enter their password below. Otherwise, they will be deleted from Firestore only and you can clean them up in Firebase Auth Console.
            </div>
          )}

          {showDeleteOverride && (
            <TextField
              label="User's Password (optional)"
              type="password"
              fullWidth
              size="small"
              value={deletePasswordOverride}
              onChange={(e) => setDeletePasswordOverride(e.target.value)}
              className="mt-2"
            />
          )}
        </DialogContent>

        <DialogActions className="border-t border-slate-100 py-3 px-6 gap-2 bg-slate-50/50">
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            disabled={submitting}
            className="text-slate-600 border-slate-300 rounded-lg px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSubmit}
            variant="contained"
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 font-semibold"
          >
            {submitting ? <CircularProgress size={16} className="text-white" /> : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagementPage;
