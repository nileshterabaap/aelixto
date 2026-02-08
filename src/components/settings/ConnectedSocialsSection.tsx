import { useState, useEffect } from 'react';
import { LogOut, RefreshCw, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';
import { toast } from 'sonner';

// Platform icons
import InstagramIcon from '@/assets/platforms/instagram.svg';
import TikTokIcon from '@/assets/platforms/tiktok.svg';
import YouTubeIcon from '@/assets/platforms/youtube.svg';
import XIcon from '@/assets/platforms/x.svg';

interface ConnectedSocial {
  id: string;
  platform: string;
  platform_username: string;
  created_at: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const platforms: PlatformConfig[] = [
  { id: 'instagram', name: 'Instagram', icon: InstagramIcon, color: 'from-purple-500 via-pink-500 to-orange-400' },
  { id: 'tiktok', name: 'TikTok', icon: TikTokIcon, color: 'from-cyan-400 to-pink-500' },
  { id: 'youtube', name: 'YouTube', icon: YouTubeIcon, color: 'from-red-500 to-red-600' },
  { id: 'x', name: 'X', icon: XIcon, color: 'from-white to-gray-300' },
];

export const ConnectedSocialsSection = () => {
  const { session } = useSession();
  const [connectedSocials, setConnectedSocials] = useState<ConnectedSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchConnectedSocials();
    }
  }, [session?.user?.id]);

  const fetchConnectedSocials = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('connected_socials')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;
      setConnectedSocials(data || []);
    } catch (error) {
      console.error('Failed to fetch connected socials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platformId: string) => {
    setConnectingPlatform(platformId);
    
    try {
      // Initiate OAuth flow via Outstand
      const { data, error } = await supabase.functions.invoke('outstand-oauth', {
        body: { 
          action: 'initiate',
          platform: platformId,
          redirectUrl: `${window.location.origin}/settings?oauth_callback=true&platform=${platformId}`,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      toast.error(`Failed to connect ${platformId}. Please try again.`);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!session?.user?.id) return;
    
    setDisconnectingPlatform(platformId);
    
    try {
      const { error } = await supabase
        .from('connected_socials')
        .delete()
        .eq('user_id', session.user.id)
        .eq('platform', platformId);

      if (error) throw error;

      setConnectedSocials(prev => prev.filter(s => s.platform !== platformId));
      toast.success(`Disconnected from ${platformId}`);
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect. Please try again.');
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  const handleSwitchAccount = (platformId: string) => {
    // Same as connect - will replace existing connection
    handleConnect(platformId);
  };

  const getConnectedAccount = (platformId: string) => {
    return connectedSocials.find(s => s.platform === platformId);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading your connected accounts...
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">Connected Socials</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Connect your social accounts to interact directly with platforms
        </p>
      </div>
      {platforms.map((platform) => {
        const connected = getConnectedAccount(platform.id);
        const isConnecting = connectingPlatform === platform.id;
        const isDisconnecting = disconnectingPlatform === platform.id;

        return (
          <div
            key={platform.id}
            className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border hover:border-muted-foreground/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${platform.color} p-2 flex items-center justify-center`}>
                <img src={platform.icon} alt={platform.name} className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{platform.name}</p>
                {connected ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" />
                    @{connected.platform_username}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60">Not connected</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSwitchAccount(platform.id)}
                    disabled={isConnecting}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isConnecting ? 'animate-spin' : ''}`} />
                    Switch
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(platform.id)}
                    disabled={isDisconnecting}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    {isDisconnecting ? 'Disconnecting...' : 'Logout'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConnect(platform.id)}
                  disabled={isConnecting}
                  className="text-xs"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
