import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadButtonProps {
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  className?: string;
  variant?: "default" | "outline";
  children?: React.ReactNode;
}

export const ImageUploadButton = ({
  onFileSelect,
  uploading = false,
  className,
  variant = "outline",
  children,
}: ImageUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        type="button"
        variant={variant}
        onClick={handleClick}
        disabled={uploading}
        className={cn("w-full", className)}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {children || "Upload Image"}
          </>
        )}
      </Button>
    </>
  );
};
