import { useState } from "react";
import { MoreVertical, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/ReportDialog";

interface PostReportMenuProps {
  postId: string;
  authorUserId: string;
  authorUsername?: string;
  onReported?: () => void;
}

/**
 * Vertical 2-dot menu shown in the top-right of a post card for posts
 * that don't belong to the current user. Currently exposes "Report".
 */
export const PostReportMenu = ({
  postId,
  authorUserId,
  authorUsername,
  onReported,
}: PostReportMenuProps) => {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Post options"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background z-50">
          <DropdownMenuItem
            onClick={() => setReportOpen(true)}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <Flag className="h-4 w-4 mr-2" />
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        postId={postId}
        targetUserId={authorUserId}
        targetUsername={authorUsername}
        onSubmitted={onReported}
      />
    </>
  );
};
