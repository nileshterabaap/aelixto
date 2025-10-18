import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { FeedPost } from "@/components/FeedPost";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { demoPosts } from "@/data/demoData";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSavePost = (postId: string) => {
    toast({
      title: "Post saved!",
      description: "Added to your saved collection"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
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
