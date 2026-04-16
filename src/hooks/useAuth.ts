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
        .single();

      if (error) throw error;
      const userProfile = data as UserProfile;
      setProfile(userProfile);
      
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
      setLoading(false); // Session is now known
      
      if (currentUser) {
        fetchProfile(currentUser.id); // Load profile in background
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false); // Session is now known
      
      if (currentUser) {
        fetchProfile(currentUser.id); // Load profile in background
      }
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
