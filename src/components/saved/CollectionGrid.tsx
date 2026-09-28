import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Collection } from "@/hooks/useCollections";
import { useCollectionItems } from "@/hooks/useCollections";
import { SavedThumbnailGrid } from "./SavedThumbnailGrid";
import { maybeProxy } from "@/lib/getPostThumb";

interface CollectionGridProps {
  collections: Collection[];
  userId?: string;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (id: string) => void;
  isCreating: boolean;
}

function CollectionThumb({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-muted/70 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer" />
      )}
      <img
        src={src}
        alt=""
        onLoad={() => setLoaded(true)}
        loading="lazy"
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function CollectionTile({
  collection,
  onClick,
  onDelete,
}: {
  collection: Collection;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const thumbs = collection.preview_thumbnails.slice(0, 4);

  return (
    <>
      <div className="group relative">
        <button onClick={onClick} className="w-full text-left">
          {/* 2x2 preview grid */}
          <div className="rounded-2xl overflow-hidden aspect-square bg-muted grid grid-cols-2 grid-rows-2 gap-px">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-muted/80 overflow-hidden">
                {thumbs[i] ? (
                  <CollectionThumb src={maybeProxy(thumbs[i], 240)} />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 px-0.5">
            <p className="font-semibold text-sm truncate">{collection.name}</p>
            <p className="text-xs text-muted-foreground">{collection.item_count} items</p>
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{collection.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the collection but not the saved posts inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CollectionDetail({
  collection,
  userId,
  onBack,
}: {
  collection: Collection;
  userId?: string;
  onBack: () => void;
}) {
  const { data: items = [], isLoading } = useCollectionItems(collection.id);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">
        ← Back to Collections
      </button>
      <h2 className="text-lg font-bold mb-4">{collection.name}</h2>
      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
      ) : (
        <SavedThumbnailGrid posts={items} userId={userId} />
      )}
    </div>
  );
}

export const CollectionGrid = ({
  collections,
  userId,
  onCreateCollection,
  onDeleteCollection,
  isCreating,
}: CollectionGridProps) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCollection(newName.trim());
    setNewName("");
    setCreateOpen(false);
  };

  if (selectedCollection) {
    return (
      <CollectionDetail
        collection={selectedCollection}
        userId={userId}
        onBack={() => setSelectedCollection(null)}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {/* Create new collection tile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-2xl aspect-square border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-muted-foreground/50 transition-colors w-full"
          >
            <Plus className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">New Collection</span>
          </button>
        </motion.div>

        {collections.map((col, i) => (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: (i + 1) * 0.08, ease: [0.4, 0, 0.2, 1] }}
          >
            <CollectionTile
              collection={col}
              onClick={() => setSelectedCollection(col)}
              onDelete={() => onDeleteCollection(col.id)}
            />
          </motion.div>
        ))}
      </div>

      {collections.length === 0 && (
        <div className="text-center py-8 mt-4">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Organize your saved posts into collections</p>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
