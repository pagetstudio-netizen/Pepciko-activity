import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface BlogImageLightboxProps {
  image: { src: string; alt: string } | null;
  onClose: () => void;
}

export default function BlogImageLightbox({ image, onClose }: BlogImageLightboxProps) {
  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] border-0 bg-black/95 p-3 sm:p-5">
        <DialogTitle className="sr-only">{image?.alt || "Capture d’écran"}</DialogTitle>
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            className="mx-auto max-h-[82dvh] max-w-full object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
