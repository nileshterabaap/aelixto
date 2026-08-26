import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserSearch, SearchResult } from "@/hooks/useUserSearch";
import { SearchResultItem } from "@/components/SearchResultItem";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const HISTORY_KEY_BASE = "aelixto:visited-profiles";
const MAX_HISTORY = 10;

// Per-account key so one user's recent searches never leak into another's.
const historyKeyFor = (userId?: string | null) =>
  userId ? `${HISTORY_KEY_BASE}:${userId}` : `${HISTORY_KEY_BASE}:anon`;

type VisitedProfile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

const loadHistory = (): VisitedProfile[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x.username === "string" && typeof x.user_id === "string")
      : [];
  } catch {
    return [];
  }
};

const saveHistory = (items: VisitedProfile[]) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch {}
};

const Discover = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const [searchQuery, setSearchQuery] = useState("");
  const { results, loading, hasMore, loadMore } = useUserSearch(searchQuery, true);
  const [history, setHistory] = useState<VisitedProfile[]>(() => loadHistory());

  // Refresh from storage when returning to this page (e.g., after visiting a profile)
  useEffect(() => {
    const onFocus = () => setHistory(loadHistory());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const addToHistory = useCallback((p: VisitedProfile) => {
    setHistory((prev) => {
      const next = [p, ...prev.filter((h) => h.user_id !== p.user_id)].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = (user_id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.user_id !== user_id);
      saveHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
  };

  const handleResultSelect = (r: SearchResult) => {
    addToHistory({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
    });
  };

  const openVisited = (p: VisitedProfile) => {
    addToHistory(p);
    navigate(`/u/${p.username}`);
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
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        onSelect={() => handleResultSelect(result)}
                      />
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
                        key={item.user_id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
                      >
                        <button
                          onClick={() => openVisited(item)}
                          className="flex items-center gap-3 flex-1 text-left min-w-0"
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={item.avatar_url || undefined} alt={item.username} />
                            <AvatarFallback>
                              {(item.display_name?.[0] || item.username[0] || "?").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {item.display_name || item.username}
                            </p>
                            <p className="text-muted-foreground text-sm truncate">
                              @{item.username}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => removeHistoryItem(item.user_id)}
                          aria-label={`Remove ${item.username}`}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
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


      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Discover;
