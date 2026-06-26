import { Box, Typography, Button, Container, Card, CardContent } from '@mui/material';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1a0505 0%, #050101 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glowing light */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '500px',
          bgcolor: 'rgba(239, 68, 68, 0.08)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          zIndex: 0,
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <Card
          sx={{
            background: 'rgba(20, 8, 8, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.25)',
            borderRadius: 4,
            overflow: 'hidden',
            py: 5,
            px: 3,
          }}
        >
          <CardContent>
            {/* Pulsing Alert Icon */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                mb: 3,
                animation: 'pulse 2s infinite ease-in-out',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
                  '50%': { transform: 'scale(1.05)', boxShadow: '0 0 20px 4px rgba(239, 68, 68, 0.2)' },
                },
              }}
            >
              <ShieldAlert size={42} color="#ef4444" />
            </Box>

            
           
            {/* Restricted Title */}
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.6rem', sm: '2.0rem' },
                color: '#fee2e2',
                mb: 2,
                letterSpacing: -0.5,
                lineHeight: 1.3,
              }}
            >
              Only Admin for Admin Use
            </Typography>

            {/* Subtext info */}
            <Typography
              variant="body1"
              sx={{
                color: '#fca5a5',
                fontSize: '0.85rem',
                mb: 4,
                lineHeight: 1.6,
                maxWidth: '420px',
                mx: 'auto',
              }}
            >
              404 Page Not Found. The link you followed is either broken or restricted to Admin personnel only.
            </Typography>

            {/* Back Button */}
            <Button
              variant="contained"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/login')}
              sx={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff',
                fontWeight: 700,
                px: 4,
                py: 1.3,
                borderRadius: 2.5,
                fontSize: '0.82rem',
                textTransform: 'none',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  boxShadow: '0 6px 20px rgba(239, 68, 68, 0.55)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
