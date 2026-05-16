import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Image as ImageIcon, Trash2, ArrowRight, ArrowLeft, Clock, Grid, Type, Save, Square, ExternalLink, RefreshCw } from 'lucide-react';

export default function Posters() {
  const [allGroups, setAllGroups] = useState([]);
  const [targetGroups, setTargetGroups] = useState([]);
  const [postText, setPostText] = useState('');
  const [timer, setTimer] = useState(15);
  const [sleepTime, setSleepTime] = useState(5);
  const [parallel, setParallel] = useState(2);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [savedPosts, setSavedPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [postingStatus, setPostingStatus] = useState(null);
  const [originalGroups, setOriginalGroups] = useState([]);
  const [groupLists, setGroupLists] = useState([]);
  const [selectedGroupList, setSelectedGroupList] = useState('');
  const [syncMessage, setSyncMessage] = useState({ text: null, type: 'info' });
  const [searchAllQuery, setSearchAllQuery] = useState('');
  const [searchTargetQuery, setSearchTargetQuery] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchGroups();
    fetchSavedPosts();
    fetchGroupLists();

    const fetchPostingStatus = () => {
      const extensionId = localStorage.getItem('fb_extension_id');
      if (!extensionId) {
        setIsExtensionConnected(false);
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(extensionId, { action: "GET_POSTING_STATUS" }, (response) => {
          if (chrome.runtime.lastError) {
            setIsExtensionConnected(false);
          } else {
            setIsExtensionConnected(true);
            if (response) setPostingStatus(response);
          }
        });
      } else {
        setIsExtensionConnected(false);
      }
    };
    const interval = setInterval(fetchPostingStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Track successful posts to update the counter and save history
  useEffect(() => {
    if (postingStatus && postingStatus.results) {
      // 1. تحديث العدادات العامة (Success, Failed, Pending)
      const currentResults = postingStatus.results;
      const lastCountedIdx = parseInt(sessionStorage.getItem('last_counted_idx') || '-1');
      
      if (currentResults.length - 1 > lastCountedIdx) {
        const newResults = currentResults.slice(lastCountedIdx + 1);
        
        newResults.forEach(async (res) => {
          // تحديث العدادات في localStorage
          if (res.status.includes('✅')) {
            const count = parseInt(localStorage.getItem('total_success_count') || '0');
            localStorage.setItem('total_success_count', count + 1);
          } else if (res.status.includes('👮')) {
            const count = parseInt(localStorage.getItem('total_pending_count') || '0');
            localStorage.setItem('total_pending_count', count + 1);
          } else if (res.status.includes('❌')) {
            const count = parseInt(localStorage.getItem('total_failed_count') || '0');
            localStorage.setItem('total_failed_count', count + 1);
          }

          // حفظ العملية في سجل البوستات (Supabase)
          await supabase.from('post_history').insert([{
            profile_id: localStorage.getItem('active_profile_id'),
            group_name: res.group_name,
            post_text: postText,
            status: res.status,
            post_url: res.url
          }]);
        });

        sessionStorage.setItem('last_counted_idx', (currentResults.length - 1).toString());
      }

      // Reset session counter if a new posting session starts
      if (postingStatus.isRunning && postingStatus.current === 1 && postingStatus.results.length <= 1) {
        sessionStorage.setItem('last_counted_idx', '-1');
      }
    }
  }, [postingStatus, postText]);

  const fetchGroups = async () => {
    const activeId = localStorage.getItem('active_profile_id');
    if (!activeId) return;
    const { data, error } = await supabase.from('groups').select('*').eq('profile_id', activeId);
    if (!error && data) {
      setOriginalGroups(data);
      setAllGroups(data);
    }
  };

  const fetchGroupLists = async () => {
    const activeId = localStorage.getItem('active_profile_id');
    if (!activeId) return;
    const { data, error } = await supabase
      .from('group_lists')
      .select('*')
      .eq('profile_id', activeId)
      .order('created_at', { ascending: false });
    if (!error && data) setGroupLists(data);
  };

  const deleteCategory = async () => {
    if (!selectedGroupList) return;
    
    setConfirmModal({
      show: true,
      title: 'حذف التصنيف',
      message: 'هل أنت متأكد من رغبتك في حذف هذا التصنيف نهائياً؟ لا يمكن التراجع عن هذه العملية.',
      onConfirm: async () => {
        const { error } = await supabase.from('group_lists').delete().eq('id', selectedGroupList);
        if (error) alert('خطأ: ' + error.message);
        else {
          showSyncToast('✅ تم الحذف بنجاح!', 'success');
          setSelectedGroupList('');
          setTargetGroups([]);
          setAllGroups(originalGroups);
          fetchGroupLists();
        }
      }
    });
  };

  const saveAsNewCategory = async () => {
    const activeId = localStorage.getItem('active_profile_id');
    if (!activeId) { alert('يرجى اختيار حساب نشط أولاً!'); return; }
    if (!newCategoryName.trim()) { alert('يرجى إدخال اسم للتصنيف'); return; }
    
    const { data, error } = await supabase.from('group_lists').insert([{ 
      name: newCategoryName, 
      groups: targetGroups,
      profile_id: activeId
    }]).select();
    
    if (error) alert('خطأ: ' + error.message);
    else {
      showSyncToast('✅ تم حفظ التصنيف بنجاح!', 'success');
      fetchGroupLists();
      setShowCategoryModal(false);
      setNewCategoryName('');
      if (data && data[0]) setSelectedGroupList(data[0].id);
    }
  };

  const updateCategory = async () => {
    if (!selectedGroupList) return;
    const { error } = await supabase.from('group_lists').update({ groups: targetGroups }).eq('id', selectedGroupList);
    if (error) alert('خطأ: ' + error.message);
    else alert('تم التحديث بنجاح!');
  };

  const fetchSavedPosts = async () => {
    const activeId = localStorage.getItem('active_profile_id');
    let query = supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (activeId) query = query.eq('profile_id', activeId);
    
    const { data, error } = await query;
    if (!error && data) setSavedPosts(data);
  };

  const showSyncToast = (text, type = 'info') => {
    setSyncMessage({ text, type });
    setTimeout(() => setSyncMessage({ text: null, type: 'info' }), 6000);
  };

  const savePostToSupabase = async (isSilent = false) => {
    if (!postText.trim() && mediaFiles.length === 0) {
      if (!isSilent) alert("يرجى كتابة نص أو إضافة مرفقات لحفظ المنشور.");
      return;
    }

    const activeId = localStorage.getItem('active_profile_id');
    const { error } = await supabase.from('posts').insert([{
      profile_id: activeId || null,
      category: 'عام',
      post_text: postText,
      media_files: mediaFiles
    }]);
    
    if (error) {
      if (!isSilent) alert("خطأ في الحفظ: " + error.message);
    } else {
      if (!isSilent) alert("تم حفظ المنشور بنجاح!");
      fetchSavedPosts();
    }
  };

  const loadSavedPost = (e) => {
    const postId = e.target.value;
    const id = e.target.value;
    setSelectedPostId(id);
    if (!id) {
      setPostText(''); setMediaFiles([]);
      return;
    }
    const post = savedPosts.find(p => p.id === id);
    if (post) {
      setPostText(post.post_text || '');
      setMediaFiles(post.media_files || []);
      setSelectedPostId(id);
    }
  };

  const moveToTarget = (group) => {
    setTargetGroups([...targetGroups, group]);
    setAllGroups(allGroups.filter(g => g.id !== group.id));
  };

  const moveToAll = (group) => {
    setAllGroups([...allGroups, group]);
    setTargetGroups(targetGroups.filter(g => g.id !== group.id));
  };

  const moveAllToTarget = () => {
    setTargetGroups([...targetGroups, ...allGroups]);
    setAllGroups([]);
  };

  const moveAllToAll = () => {
    setAllGroups([...allGroups, ...targetGroups]);
    setTargetGroups([]);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    for (const file of files) {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      const filePath = `posters/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('fb-images').upload(filePath, file);
      if (uploadError) alert('خطأ: ' + uploadError.message);
      else {
        const { data } = supabase.storage.from('fb-images').getPublicUrl(filePath);
        setMediaFiles(prev => [...prev, { url: data.publicUrl, path: filePath, type: file.type }]);
      }
    }
    setIsUploading(false);
  };

  const removeMedia = async (path, index) => {
    await supabase.storage.from('fb-images').remove([path]);
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const startAutoPosting = async () => {
    if (targetGroups.length === 0) { 
      showSyncToast("⚠️ يرجى اختيار مجموعات في قائمة Target أولاً.", 'error'); 
      return; 
    }
    if (!postText.trim() && mediaFiles.length === 0) { 
      showSyncToast("⚠️ يرجى كتابة نص أو إضافة صور للنشر.", 'error'); 
      return; 
    }
    
    const extensionId = localStorage.getItem('fb_extension_id');
    if (!extensionId) { 
      showSyncToast('⚠️ معرف الإضافة غير موجود! اذهب للإعدادات وضعه هناك.', 'error'); 
      return; 
    }

    if (!isExtensionConnected) {
      showSyncToast('❌ الإضافة غير متصلة! تأكد من تثبيتها وعمل Reload لها.', 'error');
      return;
    }

    // Save the post text to Supabase before starting (Silent save)
    try {
      await savePostToSupabase(true);
    } catch (e) {
      console.error('Failed to save post draft:', e);
    }

    const payload = { 
      groups: targetGroups, 
      postText, 
      mediaFiles, 
      timer: parseInt(timer) || 15,
      sleepTime: parseInt(sleepTime) || 5,
      parallel: parseInt(parallel) || 2
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('Sending START_POSTING to extension:', extensionId);
      chrome.runtime.sendMessage(extensionId, { action: "START_POSTING", payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Extension Error:', chrome.runtime.lastError);
          showSyncToast('❌ فشل الاتصال بالإضافة: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showSyncToast('🚀 انطلق! تم بدء النشر التلقائي بنجاح.', 'success');
        }
      });
    }
  };

  const stopAutoPosting = () => {
    const extensionId = localStorage.getItem('fb_extension_id');
    if (!extensionId) return;
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(extensionId, { action: "STOP_POSTING" }, (response) => {
        if (!chrome.runtime.lastError) showSyncToast('🛑 تم إيقاف النشر بنجاح.', 'info');
      });
    }
  };

  const handleCategorySelect = (e) => {
    const id = e.target.value;
    setSelectedGroupList(id);
    if (!id) { setTargetGroups([]); setAllGroups(originalGroups); return; }
    const list = groupLists.find(l => l.id === id);
    if (list) {
      setTargetGroups(list.groups || []);
      const targetIds = new Set((list.groups || []).map(g => g.id));
      setAllGroups(originalGroups.filter(g => !targetIds.has(g.id)));
    }
  };

  return (
    <div style={{ paddingBottom: '50px', position: 'relative' }}>
      {/* Custom Confirmation Modal */}
      {confirmModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{
            border: '1px solid var(--error)',
            borderRadius: '30px', width: '90%', maxWidth: '420px',
            padding: '40px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            textAlign: 'center', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              width: '80px', height: '80px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 25px', color: 'var(--error)'
            }}>
              <Trash2 size={40} />
            </div>

            <h2 style={{ fontSize: '26px', marginBottom: '15px', fontWeight: '900' }}>{confirmModal.title}</h2>
            <p style={{ color: 'var(--text2)', fontSize: '16px', lineHeight: '1.7', marginBottom: '35px' }}>{confirmModal.message}</p>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={async () => {
                  await confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, show: false });
                }} 
                className="btn" 
                style={{ flex: 2, padding: '15px', background: 'var(--error)', fontWeight: '800' }}
              >
                تأكيد الحذف
              </button>
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, show: false })} 
                className="btn" 
                style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text)', fontWeight: 'bold' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {syncMessage.text && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: syncMessage.type === 'success' ? 'rgba(34, 197, 94, 0.95)' : 'rgba(108, 99, 255, 0.95)', backdropFilter: 'blur(10px)', color: '#fff', padding: '16px 28px', borderRadius: '50px', boxShadow: '0 15px 35px rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', gap: '12px', animation: 'slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', border: `1px solid ${syncMessage.type === 'success' ? '#4ade80' : '#818cf8'}` }}>
          <div style={{ width: '10px', height: '10px', background: '#fff', borderRadius: '50%', animation: 'pulse 1.5s infinite', boxShadow: '0 0 10px #fff' }}></div>
          <span style={{ fontWeight: '800', fontSize: '15px' }}>{syncMessage.text}</span>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>Posters Configuration</h1>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '5px', 
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
              background: isExtensionConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isExtensionConnected ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${isExtensionConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', animation: isExtensionConnected ? 'pulse 1.5s infinite' : 'none' }}></div>
              {isExtensionConnected ? 'إضافة متصلة' : 'إضافة غير متصلة'}
            </div>
          </div>
          <p>إعداد المنشورات واختيار المجموعات المستهدفة للنشر التلقائي.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={savePostToSupabase} className="btn" style={{ background: 'var(--accent)', display: 'flex', gap: '8px', alignItems: 'center' }}><Save size={18} /> حفظ المنشور</button>
          {postingStatus?.isRunning ? (
            <button onClick={stopAutoPosting} className="btn" style={{ background: 'var(--error)', display: 'flex', gap: '8px', alignItems: 'center' }}><Square size={18} /> إيقاف النشر</button>
          ) : (
            <button onClick={startAutoPosting} className="btn" style={{ background: 'var(--success)', display: 'flex', gap: '8px', alignItems: 'center' }}><Send size={18} /> بدء النشر التلقائي</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ border: '1px solid var(--accent)', background: 'rgba(108, 99, 255, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Save size={20} color="var(--accent)" /> المنشورات المحفوظة
              </h3>
              <span style={{ fontSize: '12px', background: 'var(--bg3)', padding: '4px 10px', borderRadius: '10px', color: 'var(--text2)' }}>
                {savedPosts.length} منشور
              </span>
            </div>
            
            <div style={{ 
              maxHeight: '220px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: '12px',
              padding: '5px'
            }}>
              {savedPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text2)', border: '1px dashed var(--bg3)', borderRadius: '15px' }}>
                  <Save size={24} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <div style={{ fontSize: '13px' }}>لا توجد منشورات محفوظة حالياً</div>
                </div>
              ) : (
                savedPosts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => loadSavedPost({ target: { value: p.id } })}
                    style={{ 
                      padding: '15px', background: selectedPostId === p.id ? 'rgba(108, 99, 255, 0.1)' : 'var(--bg3)',
                      borderRadius: '16px', cursor: 'pointer', border: selectedPostId === p.id ? '1px solid var(--accent)' : '1px solid transparent',
                      transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden'
                    }}
                    onMouseOver={(e) => { if (selectedPostId !== p.id) e.currentTarget.style.transform = 'translateX(-5px)'; }}
                    onMouseOut={(e) => { if (selectedPostId !== p.id) e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent)', background: 'rgba(108, 99, 255, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        {p.category || 'عام'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text2)' }}>
                        {new Date(p.created_at).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '13px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      fontWeight: selectedPostId === p.id ? 'bold' : 'normal'
                    }}>
                      {p.post_text || (p.media_files?.length > 0 ? '📸 منشور وسائط' : 'منشور فارغ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '15px' }}><Grid size={18} color="var(--accent)" /> إعدادات المنشور</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Timer (انتظار بالثواني)</label>
                <input type="number" className="form-input" value={timer} onChange={e => setTimer(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Sleep (سكون بين الجولات)</label>
                <input type="number" className="form-input" value={sleepTime} onChange={e => setSleepTime(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Grid size={12} /> Parallel (عدد الجروبات المتوازية)</label>
              <input type="number" className="form-input" value={parallel} min="1" max="10" onChange={e => setParallel(e.target.value)} />
            </div>
            <div>
              <label><Type size={14} /> Text Poster (المحتوى)</label>
              <textarea className="form-input" rows="5" value={postText} onChange={e => setPostText(e.target.value)}></textarea>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '15px' }}><ImageIcon size={18} color="var(--accent)" /> المرفقات</h3>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="file" 
                id="file-upload"
                accept="image/*,video/*" 
                multiple 
                onChange={handleFileUpload} 
                disabled={isUploading} 
                style={{ display: 'none' }}
              />
              <label 
                htmlFor="file-upload"
                className="btn"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '30px 20px',
                  background: 'rgba(108, 99, 255, 0.05)',
                  border: '2px dashed var(--accent)',
                  borderRadius: '15px',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  width: '100%'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(108, 99, 255, 0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(108, 99, 255, 0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {isUploading ? (
                  <RefreshCw size={32} className="spin" color="var(--accent)" />
                ) : (
                  <ImageIcon size={32} color="var(--accent)" />
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text)' }}>
                    {isUploading ? 'جاري الرفع...' : 'اضغط هنا لرفع الصور أو الفيديوهات'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '5px' }}>
                    يمكنك اختيار ملفات متعددة في وقت واحد
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
              {mediaFiles.map((m, i) => (
                <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
                  {m.type?.startsWith('video') ? <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <button onClick={() => removeMedia(m.path, i)} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#ff4444', borderRadius: '50%' }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '10px' }}><Save size={18} color="var(--accent)" /> تصنيفات المجموعات</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select className="form-input" value={selectedGroupList} onChange={handleCategorySelect} style={{ flex: 1 }}>
                <option value="">-- اختر تصنيف --</option>
                {groupLists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.groups?.length})</option>)}
              </select>
              <button onClick={() => setShowCategoryModal(true)} className="btn" style={{ fontSize: '12px' }}>+ جديد</button>
              {selectedGroupList && (
                <>
                  <button onClick={updateCategory} className="btn" style={{ fontSize: '12px', background: 'var(--accent)' }}>حفظ</button>
                  <button onClick={deleteCategory} className="btn" style={{ fontSize: '12px', background: 'var(--error)' }}>حذف</button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3>All Groups ({allGroups.length})</h3>
              </div>
              <input 
                type="text" 
                placeholder="ابحث في جميع الجروبات..." 
                className="form-input" 
                style={{ marginBottom: '10px', fontSize: '12px', padding: '8px 12px' }}
                value={searchAllQuery}
                onChange={(e) => setSearchAllQuery(e.target.value)}
              />
              <button onClick={moveAllToTarget} className="btn" style={{ width: '100%', marginBottom: '10px', fontSize: '12px' }}>نقل الكل <ArrowRight size={14} /></button>
              <div style={{ height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {allGroups
                  .filter(g => g.group_name?.toLowerCase().includes(searchAllQuery.toLowerCase()))
                  .map(g => (
                    <div key={g.id} onClick={() => moveToTarget(g)} style={{ padding: '8px', background: 'var(--bg3)', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>
                      {g.group_name}
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="card" style={{ flex: 1, border: '1px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ color: 'var(--accent)' }}>Target ({targetGroups.length})</h3>
              </div>
              <input 
                type="text" 
                placeholder="ابحث في المختارة..." 
                className="form-input" 
                style={{ marginBottom: '10px', fontSize: '12px', padding: '8px 12px' }}
                value={searchTargetQuery}
                onChange={(e) => setSearchTargetQuery(e.target.value)}
              />
              <button onClick={moveAllToAll} className="btn" style={{ width: '100%', marginBottom: '10px', fontSize: '12px', background: 'var(--bg3)', color: 'var(--text)' }}><ArrowLeft size={14} /> استرجاع</button>
              <div style={{ height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {targetGroups
                  .filter(g => g.group_name?.toLowerCase().includes(searchTargetQuery.toLowerCase()))
                  .map(g => (
                    <div key={g.id} onClick={() => moveToAll(g)} style={{ padding: '8px', background: 'rgba(108, 99, 255, 0.1)', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>
                      {g.group_name}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {postingStatus && (postingStatus.isRunning || postingStatus.results.length > 0) && (
            <div className="card" style={{ border: '1px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: 'var(--accent)' }}>حالة النشر المباشر</h3>
                {postingStatus.isRunning ? (
                  <span style={{ background: 'var(--accent)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '5px', alignItems: 'center' }}><RefreshCw size={12} className="spin" /> جاري... ({postingStatus.current}/{postingStatus.total})</span>
                ) : (
                  <span style={{ background: 'var(--success)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>اكتمل</span>
                )}
              </div>

              {/* إظهار الجروبات التي يتم العمل عليها حالياً */}
              {postingStatus.isRunning && postingStatus.activeGroups && postingStatus.activeGroups.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                   <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px', fontWeight: 'bold' }}>يتم النشر الآن في:</div>
                   <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                     {postingStatus.activeGroups.map((g, idx) => (
                       <div key={idx} style={{ background: 'rgba(108, 99, 255, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                         <RefreshCw size={10} className="spin" /> {g}
                       </div>
                     ))}
                   </div>
                </div>
              )}

              <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {postingStatus.results.map((res, idx) => (
                  <div key={idx} style={{ padding: '10px', background: 'var(--bg3)', borderRadius: '10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${res.status.includes('✅') ? 'var(--success)' : 'var(--error)'}` }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{res.group_name}</div>
                      <div style={{ color: res.status.includes('✅') ? 'var(--success)' : 'var(--error)' }}>{res.status}</div>
                    </div>
                    {res.status.includes('✅') && (
                      <a href={res.url} target="_blank" rel="noreferrer" className="btn" style={{ padding: '4px 10px', fontSize: '10px', background: 'var(--accent)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <ExternalLink size={10} /> View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Premium Modal for New Category */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 5000, animation: 'fadeIn 0.3s ease'
        }}>
          <div className="card" style={{
            width: '450px', padding: '40px', borderRadius: '30px',
            border: '1px solid var(--accent)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--accent)', filter: 'blur(80px)', opacity: 0.2 }}></div>
            
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ 
                width: '60px', height: '60px', background: 'rgba(108, 99, 255, 0.1)', 
                borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', color: 'var(--accent)'
              }}>
                <Save size={32} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>حفظ تصنيف جديد</h2>
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>أدخل اسماً مميزاً لمجموعة الجروبات المختارة</p>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text2)' }}>اسم التصنيف</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="مثلاً: جروبات العقارات 2024"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
                style={{ fontSize: '16px', padding: '15px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={saveAsNewCategory}
                className="btn" 
                style={{ flex: 2, padding: '15px', fontWeight: 'bold' }}
              >
                تأكيد وحفظ
              </button>
              <button 
                onClick={() => { setShowCategoryModal(false); setNewCategoryName(''); }}
                className="btn" 
                style={{ flex: 1, padding: '15px', background: 'var(--bg3)', color: 'var(--text2)' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
