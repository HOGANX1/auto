import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserPlus, Trash2, RefreshCw, X, AlertTriangle, Check } from 'lucide-react';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(localStorage.getItem('active_profile_id'));
  const location = useLocation();
  const navigate = useNavigate();
  const isProcessingRef = useRef(false);

  const [modal, setModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('sync') === 'true' && !isProcessingRef.current) {
      handleIncomingSyncData();
    }
  }, [location.search]);

  const fetchAccounts = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      setAccounts(data);
      // إذا لم يكن هناك حساب نشط، اجعل أول حساب هو النشط تلقائياً
      if (!localStorage.getItem('active_profile_id') && data.length > 0) {
        handleSwitchAccount(data[0].id);
      }
    }
  };

  const [syncMessage, setSyncMessage] = useState({ text: null, type: 'info' });

  const showSyncToast = (text, type = 'info') => {
    setSyncMessage({ text, type });
    setTimeout(() => setSyncMessage({ text: null, type: 'info' }), 6000);
  };

  const openConfirmModal = (title, message, onConfirm) => {
    setModal({ show: true, title, message, onConfirm });
  };

  const closeConfirmModal = () => {
    setModal({ ...modal, show: false });
  };

  const executeConfirm = async () => {
    if (modal.onConfirm) await modal.onConfirm();
    closeConfirmModal();
  };

  const deleteAccount = async (id, name) => {
    openConfirmModal(
      'حذف الحساب',
      `هل أنت متأكد من حذف الحساب: ${name} وكل مجموعاته؟`,
      async () => {
        await supabase.from('profiles').delete().eq('id', id);
        if (activeProfileId === id) {
          localStorage.removeItem('active_profile_id');
          setActiveProfileId(null);
        }
        fetchAccounts();
      }
    );
  };

  const handleSwitchAccount = (id) => {
    localStorage.setItem('active_profile_id', id);
    setActiveProfileId(id);
    showSyncToast('تم تبديل الحساب النشط بنجاح.');
  };

  const handleIncomingSyncData = async () => {
    const extensionId = localStorage.getItem('fb_extension_id');
    if (!extensionId || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsSyncing(true);
    navigate('/accounts', { replace: true });

    try {
      // eslint-disable-next-line no-undef
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // eslint-disable-next-line no-undef
        chrome.runtime.sendMessage(extensionId, { action: "GET_SYNCED_DATA" }, async (response) => {
          if (response && response.data) {
            const payload = response.data;

            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', payload.profile.username)
              .maybeSingle();

            if (existing) {
              alert(`الحساب (${payload.profile.username}) موجود بالفعل مسبقاً.`);
              setIsSyncing(false);
              isProcessingRef.current = false;
              return;
            }

            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .insert([{
                username: payload.profile.username || 'حساب جديد',
                avatar_url: payload.profile.avatar_url || ''
              }])
              .select();

            if (profileError) {
              alert('حدث خطأ أثناء حفظ الحساب.');
              setIsSyncing(false);
              isProcessingRef.current = false;
              return;
            }

            const newProfileId = profileData[0].id;

            if (payload.groups && payload.groups.length > 0) {
              const groupsToInsert = payload.groups.map(g => ({
                profile_id: newProfileId,
                group_name: g.group_name,
                group_url: g.group_url,
                group_image: g.group_image || ''
              }));
              await supabase.from('groups').insert(groupsToInsert);
            }

            showSyncToast(`✅ تم إضافة الحساب (${payload.profile.username}) بنجاح!`, 'success');
            fetchAccounts();
          }
          setIsSyncing(false);
          isProcessingRef.current = false;
        });
      }
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
      isProcessingRef.current = false;
    }
  };

  const handleAddAccount = () => {
    const extensionId = localStorage.getItem('fb_extension_id');
    const serialKey = localStorage.getItem('app_serial_key');

    if (!extensionId) {
      alert('يرجى إضافة معرف الإضافة في الإعدادات أولاً!');
      return;
    }

    if (!serialKey) {
      alert('⚠️ يرجى تفعيل البرنامج بالسيريال كود من صفحة الإعدادات أولاً!');
      navigate('/settings');
      return;
    }

    // eslint-disable-next-line no-undef
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // eslint-disable-next-line no-undef
      chrome.runtime.sendMessage(extensionId, { action: "SYNC_ACCOUNT" }, (response) => {
        if (chrome.runtime.lastError) {
          alert('تعذر الاتصال بالإضافة.');
        } else {
          showSyncToast('تم إرسال الأمر. سيتم فتح صفحة فيسبوك لبدء المزامنة...');
        }
      });
    }
  };

  return (
    <div>
      {/* Modal */}
      {modal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
             <AlertTriangle size={48} color="#ff4444" style={{ marginBottom: '15px' }} />
             <h3>{modal.title}</h3>
             <p style={{ color: 'var(--text2)', margin: '10px 0 20px' }}>{modal.message}</p>
             <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={closeConfirmModal} className="btn" style={{ flex: 1, background: 'var(--bg3)' }}>إلغاء</button>
               <button onClick={executeConfirm} className="btn" style={{ flex: 1, background: '#ff4444' }}>تأكيد</button>
             </div>
          </div>
        </div>
      )}

      {/* Styled Sync Message */}
      {syncMessage.text && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: syncMessage.type === 'success' ? 'rgba(34, 197, 94, 0.95)' : 'rgba(108, 99, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          padding: '16px 28px',
          borderRadius: '50px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          border: `1px solid ${syncMessage.type === 'success' ? '#4ade80' : '#818cf8'}`
        }}>
          <div style={{ 
            width: '10px', height: '10px', 
            background: '#fff', 
            borderRadius: '50%', 
            animation: 'pulse 1.5s infinite',
            boxShadow: '0 0 10px #fff'
          }}></div>
          <span style={{ fontWeight: '800', fontSize: '15px', letterSpacing: '0.3px' }}>{syncMessage.text}</span>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Accounts Management</h1>
          <p>قم بإدارة حسابات فيسبوك والتبديل بينها.</p>
        </div>
        <button className="btn" onClick={handleAddAccount} disabled={isSyncing}>
          {isSyncing ? <RefreshCw size={18} className="spin" /> : <UserPlus size={18} />}
          {isSyncing ? ' جاري الحفظ...' : ' Add Account'}
        </button>
      </div>

      <div className="groups-grid">
        {accounts.map(acc => (
          <div key={acc.id} className="group-card" style={{ border: activeProfileId === acc.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
            <button onClick={() => deleteAccount(acc.id, acc.username)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
              <Trash2 size={16} />
            </button>
            <div className="group-img">
              {acc.avatar_url ? <img src={acc.avatar_url} /> : <div style={{ fontSize: '24px' }}>👤</div>}
            </div>
            <div className="group-name" style={{ marginTop: '10px', fontWeight: 'bold' }}>{acc.username}</div>
            <button 
              className="btn" 
              onClick={() => handleSwitchAccount(acc.id)}
              style={{ 
                marginTop: '15px', width: '100%', fontSize: '13px', 
                background: activeProfileId === acc.id ? 'var(--success)' : 'var(--bg3)',
                color: activeProfileId === acc.id ? '#fff' : 'var(--text)'
              }}
            >
              {activeProfileId === acc.id ? <Check size={14} style={{ marginRight: '5px' }} /> : null}
              {activeProfileId === acc.id ? 'Active' : 'Switch Account'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
