-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'technician');

-- Create service_order_status enum
CREATE TYPE public.service_order_status AS ENUM ('pending', 'in_progress', 'completed', 'not_executed');

-- Create profiles table (extension of auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create service_orders table
CREATE TABLE public.service_orders (
  id TEXT PRIMARY KEY,
  sequencial TEXT,
  protocol TEXT,
  service_type TEXT,
  address TEXT,
  number TEXT,
  neighborhood TEXT,
  municipality TEXT,
  description TEXT,
  client_lat DOUBLE PRECISION,
  client_long DOUBLE PRECISION,
  scheduled_date TEXT,
  status service_order_status DEFAULT 'pending',
  assigned_to UUID REFERENCES public.profiles(id),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  meter_reading TEXT,
  seal_number TEXT,
  resolution_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id TEXT REFERENCES public.service_orders(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gps_lat DOUBLE PRECISION,
  gps_long DOUBLE PRECISION
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- User roles RLS policies
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Service orders RLS policies
CREATE POLICY "Admins can do everything on service_orders"
ON public.service_orders FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Technicians can view assigned orders"
ON public.service_orders FOR SELECT
TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Technicians can update assigned orders"
ON public.service_orders FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid());

-- Photos RLS policies
CREATE POLICY "Admins can do everything on photos"
ON public.photos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Technicians can view photos of assigned orders"
ON public.photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_orders
    WHERE service_orders.id = photos.service_order_id
    AND service_orders.assigned_to = auth.uid()
  )
);

CREATE POLICY "Technicians can insert photos for assigned orders"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_orders
    WHERE service_orders.id = photos.service_order_id
    AND service_orders.assigned_to = auth.uid()
  )
);

-- Trigger to auto-create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'technician');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for service photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-photos', 'service-photos', true);

-- Storage policies for service photos
CREATE POLICY "Anyone can view service photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-photos');

CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-photos');

CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-photos');