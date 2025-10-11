import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePostDialog = ({ open, onOpenChange }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please write something before posting",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Post created!",
      description: "Your post has been published to your feed"
    });

    setContent("");
    setMediaUrl("");
    setMediaType('none');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="content">What's on your mind?</Label>
            <Textarea
              id="content"
              placeholder="Share something interesting..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1.5 min-h-[120px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mediaType === 'image' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMediaType(mediaType === 'image' ? 'none' : 'image')}
              className="flex-1"
            >
              <Image className="h-4 w-4 mr-1.5" />
              Image
            </Button>
            <Button
              type="button"
              variant={mediaType === 'video' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMediaType(mediaType === 'video' ? 'none' : 'video')}
              className="flex-1"
            >
              <Video className="h-4 w-4 mr-1.5" />
              Video
            </Button>
          </div>

          {mediaType !== 'none' && (
            <div>
              <Label htmlFor="mediaUrl">
                {mediaType === 'image' ? 'Image URL' : 'Video URL'}
              </Label>
              <Input
                id="mediaUrl"
                type="url"
                placeholder={mediaType === 'image' ? 'https://...' : 'YouTube, TikTok, etc.'}
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full">
            Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
