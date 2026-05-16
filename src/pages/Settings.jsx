import React, { useState, useEffect } from 'react';
import { 
  Save, Trash2, History, Users, User, AlertCircle, X, 
  AlertTriangle, Check, Rocket, RefreshCw, Shield, 
  Key, CreditCard, Mail, Settings as SettingsIcon, Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const [extensionId, setExtensionId] = useState('');
  const [serialKey, setSerialKey] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({ email: '', firstName: '', lastName: '' });
  const [newPassword, setNewPassword] = useState('');
  const [isActuallyActivated, setIsActuallyActivated] = useState(false);
  const [passwordForConfirm, setPasswordForConfirm] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);
  const [initialUserData, setInitialUserData] = useState(null);

  // Modal State
  const [modal, setModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger' // 'danger', 'warning', 'success'
  });
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('fb_extension_id');
    const savedSerial = localStorage.getItem('app_serial_key');
    if (savedId) setExtensionId(savedId);
    if (savedSerial) {
      setSerialKey(savedSerial);
      checkActivationStatus(savedSerial);
    }
    fetchSavedPosts();
    fetchUserData();
  }, []);

  const checkActivationStatus = async (key) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('status, expires_at')
      .eq('id', user.id)
      .maybeSingle();

    if (data && data.status === 'Active') {
      if (!data.expires_at || new Date(data.expires_at) > new Date()) {
        setIsActuallyActivated(true);
      } else {
        setIsActuallyActivated(false);
        localStorage.removeItem('app_serial_key');
      }
    } else {
      setIsActuallyActivated(false);
      localStorage.removeItem('app_serial_key');
    }
  };

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: publicUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const data = {
        email: user.email,
        firstName: publicUser?.first_name || user.user_metadata?.first_name || '',
        lastName: publicUser?.last_name || user.user_metadata?.last_name || '',
        plan: publicUser?.plan || user.user_metadata?.plan || 'monthly'
      };
      setUserData(data);
      setInitialUserData(data);
    }
  };

  const fetchSavedPosts = async () => {
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (!error && data) setPosts(data);
  };

  const handleSaveExtensionId = () => {
    localStorage.setItem('fb_extension_id', extensionId);
    openConfirmModal(
      '✅ تم الحفظ بنجاح',
      'تم تحديث معرف الإضافة (Extension ID) الخاص بك وحفظه بنجاح.',
      null,
      'success'
    );
  };

  const handleActivateSerial = async () => {
    if (!serialKey.trim()) {
      alert('يرجى إدخال السيريال أولاً');
      return;
    }

    setIsActivating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      const { data, error } = await supabase
        .from('serials')
        .select('*')
        .eq('key_code', serialKey.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        openConfirmModal('❌ سيريال غير صحيح', 'هذا السيريال غير موجود في النظام، يرجى التأكد من الكود والمحاولة مرة أخرى.', null, 'danger');
      } else if (data.is_used) {
        if (data.used_by_email === user.email) {
          openConfirmModal('✅ مفعل مسبقاً', 'هذا السيريال مفعل بالفعل على حسابك الحالي، يمكنك استخدامه مباشرة.', () => { window.location.reload(); }, 'success');
          localStorage.setItem('app_serial_key', serialKey.trim());
        } else {
          openConfirmModal(
            '⚠️ السيريال مستخدم',
            'عذراً، هذا السيريال تم تفعيله مسبقاً من قبل مستخدم آخر. لا يمكن استخدام السيريال الواحد لأكثر من حساب.',
            null,
            'warning'
          );
        }
      } else {
        let expirationDate = null;
        const now = new Date();

        if (data.plan_type === 'weekly') expirationDate = new Date(now.setDate(now.getDate() + 7));
        else if (data.plan_type === 'monthly') expirationDate = new Date(now.setMonth(now.getMonth() + 1));
        else if (data.plan_type === 'yearly') expirationDate = new Date(now.setFullYear(now.getFullYear() + 1));
        else if (data.plan_type === 'lifetime') expirationDate = null;

        const { error: updateSerialError } = await supabase
          .from('serials')
          .update({
            is_used: true,
            used_by_email: user.email,
            activated_at: new Date().toISOString()
          })
          .eq('id', data.id);

        if (updateSerialError) throw updateSerialError;

        const { error: updateUserError } = await supabase
          .from('users')
          .update({
            status: 'Active',
            plan: data.plan_type,
            used_serial: serialKey.trim(),
            expires_at: expirationDate ? expirationDate.toISOString() : null
          })
          .eq('id', user.id);

        if (updateUserError) throw updateUserError;

        localStorage.setItem('app_serial_key', serialKey.trim());
        openConfirmModal(
          '🚀 تم تفعيل البرنامج بنجاح!',
          'شكراً لك على ثقتك بنا. تم فتح جميع المميزات والخصائص الآن. استمتع بتجربة النشر الآلي!',
          () => { window.location.reload(); },
          'success'
        );
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التفعيل: ' + err.message);
    } finally {
      setIsActivating(false);
    }
  };

  const openConfirmModal = (title, message, onConfirm, type = 'danger') => {
    setModal({ show: true, title, message, onConfirm, type });
  };

  const closeConfirmModal = () => setModal({ ...modal, show: false });

  const executeConfirm = async () => {
    if (modal.onConfirm) await modal.onConfirm();
    closeConfirmModal();
  };

  const handleUpdateProfile = async (skipPassword = false) => {
    if (!skipPassword && !passwordForConfirm) {
      alert('يرجى إدخال كلمة المرور الحالية لتأكيد التغييرات');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!skipPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwordForConfirm
        });
        if (signInError) throw new Error('كلمة المرور الحالية غير صحيحة!');
      }

      const updates = {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          plan: userData.plan
        }
      };

      if (userData.email !== user.email) updates.email = userData.email;

      if (newPassword) {
        if (newPassword === passwordForConfirm) throw new Error('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية!');
        updates.password = newPassword;
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      // 4. تحديث جدول المستخدمين العام (Public Table)
      const { error: publicError } = await supabase
        .from('users')
        .update({
          first_name: userData.firstName,
          last_name: userData.lastName,
          plan: userData.plan
        })
        .eq('id', user.id);
      
      if (publicError) console.error('Public table sync failed:', publicError);

      openConfirmModal('✅ تم التحديث', 'تم تحديث بيانات حسابك والخطة بنجاح.', null, 'success');
      setNewPassword('');
      setPasswordForConfirm('');
      setShowPassModal(false);
      setInitialUserData(userData);
    } catch (error) {
      alert('خطأ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfileClick = () => {
    if (!initialUserData) return;
    const isSensitiveChanged = userData.email !== initialUserData.email || userData.plan !== initialUserData.plan || newPassword.length > 0;
    if (isSensitiveChanged) {
      setShowPassModal(true);
      setPendingAction('updateProfile');
    } else {
      handleUpdateProfile(true);
    }
  };

  const [pendingAction, setPendingAction] = useState(null);

  const handlePermanentDelete = async () => {
    if (!passwordForConfirm) {
      alert('يرجى إدخال كلمة المرور لتأكيد الحذف النهائي');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. التأكد من كلمة المرور
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForConfirm
      });
      if (signInError) throw new Error('كلمة المرور غير صحيحة، لا يمكن حذف الحساب!');

      // 2. مسح كافة البيانات المتعلقة بالمستخدم
      await supabase.from('post_history').delete().eq('user_id', user.id);
      await supabase.from('posts').delete().eq('user_id', user.id);
      await supabase.from('groups').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('user_id', user.id);
      await supabase.from('users').delete().eq('id', user.id);

      // 3. تسجيل الخروج
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      alert('خطأ: ' + error.message);
    } finally {
      setLoading(false);
      setShowPassModal(false);
    }
  };

  // Cleanup Functions
  const deleteSavedPosts = async () => {
    setLoading(true);
    const { error } = await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLoading(false);
    if (error) alert('خطأ في الحذف: ' + error.message);
    else fetchSavedPosts();
  };

  const deletePostHistoryLogs = async () => {
    setLoading(true);
    const { error } = await supabase.from('post_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLoading(false);
    if (error) alert('خطأ في الحذف: ' + error.message);
    else alert('تم مسح سجل العمليات بنجاح');
  };

  const deleteGroups = async () => {
    setLoading(true);
    const { error } = await supabase.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLoading(false);
    if (error) alert('خطأ في الحذف: ' + error.message);
  };

  const deleteProfiles = async () => {
    setLoading(true);
    const { error } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLoading(false);
    if (error) alert('خطأ في الحذف: ' + error.message);
  };

  return (
    <div style={{ paddingBottom: '80px', position: 'relative', animation: 'fadeIn 0.5s ease' }}>
      {/* Custom Confirmation Modal */}
      {modal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--accent)',
            borderRadius: '30px', width: '90%', maxWidth: '450px',
            padding: '40px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            textAlign: 'center', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: modal.type === 'success' ? 'var(--success)' : 'var(--error)', filter: 'blur(80px)', opacity: 0.15 }}></div>
            
            <div style={{
              width: '80px', height: '80px',
              background: modal.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 25px', color: modal.type === 'success' ? 'var(--success)' : 'var(--error)'
            }}>
              {modal.type === 'success' ? <Rocket size={40} className="bounce" /> : <AlertTriangle size={40} />}
            </div>

            <h2 style={{ fontSize: '26px', marginBottom: '15px', fontWeight: '900' }}>{modal.title}</h2>
            <p style={{ color: 'var(--text2)', fontSize: '16px', lineHeight: '1.7', marginBottom: '35px' }}>{modal.message}</p>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={executeConfirm} className="btn" style={{ flex: 2, padding: '15px', background: modal.type === 'success' ? 'var(--success)' : 'var(--error)', fontWeight: '800' }}>
                {modal.type === 'success' ? 'حسناً، فهمت' : 'تأكيد العملية'}
              </button>
              {modal.type !== 'success' && (
                <button onClick={closeConfirmModal} className="btn" style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text)', fontWeight: 'bold' }}>إلغاء</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal */}
      {showPassModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)',
          zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '420px', padding: '40px', borderRadius: '30px', border: '1px solid var(--accent)' }}>
            <div style={{ padding: '25px', background: 'rgba(108,99,255,0.1)', borderRadius: '24px', width: '70px', height: '70px', margin: '0 auto 25px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={35} color="var(--accent)" />
            </div>
            <h2 style={{ marginBottom: '15px', fontWeight: '900' }}>تأكيد الأمان</h2>
            <p style={{ color: 'var(--text2)', fontSize: '15px', marginBottom: '30px', lineHeight: '1.6' }}>
              يرجى إدخال كلمة مرورك الحالية لاعتماد التغييرات الحساسة على حسابك.
            </p>
            <input
              type="password"
              className="form-input"
              placeholder="كلمة المرور الحالية..."
              value={passwordForConfirm}
              onChange={(e) => setPasswordForConfirm(e.target.value)}
              autoFocus
              style={{ marginBottom: '30px', fontSize: '16px', padding: '15px' }}
            />
            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                className="btn" 
                onClick={() => {
                  if (pendingAction === 'deleteAccount') handlePermanentDelete();
                  else handleUpdateProfile();
                }} 
                style={{ flex: 1, padding: '15px', fontWeight: 'bold', background: pendingAction === 'deleteAccount' ? 'var(--error)' : 'var(--accent)' }}
              >
                تأكيد
              </button>
              <button className="btn" onClick={() => { setShowPassModal(false); setPendingAction(null); }} style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text)', padding: '15px' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ pading: '10px', background: 'rgba(108,99,255,0.1)', borderRadius: '12px', color: 'var(--accent)' }}>
             <SettingsIcon size={32} />
          </div>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900' }}>Settings & Control</h1>
            <p style={{ fontSize: '16px', color: 'var(--text2)' }}>تحكم في حسابك، الإضافات، وتطهير البيانات بضغطة واحدة.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Account Profile Section */}
          <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'var(--accent)', opacity: 0.05, borderRadius: '0 0 0 100%' }}></div>
            <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '800' }}>
              <User size={22} color="var(--accent)" /> الملف الشخصي
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>الاسم الأول</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input type="text" className="form-input" style={{ paddingLeft: '40px' }} value={userData.firstName} onChange={(e) => setUserData({ ...userData, firstName: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>الاسم الأخير</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input type="text" className="form-input" style={{ paddingLeft: '40px' }} value={userData.lastName} onChange={(e) => setUserData({ ...userData, lastName: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input type="email" className="form-input" style={{ paddingLeft: '40px' }} value={userData.email} onChange={(e) => setUserData({ ...userData, email: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>خطة الاشتراك</label>
              <div style={{ position: 'relative' }}>
                <CreditCard size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <select 
                  className="form-input" 
                  style={{ paddingLeft: '40px' }} 
                  value={userData.plan} 
                  onChange={(e) => setUserData({ ...userData, plan: e.target.value })}
                >
                  <option value="weekly">أسبوعية (Weekly)</option>
                  <option value="monthly">شهرية (Monthly)</option>
                  <option value="yearly">سنوية (Yearly)</option>
                  <option value="lifetime">مدى الحياة (Lifetime)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>كلمة المرور الجديدة</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input type="password" className="form-input" style={{ paddingLeft: '40px' }} placeholder="اتركه فارغاً للحفاظ على الحالية" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>

            <button className="btn" onClick={handleSaveProfileClick} disabled={loading} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, var(--accent), #818cf8)', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>
              {loading ? <RefreshCw size={20} className="spin" /> : 'تحديث البيانات'}
            </button>
          </div>

          {/* Extension & License Section */}
          <div className="card">
            <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '800' }}>
              <Shield size={22} color="var(--accent)" /> الترخيص والإضافة
            </h3>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>معرف الإضافة (Extension ID)</label>
              <input type="text" className="form-input" placeholder="مثلاً: abcdefghijklmnopqrstuvwxyz" value={extensionId} onChange={(e) => setExtensionId(e.target.value)} />
              <button onClick={handleSaveExtensionId} style={{ marginTop: '10px', background: 'var(--bg3)', color: 'var(--text)', fontSize: '12px' }} className="btn">حفظ المعرف فقط</button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                سيريال التفعيل
                <span style={{ color: isActuallyActivated ? 'var(--success)' : 'var(--error)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isActuallyActivated ? <Check size={12}/> : <X size={12}/>}
                  {isActuallyActivated ? 'نشط' : 'غير مفعل'}
                </span>
              </label>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="XXXX-XXXX-XXXX-XXXX" 
                  value={serialKey} 
                  onChange={(e) => setSerialKey(e.target.value)} 
                  disabled={isActuallyActivated}
                  style={{ flex: 1, letterSpacing: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', background: isActuallyActivated ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg2)' }}
                />
              </div>

              <button 
                className="btn" 
                onClick={handleActivateSerial} 
                disabled={isActivating || isActuallyActivated}
                style={{ width: '100%', padding: '15px', background: isActuallyActivated ? 'rgba(34, 197, 94, 0.1)' : 'var(--success)', color: isActuallyActivated ? 'var(--success)' : '#fff', fontWeight: 'bold' }}
              >
                {isActivating ? <RefreshCw size={20} className="spin" /> : isActuallyActivated ? 'تم التفعيل بنجاح ✅' : 'تفعيل السيريال الآن'}
              </button>

              {!isActuallyActivated && (
                <button 
                  onClick={() => {
                    const planPrices = { 'weekly': '150', 'monthly': '500', 'yearly': '5000', 'lifetime': '10000' };
                    const price = planPrices[userData.plan] || '500';
                    const planNames = { 'weekly': 'الأسبوعية', 'monthly': 'الشهرية', 'yearly': 'السنوية', 'lifetime': 'مدى الحياة' };
                    const planName = planNames[userData.plan] || 'المختارة';
                    
                    openConfirmModal(
                      '💳 طلب سيريال جديد',
                      `برجاء تحويل مبلغ: ( ${price} ج.م ) \n مقابل الخطة ${planName} \n إلى رقم فودافون كاش: 01144676413 \n\n بعد التحويل، تواصل معنا لتلقي السيريال الخاص بك.`,
                      null,
                      'success'
                    );
                  }}
                  className="btn" 
                  style={{ width: '100%', marginTop: '15px', background: 'rgba(108, 99, 255, 0.05)', color: 'var(--accent)', border: '1px dashed var(--accent)', fontSize: '13px', fontWeight: 'bold' }}
                >
                  الحصول على سيريال
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Data Management Section */}
          <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '800', color: 'var(--error)' }}>
              <Database size={22} /> إدارة وتطهير البيانات
            </h3>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '15px', borderRadius: '15px', marginBottom: '25px', border: '1px dashed rgba(239, 68, 68, 0.3)' }}>
              <p style={{ color: 'var(--error)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> 
                تنبيه: جميع عمليات الحذف أدناه نهائية ولا يمكن استرجاع البيانات بعدها.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <button 
                className="btn-cleanup" 
                onClick={() => openConfirmModal('مسح سجل العمليات', 'سيتم حذف جميع تقارير النشر السابقة (تم النشر/فشل) من قاعدة البيانات.', deletePostHistoryLogs)}
              >
                <History size={18} />
                <span>مسح سجل العمليات<br/><small>(Post History)</small></span>
              </button>

              <button 
                className="btn-cleanup" 
                onClick={() => openConfirmModal('حذف المنشورات المحفوظة', 'سيتم حذف جميع القوالب والمنشورات التي قمت بحفظها مسبقاً.', deleteSavedPosts)}
              >
                <Trash2 size={18} />
                <span>حذف المنشورات<br/><small>(Saved Posts)</small></span>
              </button>

              <button 
                className="btn-cleanup" 
                onClick={() => openConfirmModal('حذف جميع المجموعات', 'سيتم مسح قائمة المجموعات (Groups) بالكامل من حسابك.', deleteGroups)}
              >
                <Users size={18} />
                <span>حذف المجموعات<br/><small>(Groups List)</small></span>
              </button>

              <button 
                className="btn-cleanup" 
                onClick={() => openConfirmModal('حذف الحسابات الشخصية', 'سيتم حذف جميع بروفايلات فيسبوك المضافة للنظام.', deleteProfiles)}
              >
                <User size={18} />
                <span>حذف الحسابات<br/><small>(Profiles)</small></span>
              </button>

              <button 
                className="btn-cleanup" 
                style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)', color: 'var(--error)', gridColumn: 'span 2' }}
                onClick={() => {
                  setPendingAction('deleteAccount');
                  openConfirmModal(
                    '⚠️ حذف الحساب نهائياً',
                    'هل أنت متأكد من رغبتك في حذف حسابك وكافة بياناتك نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وسيؤدي لمسح كل شيء.',
                    () => setShowPassModal(true),
                    'danger'
                  );
                }}
              >
                <AlertCircle size={18} />
                <span style={{ fontWeight: 'bold' }}>حذف حسابي نهائياً من النظام</span>
              </button>
            </div>

            <style>{`
              .btn-cleanup {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 10px;
                padding: 20px 10px;
                background: var(--bg2);
                border: 1px solid var(--border);
                border-radius: '20px';
                color: var(--text);
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
              }
              .btn-cleanup:hover {
                background: rgba(239, 68, 68, 0.1);
                border-color: var(--error);
                color: var(--error);
                transform: translateY(-3px);
                box-shadow: 0 10px 20px rgba(239, 68, 68, 0.1);
              }
              .btn-cleanup small {
                opacity: 0.6;
                font-size: 10px;
              }
            `}</style>
          </div>

          {/* Quick List Section */}
          <div className="card">
             <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '800' }}>
              <History size={22} color="var(--accent)" /> المنشورات المحفوظة مؤخراً
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
              {posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px' }}>
                   <AlertCircle size={40} style={{ opacity: 0.2, marginBottom: '15px' }} />
                   <p style={{ color: 'var(--text3)' }}>لا توجد منشورات محفوظة حالياً</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} style={{ padding: '15px', background: 'var(--bg2)', borderRadius: '15px', border: '1px solid var(--border)', transition: '0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent)', background: 'rgba(108,99,255,0.1)', padding: '4px 10px', borderRadius: '10px' }}>
                        {post.category || 'بدون تصنيف'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.post_text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
