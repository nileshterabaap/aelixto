import { useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';

// Platform icons
import InstagramIcon from '@/assets/platforms/instagram.svg';
import TikTokIcon from '@/assets/platforms/tiktok.svg';
import YouTubeIcon from '@/assets/platforms/youtube.svg';
import XIcon from '@/assets/platforms/x.svg';

interface ConnectPlatformPromptProps {
  platform: string;
  onConnect: () => void;
  onDismiss: () => void;
}

const platformIcons: Record<string, string> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  x: XIcon,
  twitter: XIcon,
};

const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  twitter: 'X',
};

export const ConnectPlatformPrompt = ({
  platform,
  onConnect,
  onDismiss,
}: ConnectPlatformPromptProps) => {
  const { session } = useSession();
  const [isDismissing, setIsDismissing] = useState(false);

  const platformIcon = platformIcons[platform] || platformIcons.instagram;
  const platformName = platformNames[platform] || platform;

  const handleDismissForever = async () => {
    if (!session?.user?.id) return;
    
    setIsDismissing(true);
    try {
      // Get current settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('user_id', session.user.id)
        .single();

      const currentSettings = (profile?.settings as Record<string, unknown>) || {};
      const dismissedPrompts = (currentSettings.dismissed_connect_prompts as string[]) || [];

      // Add this platform to dismissed list
      if (!dismissedPrompts.includes(platform)) {
        const updatedSettings = {
          ...currentSettings,
          dismissed_connect_prompts: [...dismissedPrompts, platform],
        };

        await supabase
          .from('profiles')
          .update({ settings: updatedSettings })
          .eq('user_id', session.user.id);
      }

      onDismiss();
    } catch (error) {
      console.error('Failed to dismiss prompt:', error);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src={platformIcon} alt={platformName} className="w-4 h-4 opacity-70" />
        <span className="text-sm text-white/70">
          Connect {platformName} to interact on the platform
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onConnect}
          className="text-xs text-primary hover:text-primary/80"
        >
          Connect
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-4 w-4 text-white/50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
            <DropdownMenuItem 
              onClick={handleDismissForever}
              disabled={isDismissing}
              className="text-white/70 focus:text-white"
            >
              <X className="h-4 w-4 mr-2" />
              Don't ask again
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
