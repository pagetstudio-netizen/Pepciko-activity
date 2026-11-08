import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { getRobotProductImage } from "@/lib/john-deere-assets";
import { WELLNESS_PRODUCT_IMAGE_URL } from "@shared/product-catalog";
import noOrdersIllustration from "@assets/no_orders_(1)_1794096883173.png";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";
import "./orders.css";

export default function OrdersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const from = new URLSearchParams(window.location.search).get("from");
  const backPath =
    from?.startsWith("/") && !from.startsWith("//") && from !== "/orders"
      ? from
      : "/account";
  const {
    data: userProducts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/user/products"],
    enabled: Boolean(user),
  });

  if (!user) return null;

  const formatFcfa = (amount: unknown) =>
    `${Math.round(Number(amount) || 0).toLocaleString("fr-FR")} FCFA`;

  return (
    <main className="orders-page">
      <div className="orders-screen">
        <header className="orders-header">
          <button
            type="button"
            className="orders-back"
            onClick={() => navigate(backPath)}
            aria-label="Retour"
            data-testid="orders-back"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1 className="orders-title">Mon produit</h1>
        </header>

        <div className="orders-filter-row">
          <button
            type="button"
            className="orders-filter"
            aria-pressed="true"
            data-testid="orders-filter-all"
          >
            Tous
          </button>
        </div>

        {isLoading ? (
          <div className="orders-list" role="status" aria-label="Chargement des commandes">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="orders-error" role="alert">
            <p>Impossible de charger vos produits achetés.</p>
            <button type="button" onClick={() => void refetch()}>
              Réessayer
            </button>
          </div>
        ) : userProducts.length === 0 ? (
          <section className="orders-empty-card" aria-label="Aucun produit acheté">
            <img src={noOrdersIllustration} alt="" aria-hidden="true" />
          </section>
        ) : (
          <section className="orders-list" aria-label="Produits achetés">
            {userProducts.map((up: any, index: number) => {
              const purchasedAt = up.purchasedAt ? new Date(up.purchasedAt) : null;
              const purchaseDate = purchasedAt && !Number.isNaN(purchasedAt.getTime())
                ? purchasedAt.toLocaleDateString("fr-FR")
                : "—";
              const purchaseTime = purchasedAt && !Number.isNaN(purchasedAt.getTime())
                ? purchasedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                : "—";

              return (
                <article
                  key={up.id}
                  className="orders-product-card"
                  data-testid={`order-card-${up.id}`}
                >
                  <div className="orders-product-image">
                    <img
                      src={getRobotProductImage(
                        up.product?.imageUrl,
                        up.productId || index + 1,
                        up.product?.name,
                        up.product?.productType,
                      )}
                      alt={up.product?.name || "Produit"}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = up.product?.productType === "wellness"
                          ? WELLNESS_PRODUCT_IMAGE_URL
                          : getRobotProductImage(null, up.productId || index + 1, up.product?.name);
                      }}
                    />
                  </div>
                  <div className="orders-product-details">
                    <div className="orders-product-heading">
                      <strong>{up.product?.name || "Produit"}</strong>
                      <span className={up.status === "active" ? "is-active" : "is-completed"}>
                        {up.status === "active" ? "Actif" : "Terminé"}
                      </span>
                    </div>
                    <p>Prix : <strong>{formatFcfa(up.product?.price)}</strong></p>
                    <p>Gain journalier : <strong>{formatFcfa(up.product?.dailyEarnings)}</strong></p>
                    <p>Durée : <strong>{Number(up.product?.cycleDays) || 0} jours</strong></p>
                    <p>Jours restants : <strong>{Number(up.daysRemaining) || 0}</strong></p>
                    <p>
                      {up.status === "active" ? "Gains accumulés" : "Gains versés"} :{" "}
                      <strong>{formatFcfa(up.totalEarned)}</strong>
                    </p>
                    <p>Date : <strong>{purchaseDate} à {purchaseTime}</strong></p>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <WithdrawalFloatingTools />
    </main>
  );
}
