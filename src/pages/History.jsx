import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Clock, CheckCircle, XCircle, ShieldAlert, ExternalLink, Trash2 } from 'lucide-react';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('post_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoading(false);
  };

  const deleteHistory = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    const { error } = await supabase.from('post_history').delete().eq('id', id);
    if (!error) {
      setHistory(history.filter(h => h.id !== id));
    }
  };

  const filteredHistory = history.filter(h => 
    h.group_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.post_text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    if (status.includes('✅')) return <span className="badge-success" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px' }}>تم النشر بنجاح</span>;
    if (status.includes('👮') || status.includes('Pending')) return <span className="badge-warning" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '20px', fontSize: '11px' }}>بانتظار المشرف</span>;
    return <span className="badge-error" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px' }}>فشل النشر</span>;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Post History</h1>
          <p>سجل العمليات السابقة وحالة كل منشور في الجروبات.</p>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} color="var(--text2)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input 
            type="text" 
            placeholder="بحث في السجل..." 
            className="form-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px', width: '100%' }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '15px' }}>تاريخ العملية</th>
              <th style={{ padding: '15px' }}>اسم الجروب</th>
              <th style={{ padding: '15px' }}>نص المنشور</th>
              <th style={{ padding: '15px' }}>الحالة</th>
              <th style={{ padding: '15px' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>جاري التحميل...</td></tr>
            ) : filteredHistory.length > 0 ? (
              filteredHistory.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                  <td style={{ padding: '15px', fontSize: '13px', color: 'var(--text2)' }}>
                    {new Date(item.created_at).toLocaleString('ar-EG')}
                  </td>
                  <td style={{ padding: '15px', fontWeight: 'bold' }}>{item.group_name}</td>
                  <td style={{ padding: '15px', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.post_text}
                  </td>
                  <td style={{ padding: '15px' }}>
                    {getStatusBadge(item.status)}
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {item.post_url && (
                        <a href={item.post_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }} title="رابط البوست">
                          <ExternalLink size={18} />
                        </a>
                      )}
                      <button onClick={() => deleteHistory(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }} title="حذف من السجل">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>لا يوجد سجل عمليات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
