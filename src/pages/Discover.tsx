import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { FeedPost } from "@/components/FeedPost";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { demoPosts } from "@/data/demoData";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Discover = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search topics, people, or posts..." 
              className="pl-10 h-12 bg-card"
            />
          </div>

          {/* Trending Topics */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Trending Topics</h2>
            <div className="grid gap-3">
              {["Design Systems", "React 19", "AI Development", "TypeScript Tips", "Web3"].map((topic) => (
                <div 
                  key={topic}
                  className="p-4 bg-card rounded-xl border hover:border-primary transition-colors cursor-pointer"
                >
                  <h3 className="font-medium">#{topic}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Math.floor(Math.random() * 50 + 10)}k posts
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Suggested Creators */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Suggested Creators</h2>
            <div className="grid gap-3">
              {["Sarah Chen", "Marcus Rodriguez", "Emily Park"].map((name) => (
                <div 
                  key={name}
                  className="p-4 bg-card rounded-xl border flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/50" />
                    <div>
                      <h3 className="font-medium">{name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {Math.floor(Math.random() * 100 + 20)}k followers
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Demo Posts Feed */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Featured Posts</h2>
            <div className="space-y-4">
              {demoPosts.map((post) => (
                <FeedPost 
                  key={post.id} 
                  post={post}
                  userId={user?.id}
                />
              ))}
            </div>
          </section>
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

export default Discover;
