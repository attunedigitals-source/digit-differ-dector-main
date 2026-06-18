import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Store original console methods once on file load to prevent losing them when console is silenced
const originalLog = window.console.log;
const originalInfo = window.console.info;
const originalWarn = window.console.warn;
const originalDebug = window.console.debug;
const originalError = window.console.error;

export const ConsoleGuard = ({ children }: { children: React.ReactNode }) => {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [userEnabled, setUserEnabled] = useState(false);

  useEffect(() => {
    const isCurrentlyEnabled = globalEnabled && userEnabled;

    if (!isCurrentlyEnabled) {
      window.console.log = () => {};
      window.console.info = () => {};
      window.console.warn = () => {};
      window.console.debug = () => {};
      window.console.error = () => {};
    } else {
      window.console.log = originalLog;
      window.console.info = originalInfo;
      window.console.warn = originalWarn;
      window.console.debug = originalDebug;
      window.console.error = originalError;
    }

    return () => {
      // Restore on effect cleanup or change
      window.console.log = originalLog;
      window.console.info = originalInfo;
      window.console.warn = originalWarn;
      window.console.debug = originalDebug;
      window.console.error = originalError;
    };
  }, [globalEnabled, userEnabled]);

  useEffect(() => {
    let userChannel: any;

    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Fetch Global Preference
      const { data: globalData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'enable_client_logs')
        .maybeSingle();
      
      if (globalData) {
        setGlobalEnabled(globalData.value === true || globalData.value === 'true');
      }

      // 2. Fetch User-Specific Preference
      if (user) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('enable_logs')
          .eq('id', user.id)
          .maybeSingle();
        
        if (userData) {
          setUserEnabled(userData.enable_logs);
        }

        // 3. Subscribe to individual user preference changes
        userChannel = supabase
          .channel(`user-log-sync-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`
            },
            (payload: any) => {
              if (payload.new) {
                setUserEnabled(payload.new.enable_logs);
              }
            }
          )
          .subscribe();
      }
    };

    initialize();

    // 4. Subscribe to global preference changes
    const globalChannel = supabase
      .channel('global-log-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.enable_client_logs'
        },
        (payload: any) => {
          if (payload.new) {
            setGlobalEnabled(payload.new.value === true || payload.new.value === 'true');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
  }, []);

  return <>{children}</>;
};
