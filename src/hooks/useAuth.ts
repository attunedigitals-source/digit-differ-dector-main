import { useEffect, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  trial_started_at: string | null;
  trial_duration_days: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileChannelRef = useRef<any>(null);

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

      // Initialize trial if not started
      if (!userProfile.trial_started_at && userProfile.subscription_status === 'free') {
        console.log("Initializing demo trial for user...");
        
        // Fetch default duration from settings
        const { data: settingData } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'default_trial_duration')
          .maybeSingle();
        
        const defaultDuration = settingData ? Number(settingData.value) : 7;
        const now = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            trial_started_at: now,
            trial_duration_days: defaultDuration
          })
          .eq('id', userId);
          
        if (!updateError) {
          userProfile.trial_started_at = now;
          userProfile.trial_duration_days = defaultDuration;
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
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        setProfileLoading(true);
        fetchProfile(currentUser.id);

        // Single-Session Enforcer: Listen for device_id changes
        const channelName = `session-enforcement-${currentUser.id}`;
        
        // Remove existing channel safely to prevent duplicate subscription error
        if (profileChannelRef.current) {
          try {
            supabase.removeChannel(profileChannelRef.current).catch(() => {});
          } catch (e) {}
          profileChannelRef.current = null;
        }

        const channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'profiles', 
              filter: `id=eq.${currentUser.id}` 
            },
            (payload) => {
              const serverDeviceId = payload.new.device_id;
              const localDeviceId = localStorage.getItem('bt_device_id');
              
              if (serverDeviceId && localDeviceId && serverDeviceId !== localDeviceId) {
                console.warn("[Auth] New login detected on another device. Signing out...");
                toast.error("You have been logged in on another device. This session will close.", {
                  duration: 5000,
                  id: 'session-kick-out'
                });
                
                // Small delay to allow the user to see the message
                setTimeout(() => {
                  supabase.auth.signOut();
                }, 2000);
              }
            }
          );

        profileChannelRef.current = channel;

        try {
          channel.subscribe();
        } catch (e) {
          console.error("Supabase Realtime subscription error:", e);
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
        
        if (profileChannelRef.current) {
          try {
            supabase.removeChannel(profileChannelRef.current).catch(() => {});
          } catch (e) {}
          profileChannelRef.current = null;
        }
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

    return () => {
      authSub.unsubscribe();
      if (profileChannelRef.current) {
        try {
          supabase.removeChannel(profileChannelRef.current).catch(() => {});
        } catch (e) {}
      }
    };
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
