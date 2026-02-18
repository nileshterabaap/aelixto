import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { InteractionPermissions } from "@/components/settings/InteractionPermissions";
import type { CommentPermission, MessagePermission, MentionPermission } from "@/hooks/useInteractionPermissions";

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();

  const [isPrivate, setIsPrivate] = useState(false);
  const [whoCanComment, setWhoCanComment] = useState<CommentPermission>('everyone');
  const [whoCanMessage, setWhoCanMessage] = useState<MessagePermission>('everyone');
  const [whoCanMention, setWhoCanMention] = useState<MentionPermission>('everyone');

  useEffect(() => {
    if (profile?.settings) {
      const s = profile.settings as any;
      setIsPrivate(s.is_private || false);
      setWhoCanComment(s.who_can_comment || 'everyone');
      setWhoCanMessage(s.who_can_message || 'everyone');
      setWhoCanMention(s.who_can_mention || 'everyone');
    }
  }, [profile]);

  const saveSettings = (updates: Record<string, any>) => {
    const merged = {
      ...((profile?.settings as any) || {}),
      ...updates,
    };
    upsertProfile({ settings: merged });
  };

  const handlePrivateToggle = (checked: boolean) => {
    setIsPrivate(checked);
    saveSettings({ is_private: checked });
  };

  const handleCommentChange = (v: CommentPermission) => {
    setWhoCanComment(v);
    saveSettings({ who_can_comment: v });
  };

  const handleMessageChange = (v: MessagePermission) => {
    setWhoCanMessage(v);
    saveSettings({ who_can_message: v });
  };

  const handleMentionChange = (v: MentionPermission) => {
    setWhoCanMention(v);
    saveSettings({ who_can_mention: v });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to access settings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Privacy settings</h1>
        </div>

        {/* Private Account */}
        <p className="text-base text-muted-foreground pt-6 pb-2">Account</p>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between py-4">
            <div>
              <span className="text-base text-foreground">Private account</span>
              <p className="text-sm text-muted-foreground mt-0.5">Only approved followers can see your posts</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={handlePrivateToggle} />
          </div>
        </div>

        {/* Allow Interactions */}
        <p className="text-base text-muted-foreground pt-6 pb-2">Allow interactions</p>
        <div className="divide-y divide-border">
          <InteractionPermissions
            whoCanComment={whoCanComment}
            whoCanMessage={whoCanMessage}
            whoCanMention={whoCanMention}
            onChangeComment={handleCommentChange}
            onChangeMessage={handleMessageChange}
            onChangeMention={handleMentionChange}
          />
        </div>
      </main>
    </div>
  );
};

export default PrivacySettings;
