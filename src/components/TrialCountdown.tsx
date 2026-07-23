import React, { useState, useEffect } from 'react';
import { Timer, AlertCircle } from 'lucide-react';
import { UserProfile } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface TrialCountdownProps {
  profile: UserProfile;
}

export const TrialCountdown: React.FC<TrialCountdownProps> = ({ profile }) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!profile.trial_started_at) return;

    const calculateTimeLeft = () => {
      const startTime = new Date(profile.trial_started_at!).getTime();
      const durationMs = profile.trial_duration_days * 24 * 60 * 60 * 1000;
      const expiryTime = startTime + durationMs;
      const now = new Date().getTime();
      const difference = expiryTime - now;

      if (difference <= 0) {
        setTimeLeft("Trial Expired");
        setIsExpired(true);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [profile.trial_started_at, profile.trial_duration_days]);

  if (!profile.trial_started_at || profile.subscription_status !== 'free') return null;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-300",
      isExpired 
        ? "bg-red-500/10 border-red-500/20 text-red-400" 
        : "bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
    )}>
      <div className={cn(
        "p-1.5 rounded-lg",
        isExpired ? "bg-red-500/20" : "bg-blue-500/20"
      )}>
        {isExpired ? <AlertCircle size={18} /> : <Timer size={18} className="animate-pulse" />}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
          Demo Trial
        </span>
        <span className="text-sm font-mono font-medium tabular-nums">
          {timeLeft}
        </span>
      </div>
    </div>
  );
};
