import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(
    location.state?.message || null
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError('Login failed. Please check your credentials.');
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
      {/* Left branding panel with background image */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          position: 'relative',
          backgroundImage: 'url(/login_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
          },
        }}
      >
        {/* Top Branding Logo */}
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <img src="/logo.png" alt="SJMW Logo" style={{ height: 40, width: 40, objectFit: 'contain', borderRadius:'20px' }} />
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', letterSpacing: 0.5 }}>
            Sri Jothi Moulding Works ERP
          </Typography>
        </Box>

        {/* Bottom Testimonial */}
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 500 }}>
          <Typography
            variant="h4"
            sx={{
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1.3,
              mb: 2,
              letterSpacing: -0.5,
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            "The ultimate platform for moulding works and foundry operation management."
          </Typography>
          <Box>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }}>
               By Procomet
            </Typography>
          </Box>
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
          {/* Mobile Logo Header */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 5 }}>
            <img src="/logo.png" alt="SJMW Logo" style={{ height: 36, width: 36, objectFit: 'contain' }} />
            <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: '1.15rem' }}>
              Sri Jothi Moulding Works ERP
            </Typography>
          </Box>

          {/* Heading */}
          <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
            Welcome to Sri Jothi Moulding Works ERP
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mb: 4, lineHeight: 1.5 }}>
            Streamlining moulding works operations, chemical analysis, and cost ledgers.
          </Typography>

          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {infoMessage && (
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2, fontSize: '0.85rem' }}>
              {infoMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                id="login-email"
                label="Email"
                type="email"
                placeholder="alex.jordan@gmail.com"
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
                id="login-password"
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
                id="login-submit"
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
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.55)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': { opacity: 0.6 },
                }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Log in'}
              </Button>
            </Box>
          </form>

          
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
    '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: 2 },
  },
  '& .MuiInputLabel-root': {
    color: '#94a3b8',
    '&.Mui-focused': { color: '#6366f1' },
  },
};
