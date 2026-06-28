import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Button,
  Chip,
} from '@mui/material';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  Truck,
  Building2,
  Warehouse,
  LogOut,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  handleDrawerToggle: () => void;
  isMobile: boolean;
}

const ACCOUNTS_MENU = [
  { text: 'Finished Goods', icon: <PackageCheck size={20} />, path: '/accounts/finished-goods', desc: 'View Only' },
  { text: 'Dispatch Management', icon: <Truck size={20} />, path: '/accounts/dispatch', desc: 'View Only' },
  { text: 'Vendor Master', icon: <Building2 size={20} />, path: '/accounts/vendor-master', desc: 'Edit Access' },
  { text: 'Warehouse', icon: <Warehouse size={20} />, path: '/accounts/warehouse', desc: 'View Only' },
];

const TEAL = '#059669';
const TEAL_LIGHT = '#ecfdf5';
const TEAL_BORDER = '#a7f3d0';
const TEAL_ACTIVE_BG = '#d1fae5';

const AccountsSidebar = ({ drawerWidth, mobileOpen, handleDrawerToggle, isMobile }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, profile, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/accounts-login', { replace: true });
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo & Title */}
      <Box sx={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        gap: 1.5,
        borderBottom: `1px solid ${TEAL_BORDER}`,
        background: 'linear-gradient(135deg, #064e3b, #065f46)',
      }}>
        <img src="/logo.png" alt="SJMW Logo" style={{ height: 36, width: 36, objectFit: 'contain' }} />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1, color: '#fff', fontSize: '0.8rem' }}>
            Sri Jothi Moulding Works
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: '#6ee7b7', fontWeight: 600, letterSpacing: 0.5 }}>
            ACCOUNTS PORTAL
          </Typography>
        </Box>
      </Box>

      {/* Role badge */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1, bgcolor: TEAL_LIGHT, borderRadius: 2,
          border: `1px solid ${TEAL_BORDER}`,
        }}>
          <BarChart3 size={14} color={TEAL} />
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#065f46', letterSpacing: 0.3 }}>
            Accounts Manager
          </Typography>
        </Box>
      </Box>

      {/* Nav items */}
      <Box sx={{ overflow: 'auto', flex: 1, py: 1 }}>
        <Typography sx={{ px: 3, pb: 1, fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
          Modules
        </Typography>
        <List sx={{ px: 1.5 }}>
          {ACCOUNTS_MENU.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const isEdit = item.desc === 'Edit Access';
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  onClick={isMobile ? handleDrawerToggle : undefined}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: isActive ? TEAL_ACTIVE_BG : 'transparent',
                    border: isActive ? `1px solid ${TEAL_BORDER}` : '1px solid transparent',
                    color: isActive ? '#065f46' : '#374151',
                    '&:hover': { backgroundColor: TEAL_LIGHT },
                  }}
                >
                  <ListItemIcon sx={{ color: isActive ? TEAL : '#6b7280', minWidth: 38 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    secondary={item.desc}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#065f46' : '#1e293b',
                      },
                      '& .MuiListItemText-secondary': {
                        fontSize: '0.6rem',
                        color: isEdit ? '#059669' : '#94a3b8',
                        fontWeight: 600,
                      },
                    }}
                  />
                  {isEdit && (
                    <Chip
                      label="EDIT"
                      size="small"
                      sx={{
                        height: 16, fontSize: '0.5rem', fontWeight: 800,
                        bgcolor: '#d1fae5', color: '#065f46',
                        border: '1px solid #6ee7b7',
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ borderColor: '#f0fdf4' }} />

      {/* User info + logout */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {profile && (
          <Box sx={{ px: 0.5, mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }} noWrap>
              {profile.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }} noWrap>
              {user?.email}
            </Typography>
          </Box>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={<LogOut size={16} />}
          onClick={handleLogout}
          fullWidth
          sx={{
            borderRadius: 2, textTransform: 'none', fontWeight: 600,
            borderColor: TEAL_BORDER, color: TEAL,
            '&:hover': { bgcolor: TEAL_LIGHT, borderColor: TEAL },
          }}
        >
          Logout
        </Button>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ fontSize: '0.6rem', mt: 0.5 }}>
          Copyrights © 2026 by Procomets Solutions · v1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none', boxShadow: '4px 0 24px rgba(0,0,0,0.05)' },
        }}
      >
        {drawer}
      </Drawer>
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #d1fae5' },
        }}
        open
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default AccountsSidebar;
