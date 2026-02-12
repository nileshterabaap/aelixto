import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import youtubeIcon from '@/assets/platforms/youtube.svg';
import instagramIcon from '@/assets/platforms/instagram.svg';
import tiktokIcon from '@/assets/platforms/tiktok.svg';
import redditIcon from '@/assets/platforms/reddit.svg';
import twitterIcon from '@/assets/platforms/x.svg';
import pinterestIcon from '@/assets/platforms/pinterest.svg';
import facebookIcon from '@/assets/platforms/facebook.svg';
import spotifyIcon from '@/assets/platforms/spotify.svg';
import quoraIcon from '@/assets/platforms/quora.svg';
import mediumIcon from '@/assets/platforms/medium.svg';

const platformMeta: Record<string, { name: string; icon: string }> = {
  youtube: { name: 'YouTube', icon: youtubeIcon },
  instagram: { name: 'Instagram', icon: instagramIcon },
  tiktok: { name: 'TikTok', icon: tiktokIcon },
  twitter: { name: 'X (Twitter)', icon: twitterIcon },
  x: { name: 'X (Twitter)', icon: twitterIcon },
  facebook: { name: 'Facebook', icon: facebookIcon },
  reddit: { name: 'Reddit', icon: redditIcon },
  pinterest: { name: 'Pinterest', icon: pinterestIcon },
  spotify: { name: 'Spotify', icon: spotifyIcon },
  quora: { name: 'Quora', icon: quoraIcon },
  medium: { name: 'Medium', icon: mediumIcon },
};

interface ConnectedSocial {
  id: string;
  platform: string;
  platform_username: string;
}

export const ConnectedSocials = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [socials, setSocials] = useState<ConnectedSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('connected_socials')
        .select('id, platform, platform_username')
        .eq('user_id', user.id);
      setSocials(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleDisconnect = async (social: ConnectedSocial) => {
    setDisconnecting(social.id);
    const { error } = await supabase
      .from('connected_socials')
      .delete()
      .eq('id', social.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to disconnect account', variant: 'destructive' });
    } else {
      setSocials((prev) => prev.filter((s) => s.id !== social.id));
      toast({ title: 'Disconnected', description: `${platformMeta[social.platform]?.name || social.platform} account removed.` });
    }
    setDisconnecting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (socials.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        No connected accounts yet. Connect platforms from your feed.
      </div>
    );
  }

  return (
    <>
      {socials.map((social) => {
        const meta = platformMeta[social.platform];
        return (
          <div key={social.id} className="flex items-center gap-4 p-4">
            {meta?.icon && (
              <img
                src={meta.icon}
                alt={meta.name}
                className="h-5 w-5 object-contain dark:invert shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{meta?.name || social.platform}</p>
              <p className="text-sm text-muted-foreground truncate">@{social.platform_username}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive shrink-0"
              disabled={disconnecting === social.id}
              onClick={() => handleDisconnect(social)}
            >
              {disconnecting === social.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        );
      })}
    </>
  );
};
