import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useCallback, useEffect } from "react";
import { useUserSearch } from "@/hooks/useUserSearch";
import { SearchResultItem } from "@/components/SearchResultItem";

const HISTORY_KEY = "aelixto:search-history";
const MAX_HISTORY = 10;

const loadHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const Discover = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { results, loading, hasMore, loadMore } = useUserSearch(searchQuery, true);
  const [history, setHistory] = useState<string[]>(() => loadHistory());

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    const t = setTimeout(() => {
      setHistory((prev) => {
        const next = [q, ...prev.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, MAX_HISTORY);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }, 800);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const removeHistoryItem = (item: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== item);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
  };

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
        <main className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
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
              history.length > 0 ? (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-muted-foreground">Recent</h2>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {history.map((item) => (
                      <li
                        key={item}
                        className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-card transition-colors"
                      >
                        <button
                          onClick={() => setSearchQuery(item)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground truncate">{item}</span>
                        </button>
                        <button
                          onClick={() => removeHistoryItem(item)}
                          aria-label={`Remove ${item}`}
                          className="p-1 -mr-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Search for users</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Find people by username or display name
                  </p>
                </div>
              )
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
