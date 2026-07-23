import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const TawkChat = () => {
  useEffect(() => {
    // Tawk.to Script Integration
    var Tawk_API: any = (window as any).Tawk_API || {};
    var Tawk_LoadStart = new Date();

    const s1 = document.createElement("script");
    const s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = "https://embed.tawk.to/64464cdc31ebfa0fe7fa0937/1jo9sjams";
    s1.charset = "UTF-8";
    s1.setAttribute("crossorigin", "*");
    s0.parentNode?.insertBefore(s1, s0);

    // Set User Attributes when Tawk.to is loaded
    Tawk_API.onLoad = async function () {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        Tawk_API.setAttributes({
          'name': user.email?.split('@')[0] || 'User',
          'email': user.email,
          'id': user.id
        }, function (error: any) {
          if (error) console.error("Tawk.to attribute error:", error);
        });
      }
    };

    return () => {
      // Optional: Cleanup if needed, though Tawk.to usually persists
    };
  }, []);

  return null; // This component doesn't render anything visible
};
