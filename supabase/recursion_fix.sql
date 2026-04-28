-- EMERGENCY RECURSION FIX (RESTORE ACCESS)
-- This script breaks the security loop to unlock your Admin account.

-- 1. Create a specialized non-recursive admin check
-- SECURITY DEFINER allows this function to bypass RLS checks internally.
CREATE OR REPLACE FUNCTION public.is_admin_v2()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'sub-admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Profiles Policies to use the non-recursive check
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING ( public.is_admin_v2() );

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles 
FOR UPDATE TO authenticated 
USING ( public.is_admin_v2() );

-- 3. Update Payments Policies
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments 
FOR SELECT TO authenticated 
USING ( public.is_admin_v2() );

-- 4. Verify user can still see their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);
