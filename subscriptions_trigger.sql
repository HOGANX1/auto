-- ==========================================================
-- تريجر المزامنة التلقائية للمستخدمين الجدد
-- جعل الحساب مفعل تلقائياً (Active) عند الإنشاء
-- ==========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_name TEXT;
BEGIN
  -- 1. تجهيز البيانات
  v_plan := COALESCE(NEW.raw_user_meta_data->>'plan', 'trial');
  v_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  if trim(v_name) = '' then v_name := 'User_' || substr(NEW.id::text, 1, 5); end if;
  
  -- 2. حساب تاريخ الانتهاء
  IF v_plan = 'weekly' THEN v_expires_at := NOW() + INTERVAL '7 days';
  ELSIF v_plan = 'monthly' THEN v_expires_at := NOW() + INTERVAL '1 month';
  ELSIF v_plan = 'yearly' THEN v_expires_at := NOW() + INTERVAL '1 year';
  ELSIF v_plan = 'lifetime' THEN v_expires_at := NOW() + INTERVAL '100 years';
  ELSE v_expires_at := NOW() + INTERVAL '30 days'; v_plan := 'trial';
  END IF;

  -- 3. إدخال البيانات في الجداول الثلاثة مع تجاهل الأخطاء (ON CONFLICT)
  
  -- جدول users
  INSERT INTO public.users (id, first_name, last_name, email, plan, expires_at, status)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''), 
    COALESCE(NEW.email, 'no-email@temp.com'), 
    v_plan, 
    v_expires_at, 
    'Active'
  ) ON CONFLICT (id) DO NOTHING;

  -- جدول profiles (الحقل هو username)
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, v_name)
  ON CONFLICT (user_id) DO NOTHING;

  -- جدول clients
  INSERT INTO public.clients (auth_user_id, full_name, email, plan, expires_at)
  VALUES (NEW.id, v_name, COALESCE(NEW.email, 'no-email@temp.com'), v_plan, v_expires_at)
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- في حالة حدوث أي خطأ، لا تعطل عملية التسجيل الأساسية
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إضافة Unique Index لجدول profiles (ضروري لعمل ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- ربط التريجر
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
