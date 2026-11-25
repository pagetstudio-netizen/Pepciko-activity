import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Product } from "@shared/schema";
import { WELLNESS_PRODUCT_IMAGE_URL } from "@shared/product-catalog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { getRobotProductImage } from "@/lib/john-deere-assets";
import { isProductStockFull } from "@shared/product-purchase-limit";
import {
  getWellnessCardTotalRevenue,
  getWellnessDailyEarnings,
} from "@shared/wellness-product-policy";
import "./product-details.css";

type ProductWithClaimStatus = Product & {
  canClaimFree?: boolean;
  stockCount?: number;
  canPurchaseNow?: boolean;
  availability?: {
    dateLabel: string;
    timeLabel: string;
    timeZoneLabel: string;
    label: string;
  } | null;
  canPurchaseThisLaunch?: boolean;
  canPurchaseWellness?: boolean;
};

const formatFcfa = (amount: number) =>
  `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;

export default function ProductDetailsPage() {
  const { user, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const [, routeParams] = useRoute("/products/:id");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const productId = Number(routeParams?.id);
  const validProductId = Number.isInteger(productId) && productId > 0;

  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProductWithClaimStatus[]>({
    queryKey: ["/api/products"],
    enabled: Boolean(user) && validProductId,
  });

  const product = products.find((item) => item.id === productId && item.isActive);

  const purchaseMutation = useMutation({
    mutationFn: async (selectedProduct: ProductWithClaimStatus) => {
      const endpoint = selectedProduct.isFree
        ? `/api/products/${selectedProduct.id}/claim-free`
        : `/api/products/${selectedProduct.id}/purchase`;
      const response = await apiRequest("POST", endpoint, {});
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "L'achat n'a pas pu être effectué.");
      }
      await response.json();
      return {
        isFree: Boolean(selectedProduct.isFree),
        productType: selectedProduct.productType,
      };
    },
    onSuccess: async ({ isFree, productType }) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/user/products"] });
      refreshUser();
      setConfirmationOpen(false);
      toast({
        title: isFree ? "Produit réclamé !" : "Produit acheté !",
        description: isFree
          ? "Votre produit gratuit a été ajouté à votre compte."
          : productType === "wellness"
            ? "Les gains Bien-être seront crédités automatiquement sur votre solde de retrait toutes les 24 heures."
            : "Les gains seront crédités sur votre solde de retrait à la fin de la période.",
      });
    },
    onError: (purchaseError: Error) => {
      setConfirmationOpen(false);
      toast({
        title: "Achat impossible",
        description: purchaseError.message,
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  if (isLoading) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-state">
          <Loader2 aria-label="Chargement du produit" className="h-8 w-8 animate-spin text-[#367c2b]" />
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-state">
          <p>{error instanceof Error ? error.message : "Impossible de charger ce produit."}</p>
          <button type="button" className="product-detail-state-button" onClick={() => refetch()}>
            Réessayer
          </button>
          <button type="button" className="product-detail-back-link" onClick={() => navigate("/")}>
            Retour aux produits
          </button>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-state">
          <p>Ce produit n'est pas disponible.</p>
          <button type="button" className="product-detail-state-button" onClick={() => navigate("/")}>
            Retour aux produits
          </button>
        </div>
      </main>
    );
  }

  const price = Number(product.price) || 0;
  const cycleDays = Number(product.cycleDays) || 0;
  const totalReturn = Number(product.totalReturn) || Number(product.dailyEarnings || 0) * cycleDays;
  const wellnessTotalRevenue = getWellnessCardTotalRevenue(price, totalReturn);
  const dailyEarnings = product.productType === "wellness"
    ? getWellnessDailyEarnings(wellnessTotalRevenue, cycleDays)
    : product.productType === "activity" ? 0 : Number(product.dailyEarnings) || 0;
  const activityFixedProfit = product.productType === "activity"
    ? Math.max(0, totalReturn - price)
    : 0;
  const fallbackImage = product.productType === "wellness" ? WELLNESS_PRODUCT_IMAGE_URL : undefined;
  const image = getRobotProductImage(product.imageUrl, product.id, product.name, product.productType);
  const cannotClaimFree = Boolean(product.isFree && !product.canClaimFree);
  const stockFull = !product.isFree && isProductStockFull(product.stockLimit, product.stockCount || 0);
  const launchAlreadyPurchased = product.productType === "activity" && product.canPurchaseThisLaunch === false;
  const launchNotStarted = product.productType === "activity" && product.canPurchaseNow === false;
  const wellnessLocked = product.productType === "wellness" && product.canPurchaseWellness === false;
  const purchaseBlocked = cannotClaimFree || stockFull || launchAlreadyPurchased || wellnessLocked;

  return (
    <main className="product-detail-page">
      <div className="product-detail-shell">
        <section className="product-detail-hero" aria-label={`Image de ${product.name}`}>
          <img
            className="product-detail-image"
            src={image}
            alt={product.name}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackImage || getRobotProductImage(null, product.id, product.name);
            }}
          />
          <button
            type="button"
            className="product-detail-back"
            onClick={() => navigate("/")}
            aria-label="Retour à l'accueil"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
        </section>

        <section className="product-detail-content">
          <h1 className="product-detail-title">{product.name}</h1>

          <div className="product-detail-metrics" aria-label="Détails des gains">
            <div className="product-detail-metric-row">
              <span>{product.isFree
                ? "Bonus quotidien :"
                : product.productType === "activity"
                  ? "Bénéfice fixe à l’échéance :"
                  : product.productType === "wellness" ? "Gain journalier :" : "Gain journalier calculé :"}</span>
              <strong>{formatFcfa(product.productType === "activity" ? activityFixedProfit : dailyEarnings)}</strong>
            </div>
            {product.productType !== "stable" && (
              <div className="product-detail-metric-row">
                <span>{product.isFree
                  ? "Gain total :"
                  : product.productType === "wellness"
                    ? "Revenu total du cycle :"
                    : "Total reçu à l’échéance (prix inclus) :"}</span>
                <strong>{formatFcfa(product.productType === "wellness" ? wellnessTotalRevenue : totalReturn)}</strong>
              </div>
            )}
            <div className="product-detail-metric-row">
              <span>Cycle :</span>
              <strong>{cycleDays} {cycleDays === 1 ? "jour" : "jours"}</strong>
            </div>
            {product.stockLimit != null && (
              <div className="product-detail-metric-row">
                <span>Places disponibles :</span>
                <strong>{Math.max(0, product.stockLimit - (product.stockCount || 0))} / {product.stockLimit}</strong>
              </div>
            )}
            {product.productType === "activity" && product.availability && (
              <div className="product-detail-metric-row">
                <span>Disponible à :</span>
                <strong>{product.availability.label}</strong>
              </div>
            )}
          </div>

          <p className="product-detail-note">
            {product.isFree
              ? "Le bonus gratuit peut être réclamé selon les règles affichées dans l’application."
              : product.productType === "wellness"
                ? "Les gains journaliers sont crédités automatiquement sur votre solde de retrait toutes les 24 heures."
                  : product.productType === "activity" && launchNotStarted
                    ? `Vous pourrez acheter cette offre à partir du ${product.availability?.label || "début du lancement"}.`
                : product.productType === "activity"
                  ? `Le prix d’achat et le bénéfice fixe seront crédités en une seule fois à la fin des ${cycleDays} jours.`
                  : "Le gain journalier sert au calcul du total. Le montant total sera versé en une seule fois à la fin de la période."}
          </p>
        </section>
      </div>

      <div className="product-detail-purchase-bar">
        <div className="product-detail-purchase-inner">
          <div className="product-detail-price">
            <span>Prix :</span>
            <strong>{product.isFree ? "Gratuit" : formatFcfa(price)}</strong>
          </div>
          <button
            type="button"
            className="product-detail-buy"
            onClick={() => {
              if (launchNotStarted) {
                toast({
                  title: "Pas encore disponible",
                  description: product.availability?.label
                    ? `La disponibilité de ce produit est prévue le ${product.availability.label}. Veuillez revenir à cette heure.`
                    : "Ce produit n’est pas encore disponible. Veuillez revenir à l’heure de lancement.",
                });
                return;
              }
              setConfirmationOpen(true);
            }}
            disabled={purchaseBlocked || purchaseMutation.isPending}
          >
            {purchaseMutation.isPending
              ? "Traitement…"
              : stockFull
                ? "Complet"
                : launchAlreadyPurchased
                  ? "Déjà acheté"
                  : wellnessLocked
                    ? "En cours"
                  : cannotClaimFree
                ? "Déjà réclamé"
                : product.isFree
                  ? "Réclamer"
                  : "Acheter"}
          </button>
        </div>
      </div>

      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent className="max-w-[380px] border border-[#dce5d8] bg-white text-[#202124]">
          <DialogHeader>
            <DialogTitle>{product.isFree ? "Réclamer le produit" : "Confirmer l'achat"}</DialogTitle>
            <DialogDescription>
              {product.isFree
                ? `Réclamer gratuitement ${product.name} ?`
                : `Confirmez l'achat de ${product.name} au prix de ${formatFcfa(price)}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="min-h-[42px] rounded-md bg-[#f1f3ef] px-4 font-semibold text-[#293327] disabled:opacity-60"
              onClick={() => setConfirmationOpen(false)}
              disabled={purchaseMutation.isPending}
            >
              Annuler
            </button>
            <button
              type="button"
              className="min-h-[42px] rounded-md bg-[#086b2d] px-4 font-semibold text-white hover:bg-[#075a27] disabled:opacity-60"
              onClick={() => purchaseMutation.mutate(product)}
              disabled={purchaseMutation.isPending || purchaseBlocked}
            >
              {purchaseMutation.isPending
                ? "Traitement…"
                : product.isFree
                  ? "Réclamer"
                  : "Confirmer"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}