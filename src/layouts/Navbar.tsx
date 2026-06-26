import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  useTheme,
} from '@mui/material';
import { Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  handleDrawerToggle: () => void;
  drawerWidth: number;
}

const Navbar = ({ handleDrawerToggle, drawerWidth }: NavbarProps) => {
  const theme = useTheme();
  const { profile } = useAuth();

  const name = profile?.name || 'Admin User';
  const role = profile?.role || 'Plant Manager';
  const firstLetter = name.trim().charAt(0).toUpperCase() || 'A';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        backgroundColor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ height: 64 }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        {/* Right side icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, gap: 1, cursor: 'pointer' }}>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {role}
              </Typography>
            </Box>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36, fontWeight: 700 }}>
              {firstLetter}
            </Avatar>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
