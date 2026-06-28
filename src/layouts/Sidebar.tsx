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
  useTheme,
  Button
} from '@mui/material';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  Calculator,
  Download,
  Users,
  LogOut,
  ShieldCheck,
  Warehouse,
  PackageCheck,
  Building2,
  Beaker,
  Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  handleDrawerToggle: () => void;
  isMobile: boolean;
}

const MENU_ITEMS = [
  { text: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
  { text: 'Production Ledger', icon: <Factory size={20} />, path: '/production-ledger' },
  { text: 'Cost Ledger', icon: <Calculator size={20} />, path: '/cost-ledger' },
  { text: 'Warehouse', icon: <Warehouse size={20} />, path: '/warehouse' },
  { text: 'Finished Goods', icon: <PackageCheck size={20} />, path: '/finished-goods' },
  { text: 'Dispatch Management', icon: <Truck size={20} />, path: '/dispatch' },
  { text: 'Export Center', icon: <Download size={20} />, path: '/exports' },
  { text: 'Users', icon: <Users size={20} />, path: '/users' },
  { text: 'Master Controller', icon: <ShieldCheck size={20} />, path: '/master-controller', isAdmin: true },
  { text: 'Vendor Master', icon: <Building2 size={20} />, path: '/vendor-master', isAdmin: true },
  { text: 'Alloy Master', icon: <Beaker size={20} />, path: '/alloy-master', isAdmin: true },
];

const Sidebar = ({ drawerWidth, mobileOpen, handleDrawerToggle, isMobile }: SidebarProps) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        gap: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <img src="/logo.png" alt="SJMW Logo" style={{ height: 40, width: 40, objectFit: 'contain' }} />
        <Typography variant="body2" color="primary" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
          Sri Jothi Moulding Works ERP
        </Typography>
      </Box>
      <Box sx={{ overflow: 'auto', flex: 1, py: 2 }}>
        <List sx={{ px: 2 }}>
          {MENU_ITEMS.filter((item) => !(item as any).isAdmin).map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  onClick={isMobile ? handleDrawerToggle : undefined}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: isActive ? `${theme.palette.primary.main}14` : 'transparent',
                    color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: `${theme.palette.primary.main}0A`,
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    minWidth: 40
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 500
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Admin-only section separator */}
        <Box sx={{ px: 2, mt: 1, mb: 0.5 }}>
          <Divider>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.8, px: 1 }}>
              Admin Only
            </Typography>
          </Divider>
        </Box>

        <List sx={{ px: 2 }}>
          {MENU_ITEMS.filter((item) => (item as any).isAdmin).map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  onClick={isMobile ? handleDrawerToggle : undefined}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: isActive ? '#fef3c7' : 'transparent',
                    color: isActive ? '#b45309' : theme.palette.text.primary,
                    border: isActive ? '1px solid #fcd34d' : '1px solid transparent',
                    '&:hover': {
                      backgroundColor: '#fef9c3',
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    color: isActive ? '#b45309' : '#d97706',
                    minWidth: 40
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? '#b45309' : '#92400e',
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
      <Divider />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {user && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', px: 0.5 }} noWrap>
            {user.displayName ?? user.email}
          </Typography>
        )}
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<LogOut size={16} />}
          onClick={handleLogout}
          fullWidth
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Logout
        </Button>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ fontSize: '0.65rem', mt: 0.5 }}>
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
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: `1px solid ${theme.palette.divider}` },
        }}
        open
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Sidebar;
