import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { FeedPost } from "@/components/FeedPost";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { demoPosts } from "@/data/demoData";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSavePost = (postId: string) => {
    toast({
      title: "Post saved!",
      description: "Added to your saved collection"
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-3">
        <div className="space-y-4">
          {demoPosts.map((post) => (
            <FeedPost key={post.id} post={post} onSave={handleSavePost} />
          ))}
        </div>
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Index;
