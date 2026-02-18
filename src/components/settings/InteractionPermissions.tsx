import { MessageSquare, AtSign, MessageCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CommentPermission, MessagePermission, MentionPermission } from "@/hooks/useInteractionPermissions";

interface InteractionPermissionsProps {
  whoCanComment: CommentPermission;
  whoCanMessage: MessagePermission;
  whoCanMention: MentionPermission;
  onChangeComment: (v: CommentPermission) => void;
  onChangeMessage: (v: MessagePermission) => void;
  onChangeMention: (v: MentionPermission) => void;
}

const PermissionGroup = ({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <p className="font-medium">{label}</p>
    </div>
    <RadioGroup value={value} onValueChange={onChange} className="pl-8 space-y-2">
      {options.map((opt) => (
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

export const InteractionPermissions = ({
  whoCanComment,
  whoCanMessage,
  whoCanMention,
  onChangeComment,
  onChangeMessage,
  onChangeMention,
}: InteractionPermissionsProps) => (
  <>
    <PermissionGroup
      icon={MessageSquare}
      label="Comment on my posts"
      value={whoCanComment}
      onChange={(v) => onChangeComment(v as CommentPermission)}
      options={[
        { value: 'everyone', label: 'Everyone' },
        { value: 'followers', label: 'Followers' },
        { value: 'no_one', label: 'No one' },
      ]}
    />
    <PermissionGroup
      icon={MessageCircle}
      label="Message me"
      value={whoCanMessage}
      onChange={(v) => onChangeMessage(v as MessagePermission)}
      options={[
        { value: 'everyone', label: 'Everyone' },
        { value: 'followers', label: 'Only Followers' },
        { value: 'following', label: 'Only Following' },
        { value: 'no_one', label: 'No one' },
      ]}
    />
    <PermissionGroup
      icon={AtSign}
      label="Mention me"
      value={whoCanMention}
      onChange={(v) => onChangeMention(v as MentionPermission)}
      options={[
        { value: 'everyone', label: 'Everyone' },
        { value: 'followers', label: 'Followers' },
        { value: 'following', label: 'Following' },
        { value: 'no_one', label: 'No one' },
      ]}
    />
  </>
);
