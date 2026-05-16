import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const activeId = localStorage.getItem('active_profile_id');
    if (activeId) {
      fetchGroups(activeId);
    }
    
    // Check if we are returning from a sync
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('sync') === 'true') {
      processSyncedGroups();
    }
  }, []);

  const processSyncedGroups = () => {
    const extensionId = localStorage.getItem('fb_extension_id');
    if (!extensionId || typeof chrome === 'undefined' || !chrome.runtime) return;

    // eslint-disable-next-line no-undef
    chrome.runtime.sendMessage(extensionId, { action: "GET_SYNCED_GROUPS" }, async (response) => {
      // eslint-disable-next-line no-undef
      if (chrome.runtime.lastError) {
         console.warn("AutoPost Extension not connected:", chrome.runtime.lastError.message);
         return;
      }
      if (response && response.data) {
        const newGroups = response.data;
        
        // Fetch current groups to avoid duplicates
        const { data: existingGroups } = await supabase.from('groups').select('group_url');
        const existingUrls = new Set(existingGroups?.map(g => g.group_url) || []);
        
        // Use the active profile ID
        const userId = localStorage.getItem('active_profile_id');
        if (!userId) {
           alert("يجب اختيار حساب نشط من صفحة Accounts أولاً.");
           return;
        }

        const groupsToInsert = newGroups.filter(g => !existingUrls.has(g.group_url)).map(g => ({
          profile_id: userId,
          group_name: g.group_name,
          group_url: g.group_url,
          group_image: g.group_image
        }));

        if (groupsToInsert.length > 0) {
          const { error } = await supabase.from('groups').insert(groupsToInsert);
          if (error) {
             alert('خطأ في حفظ الجروبات: ' + error.message);
          } else {
             showSyncToast(`✅ تمت إضافة ${groupsToInsert.length} جروب بنجاح!`, 'success');
             fetchGroups();
          }
        } else {
           showSyncToast("ℹ️ لم يتم العثور على جروبات جديدة.", 'info');
        }
        
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });
  };

  const fetchGroups = async (activeId) => {
    const id = activeId || localStorage.getItem('active_profile_id');
    if (!id) return;

    const { data, error } = await supabase.from('groups').select('*').eq('profile_id', id);
    if (!error && data) {
      // فلترة الجروبات لإزالة أي جروب اسمه "Create New Group" كان قد تم التقاطه مسبقاً
      const validGroups = data.filter(g => 
        !g.group_name.toLowerCase().includes('create new group') && 
        !g.group_name.includes('إنشاء مجموعة')
      );
      setGroups(validGroups);
    }
  };

  const [modal, setModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

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

  const handleDelete = async (id, name) => {
    openConfirmModal(
      'حذف الجروب',
      `هل أنت متأكد من حذف الجروب: ${name}؟`,
      async () => {
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (error) {
          alert('حدث خطأ أثناء الحذف.');
        } else {
          setGroups(groups.filter(g => g.id !== id));
        }
      }
    );
  };

  const handleEdit = async (id, currentName) => {
    const newName = window.prompt("تعديل اسم الجروب:", currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      const { error } = await supabase.from('groups').update({ group_name: newName.trim() }).eq('id', id);
      if (error) {
        alert('حدث خطأ أثناء التعديل.');
      } else {
        setGroups(groups.map(g => g.id === id ? { ...g, group_name: newName.trim() } : g));
      }
    }
  };

  const [syncMessage, setSyncMessage] = useState({ text: null, type: 'info' });

  const showSyncToast = (text, type = 'info') => {
    setSyncMessage({ text, type });
    setTimeout(() => setSyncMessage({ text: null, type: 'info' }), 6000);
  };

  const handleSyncGroups = () => {
    const extensionId = localStorage.getItem('fb_extension_id');
    if (!extensionId) {
      alert('يرجى إضافة معرف الإضافة (Extension ID) في صفحة الإعدادات أولاً!');
      return;
    }

    try {
      // eslint-disable-next-line no-undef
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // eslint-disable-next-line no-undef
        chrome.runtime.sendMessage(extensionId, { action: "SYNC_GROUPS_ONLY" }, (response) => {
          if (chrome.runtime.lastError) {
            alert('تعذر الاتصال بالإضافة.');
          } else {
            showSyncToast('تم إرسال الأمر. سيتم فتح صفحة الجروبات لجمعها...');
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.group_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Custom Confirmation Modal */}
      {modal.show && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            width: '90%',
            maxWidth: '400px',
            padding: '30px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '70px', height: '70px',
              background: 'rgba(255, 68, 68, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#ff4444'
            }}>
              <AlertTriangle size={36} />
            </div>
            
            <h2 style={{ fontSize: '22px', marginBottom: '10px', fontWeight: 'bold' }}>{modal.title}</h2>
            <p style={{ color: 'var(--text2)', fontSize: '15px', lineHeight: '1.6', marginBottom: '25px' }}>
              {modal.message}
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={closeConfirmModal}
                className="btn" 
                style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text)' }}
              >
                إلغاء
              </button>
              <button 
                onClick={executeConfirm}
                className="btn" 
                style={{ flex: 1, background: '#ff4444' }}
              >
                تأكيد الحذف
              </button>
            </div>

            <button 
              onClick={closeConfirmModal}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
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

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1>Groups Management</h1>
          <p>إدارة وتعديل جميع مجموعاتك على فيسبوك.</p>
        </div>
        <div style={{ position: 'relative', width: '300px', display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text2)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input 
              type="text" 
              placeholder="ابحث عن جروب..." 
              className="form-input" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', width: '100%' }}
            />
          </div>
          <button onClick={handleSyncGroups} className="btn" style={{ background: 'var(--accent)', whiteSpace: 'nowrap' }}>
            🔄 سحب الجروبات
          </button>
        </div>
      </div>

      <div className="groups-grid">
        {filteredGroups.map(group => (
          <div key={group.id} className="group-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
              <button 
                onClick={() => handleEdit(group.id, group.group_name)}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '5px' }}
                title="تعديل اسم الجروب"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleDelete(group.id, group.group_name)}
                style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '5px' }}
                title="حذف الجروب"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="group-img">
              {group.group_image ? (
                <img src={group.group_image} alt={group.group_name} />
              ) : (
                <div style={{ fontSize: '24px', lineHeight: '48px' }}>👥</div>
              )}
            </div>
            <div className="group-name" title={group.group_name} style={{ marginTop: '10px' }}>
              {group.group_name}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && <p style={{ color: 'var(--text2)', gridColumn: '1 / -1' }}>لا توجد جروبات مطابقة.</p>}
      </div>
    </div>
  );
}
