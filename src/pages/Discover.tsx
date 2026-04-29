import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";
import { useUserSearch } from "@/hooks/useUserSearch";
import { SearchResultItem } from "@/components/SearchResultItem";

const Discover = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { results, loading, hasMore, loadMore } = useUserSearch(searchQuery, true);

  const handleRefresh = useCallback(async () => {
    // Reset search to trigger a fresh search
    const q = searchQuery;
    setSearchQuery("");
    await new Promise((r) => setTimeout(r, 100));
    setSearchQuery(q);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search users (@username or name)..." 
                className="pl-10 h-12 bg-card"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Search Results */}
            {searchQuery ? (
              <section>
                <h2 className="text-xl font-semibold mb-4">Search Results</h2>
                {loading && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Searching...
                  </p>
                )}
                {!loading && results.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users found
                  </p>
                )}
                {results.length > 0 && (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <SearchResultItem key={result.id} result={result} />
                    ))}
                    {hasMore && (
                      <button
                        onClick={loadMore}
                        disabled={loading}
                        className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Search for users</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Find people by username or display name
                </p>
              </div>
            )}
          </div>
        </main>
      </PullToRefresh>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Discover;
