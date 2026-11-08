import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import rewardsArtwork from "@assets/logo_(6)_1793923906233.png";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";
import "./rewards-history.css";

interface RewardTransaction {
  id: number;
  type: string;
  amount: string | number;
  createdAt: string;
  description?: string | null;
}

const formatFcfa = (value: number) =>
  `${Math.round(Number.isFinite(value) ? value : 0).toLocaleString("fr-FR")} FCFA`;

const formatClaimDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function RewardsHistoryPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const {
    data: transactions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<RewardTransaction[]>({
    queryKey: ["/api/transactions"],
    enabled: Boolean(user),
  });

  const checkins = useMemo(
    () => transactions
      .filter((transaction) => transaction.type.toLowerCase() === "daily_checkin")
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [transactions],
  );
  const totalRewards = checkins.reduce((total, transaction) => {
    const amount = Number(transaction.amount);
    return total + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);

  if (!user) return null;

  return (
    <main className="rewards-history-page">
      <header className="rewards-history-header">
        <button
          type="button"
          className="rewards-history-back"
          onClick={() => navigate("/account")}
          aria-label="Retour au compte"
          data-testid="button-rewards-back"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h1>Récompenses</h1>
      </header>

      <div className="rewards-history-content">
        <img
          className="rewards-history-art"
          src={rewardsArtwork}
          alt=""
          aria-hidden="true"
        />
        <p className="rewards-history-total" data-testid="text-checkin-reward-total">
          {Math.round(totalRewards).toLocaleString("fr-FR")} <span>FCFA</span>
        </p>
        <p className="rewards-history-caption">Récompenses du compte</p>

        <section className="rewards-history-records" aria-label="Historique des connexions quotidiennes" aria-live="polite">
          {isLoading ? (
            <div className="rewards-history-loading" role="status" aria-label="Chargement de l’historique">
              <Loader2 className="animate-spin" aria-hidden="true" />
            </div>
          ) : isError ? (
            <div className="rewards-history-error" role="alert">
              <p>Impossible de charger l’historique des connexions.</p>
              <button type="button" onClick={() => void refetch()}>Réessayer</button>
            </div>
          ) : checkins.length > 0 ? (
            <>
              <h2>Historique de connexion</h2>
              <div className="rewards-history-list">
                {checkins.map((transaction) => (
                  <article className="rewards-history-row" key={transaction.id} data-testid={`checkin-reward-${transaction.id}`}>
                    <div className="rewards-history-row-copy">
                      <strong>Connexion quotidienne</strong>
                      <time dateTime={transaction.createdAt}>{formatClaimDate(transaction.createdAt)}</time>
                    </div>
                    <strong className="rewards-history-row-amount">+ {formatFcfa(Number(transaction.amount) || 0)}</strong>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="rewards-history-empty" role="status">
              Aucune récompense de connexion pour le moment.
            </p>
          )}
        </section>
      </div>

      <WithdrawalFloatingTools
        containerClassName="rewards-history-floating-tools"
        buttonClassName="rewards-history-float-button"
      />
    </main>
  );
}
