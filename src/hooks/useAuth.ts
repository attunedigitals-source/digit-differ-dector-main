import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'user' | 'admin' | 'sub-admin';
export type SubscriptionStatus = 'free' | 'pending' | 'active' | 'expired' | 'suspended';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  subscription_status: SubscriptionStatus;
  subscription_expiry: string | null;
  is_suspended: boolean;
  device_id: string | null;
  last_login_ip: string | null;
  timezone: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        throw error;
      }
      
      let userProfile = data as UserProfile;

      // FALLBACK: If profile is missing (trigger failed), create it manually
      if (!data) {
        console.warn("Profile missing for user, creating fallback profile...");
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              email: currentUser.email,
              role: 'user',
              subscription_status: 'free',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos'
            })
            .select()
            .single();
          
          if (insertError) {
            console.error("Failed to create fallback profile:", insertError);
            throw insertError;
          }
          userProfile = newProfile as UserProfile;
        }
      }

      setProfile(userProfile);
      
      // Update timezone if changed or missing
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userProfile.timezone !== browserTimezone) {
        await supabase.from('profiles').update({
          timezone: browserTimezone
        }).eq('id', userId);
        
        // Update local state as well
        setProfile(prev => prev ? { ...prev, timezone: browserTimezone } : null);
      }

      // Anti-Sharing Logic: Device Fingerprinting
      let deviceId = localStorage.getItem('bt_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('bt_device_id', deviceId);
      }

      if (userProfile.device_id && userProfile.device_id !== deviceId) {
        await supabase.from('profiles').update({
          device_id: deviceId,
          last_login_ip: 'Active Session'
        }).eq('id', userId);
      } else if (!userProfile.device_id) {
        await supabase.from('profiles').update({
          device_id: deviceId,
        }).eq('id', userId);
      }

    } catch (err) {
      console.error("Error fetching profile:", err);
      // If profile doesn't exist, we might need to wait or handle it
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        setProfileLoading(true);
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
      
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session fetch error:", error);
      }
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        setProfileLoading(true);
        fetchProfile(currentUser.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string) => {
    return supabase.auth.signUp({ 
      email, 
      password, 
      options: { emailRedirectTo: window.location.origin } 
    });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  }

  const initializeAdmin = async (email: string) => {
    // Attempt to sign up the default admin with their email as password
    return supabase.auth.signUp({
      email,
      password: email,
      options: {
        data: { role: 'admin' }
      }
    });
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'sub-admin';
  const isPaid = profile?.subscription_status === 'active';

  return { 
    user, 
    profile, 
    loading, 
    profileLoading,
    isAdmin, 
    isPaid,
    signIn, 
    signUp, 
    signOut,
    initializeAdmin,
    refreshProfile: () => user && fetchProfile(user.id)
  };
}
