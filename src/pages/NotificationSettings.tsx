import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Heart, MessageCircle, Repeat2, UserPlus, UserCheck, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";

type Scope = "off" | "following" | "everyone";

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "following", label: "From profiles I follow" },
  { value: "everyone", label: "From everyone" },
];

const ScopeGroup = ({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: Scope;
  onChange: (v: Scope) => void;
}) => (
  <div className="p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <p className="font-medium">{label}</p>
    </div>
    <RadioGroup value={value} onValueChange={(v) => onChange(v as Scope)} className="pl-8 space-y-2">
      {SCOPE_OPTIONS.map((opt) => (
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

const FlagGroup = ({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <p className="font-medium">{label}</p>
    </div>
    <RadioGroup
      value={value ? "on" : "off"}
      onValueChange={(v) => onChange(v === "on")}
      className="pl-8 space-y-2"
    >
      {[
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
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

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();

  const [likes, setLikes] = useState<Scope>("everyone");
  const [comments, setComments] = useState<Scope>("everyone");
  const [reposts, setReposts] = useState<Scope>("everyone");
  const [messages, setMessages] = useState<Scope>("everyone");
  const [follows, setFollows] = useState(true);
  const [followAsks, setFollowAsks] = useState(true);
  const [followAccepted, setFollowAccepted] = useState(true);

  useEffect(() => {
    const s = (profile?.settings as any) || {};
    setLikes(s.notif_likes || "everyone");
    setComments(s.notif_comments || "everyone");
    setReposts(s.notif_reposts || "everyone");
    setMessages(s.notif_messages || "everyone");
    setFollows(s.notif_follows !== false);
    setFollowAsks(s.notif_follow_asks !== false);
    setFollowAccepted(s.notif_follow_accepted !== false);
  }, [profile]);

  const save = (updates: Record<string, any>) => {
    upsertProfile({
      settings: {
        ...((profile?.settings as any) || {}),
        ...updates,
      },
    });
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
    <div className="min-h-screen bg-background pb-[calc(5rem+var(--safe-bottom))]">
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>

        <div className="bg-card rounded-xl border divide-y divide-border">
          <ScopeGroup
            icon={Heart}
            label="Likes"
            value={likes}
            onChange={(v) => { setLikes(v); save({ notif_likes: v }); }}
          />
          <ScopeGroup
            icon={MessageCircle}
            label="Comments"
            value={comments}
            onChange={(v) => { setComments(v); save({ notif_comments: v }); }}
          />
          <ScopeGroup
            icon={Repeat2}
            label="Reposts"
            value={reposts}
            onChange={(v) => { setReposts(v); save({ notif_reposts: v }); }}
          />
          <ScopeGroup
            icon={MessageSquare}
            label="Messages"
            value={messages}
            onChange={(v) => { setMessages(v); save({ notif_messages: v }); }}
          />
          <FlagGroup
            icon={Users}
            label="New followers"
            value={follows}
            onChange={(v) => { setFollows(v); save({ notif_follows: v }); }}
          />
          <FlagGroup
            icon={UserPlus}
            label="Follow Asks"
            value={followAsks}
            onChange={(v) => { setFollowAsks(v); save({ notif_follow_asks: v }); }}
          />
          <FlagGroup
            icon={UserCheck}
            label="Agreed Follow Asks"
            value={followAccepted}
            onChange={(v) => { setFollowAccepted(v); save({ notif_follow_accepted: v }); }}
          />
        </div>
      </main>
    </div>
  );
};

export default NotificationSettings;
