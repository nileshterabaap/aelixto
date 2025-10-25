import { useEffect, useRef, useState } from 'react';
import { loadInstagramEmbed, loadFacebookSDK } from '@/lib/ScriptLoader';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface RawEmbedRendererProps {
  embedHtml: string;
}

const stripScriptTags = (html: string): string => {
  // Remove all <script> tags for security
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

const detectPlatform = (html: string): 'instagram' | 'facebook' | 'twitter' | 'pinterest' | 'unknown' => {
  if (html.includes('instagram.com') || html.includes('instagr.am')) {
    return 'instagram';
  }
  if (html.includes('facebook.com') || html.includes('fb.com')) {
    return 'facebook';
  }
  if (html.includes('twitter.com') || html.includes('x.com') || html.includes('platform.twitter.com')) {
    return 'twitter';
  }
  if (html.includes('pinterest.com') || html.includes('pinimg.com') || html.includes('assets.pinterest.com')) {
    return 'pinterest';
  }
  return 'unknown';
};

export const RawEmbedRenderer = ({ embedHtml }: RawEmbedRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadEmbed = async () => {
      if (!embedHtml || !containerRef.current) {
        setIsLoading(false);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const platform = detectPlatform(embedHtml);
        const sanitizedHtml = stripScriptTags(embedHtml);

        // Set the HTML content
        containerRef.current.innerHTML = sanitizedHtml;

        // Load appropriate script and process embed
        if (platform === 'instagram') {
          await loadInstagramEmbed();
          // Process Instagram embeds
          if (window.instgrm?.Embeds) {
            window.instgrm.Embeds.process();
          }
        } else if (platform === 'facebook') {
          await loadFacebookSDK();
          // Parse Facebook embeds
          if (window.FB?.XFBML && containerRef.current) {
            window.FB.XFBML.parse(containerRef.current);
          }
        } else if (platform === 'twitter') {
          // Load Twitter widgets script
          const script = document.createElement('script');
          script.src = 'https://platform.twitter.com/widgets.js';
          script.async = true;
          if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
            document.body.appendChild(script);
          }
        } else if (platform === 'pinterest') {
          // Load Pinterest script with proper timing
          await new Promise<void>((resolve) => {
            const existingScript = document.querySelector('script[src="https://assets.pinterest.com/js/pinit.js"]');
            
            if (existingScript) {
              // Script already loaded, just build
              if (window.PinUtils) {
                window.PinUtils.build();
              }
              resolve();
            } else {
              // Load script and wait for it
              const script = document.createElement('script');
              script.src = 'https://assets.pinterest.com/js/pinit.js';
              script.async = true;
              script.setAttribute('data-pin-build', 'doBuild');
              
              script.onload = () => {
                console.log('Pinterest script loaded');
                // Wait a bit for PinUtils to be available
                setTimeout(() => {
                  if (window.PinUtils) {
                    console.log('Building Pinterest embed');
                    window.PinUtils.build();
                  }
                  resolve();
                }, 100);
              };
              
              script.onerror = () => {
                console.error('Failed to load Pinterest script');
                resolve();
              };
              
              document.body.appendChild(script);
            }
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load embed:', err);
        setError('Failed to load embed. Please try again.');
        setIsLoading(false);
      }
    };

    loadEmbed();
  }, [embedHtml]);

  if (error) {
    return (
      <Card className="p-6 border-destructive">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      <div 
        ref={containerRef}
        className="embed-container rounded-2xl overflow-hidden"
        style={{ minHeight: isLoading ? '200px' : 'auto' }}
      />
    </div>
  );
};
