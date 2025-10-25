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

const detectPlatform = (html: string): 'instagram' | 'facebook' | 'unknown' => {
  if (html.includes('instagram.com') || html.includes('instagr.am')) {
    return 'instagram';
  }
  if (html.includes('facebook.com') || html.includes('fb.com')) {
    return 'facebook';
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
