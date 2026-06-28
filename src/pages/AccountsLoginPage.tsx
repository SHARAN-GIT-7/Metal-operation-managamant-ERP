import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Mail, Lock, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AccountsLoginPage = () => {
  const { loginAsAccountsManager } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAsAccountsManager(email, password);
      navigate('/accounts/finished-goods', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Access Denied')) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#ffffff',
      }}
    >
      {/* Left branding panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          position: 'relative',
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 35%, #047857 70%, #059669 100%)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          },
        }}
      >
        {/* Decorative circles */}
        <Box sx={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -40, left: -60, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
        }} />

        {/* Top Branding */}
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <img src="/logo.png" alt="SJMW Logo" style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: '20px' }} />
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', letterSpacing: 0.5 }}>
            Sri Jothi Moulding Works ERP
          </Typography>
        </Box>

        {/* Center badge */}
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <Box sx={{
            p: 3, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <BarChart3 size={48} color="#6ee7b7" />
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.6rem', textAlign: 'center', letterSpacing: -0.5 }}>
              Accounts Manager
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', textAlign: 'center', maxWidth: 280 }}>
              Secure access to financial records, vendor data, dispatch history, and stock visibility.
            </Typography>
          </Box>

          {/* Module access chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 320 }}>
            {['Finished Goods (View)', 'Dispatch (View)', 'Vendor Master (Edit)', 'Warehouse (View)'].map((m) => (
              <Box key={m} sx={{
                px: 1.5, py: 0.5, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{m}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bottom */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>
            By Procomet Solutions · Accounts Portal v1.0
          </Typography>
        </Box>
      </Box>

      {/* Right form panel */}
      <Box
        sx={{
          flex: { xs: 1, md: 1.2 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: { xs: 4, sm: 6, md: 10 },
          bgcolor: '#ffffff',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile Logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 5 }}>
            <img src="/logo.png" alt="SJMW Logo" style={{ height: 36, width: 36, objectFit: 'contain' }} />
            <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: '1.15rem' }}>
              Sri Jothi Moulding Works ERP
            </Typography>
          </Box>

          {/* Portal badge */}
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1,
            px: 2, py: 0.75, bgcolor: '#ecfdf5', border: '1px solid #a7f3d0',
            borderRadius: 20, mb: 3,
          }}>
            <BarChart3 size={14} color="#059669" />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46', letterSpacing: 0.3 }}>
              ACCOUNTS MANAGER PORTAL
            </Typography>
          </Box>

          {/* Heading */}
          <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
            Welcome back
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mb: 4, lineHeight: 1.5 }}>
            Sign in to your Accounts Manager account to access financial records and reports.
          </Typography>

          {/* Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                id="accounts-login-email"
                label="Email"
                type="email"
                placeholder="accounts@company.com"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail size={16} className="text-slate-400" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={fieldSx}
              />

              <TextField
                id="accounts-login-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={16} className="text-slate-400" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                          sx={{ color: '#64748b' }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={fieldSx}
              />

              <Button
                id="accounts-login-submit"
                type="submit"
                fullWidth
                disabled={loading}
                sx={{
                  mt: 1.5,
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  borderRadius: 2.5,
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                    boxShadow: '0 6px 20px rgba(5, 150, 105, 0.5)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': { opacity: 0.6 },
                }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sign In'}
              </Button>
            </Box>
          </form>

          {/* Admin portal link */}
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Are you an administrator?{' '}
              <a
                href="/login"
                style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}
              >
                Go to Admin Portal →
              </a>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#0f172a',
    borderRadius: 2.5,
    backgroundColor: '#ffffff',
    '& fieldset': { borderColor: '#e2e8f0' },
    '&:hover fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: '#059669', borderWidth: 2 },
  },
  '& .MuiInputLabel-root': {
    color: '#94a3b8',
    '&.Mui-focused': { color: '#059669' },
  },
};

export default AccountsLoginPage;
