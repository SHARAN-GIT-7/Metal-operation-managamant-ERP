import { Box, Card, CardContent, Typography } from '@mui/material';
import type { DashboardAnalytics } from '../types/dashboard.types';

interface Props {
  analytics: DashboardAnalytics;
}

const MaterialCostDistributionCard = ({ analytics }: Props) => {
  // Sum up all material costs
  const totalCost = analytics.materialCostDistribution.reduce((acc, curr) => acc + curr.value, 0);
  
  // Format total cost to Lakhs/Thousands
  const formatCostLakhs = (val: number): string => {
    if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
    if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
    return '₹' + val.toLocaleString('en-IN');
  };

  // Find the top two material contributions
  const sortedCosts = [...analytics.materialCostDistribution].sort((a, b) => b.value - a.value);
  const primaryItem = sortedCosts[0] || { name: 'Raw Material', value: totalCost * 0.65, color: '#f97316' };
  const secondaryItem = sortedCosts[1] || { name: 'Scrap Metal', value: totalCost * 0.35, color: '#8b5cf6' };

  // Calculate percentages
  const primaryPercent = totalCost > 0 ? (primaryItem.value / totalCost) * 100 : 65;
  const secondaryPercent = totalCost > 0 ? (secondaryItem.value / totalCost) * 100 : 35;

  return (
    <Card sx={{
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      border: '1px solid #e2e8f0',
      bgcolor: '#ffffff',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 3, '&:last-child': { pb: 3 } }}>
        
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
            Balance Distribution
          </Typography>
          <Typography sx={{ fontSize: '1rem', color: '#94a3b8', cursor: 'pointer' }}>
            ···
          </Typography>
        </Box>

        {/* Large cost balance display */}
        <Box>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 955, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1 }}>
            {formatCostLakhs(totalCost)}
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, mt: 0.5 }}>
            Total material cost balance
          </Typography>
        </Box>

        {/* 3D Cylindrical blocks representing distributions */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-around', 
          alignItems: 'flex-end', 
          flex: 1, 
          minHeight: 140, 
          pb: 1,
          gap: 3 
        }}>
          {/* Orange Block - Primary Material Cost */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            width: '45%' 
          }}>
            {/* 3D Cylindrical Bar */}
            <Box sx={{
              width: 56,
              height: `${80 * (primaryPercent / 100)}px`,
              minHeight: 35,
              borderRadius: 3.5,
              background: 'linear-gradient(180deg, #ff9e59 0%, #f97316 100%)',
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.35), inset -3px -3px 8px rgba(194, 65, 12, 0.4), inset 3px 3px 6px rgba(255, 255, 255, 0.3)',
              position: 'relative',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scaleY(1.05)',
                boxShadow: '0 12px 30px rgba(249, 115, 22, 0.5)'
              }
            }} />
            <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', mt: 1.5, textAlign: 'center' }}>
              {primaryItem.name}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: '#f97316', fontWeight: 800, mt: 0.25 }}>
              {primaryPercent.toFixed(0)}% ({formatCostLakhs(primaryItem.value)})
            </Typography>
          </Box>

          {/* Purple Block - Secondary Material Cost */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            width: '45%' 
          }}>
            {/* 3D Cylindrical Bar */}
            <Box sx={{
              width: 56,
              height: `${80 * (secondaryPercent / 100)}px`,
              minHeight: 35,
              borderRadius: 3.5,
              background: 'linear-gradient(180deg, #c084fc 0%, #8b5cf6 100%)',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35), inset -3px -3px 8px rgba(109, 40, 217, 0.4), inset 3px 3px 6px rgba(255, 255, 255, 0.3)',
              position: 'relative',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scaleY(1.05)',
                boxShadow: '0 12px 30px rgba(139, 92, 246, 0.5)'
              }
            }} />
            <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', mt: 1.5, textAlign: 'center' }}>
              {secondaryItem.name}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: '#8b5cf6', fontWeight: 800, mt: 0.25 }}>
              {secondaryPercent.toFixed(0)}% ({formatCostLakhs(secondaryItem.value)})
            </Typography>
          </Box>
        </Box>

      </CardContent>
    </Card>
  );
};

export default MaterialCostDistributionCard;
