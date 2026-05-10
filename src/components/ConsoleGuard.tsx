import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ConsoleGuard = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Store original console methods
    const originalLog = window.console.log;
    const originalInfo = window.console.info;
    const originalWarn = window.console.warn;
    const originalDebug = window.console.debug;

    const applyPreference = (enabled: boolean) => {
      if (!enabled) {
        window.console.log = () => {};
        window.console.info = () => {};
        window.console.warn = () => {};
        window.console.debug = () => {};
      } else {
        window.console.log = originalLog;
        window.console.info = originalInfo;
        window.console.warn = originalWarn;
        window.console.debug = originalDebug;
      }
    };

    // Initial fetch
    const fetchPreference = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'enable_client_logs')
        .maybeSingle();
      
      if (!error && data) {
        const isEnabled = data.value === true || data.value === 'true';
        applyPreference(isEnabled);
      }
    };

    fetchPreference();

    // Realtime subscription
    const channel = supabase
      .channel('system-settings-changes')
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
            const isEnabled = payload.new.value === true || payload.new.value === 'true';
            applyPreference(isEnabled);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Restore on unmount
      window.console.log = originalLog;
      window.console.info = originalInfo;
      window.console.warn = originalWarn;
      window.console.debug = originalDebug;
    };
  }, []);

  return <>{children}</>;
};
