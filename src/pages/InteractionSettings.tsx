import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { InteractionPermissions } from "@/components/settings/InteractionPermissions";
import type { CommentPermission, MessagePermission, MentionPermission } from "@/hooks/useInteractionPermissions";

const InteractionSettings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();

  const [whoCanComment, setWhoCanComment] = useState<CommentPermission>('everyone');
  const [whoCanMessage, setWhoCanMessage] = useState<MessagePermission>('everyone');
  const [whoCanMention, setWhoCanMention] = useState<MentionPermission>('everyone');

  useEffect(() => {
    if (profile?.settings) {
      const s = profile.settings as any;
      setWhoCanComment(s.who_can_comment || 'everyone');
      setWhoCanMessage(s.who_can_message || 'everyone');
      setWhoCanMention(s.who_can_mention || 'everyone');
    }
  }, [profile]);

  const save = (comment: CommentPermission, message: MessagePermission, mention: MentionPermission) => {
    setWhoCanComment(comment);
    setWhoCanMessage(message);
    setWhoCanMention(mention);
    upsertProfile({
      settings: {
        ...((profile?.settings as any) || {}),
        who_can_comment: comment,
        who_can_message: message,
        who_can_mention: mention,
      },
    });
  };

  if (!user) {
    return (
      <div className="screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to access settings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="screen-nav bg-background">
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Allow Interactions</h1>
        </div>

        <div className="bg-card rounded-xl border divide-y divide-border">
          <InteractionPermissions
            whoCanComment={whoCanComment}
            whoCanMessage={whoCanMessage}
            whoCanMention={whoCanMention}
            onChangeComment={(v) => save(v, whoCanMessage, whoCanMention)}
            onChangeMessage={(v) => save(whoCanComment, v, whoCanMention)}
            onChangeMention={(v) => save(whoCanComment, whoCanMessage, v)}
          />
        </div>
      </main>
    </div>
  );
};

export default InteractionSettings;
