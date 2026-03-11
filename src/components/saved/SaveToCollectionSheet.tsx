import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";

interface SaveToCollectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  userId: string;
}

export const SaveToCollectionSheet = ({
  open,
  onOpenChange,
  postId,
  userId,
}: SaveToCollectionSheetProps) => {
  const { collections, createCollection, addToCollection, isCreating } = useCollections(userId);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());

  const handleAdd = (collectionId: string) => {
    addToCollection({ collectionId, postId });
    setAddedTo((prev) => new Set(prev).add(collectionId));
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCollection(newName.trim(), {
      onSuccess: (data: any) => {
        setNewName("");
        setShowCreate(false);
        if (data?.id) {
          handleAdd(data.id);
        }
      },
    } as any);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader>
          <SheetTitle>Save to Collection</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[50vh]">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => handleAdd(col.id)}
              disabled={addedTo.has(col.id)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors text-left"
            >
              <div>
                <p className="font-medium text-sm">{col.name}</p>
                <p className="text-xs text-muted-foreground">{col.item_count} items</p>
              </div>
              {addedTo.has(col.id) && <Check className="w-5 h-5 text-green-500" />}
            </button>
          ))}

          {showCreate ? (
            <div className="flex gap-2 p-2">
              <Input
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isCreating}>
                Add
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">New Collection</span>
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
