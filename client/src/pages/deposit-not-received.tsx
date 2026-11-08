import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, LoaderCircle, X } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import screenshotButton from "@assets/image_1794149826640.png";
import "./service-screenshot.css";

interface Deposit {
  id: number;
  amount: number | string;
  createdAt: string;
}

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function money(value: number | string) {
  return `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
}

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date inconnue"
    : parsed.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export default function DepositNotReceivedPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [depositId, setDepositId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const { data: deposits = [], isLoading, isError } = useQuery<Deposit[]>({
    queryKey: ["/api/deposits/history"],
  });

  const addPhotos = (selected: FileList | null) => {
    if (!selected?.length) return;
    const incoming = Array.from(selected);
    const invalidType = incoming.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
    const oversized = incoming.find((file) => file.size > MAX_PHOTO_BYTES);
    if (invalidType) {
      toast({ title: "Format non accepté", description: "Choisissez une image JPEG, PNG ou WebP.", variant: "destructive" });
      return;
    }
    if (oversized) {
      toast({ title: "Image trop volumineuse", description: "Chaque image doit faire 5 Mo maximum.", variant: "destructive" });
      return;
    }
    setPhotos((current) => [...current, ...incoming].slice(0, MAX_PHOTOS));
    if (currentPhotoCount(incoming, photos.length) > MAX_PHOTOS) {
      toast({ title: "Limite de pièces jointes", description: `Vous pouvez joindre ${MAX_PHOTOS} images maximum.` });
    }
  };

  const removePhoto = (index: number) => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!depositId) {
      toast({ title: "Sélectionnez un dépôt", variant: "destructive" });
      return;
    }
    if (payerName.trim().length < 2 || description.trim().length < 8) {
      toast({
        title: "Informations incomplètes",
        description: "Indiquez le nom du payeur et décrivez le problème.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.set("depositId", depositId);
    formData.set("payerName", payerName.trim());
    formData.set("description", description.trim());
    photos.forEach((photo) => formData.append("photos", photo));

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/support/deposit-not-received", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Le signalement n’a pas pu être envoyé.");
      toast({ title: "Signalement envoyé", description: result.message || "Notre équipe va vérifier votre dépôt." });
      navigate("/service");
    } catch (error) {
      toast({
        title: "Envoi impossible",
        description: error instanceof Error ? error.message : "Réessayez dans quelques instants.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="service-client-page service-report-page">
      <div className="service-client-screen">
        <header className="service-form-header">
          <button
            type="button"
            className="service-form-back"
            onClick={() => navigate("/service")}
            aria-label="Retour au centre d’aide"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <h1>Retour</h1>
        </header>

        <form className="service-report-form" onSubmit={submit}>
          <h2 className="service-report-title">Recharge non encore reçue</h2>
          <label className="service-form-label" htmlFor="report-deposit">
            Veuillez sélectionner une commande de recharge
          </label>
          <select
            id="report-deposit"
            className="service-form-control"
            value={depositId}
            onChange={(event) => setDepositId(event.target.value)}
            disabled={isLoading || isError || deposits.length === 0}
            required
          >
            <option value="">
              {isLoading ? "Chargement des commandes…" : "Veuillez sélectionner une commande de recharge"}
            </option>
            {deposits.map((deposit) => (
              <option value={deposit.id} key={deposit.id}>
                #{deposit.id} · {money(deposit.amount)} · {dateLabel(deposit.createdAt)}
              </option>
            ))}
          </select>
          {isError && <p className="service-form-error">Impossible de charger vos dépôts. Actualisez la page et réessayez.</p>}

          <label className="service-form-label" htmlFor="report-payer-name">
            Nom du payeur
          </label>
          <input
            id="report-payer-name"
            className="service-form-control"
            type="text"
            autoComplete="name"
            maxLength={80}
            placeholder="Nom du payeur"
            value={payerName}
            onChange={(event) => setPayerName(event.target.value)}
            required
          />

          <label className="service-form-label" htmlFor="report-description">
            Description description
          </label>
          <textarea
            id="report-description"
            className="service-form-control service-form-textarea"
            maxLength={500}
            minLength={8}
            placeholder="Description description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />

          <label className="service-form-label" htmlFor="report-photos">Télécharger des photos</label>
          <label className="service-photo-picker">
            <span className="service-camera-icon"><Camera aria-hidden="true" /></span>
            <input
              ref={photoInputRef}
              id="report-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                addPhotos(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {photos.length > 0 && (
            <div className="service-photo-preview-list" aria-label="Images jointes">
              {photos.map((photo, index) => (
                <div className="service-photo-preview" key={`${photo.name}-${photo.lastModified}-${index}`}>
                  <img src={previews[index]} alt={`Aperçu ${index + 1} : ${photo.name}`} />
                  <button type="button" onClick={() => removePhoto(index)} aria-label={`Supprimer ${photo.name}`}>
                    <X aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className="service-form-submit"
            type="submit"
            disabled={isSubmitting || isLoading || isError}
          >
            {isSubmitting && <LoaderCircle className="service-spin" aria-hidden="true" />}
            {isSubmitting ? "Envoi en cours…" : "Envoyer des commentaires"}
          </button>
        </form>
      </div>
      <button
        className="service-photo-shortcut"
        type="button"
        aria-label="Ajouter une capture d’écran"
        onClick={() => photoInputRef.current?.click()}
      >
        <img src={screenshotButton} alt="" aria-hidden="true" />
      </button>
    </main>
  );
}

function currentPhotoCount(incoming: File[], currentCount: number) {
  return incoming.length + currentCount;
}
