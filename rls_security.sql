-- ==========================================================
-- نظام العزل والحماية الكامل (Row Level Security - RLS)
-- سكربت الترقية والأمان (Migration & Security Script)
-- ==========================================================

-- 1. تجهيز الأعمدة اللازمة في الجداول (تعديل الهيكل ليدعم العزل)

-- أ. جدول الحسابات (Profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- ب. جدول المجموعات (Groups)
-- أولاً: إعادة تسمية العمود القديم إذا كان موجوداً لتجنب التضارب (user_id -> profile_id)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='user_id' AND data_type='uuid') THEN
    -- نغير الاسم فقط إذا لم يكن هناك عمود profile_id بالفعل
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='profile_id') THEN
      ALTER TABLE public.groups RENAME COLUMN user_id TO profile_id;
    END IF;
  END IF;
END $$;
-- ثانياً: إضافة عمود user_id الجديد الخاص بالمصادقة
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ج. جدول المنشورات (Posts)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='user_id' AND data_type='uuid') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='profile_id') THEN
      ALTER TABLE public.posts RENAME COLUMN user_id TO profile_id;
    END IF;
  END IF;
END $$;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- د. قوائم المجموعات (Group Lists)
ALTER TABLE public.group_lists ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.group_lists ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- هـ. سجل النشر (Post History)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_history' AND column_name='user_id' AND data_type='uuid') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_history' AND column_name='profile_id') THEN
      ALTER TABLE public.post_history RENAME COLUMN user_id TO profile_id;
    END IF;
  END IF;
END $$;
ALTER TABLE public.post_history ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.post_history ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- و. السيريالات (Serials)
ALTER TABLE public.serials ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ز. جدول المشتركين (Clients)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- ح. جدول المستخدمين (Users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    status TEXT DEFAULT 'Inactive',
    plan TEXT DEFAULT 'trial',
    used_serial TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================================
-- 2. تفعيل الحماية (Enable RLS)
-- ==========================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serials ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 3. إنشاء سياسات العزل (Policies)
-- ==========================================================

-- سياسة المستخدمين
DROP POLICY IF EXISTS "Users isolation" ON public.users;
CREATE POLICY "Users isolation" ON public.users FOR ALL USING (id = auth.uid());

-- سياسة الحسابات
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
CREATE POLICY "Profiles isolation" ON public.profiles FOR ALL USING (user_id = auth.uid());

-- سياسة المجموعات
DROP POLICY IF EXISTS "Groups isolation" ON public.groups;
CREATE POLICY "Groups isolation" ON public.groups FOR ALL USING (user_id = auth.uid());

-- سياسة المنشورات
DROP POLICY IF EXISTS "Posts isolation" ON public.posts;
CREATE POLICY "Posts isolation" ON public.posts FOR ALL USING (user_id = auth.uid());

-- سياسة القوائم
DROP POLICY IF EXISTS "Group lists isolation" ON public.group_lists;
CREATE POLICY "Group lists isolation" ON public.group_lists FOR ALL USING (user_id = auth.uid());

-- سياسة السجل
DROP POLICY IF EXISTS "Post history isolation" ON public.post_history;
CREATE POLICY "Post history isolation" ON public.post_history FOR ALL USING (user_id = auth.uid());

-- سياسة المشتركين
DROP POLICY IF EXISTS "Clients isolation" ON public.clients;
CREATE POLICY "Clients isolation" ON public.clients FOR ALL USING (auth_user_id = auth.uid());

-- سياسة السيريالات
DROP POLICY IF EXISTS "Serials check" ON public.serials;
CREATE POLICY "Serials check" ON public.serials FOR SELECT USING (is_used = false OR user_id = auth.uid());
DROP POLICY IF EXISTS "Serials activation" ON public.serials;
CREATE POLICY "Serials activation" ON public.serials FOR UPDATE USING (is_used = false OR user_id = auth.uid());

-- سياسة التخزين (Storage)
-- 1. السماح للجميع بمشاهدة الصور (لتمكين الإضافة من جلبها)
DROP POLICY IF EXISTS "Public View Images" ON storage.objects;
CREATE POLICY "Public View Images" ON storage.objects FOR SELECT 
USING (bucket_id = 'fb-images');

-- 2. السماح للمالك فقط بالرفع والحذف والتعديل
DROP POLICY IF EXISTS "Owner Storage Actions" ON storage.objects;
CREATE POLICY "Owner Storage Actions" ON storage.objects FOR ALL 
TO authenticated
USING (bucket_id = 'fb-images' AND (owner = auth.uid()))
WITH CHECK (bucket_id = 'fb-images' AND (owner = auth.uid()));

