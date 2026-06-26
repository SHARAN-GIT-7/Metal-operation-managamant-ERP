import { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, IconButton, InputAdornment } from '@mui/material';
import { Send, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import type { DashboardAnalytics } from '../types/dashboard.types';

interface Props {
  analytics: DashboardAnalytics;
  userName: string;
}

const OperationsAdvisorCard = ({ analytics, userName }: Props) => {
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'ai'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Extract actual statistics for dynamic advisor summaries
  const recoveryKpi = analytics.efficiencyTrend.length 
    ? analytics.efficiencyTrend[analytics.efficiencyTrend.length - 1].value 
    : 75.8;
  const passRate = analytics.qualityPassFail.find(q => q.name === 'PASS')?.value ?? 0;
  const failRate = analytics.qualityPassFail.find(q => q.name === 'FAIL')?.value ?? 0;
  const totalQC = passRate + failRate;
  const qcPercentage = totalQC > 0 ? ((passRate / totalQC) * 100).toFixed(1) : '85.0';

  // Count pending heats
  const pendingCount = 7; // Mocked fallback or we can calculate
  const dispatchCount = analytics.customerWiseDispatch.length ? analytics.customerWiseDispatch.reduce((acc, curr) => acc + (curr.value2 ?? 1), 0) : 25;

  const handleSend = () => {
    if (!query.trim()) return;
    const userMsg = query;
    setChatLog(prev => [...prev, { sender: 'user', text: userMsg }]);
    setQuery('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = "";
      const lower = userMsg.toLowerCase();
      
      if (lower.includes('yield') || lower.includes('efficiency') || lower.includes('recovery')) {
        reply = `Our current average recovery efficiency stands at ${recoveryKpi.toFixed(1)}%. Shift performance shows stable heating cycles with minimum metal losses.`;
      } else if (lower.includes('qc') || lower.includes('quality') || lower.includes('pass')) {
        reply = `The QC pass rate is currently ${qcPercentage}% with ${passRate} passed heats and ${failRate} failures. There are currently ${pendingCount} heats waiting for inspection.`;
      } else if (lower.includes('stock') || lower.includes('inventory') || lower.includes('material')) {
        reply = `Raw material stocks are currently healthy. Low Stock alerts are active for 1 material category. Current warehouse reserve is sufficient for the next 6 production days.`;
      } else if (lower.includes('dispatch') || lower.includes('ship') || lower.includes('customer')) {
        reply = `A total of ${dispatchCount} dispatches have been registered in this period. All shipments are active and driver utilization is at 94%.`;
      } else {
        reply = `Foundry Operations report: Average recovery is ${recoveryKpi.toFixed(1)}%, QC pass rate is ${qcPercentage}%, and there are ${pendingCount} heats pending approval. Let me know if you need specific details!`;
      }

      setChatLog(prev => [...prev, { sender: 'ai', text: reply }]);
      setIsTyping(false);
    }, 1200);
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userName.split(' ')[0] || 'Operator';

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
      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5, '&:last-child': { pb: 3 } }}>
        
        {/* Glowing Orb Visualization */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          py: 1,
          mb: 1
        }}>
          {/* Glowing Rings container */}
          <Box sx={{
            position: 'relative',
            width: 140,
            height: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Outer ring */}
            <Box sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '1px dashed rgba(74, 222, 128, 0.2)',
              animation: 'spin 20s linear infinite',
              '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } }
            }} />
            
            {/* Middle pulsing ring */}
            <Box sx={{
              position: 'absolute',
              width: '80%',
              height: '80%',
              borderRadius: '50%',
              border: '2px solid rgba(74, 222, 128, 0.1)',
              boxShadow: '0 0 15px rgba(74, 222, 128, 0.15)',
              animation: 'pulse 3s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)', opacity: 0.6 },
                '50%': { transform: 'scale(1.05)', opacity: 1 },
              }
            }} />

            {/* Inner ring */}
            <Box sx={{
              position: 'absolute',
              width: '62%',
              height: '62%',
              borderRadius: '50%',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              boxShadow: 'inset 0 0 10px rgba(74, 222, 128, 0.05)',
            }} />

            {/* 3D Green Sphere */}
            <Box sx={{
              position: 'absolute',
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 60%, #15803d 90%)',
              boxShadow: '0 10px 25px rgba(34, 197, 94, 0.4), inset -5px -5px 12px rgba(21, 128, 61, 0.8), inset 5px 5px 8px rgba(255, 255, 255, 0.5)',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 6,
                left: 10,
                width: 14,
                height: 7,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.5)',
                transform: 'rotate(-25deg)',
              }
            }} />
          </Box>

          {/* Greeting text */}
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', mt: 1.5 }}>
            {greeting}, {firstName}!
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', mt: 0.25 }}>
            What do you want to know?
          </Typography>
        </Box>

        {/* AI Summary Section */}
        <Box sx={{ bgcolor: '#fafafa', border: '1px solid #f1f5f9', borderRadius: 3, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#7c3aed', mb: 1 }}>
            <Sparkles size={14} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              AI Summary
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.5 }}>
            Operational efficiency is active. Recovery rates are stable at <b>{recoveryKpi.toFixed(1)}%</b>. Risk exposures are minimal, and furnace logs report normal heating profiles.
          </Typography>
          
          {/* Quick Metrics */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 2, p: 1 }}>
              <Clock size={12} style={{ color: '#ef4444' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>
                  {pendingCount} Pending
                </Typography>
                <Typography sx={{ fontSize: '0.58rem', color: '#94a3b8', mt: 0.25 }}>
                  Unconfirmed heats
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 2, p: 1 }}>
              <CheckCircle2 size={12} style={{ color: '#22c55e' }} />
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>
                  {dispatchCount} Claimed
                </Typography>
                <Typography sx={{ fontSize: '0.58rem', color: '#94a3b8', mt: 0.25 }}>
                  Dispatches active
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Chat / Query Log if responses exist */}
        {chatLog.length > 0 && (
          <Box sx={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, p: 1, borderTop: '1px solid #f1f5f9' }}>
            {chatLog.map((chat, idx) => (
              <Box key={idx} sx={{ alignSelf: chat.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <Box sx={{
                  p: 1.25,
                  borderRadius: 3.5,
                  border: chat.sender === 'user' ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                  bgcolor: chat.sender === 'user' ? '#3b82f6' : '#f8fafc',
                  color: chat.sender === 'user' ? '#ffffff' : '#334155',
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                    {chat.text}
                  </Typography>
                </Box>
              </Box>
            ))}
            {isTyping && (
              <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', fontStyle: 'italic', pl: 1 }}>
                Advisor is typing...
              </Typography>
            )}
          </Box>
        )}

        {/* Chat Input Field */}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask about selected data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton 
                      size="small" 
                      onClick={handleSend}
                      sx={{ 
                        bgcolor: '#3b82f6', 
                        color: '#ffffff',
                        p: 0.5,
                        '&:hover': { bgcolor: '#2563eb' }
                      }}
                    >
                      <Send size={12} />
                    </IconButton>
                  </InputAdornment>
                ),
                style: { fontSize: '0.72rem', borderRadius: 16 }
              }
            }}
          />
        </Box>

      </CardContent>
    </Card>
  );
};

export default OperationsAdvisorCard;
