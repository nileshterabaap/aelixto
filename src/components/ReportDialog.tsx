import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReportTarget = "post" | "user";

type Reason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "nudity_sexual"
  | "violence"
  | "misinformation"
  | "self_harm"
  | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "nudity_sexual", label: "Nudity or sexual content" },
  { value: "violence", label: "Violence or dangerous behavior" },
  { value: "misinformation", label: "False information" },
  { value: "self_harm", label: "Suicide or self-harm" },
  { value: "other", label: "Something else" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTarget;
  /** Required when targetType === 'post' */
  postId?: string;
  /** Required for both post and user — the author/target user */
  targetUserId: string;
  /** Username for confirmation copy */
  targetUsername?: string;
  /** Called after a successful submit so caller can hide content locally */
  onSubmitted?: () => void;
}

export const ReportDialog = ({
  open,
  onOpenChange,
  targetType,
  postId,
  targetUserId,
  targetUsername,
  onSubmitted,
}: ReportDialogProps) => {
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason("");
    setDetails("");
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please choose a reason");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to report");
        return;
      }

      const payload: any = {
        reporter_id: user.id,
        target_type: targetType,
        reason,
        details: details.trim() || null,
      };
      if (targetType === "post") {
        payload.target_post_id = postId;
      } else {
        payload.target_user_id = targetUserId;
      }

      const { data: insertData, error } = await supabase
        .from("reports" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Fire-and-forget moderator email — don't block UI on it
      if (targetType === "post" && (insertData as any)?.id) {
        supabase.functions
          .invoke("notify-report", { body: { reportId: (insertData as any).id } })
          .catch((err) => console.error("notify-report failed:", err));
      }

      // Auto-hide locally so the user stops seeing the offending content
      if (targetType === "post" && postId) {
        await supabase
          .from("hidden_posts" as any)
          .insert({ user_id: user.id, post_id: postId });
      } else if (targetType === "user") {
        await supabase
          .from("hidden_users" as any)
          .insert({ user_id: user.id, hidden_user_id: targetUserId });
      }

      toast.success("Thanks for reporting", {
        description:
          targetType === "post"
            ? "We'll review this post. It's been hidden from your feed."
            : `We'll review @${targetUsername ?? "this account"}. They've been hidden from your feed.`,
      });
      onSubmitted?.();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Report submit error:", err);
      toast.error("Couldn't submit report", { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Report {targetType === "post" ? "post" : `@${targetUsername ?? "user"}`}
          </DialogTitle>
          <DialogDescription>
            Your report is anonymous. We'll review it and take action if it violates our
            community guidelines.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason}
          onValueChange={(v) => setReason(v as Reason)}
          className="space-y-1 max-h-[50vh] overflow-y-auto py-2"
        >
          {REASONS.map((r) => (
            <Label
              key={r.value}
              htmlFor={`report-${r.value}`}
              className="flex items-center gap-3 rounded-lg p-3 cursor-pointer hover:bg-accent"
            >
              <RadioGroupItem id={`report-${r.value}`} value={r.value} />
              <span className="text-sm font-normal">{r.label}</span>
            </Label>
          ))}
        </RadioGroup>

        {reason === "other" && (
          <Textarea
            placeholder="Tell us more (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            className="resize-none"
            rows={3}
          />
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
