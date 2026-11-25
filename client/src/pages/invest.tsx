import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { useLocation } from "wouter";
import type { Product, ProductType } from "@shared/schema";
import {
  PRODUCT_IMAGE_URL,
  WELLNESS_PRODUCT_IMAGE_URL,
} from "@shared/product-catalog";
import {
  isProductStockFull,
  MAX_PRODUCT_PURCHASE_QUANTITY,
} from "@shared/product-purchase-limit";
import {
  getWellnessCardTotalRevenue,
  getWellnessDailyEarnings,
} from "@shared/wellness-product-policy";
import {
  compareActivityProductOrder,
  getActivityDailyProfit,
} from "@shared/activity-product-policy";

import { getRobotProductImage } from "@/lib/john-deere-assets";
import EmptyState from "@/components/empty-state";
import activityIcon from "@assets/activity_1793867103101.png";
import stableIcon from "@assets/stable_active_1793867103132.png";
import welfareIcon from "@assets/welfare_1793867102974.png";
import "./invest.css";

interface ProductWithOwnership extends Product {
  isOwned: boolean;
  canClaimFree: boolean;
  ownedCount?: number;
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
}

interface PurchaseVariables {
  productId: number;
  quantity: number;
  productType: ProductType;
}

export default function InvestPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [confirmProduct, setConfirmProduct] = useState<ProductWithOwnership | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedProductType, setSelectedProductType] = useState<ProductType>("stable");

  const openPurchaseModal = (product: ProductWithOwnership) => {
    setPurchaseQuantity(1);
    setPurchaseError(null);
    setConfirmProduct(product);
  };

  const closePurchaseModal = () => {
    setConfirmProduct(null);
    setPurchaseQuantity(1);
    setPurchaseError(null);
  };

  useEffect(() => {
    if (!confirmProduct) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const preventBackgroundTouch = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".invest-confirm-sheet")) {
        event.preventDefault();
      }
    };
    document.addEventListener("touchmove", preventBackgroundTouch, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventBackgroundTouch);
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [confirmProduct]);

  const { data: products, isLoading } = useQuery<ProductWithOwnership[]>({
    queryKey: ["/api/products"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ productId, quantity }: PurchaseVariables) => {
      const response = await apiRequest("POST", `/api/products/${productId}/purchase`, { quantity });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/products"] });
      refreshUser();
      closePurchaseModal();
      toast({
        title: "Produit acheté !",
        description: variables.productType === "wellness"
          ? "Les gains Bien-être seront crédités automatiquement sur votre solde de retrait toutes les 24 heures."
          : "Les gains seront crédités sur votre solde de retrait à la fin de la période.",
      });
    },
    onError: (error: any) => {
      const message = error.message || "L’achat n’a pas pu être effectué.";
      if (/solde insuffisant/i.test(message)) {
        setPurchaseError(null);
        toast({
          title: "Solde insuffisant",
          description: message,
          variant: "destructive",
        });
        return;
      }
      setPurchaseError(message);
    },
  });

  if (!user) return null;

  const balance     = parseFloat(user.depositBalance || "0");
  const currency    = "FCFA";
  const categoryProducts = products?.filter(
    product => product.isActive && product.productType === selectedProductType,
  ) || [];
  const displayed = selectedProductType === "activity"
    ? [...categoryProducts].sort(compareActivityProductOrder)
    : categoryProducts;
  const formatFcfa = (amount: number | string) =>
    `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0)} ${currency}`;

  return (
    <div className="invest-page">
      <header className="invest-hero">
        <h1>Produits d'investissement</h1>
      </header>

      <main className="invest-main">
        <div className="invest-category-tabs" role="tablist" aria-label="Catégories de produits">
          <button
            type="button"
            role="tab"
            aria-selected={selectedProductType === "stable"}
            className={`invest-category ${selectedProductType === "stable" ? "is-active" : ""}`}
            onClick={() => setSelectedProductType("stable")}
          >
            <img src={stableIcon} alt="" />
            <span>Écurie</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedProductType === "wellness"}
            className={`invest-category ${selectedProductType === "wellness" ? "is-active" : ""}`}
            onClick={() => setSelectedProductType("wellness")}
          >
            <img src={welfareIcon} alt="" />
            <span>Bien-être</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedProductType === "activity"}
            className={`invest-category invest-category-activity ${selectedProductType === "activity" ? "is-active" : ""}`}
            onClick={() => setSelectedProductType("activity")}
          >
            <img src={activityIcon} alt="" />
            <span>Activité</span>
            <span className="invest-hot-badge">CHAUD</span>
          </button>
        </div>

        <section className="invest-products" aria-label="Offres d'investissement">
          {selectedProductType === "wellness"
            && products?.some((product) => product.productType === "wellness" && product.canPurchaseWellness === false) && (
              <p className="rounded-xl border border-pink-200 bg-white/80 px-4 py-3 text-sm text-gray-700">
                Un produit Bien-être est déjà en cours. Vous pourrez en acheter un autre à la fin de sa période.
              </p>
            )}
          {isLoading ? (
            Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="invest-product-skeleton" />
            ))
          ) : displayed.length > 0 ? (
            displayed.map((product) => {
              const fallbackImage = product.productType === "wellness"
                ? WELLNESS_PRODUCT_IMAGE_URL
                : PRODUCT_IMAGE_URL;
              const image = getRobotProductImage(
                product.imageUrl,
                product.id,
                product.name,
                product.productType,
              );
              const stockFull = !product.isFree && isProductStockFull(
                product.stockLimit,
                product.stockCount || 0,
              );
              const launchNotStarted = product.productType === "activity"
                && product.canPurchaseNow === false;
              const wellnessLocked = product.productType === "wellness" && product.canPurchaseWellness === false;
              const duration = Number(product.cycleDays || 90);
              const total = Number(product.totalReturn || Number(product.dailyEarnings || 0) * duration);
              const activityDaily = product.productType === "activity"
                ? getActivityDailyProfit(total, Number(product.price), duration)
                : 0;
              const totalRevenue = product.productType === "wellness"
                ? getWellnessCardTotalRevenue(Number(product.price), total)
                : product.productType === "activity"
                  ? activityDaily * duration
                  : total;
              const daily = product.productType === "wellness"
                ? getWellnessDailyEarnings(totalRevenue, duration)
                : product.productType === "activity"
                  ? activityDaily
                  : Number(product.dailyEarnings || 0);
              const gainsLabel = product.productType === "wellness" ? "Gains journaliers" : "Gains quotidiens";

              return (
                <article
                  key={product.id}
                  className="invest-product-card"
                  data-testid={`product-card-${product.id}`}
                >
                  <div className="invest-product-image">
                    <img
                      src={image}
                      alt={product.name}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = fallbackImage;
                      }}
                    />
                  </div>

                  <div className="invest-product-main">
                    <h2 className="invest-product-title">{product.name}</h2>
                    <div className="invest-product-stats">
                      <span>Prix unitaire</span>
                      <strong>{product.isFree ? "Gratuit" : formatFcfa(product.price)}</strong>
                      <span>{gainsLabel}</span>
                      <strong>{formatFcfa(daily)}</strong>
                      <span>{product.productType === "activity" ? "Cycle" : "Revenu"}</span>
                      <strong>{duration} jours</strong>
                      <span>Revenu total</span>
                      <strong>{formatFcfa(totalRevenue)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (product.isFree) {
                        navigate(`/products/${product.id}`);
                      } else if (launchNotStarted) {
                        toast({
                          title: "Pas encore disponible",
                          description: product.availability?.label
                            ? `La disponibilité de ce produit est prévue le ${product.availability.label}. Veuillez revenir à cette heure.`
                            : "Ce produit n’est pas encore disponible. Veuillez revenir à l’heure de lancement.",
                        });
                      } else {
                        openPurchaseModal(product);
                      }
                    }}
                    disabled={!product.isFree && (stockFull || wellnessLocked)}
                    className="invest-product-cta"
                    data-testid={`button-purchase-${product.id}`}
                  >
                    {product.isFree
                      ? "Découvrir"
                      : stockFull
                        ? "Complet"
                        : wellnessLocked
                          ? "En cours"
                          : "Investissez maintenant"}
                  </button>
                </article>
              );
            })
          ) : (
            <EmptyState className="invest-empty-state">
              <p>
                {selectedProductType === "activity"
                  ? "Aucune offre d’activité disponible pour le moment."
                  : selectedProductType === "wellness"
                    ? "Aucune offre Bien-être disponible pour le moment."
                    : "Aucune offre stable disponible pour le moment."}
              </p>
            </EmptyState>
          )}
        </section>
      </main>

      {confirmProduct && (() => {
        const productImage = getRobotProductImage(
          confirmProduct.imageUrl,
          confirmProduct.id,
          confirmProduct.name,
          confirmProduct.productType,
        );
        const stockFull = isProductStockFull(
          confirmProduct.stockLimit,
          confirmProduct.stockCount || 0,
        );
        const price = Number(confirmProduct.price);
        const quantityLimit = confirmProduct.productType !== "stable"
          ? 1
          : MAX_PRODUCT_PURCHASE_QUANTITY;
        const totalPrice = price * purchaseQuantity;
        const shortage = Math.max(0, totalPrice - balance);
        const insufficientBalance = shortage > 0;
        const duration = Number(confirmProduct.cycleDays || 90);
        const total = Number(confirmProduct.totalReturn || Number(confirmProduct.dailyEarnings || 0) * duration);
        const activityDaily = confirmProduct.productType === "activity"
          ? getActivityDailyProfit(total, price, duration)
          : 0;
        const totalRevenue = confirmProduct.productType === "wellness"
          ? getWellnessCardTotalRevenue(price, total)
          : confirmProduct.productType === "activity"
            ? activityDaily * duration
            : total;
        const daily = confirmProduct.productType === "wellness"
          ? getWellnessDailyEarnings(totalRevenue, duration)
          : confirmProduct.productType === "activity"
            ? activityDaily
            : Number(confirmProduct.dailyEarnings || 0);
        const gainsLabel = confirmProduct.productType === "wellness" ? "Gains journaliers" : "Gains quotidiens";
        const productCategoryLabel = confirmProduct.productType === "activity"
          ? "Activité"
          : confirmProduct.productType === "wellness" ? "Bien-être" : "Écurie";
        const updateQuantity = (nextQuantity: number) => {
          if (!Number.isSafeInteger(nextQuantity)) return;
          setPurchaseQuantity(Math.max(1, Math.min(quantityLimit, nextQuantity)));
          setPurchaseError(null);
        };
        const confirmPurchase = () => {
          if (insufficientBalance) {
            setPurchaseError(null);
            toast({
              title: "Solde insuffisant",
              description: `Il vous manque ${formatFcfa(shortage)}.`,
              variant: "destructive",
            });
            return;
          }
          setPurchaseError(null);
          purchaseMutation.mutate({
            productId: confirmProduct.id,
            quantity: purchaseQuantity,
            productType: confirmProduct.productType,
          });
        };

        return (
          <div
            className="invest-modal-backdrop"
            onClick={closePurchaseModal}
          >
            <section
              className="invest-confirm-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="invest-confirm-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="invest-modal-close"
                aria-label="Fermer la confirmation"
                onClick={closePurchaseModal}
              >
                <X aria-hidden="true" />
              </button>

              <img className="invest-modal-image" src={productImage} alt="" />
              <h2 id="invest-confirm-title">{confirmProduct.name}</h2>
              <div className="invest-modal-divider" />

              <dl className="invest-modal-details">
                <div className="invest-modal-row">
                  <dt>Catégorie</dt>
                  <dd>{productCategoryLabel}</dd>
                </div>
                <div className="invest-modal-row">
                  <dt>Prix unitaire</dt>
                  <dd className="invest-modal-price">{formatFcfa(price)}</dd>
                </div>
                <div className="invest-modal-row">
                  <dt>{gainsLabel}</dt>
                  <dd>{formatFcfa(daily * purchaseQuantity)}</dd>
                </div>
                <div className="invest-modal-row">
                  <dt>Revenu</dt>
                  <dd>{duration} jours</dd>
                </div>
                {confirmProduct.productType !== "stable" && (
                  <div className="invest-modal-row">
                    <dt>Revenu total</dt>
                    <dd>{formatFcfa(totalRevenue * purchaseQuantity)}</dd>
                  </div>
                )}
                <div className="invest-modal-row invest-quantity-row">
                  <dt>Quantité d’achat</dt>
                  <dd>
                    <div className="invest-quantity-control">
                      <button
                        type="button"
                        aria-label="Diminuer la quantité"
                        disabled={purchaseMutation.isPending || stockFull || purchaseQuantity <= 1}
                        onClick={() => updateQuantity(purchaseQuantity - 1)}
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={quantityLimit}
                        step="1"
                        value={purchaseQuantity}
                        disabled={purchaseMutation.isPending || stockFull}
                        aria-label="Quantité d’achat"
                        onChange={(event) => {
                          if (event.currentTarget.value === "") return;
                          updateQuantity(Number(event.currentTarget.value));
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Augmenter la quantité"
                        disabled={purchaseMutation.isPending || stockFull || purchaseQuantity >= quantityLimit}
                        onClick={() => updateQuantity(purchaseQuantity + 1)}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </dd>
                </div>
              </dl>

              <div className="invest-pay-total">
                <span>Payer l'argent :</span>
                <strong>{formatFcfa(totalPrice)}</strong>
              </div>

              {purchaseError ? (
                <p className="invest-purchase-error" role="alert">
                  {purchaseError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={confirmPurchase}
                disabled={purchaseMutation.isPending || stockFull}
                className="invest-confirm-cta"
                data-testid="button-confirm-purchase"
              >
                {purchaseMutation.isPending
                  ? <Loader2 className="animate-spin" aria-label="Achat en cours" />
                  : stockFull
                    ? "Complet"
                    : "Investissez maintenant"}
              </button>
            </section>
          </div>
        );
      })()}
    </div>
  );
}
