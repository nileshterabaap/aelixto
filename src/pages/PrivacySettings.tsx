import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Ban, Heart, Users, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { InteractionPermissions } from "@/components/settings/InteractionPermissions";
import type { CommentPermission, MessagePermission, MentionPermission } from "@/hooks/useInteractionPermissions";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";
import { useToast } from "@/hooks/use-toast";

type FollowVisibility = "everyone" | "followers" | "no_one";

const FollowVisibilityGroup = ({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: FollowVisibility;
  onChange: (v: FollowVisibility) => void;
}) => (
  <div className="p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <p className="font-medium">{label}</p>
    </div>
    <RadioGroup value={value} onValueChange={(v) => onChange(v as FollowVisibility)} className="pl-8 space-y-2">
      {[
        { value: 'everyone', label: 'Everyone' },
        { value: 'followers', label: 'Followers' },
        { value: 'no_one', label: 'No one' },
      ].map((opt) => (
        <div key={opt.value} className="flex items-center gap-2">
          <RadioGroupItem value={opt.value} id={`${label}-${opt.value}`} />
          <Label htmlFor={`${label}-${opt.value}`} className="text-sm font-normal cursor-pointer">
            {opt.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  </div>
);

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();
  const { blockedUsers, isLoading: blockedLoading, unblock } = useBlockedUsers();
  const { toast } = useToast();

  const [isPrivate, setIsPrivate] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [whoCanSeeFollowers, setWhoCanSeeFollowers] = useState<FollowVisibility>("everyone");
  const [whoCanSeeFollowing, setWhoCanSeeFollowing] = useState<FollowVisibility>("everyone");
  const [whoCanComment, setWhoCanComment] = useState<CommentPermission>('everyone');
  const [whoCanMessage, setWhoCanMessage] = useState<MessagePermission>('everyone');
  const [whoCanMention, setWhoCanMention] = useState<MentionPermission>('everyone');

  useEffect(() => {
    if (profile?.settings) {
      const s = profile.settings as any;
      setIsPrivate(s.is_private || false);
      setHideLikes(s.hide_likes || false);
      setWhoCanSeeFollowers(s.who_can_see_followers || (s.is_private ? 'followers' : 'everyone'));
      setWhoCanSeeFollowing(s.who_can_see_following || (s.is_private ? 'followers' : 'everyone'));
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

  const handleHideLikesToggle = (checked: boolean) => {
    setHideLikes(checked);
    saveSettings({ hide_likes: checked });
  };

  const handleSeeFollowersChange = (v: FollowVisibility) => {
    setWhoCanSeeFollowers(v);
    saveSettings({ who_can_see_followers: v });
  };

  const handleSeeFollowingChange = (v: FollowVisibility) => {
    setWhoCanSeeFollowing(v);
    saveSettings({ who_can_see_following: v });
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
          <div className="flex items-center justify-between py-4">
            <div>
              <span className="text-base text-foreground">Hide like counts</span>
              <p className="text-sm text-muted-foreground mt-0.5">Others won't see like counts on your posts</p>
            </div>
            <Switch checked={hideLikes} onCheckedChange={handleHideLikesToggle} />
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

        {/* Follow list visibility */}
        <p className="text-base text-muted-foreground pt-6 pb-2">Follow lists</p>
        <div className="divide-y divide-border">
          <FollowVisibilityGroup
            icon={Users}
            label="Who can see my followers"
            value={whoCanSeeFollowers}
            onChange={handleSeeFollowersChange}
          />
          <FollowVisibilityGroup
            icon={UserCheck}
            label="Who can see who I follow"
            value={whoCanSeeFollowing}
            onChange={handleSeeFollowingChange}
          />
        </div>

        {/* Blocked Accounts */}
        <p className="text-base text-muted-foreground pt-6 pb-2">Blocked accounts</p>
        <div className="divide-y divide-border">
          {blockedLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Ban className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No blocked accounts</p>
            </div>
          ) : (
            blockedUsers.map((block) => (
              <div key={block.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={block.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-sm">
                      {(block.profile?.username || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {block.profile?.display_name || block.profile?.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{block.profile?.username || 'unknown'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    unblock.mutate(block.blocked_user_id, {
                      onSuccess: () => toast({ title: "Unblocked", description: `@${block.profile?.username || 'user'} has been unblocked.` }),
                    });
                  }}
                  disabled={unblock.isPending}
                >
                  Unblock
                </Button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default PrivacySettings;
