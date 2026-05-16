import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, MessageSquare, CheckCircle, Clock, Calendar, Zap, AlertCircle, Eye, XCircle, ShieldAlert, List } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ profiles: 0, groups: 0, success: 0, failed: 0, pending: 0 });
  const [subscription, setSubscription] = useState({ days: 0, plan: '...', expiresAt: null, isLifetime: false });
  const [liveStatus, setLiveStatus] = useState([]);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: groupsCount } = await supabase.from('groups').select('*', { count: 'exact', head: true });

      const savedSuccess = parseInt(localStorage.getItem('total_success_count')) || 0;
      const savedFailed = parseInt(localStorage.getItem('total_failed_count')) || 0;
      const savedPending = parseInt(localStorage.getItem('total_pending_count')) || 0;

      setStats({
        profiles: profilesCount || 0,
        groups: groupsCount || 0,
        success: savedSuccess,
        failed: savedFailed,
        pending: savedPending
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('plan, expires_at, status')
          .eq('id', user.id)
          .maybeSingle();

        if (userData) {
          const planMap = {
            'weekly': 'أسبوعية',
            'monthly': 'شهرية',
            'yearly': 'سنوية',
            'lifetime': 'مدى الحياة'
          };

          if (userData.plan === 'lifetime') {
            setSubscription({ isLifetime: true, plan: 'مدى الحياة' });
          } else if (userData.expires_at) {
            const diff = new Date(userData.expires_at) - new Date();
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            setSubscription({
              days: days > 0 ? days : 0,
              plan: planMap[userData.plan] || userData.plan,
              expiresAt: userData.expires_at
            });
          } else {
            setSubscription(prev => ({ ...prev, plan: planMap[userData.plan] || userData.plan }));
          }
        }
      }
    };
    fetchStats();

    const interval = setInterval(() => {
      const extensionId = localStorage.getItem('fb_extension_id');
      if (extensionId && typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(extensionId, { action: "GET_POSTING_STATUS" }, (response) => {
          if (response && response.isRunning) {
            setIsPosting(true);
            setLiveStatus(response.results || []);
          } else {
            setIsPosting(false);
          }
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const resetStats = () => {
    if (window.confirm('هل أنت متأكد من تصفير جميع إحصائيات النشر (ناجح، ملغي، بانتظار المشرف)؟')) {
      localStorage.setItem('total_success_count', '0');
      localStorage.setItem('total_failed_count', '0');
      localStorage.setItem('total_pending_count', '0');
      setStats(prev => ({ ...prev, success: 0, failed: 0, pending: 0 }));
    }
  };

  const StatCard = ({ icon, title, value, color }) => (
    <div className="card" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center',
      borderBottom: `3px solid ${color}`
    }}>
      <div style={{ color: color, marginBottom: '10px' }}>{icon}</div>
      <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 'bold', marginBottom: '5px' }}>{title}</span>
      <span style={{ fontSize: '24px', fontWeight: '900' }}>{value.toLocaleString()}</span>
    </div>
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Dashboard Overview</h1>
          <p>Welcome back to AutoPost.</p>
        </div>
        <button 
          onClick={resetStats} 
          className="btn" 
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: 'var(--error)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px'
          }}
        >
          <XCircle size={16} /> تصفير الإحصائيات
        </button>
      </div>

      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(108, 99, 255, 0.05))',
          border: '1px solid rgba(108, 99, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '30px'
        }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
            <Zap size={120} color="var(--accent)" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{
              width: '50px', height: '50px',
              background: 'var(--accent)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 20px rgba(108,99,255,0.3)'
            }}>
              <Calendar size={24} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>حالة الاشتراك</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)' }}>
                {subscription.isLifetime ? 'خطة مدى الحياة نشطة' : `خطة ${subscription.plan} نشطة`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {subscription.isLifetime ? (
              <span style={{ fontSize: '36px', fontWeight: '900', color: 'var(--accent)' }}>∞</span>
            ) : (
              <span style={{ fontSize: '36px', fontWeight: '900', color: subscription.days <= 3 ? 'var(--error)' : 'var(--accent)' }}>
                {subscription.days}
              </span>
            )}
            <span style={{ fontSize: '16px', color: 'var(--text2)', fontWeight: 'bold' }}>
              {subscription.isLifetime ? 'Lifetime Access' : 'DAYS REMAINING'}
            </span>
          </div>

          <div style={{
            marginTop: '20px',
            padding: '10px 15px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Clock size={14} color="var(--accent2)" />
            <span>
              {subscription.isLifetime ? 'الاشتراك لا ينتهي أبداً' :
                subscription.expiresAt ? `ينتهي في: ${new Date(subscription.expiresAt).toLocaleDateString('ar-EG')}` :
                  'بانتظار التفعيل...'}
            </span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <List size={18} color="var(--accent)" /> شاشة مراقبة النشر الحي
            </h4>
            {isPosting && (
                <span className="badge-pulse" style={{ background: 'var(--success)', fontSize: '10px', padding: '4px 10px', borderRadius: '20px' }}>
                    جاري النشر حالياً...
                </span>
            )}
          </div>
          
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {liveStatus.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                            <th style={{ padding: '8px' }}>الجروب</th>
                            <th style={{ padding: '8px' }}>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {liveStatus.map((res, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '8px' }}>{res.group_name}</td>
                                <td style={{ padding: '8px', color: res.status.includes('✅') ? 'var(--success)' : res.status.includes('👮') ? '#f59e0b' : 'var(--error)' }}>
                                    {res.status}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                    <Zap size={30} style={{ opacity: 0.2, marginBottom: '10px' }} />
                    <p>لا يوجد عمليات نشر نشطة حالياً.</p>
                </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
        <StatCard icon={<Users size={24} />} title="الحسابات" value={stats.profiles} color="var(--accent)" />
        <StatCard icon={<MessageSquare size={24} />} title="الجروبات" value={stats.groups} color="#3b82f6" />
        <StatCard icon={<CheckCircle size={24} />} title="نشر ناجح" value={stats.success} color="var(--success)" />
        <StatCard icon={<XCircle size={24} />} title="نشر ملغي" value={stats.failed} color="var(--error)" />
        <StatCard icon={<ShieldAlert size={24} />} title="بانتظار المشرف" value={stats.pending} color="#f59e0b" />
      </div>
    </div>
  );
}