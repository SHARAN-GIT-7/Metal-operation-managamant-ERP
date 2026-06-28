import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading) {
    // you could render a loading spinner here
    return null;
  }
  if (!user) return <Navigate to="/login" replace />;

  const role = (profile?.role || '').toLowerCase();
  if (role.includes('accounts')) {
    return <Navigate to="/accounts/finished-goods" replace />;
  }

  return <Outlet />;
};

/** Guards routes that require the Accounts Manager role. */
export const AccountsProtectedRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return null;

  if (!user) return <Navigate to="/accounts-login" replace />;

  const role = (profile?.role || '').toLowerCase();
  if (role.includes('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!role.includes('accounts')) {
    return <Navigate to="/accounts-login" replace />;
  }

  return <Outlet />;
};
