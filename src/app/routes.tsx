import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import ProductionLedgerPage from '../features/productionLedger/pages/ProductionLedgerPage';
import CostLedgerPage from '../features/costLedger/pages/CostLedgerPage';
import ExportCenterPage from '../features/exports/pages/ExportCenterPage';
import UserManagementPage from '../features/users/pages/UserManagementPage';
import MasterControllerPage from '../features/masterController/pages/MasterControllerPage';
import WarehousePage from '../features/warehouse/pages/WarehousePage';
import FinishedGoodsPage from '../features/finishedGoods/pages/FinishedGoodsPage';
import VendorMasterPage from '../features/vendorMaster/pages/VendorMasterPage';
import AlloyMasterPage from '../features/alloyMaster/pages/AlloyMasterPage';
import DispatchPage from '../features/dispatch/pages/DispatchPage';

export const router = createBrowserRouter([
  {
    // Redirect root to login
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    // All app routes are protected
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },

          {
            path: 'production-ledger',
            element: <ProductionLedgerPage />,
          },
          {
            path: 'cost-ledger',
            element: <CostLedgerPage />,
          },
          {
            path: 'exports',
            element: <ExportCenterPage />,
          },
          {
            path: 'users',
            element: <UserManagementPage />,
          },
          {
            path: 'master-controller',
            element: <MasterControllerPage />,
          },
          {
            path: 'warehouse',
            element: <WarehousePage />,
          },
          {
            path: 'finished-goods',
            element: <FinishedGoodsPage />,
          },
          {
            path: 'vendor-master',
            element: <VendorMasterPage />,
          },
          {
            path: 'alloy-master',
            element: <AlloyMasterPage />,
          },
          {
            path: 'dispatch',
            element: <DispatchPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
