import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, Camera, LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import "./blog.css";

const WITHDRAWAL_REQUIRED = "Vous devez effectuer un retrait réussi pour envoyer votre commentaire.";
const DAILY_LIMIT_MESSAGE = "Vous avez déjà envoyé une publication aujourd’hui. Vous pourrez en envoyer une autre demain.";
const IMAGE_REQUIRED_MESSAGE = "Ajoutez au moins une capture d’écran avant d’envoyer votre publication.";
const MAX_BLOG_IMAGES = 2;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 900 * 1024;

interface Eligibility {
  eligible: boolean;
  message: string;
  submittedToday?: boolean;
}

interface PendingPhoto {
  file: File;
  previewUrl: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Cette capture n’a pas pu être compressée."));
    }, type, quality);
  });
}

async function compressPhoto(source: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(source.type)) {
    throw new Error("Choisissez une image JPEG, PNG ou WebP.");
  }
  if (source.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Une capture originale ne peut pas dépasser 20 Mo.");
  }

  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    const sizes = [1440, 1100, 900];
    const qualities = [0.78, 0.66, 0.54];

    for (const maxDimension of sizes) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("La capture n’a pas pu être traitée.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, "image/webp", quality);
        if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) {
          const type = blob.type || "image/webp";
          const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1] || "webp";
          const filename = `capture-${Date.now()}.${extension}`;
          return new File([blob], filename, { type });
        }
      }
    }

    throw new Error("Cette capture reste trop volumineuse après compression.");
  } finally {
    bitmap.close();
  }
}

export default function BlogCreatePage() {
  const [, navigate] = useLocation();
  const [content, setContent] = useState("");
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PendingPhoto[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  const publishMutation = useMutation({
    mutationFn: async (submission: { content: string; photos: PendingPhoto[] }) => {
      const formData = new FormData();
      formData.append("content", submission.content);
      submission.photos.forEach(({ file }) => formData.append("images", file, file.name));

      const response = await fetch("/api/blog/posts", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const responseText = await response.text();
      let data: { message?: string } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }
      if (!response.ok) {
        const error = new Error(
          data.message || "La publication n’a pas pu être envoyée.",
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
      toast({ title: "Soumission envoyée", description: "Votre publication apparaîtra sur le Blog après approbation." });
      navigate("/blog");
    },
    onError: (error: Error & { status?: number }) => {
      toast({
        title: error.status === 403 || error.status === 409 ? "Publication impossible" : "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePhotoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (selectedFiles.length === 0) return;

    if (photos.length + selectedFiles.length > MAX_BLOG_IMAGES) {
      toast({
        title: "Limite de captures atteinte",
        description: "Vous pouvez joindre deux captures maximum.",
        variant: "destructive",
      });
      return;
    }

    setProcessingPhotos(true);
    const newPhotos: PendingPhoto[] = [];
    try {
      for (const source of selectedFiles) {
        const file = await compressPhoto(source);
        newPhotos.push({ file, previewUrl: URL.createObjectURL(file) });
      }
      setPhotos((current) => [...current, ...newPhotos]);
    } catch (error) {
      toast({
        title: "Capture non ajoutée",
        description: error instanceof Error ? error.message : "La capture n’a pas pu être traitée.",
        variant: "destructive",
      });
      newPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    URL.revokeObjectURL(photo.previewUrl);
    setPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const beginPublishing = async () => {
    if (!content.trim()) {
      toast({ title: "Votre texte est vide", description: "Ajoutez votre expérience avant de publier.", variant: "destructive" });
      return;
    }
    if (photos.length < 1) {
      toast({ title: "Capture requise", description: IMAGE_REQUIRED_MESSAGE, variant: "destructive" });
      return;
    }
    try {
      setCheckingEligibility(true);
      const response = await fetch("/api/blog/eligibility", { credentials: "include" });
      const result = await response.json().catch(() => ({})) as Partial<Eligibility>;
      if (!response.ok) throw new Error(result.message || "Vérification impossible. Veuillez réessayer.");
      if (!result.eligible) {
        toast({
          title: "Publication non autorisée",
          description: result.message || (result.submittedToday ? DAILY_LIMIT_MESSAGE : WITHDRAWAL_REQUIRED),
          variant: "destructive",
        });
        return;
      }
      publishMutation.mutate({ content: content.trim(), photos });
    } catch (error) {
      toast({
        title: "Vérification impossible",
        description: error instanceof Error ? error.message : "Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setCheckingEligibility(false);
    }
  };

  const busy = checkingEligibility || processingPhotos || publishMutation.isPending;
  return (
    <main className="pepsi-composer-page">
      <header className="pepsi-composer-header">
        <button className="pepsi-composer-back" type="button" onClick={() => navigate("/blog")} aria-label="Retour au blog">
          <ChevronLeft size={25} strokeWidth={2.5} />
        </button>
        <h1>Article de blog</h1>
      </header>
      <section className="pepsi-composer-body">
        <label className="pepsi-composer-label" htmlFor="blog-content">Votre publication</label>
        <textarea
          id="blog-content"
          className="pepsi-composer-textarea"
          placeholder="Veuillez saisir votre contenu"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={2000}
        />
        <div className="pepsi-composer-photos">
          {photos.length < MAX_BLOG_IMAGES && (
            <button
              className="pepsi-composer-photo"
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={busy}
              aria-label="Joindre des captures d’écran"
            >
              {processingPhotos ? <LoaderCircle size={30} className="pepsi-loading-icon" /> : <Camera size={36} strokeWidth={1.35} />}
              <span className="pepsi-composer-photo-count">{photos.length}/{MAX_BLOG_IMAGES}</span>
            </button>
          )}
          <input
            ref={photoInputRef}
            className="pepsi-composer-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => void handlePhotoSelection(event)}
            disabled={busy}
            aria-label="Sélectionner jusqu’à deux captures"
          />
          {photos.map((photo, index) => (
            <div className="pepsi-composer-photo-preview" key={photo.previewUrl}>
              <img src={photo.previewUrl} alt={`Capture jointe ${index + 1}`} />
              <button
                type="button"
                className="pepsi-composer-photo-remove"
                onClick={() => removePhoto(index)}
                disabled={busy}
                aria-label={`Retirer la capture ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <p className="pepsi-composer-photo-note">Ajoutez 1 ou 2 captures · {photos.length}/{MAX_BLOG_IMAGES}</p>
      </section>
      <footer className="pepsi-publish-bar">
        <button className="pepsi-publish-button" type="button" onClick={() => void beginPublishing()} disabled={busy || !content.trim()}>
          {busy ? <><LoaderCircle size={19} className="pepsi-loading-icon" /> Publication…</> : "Poste"}
        </button>
      </footer>
    </main>
  );
}
