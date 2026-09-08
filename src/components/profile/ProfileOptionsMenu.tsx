import { useState } from "react";
import { MoreVertical, Ban, UserMinus, Copy, Share2, Flag } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildShortUrl, buildProfilePath } from "@/lib/shortUrl";

interface ProfileOptionsMenuProps {
  targetUserId: string;
  username: string;
  displayName?: string | null;
  isFollowedByTarget: boolean; // does this user follow ME?
  onBlocked?: () => void;
  onRemovedFollower?: () => void;
}

export const ProfileOptionsMenu = ({
  targetUserId,
  username,
  displayName,
  isFollowedByTarget,
  onBlocked,
  onRemovedFollower,
}: ProfileOptionsMenuProps) => {
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [removeFollowerDialogOpen, setRemoveFollowerDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const name = displayName || username;

  const handleCopyUrl = async () => {
    const url = await buildShortUrl(buildProfilePath(username));
    navigator.clipboard.writeText(url);
    toast.success("Profile link copied");
  };

  const handleShare = async () => {
    const url = await buildShortUrl(buildProfilePath(username));
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} on Aelixto`, url });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("blocked_users")
        .insert({ user_id: user.id, blocked_user_id: targetUserId });

      if (error) throw error;

      // Also unfollow them and remove them as follower
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);

      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", targetUserId)
        .eq("following_id", user.id);

      toast.success(`Blocked @${username}`);
      onBlocked?.();
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    } finally {
      setLoading(false);
      setBlockDialogOpen(false);
    }
  };

  const handleRemoveFollower = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", targetUserId)
        .eq("following_id", user.id);

      if (error) throw error;

      toast.success(`Removed @${username} from your followers`);
      onRemovedFollower?.();
    } catch (error) {
      console.error("Error removing follower:", error);
      toast.error("Failed to remove follower");
    } finally {
      setLoading(false);
      setRemoveFollowerDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/20 hover:bg-black/30 text-white rounded-full h-9 w-9 shadow-lg flex-shrink-0"
          >
            <MoreVertical className="h-4 w-4 stroke-[2.5]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleCopyUrl}>
            <Copy className="h-4 w-4 mr-2" />
            Copy profile URL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share profile
          </DropdownMenuItem>
          {isFollowedByTarget && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRemoveFollowerDialogOpen(true)}>
                <UserMinus className="h-4 w-4 mr-2" />
                Remove follower
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setReportOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Flag className="h-4 w-4 mr-2" />
            Report @{username}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setBlockDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="h-4 w-4 mr-2" />
            Block @{username}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="user"
        targetUserId={targetUserId}
        targetUsername={username}
      />

      {/* Block confirmation */}
      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to find your profile, posts, or message you. They won't be notified that you blocked them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={handleBlock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Blocking..." : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove follower confirmation */}
      <AlertDialog open={removeFollowerDialogOpen} onOpenChange={setRemoveFollowerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove follower?</AlertDialogTitle>
            <AlertDialogDescription>
              @{username} will be removed from your followers. They won't be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={handleRemoveFollower}
            >
              {loading ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
