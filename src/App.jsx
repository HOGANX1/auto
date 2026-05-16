import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Settings as SettingsIcon, LogOut, Search, Rocket, CheckCircle, XCircle, Send, Eye, EyeOff, Clock } from 'lucide-react';
import { supabase } from './lib/supabase';

// Pages
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Groups from './pages/Groups';
import Settings from './pages/Settings';
import Posters from './pages/Posters';
import History from './pages/History';

export default function App() {
  const [session, setSession] = useState(null);
  const location = useLocation();
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isActivated, setIsActivated] = useState(!!localStorage.getItem('app_serial_key'));
  const [showPassword, setShowPassword] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const checkActivation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsActivated(false);
        setIsInitializing(false);
        return;
      }

      // التحقق من حالة المستخدم في قاعدة البيانات أولاً
      const { data: userData } = await supabase
        .from('users')
        .select('status, expires_at')
        .eq('id', user.id)
        .maybeSingle();

      if (userData && userData.status === 'Active') {
        // إذا كانت الحالة نشطة وتاريخ الانتهاء لم يأتِ بعد (أو غير موجود)
        if (!userData.expires_at || new Date(userData.expires_at) > new Date()) {
          setIsActivated(true);
          setIsInitializing(false);
          return;
        }
      }

      // إذا لم يكن نشطاً في قاعدة البيانات، نتحقق من السيريال المحلي (للتوافق القديم)
      let savedSerial = localStorage.getItem('app_serial_key');
      if (savedSerial) {
        const { data: serialData } = await supabase
          .from('serials')
          .select('expires_at')
          .eq('key_code', savedSerial)
          .maybeSingle();

        if (serialData && (!serialData.expires_at || new Date(serialData.expires_at) > new Date())) {
          setIsActivated(true);
          setIsInitializing(false);
          return;
        }
      }

      setIsActivated(false);
      setIsInitializing(false);
    };

    checkActivation();
    const interval = setInterval(checkActivation, 5000);
    return () => clearInterval(interval);
  }, [session]); // إعادة الفحص عند تغيير الجلسة (الدخول/الخروج)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 5000);
  };

  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) showToast(error.message, 'error');
    } else {
      const confirmPassword = e.target.confirmPassword.value;
      if (password !== confirmPassword) {
        showToast("كلمة المرور غير متطابقة!", 'error');
        return;
      }

      const firstName = e.target.firstName.value;
      const lastName = e.target.lastName.value;
      const plan = e.target.plan.value;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            plan: plan
          }
        }
      });

      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast("تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني لتأكيد الحساب.", 'success');
        setIsLogin(true); // Return to login
      }
    }
  };

  const ToastComponent = () => {
    if (!toast.show) return null;
    return (
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: toast.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
        backdropFilter: 'blur(10px)',
        color: '#fff',
        padding: '16px 24px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        zIndex: 9999,
        animation: 'slideDown 0.3s ease forwards'
      }}>
        {toast.type === 'success' ? <CheckCircle color="var(--success)" size={24} /> : <XCircle color="var(--error)" size={24} />}
        <span style={{ fontWeight: '600', fontSize: '15px' }}>{toast.message}</span>
      </div>
    );
  };

  const LoadingScreen = () => (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000,
      textAlign: 'center'
    }}>
      <div style={{
        width: '80px', height: '80px',
        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
        borderRadius: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 40px rgba(108,99,255,0.4)',
        marginBottom: '30px',
        animation: 'bounce 2s infinite'
      }}>
        <Rocket size={48} color="#fff" />
      </div>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>جاري استعادة جلستك...</h2>
      <p style={{ color: 'var(--text2)', fontSize: '15px' }}>انتظر قليلاً، نحن نقوم بربط حسابك وتفعيل محرك النشر الصاروخي 🚀</p>

      <div style={{ marginTop: '40px', width: '200px', height: '4px', background: 'var(--bg2)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ width: '60%', height: '100%', background: 'var(--accent)', borderRadius: '10px', animation: 'progress 2s infinite ease-in-out' }}></div>
      </div>
    </div>
  );

  if (session && isInitializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
        <ToastComponent />
        {/* Left Side: Auth Form */}
        <div style={{
          flex: '0 0 450px',
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '40px',
          boxShadow: '20px 0 50px rgba(0,0,0,0.2)',
          zIndex: 10,
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', justifyContent: 'center' }}>
            <div style={{
              width: '50px', height: '50px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(108,99,255,0.4)'
            }}>
              <Rocket size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '900', margin: 0, background: 'linear-gradient(135deg, #fff, var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AUTO POSTER
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', justifyContent: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', fontSize: '16px', color: isLogin ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontWeight: 'bold', position: 'relative' }}
              onClick={() => setIsLogin(true)}
            >
              تسجيل الدخول
              {isLogin && <div style={{ position: 'absolute', bottom: '-12px', left: 0, right: 0, height: '3px', background: 'var(--accent)', borderRadius: '3px' }} />}
            </button>
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', fontSize: '16px', color: !isLogin ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontWeight: 'bold', position: 'relative' }}
              onClick={() => setIsLogin(false)}
            >
              إنشاء حساب
              {!isLogin && <div style={{ position: 'absolute', bottom: '-12px', left: 0, right: 0, height: '3px', background: 'var(--accent)', borderRadius: '3px' }} />}
            </button>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!isLogin && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', fontWeight: 'bold' }}>الاسم الأول</label>
                  <input type="text" name="firstName" placeholder="الأول" className="form-input" required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', fontWeight: 'bold' }}>الاسم الأخير</label>
                  <input type="text" name="lastName" placeholder="الأخير" className="form-input" required />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', fontWeight: 'bold' }}>البريد الإلكتروني</label>
              <input type="email" name="email" placeholder="example@mail.com" className="form-input" required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', fontWeight: 'bold' }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  className="form-input"
                  required
                  minLength="6"
                  style={{ paddingRight: '45px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', fontWeight: 'bold' }}>تأكيد كلمة المرور</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="••••••••"
                      className="form-input"
                      required
                      minLength="6"
                      style={{ paddingRight: '45px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', fontWeight: 'bold' }}>اختر خطة الاشتراك</label>
                  <select name="plan" className="form-input" required style={{ appearance: 'none' }}>
                    <option value="weekly">خطة أسبوعية - 250 ج</option>
                    <option value="monthly">خطة شهرية - 600 ج</option>
                    <option value="yearly">خطة سنوية - 1200 ج</option>
                    <option value="lifetime">مدى الحياة - 1900 ج</option>
                  </select>
                </div>
              </>
            )}

            <button type="submit" className="btn" style={{ marginTop: '10px', padding: '14px', fontSize: '16px' }}>
              {isLogin ? 'دخول الآن' : 'تسجيل حساب جديد'}
            </button>
          </form>
        </div>

        {/* Right Side: Showcase */}
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          background: 'radial-gradient(circle at center, rgba(108,99,255,0.15) 0%, var(--bg) 70%)'
        }}>
          {/* Decorative Elements */}
          <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'var(--accent2)', filter: 'blur(150px)', opacity: 0.2, borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '20%', width: '400px', height: '400px', background: 'var(--accent)', filter: 'blur(200px)', opacity: 0.2, borderRadius: '50%' }} />

          <div style={{ zIndex: 1, textAlign: 'center', maxWidth: '600px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: '900', lineHeight: '1.2', marginBottom: '20px', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              انشر في عدد أكبر من الجروبات<br />بضغطة زر واحدة!
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--text2)', marginBottom: '40px', lineHeight: '1.6' }}>
              الأداة الأقوى لإدارة ونشر المحتوى في مجموعات فيسبوك المتعددة بأعلى معايير الجودة والاحترافية.
            </p>

            <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', marginBottom: '60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <CheckCircle color="var(--success)" size={20} />
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>أمان تام</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <CheckCircle color="var(--accent3)" size={20} />
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>سرعة فائقة</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <CheckCircle color="var(--accent)" size={20} />
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>حماية مستمرة</span>
              </div>
            </div>
          </div>

          {/* Developer Credit */}
          <div style={{ position: 'absolute', bottom: '30px', right: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text3)', fontSize: '14px', letterSpacing: '1px' }}>تطوير وصناعة:</span>
            <strong style={{ fontSize: '16px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              محمد سيد
            </strong>
          </div>
        </div>
      </div>
    );
  }

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, locked: !isActivated },
    { name: 'Accounts', path: '/accounts', icon: <Users size={20} />, locked: !isActivated },
    { name: 'Groups', path: '/groups', icon: <MessageSquare size={20} />, locked: !isActivated },
    { name: 'Posters', path: '/posters', icon: <Send size={20} />, locked: !isActivated },
    { name: 'History', path: '/history', icon: <Clock size={20} />, locked: !isActivated },
    { name: 'Settings', path: '/settings', icon: <SettingsIcon size={20} />, locked: false },
  ];

  return (
    <div className="layout">
      <ToastComponent />
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">A</div>
          <h2>AutoPost</h2>
        </div>

        <div className="nav-section">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.locked ? '#' : link.path}
              onClick={(e) => {
                if (link.locked) {
                  e.preventDefault();
                  showToast('يرجى تفعيل البرنامج بالسيريال أولاً!', 'error');
                }
              }}
              className={`nav-btn ${location.pathname === link.path ? 'active' : ''} ${link.locked ? 'locked' : ''}`}
              style={{
                opacity: link.locked ? 0.5 : 1,
                cursor: link.locked ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {link.icon}
                {link.name}
              </div>
              {link.locked && <Rocket size={14} style={{ opacity: 0.5 }} />}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '20px' }}>
          <button
            className="nav-btn"
            style={{ color: 'var(--error)' }}
            onClick={() => {
              localStorage.removeItem('app_serial_key');
              supabase.auth.signOut();
            }}
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        {!isActivated && location.pathname !== '/settings' && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            padding: '20px'
          }}>
            <div style={{ background: 'var(--card)', padding: '40px', borderRadius: '30px', border: '1px solid var(--accent)', maxWidth: '500px' }}>
              <Rocket size={60} color="var(--accent)" style={{ marginBottom: '20px', animation: 'bounce 2s infinite' }} />
              <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>البرنامج غير مفعل!</h2>
              <p style={{ color: 'var(--text2)', marginBottom: '30px', lineHeight: '1.6' }}>
                عذراً، يجب عليك إدخال سيريال التفعيل الخاص بك لتتمكن من استخدام كافة خصائص ومميزات البرنامج.
              </p>
              <Link to="/settings" className="btn" style={{ padding: '12px 30px' }}>
                انتقل لصفحة التفعيل الآن
              </Link>
            </div>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/posters" element={<Posters />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}
