-- Supabase Schema for Greater Works City Church Management System

-- 1. Users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT CHECK (role IN ('admin', 'staff')) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1b. Staff Members
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (
    position IN (
      'Senior pastor',
      'Assistant pastor',
      'Department head',
      'Church secretary',
      'Ministry leader'
    )
  ),
  department TEXT NOT NULL,
  ministry TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  bio TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- 2. Member Groups
CREATE TABLE IF NOT EXISTS public.member_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.member_groups ENABLE ROW LEVEL SECURITY;

-- 2b. Member Departments
CREATE TABLE IF NOT EXISTS public.member_departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.member_departments ENABLE ROW LEVEL SECURITY;

-- 3. Members
CREATE TABLE IF NOT EXISTS public.members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  address TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  birthday DATE,
  date_joined DATE,
  status TEXT CHECK (status IN ('Active', 'Inactive', 'Visitor')) DEFAULT 'Active',
  marital_status TEXT CHECK (marital_status IN ('Single', 'Married', 'Widowed', 'Divorced')),
  occupation TEXT,
  education TEXT,
  baptism_status TEXT CHECK (baptism_status IN ('Baptized', 'Not Baptized')),
  baptism_date DATE,
  membership_date DATE,
  ministry TEXT,
  department TEXT,
  department_id UUID REFERENCES public.member_departments(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.member_groups(id) ON DELETE SET NULL,
  emergency_contact JSONB,
  note TEXT,
  photo_url TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- 4. Tithes
CREATE TABLE IF NOT EXISTS public.tithes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('Cash', 'Check', 'Bank Transfer', 'Mobile Money')),
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tithes ENABLE ROW LEVEL SECURITY;

-- 5. Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  service_type TEXT CHECK (service_type IN ('Sunday Service', 'Mid-week Service', 'Youth Meeting', 'Special Event')),
  total_count INTEGER NOT NULL CHECK (total_count >= 0),
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 6. Finance Categories
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('Income', 'Expense')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

-- 7. Finances
CREATE TABLE IF NOT EXISTS public.finances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT CHECK (type IN ('Income', 'Expense')) NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL,
  description TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

-- 8. Church Events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  location TEXT,
  category TEXT CHECK (category IN ('Service', 'Youth', 'Outreach', 'Special', 'Meeting', 'Other')),
  status TEXT CHECK (status IN ('Upcoming', 'Ongoing', 'Completed', 'Cancelled')) DEFAULT 'Upcoming',
  organizer TEXT,
  recurrence_type TEXT CHECK (recurrence_type IN ('None', 'Daily', 'Weekly', 'Monthly', 'Yearly')) DEFAULT 'None',
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic examples, can be refined)

-- Profiles: Users can read all profiles, but only update their own
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Members: Authenticated users can read/write
DROP POLICY IF EXISTS "Members are viewable by authenticated users" ON public.members;
CREATE POLICY "Members are viewable by authenticated users" ON public.members FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Members are insertable by authenticated users" ON public.members;
CREATE POLICY "Members are insertable by authenticated users" ON public.members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Members are updatable by authenticated users" ON public.members;
CREATE POLICY "Members are updatable by authenticated users" ON public.members FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Members are deletable by admins" ON public.members;
CREATE POLICY "Members are deletable by admins" ON public.members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Similar policies for other tables...
-- (Note: For brevity, I'm adding basic authenticated access. In production, these should be more granular.)

DROP POLICY IF EXISTS "Authenticated users can manage groups" ON public.member_groups;
CREATE POLICY "Authenticated users can manage groups" ON public.member_groups FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can manage departments" ON public.member_departments;
CREATE POLICY "Authenticated users can manage departments" ON public.member_departments FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can manage tithes" ON public.tithes;
CREATE POLICY "Authenticated users can manage tithes" ON public.tithes FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON public.attendance;
CREATE POLICY "Authenticated users can manage attendance" ON public.attendance FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can manage finance categories" ON public.finance_categories;
CREATE POLICY "Authenticated users can manage finance categories" ON public.finance_categories FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can manage finances" ON public.finances;
CREATE POLICY "Authenticated users can manage finances" ON public.finances FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can manage events" ON public.events;
CREATE POLICY "Authenticated users can manage events" ON public.events FOR ALL USING (auth.role() = 'authenticated');

-- Staff members: viewable by authenticated users, admin-managed
DROP POLICY IF EXISTS "Staff viewable by authenticated users" ON public.staff_members;
CREATE POLICY "Staff viewable by authenticated users" ON public.staff_members FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can insert staff" ON public.staff_members;
CREATE POLICY "Admins can insert staff" ON public.staff_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update staff" ON public.staff_members;
CREATE POLICY "Admins can update staff" ON public.staff_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete staff" ON public.staff_members;
CREATE POLICY "Admins can delete staff" ON public.staff_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 10. Custom Field Definitions
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('text', 'number', 'date', 'select', 'boolean')) NOT NULL,
  options JSONB, -- For 'select' type
  required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage custom field definitions" ON public.custom_field_definitions;
CREATE POLICY "Authenticated users can manage custom field definitions" ON public.custom_field_definitions FOR ALL USING (auth.role() = 'authenticated');

-- 11. Member Relationships
CREATE TABLE IF NOT EXISTS public.member_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  related_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  relationship_type TEXT CHECK (relationship_type IN ('Spouse', 'Parent', 'Child', 'Sibling', 'Other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.member_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Relationships are viewable by authenticated users" ON public.member_relationships;
CREATE POLICY "Relationships are viewable by authenticated users" ON public.member_relationships FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Relationships are manageable by admins" ON public.member_relationships;
CREATE POLICY "Relationships are manageable by admins" ON public.member_relationships FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 12. Member Attendance (Individual Records)
CREATE TABLE IF NOT EXISTS public.member_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('Present', 'Absent', 'Excused')) DEFAULT 'Present',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.member_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage member attendance" ON public.member_attendance;
CREATE POLICY "Authenticated users can manage member attendance" ON public.member_attendance FOR ALL USING (auth.role() = 'authenticated');

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_members_updated_at ON public.members;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_member_groups_updated_at ON public.member_groups;
CREATE TRIGGER update_member_groups_updated_at BEFORE UPDATE ON public.member_groups FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_member_departments_updated_at ON public.member_departments;
CREATE TRIGGER update_member_departments_updated_at BEFORE UPDATE ON public.member_departments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_tithes_updated_at ON public.tithes;
CREATE TRIGGER update_tithes_updated_at BEFORE UPDATE ON public.tithes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_finances_updated_at ON public.finances;
CREATE TRIGGER update_finances_updated_at BEFORE UPDATE ON public.finances FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_staff_members_updated_at ON public.staff_members;
CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 9. Storage for Member Photos
-- Create a bucket for member photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
DROP POLICY IF EXISTS "Allow authenticated users to upload photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'member-photos');

DROP POLICY IF EXISTS "Allow authenticated users to update photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'member-photos');

DROP POLICY IF EXISTS "Allow public to read photos" ON storage.objects;
CREATE POLICY "Allow public to read photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'member-photos');

DROP POLICY IF EXISTS "Allow authenticated users to delete photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'member-photos');

-- 9b. Storage for Staff Photos
-- Create a bucket for staff photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-photos', 'staff-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for staff photos
DROP POLICY IF EXISTS "Allow authenticated users to upload staff photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload staff photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-photos');

DROP POLICY IF EXISTS "Allow authenticated users to update staff photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update staff photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-photos');

DROP POLICY IF EXISTS "Allow public to read staff photos" ON storage.objects;
CREATE POLICY "Allow public to read staff photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'staff-photos');

DROP POLICY IF EXISTS "Allow authenticated users to delete staff photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete staff photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-photos');
