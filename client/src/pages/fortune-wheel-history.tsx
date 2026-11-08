import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Trophy } from "lucide-react";
import { Link } from "wouter";
import EmptyState from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import {
  FORTUNE_WHEEL_PAYOUT_TRANSACTION_TYPE,
  isFortuneWheelPrizeTransactionType,
} from "@shared/fortune-wheel";

interface GameWinTransaction {
  id: number;
  type: string;
  amount: string | number;
  description: string;
  createdAt: string;
}

function formatAmount(value: string | number) {
  const amount = Number(value);
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function FortuneWheelHistoryPage() {
  const { user } = useAuth();
  const {
    data: transactions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<GameWinTransaction[]>({
    queryKey: ["/api/transactions"],
    enabled: Boolean(user),
  });

  if (!user) return null;

  const wins = transactions
    .filter((transaction) => isFortuneWheelPrizeTransactionType(transaction.type))
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    );
  const totalWinnings = wins.reduce(
    (total, transaction) => total + Number(transaction.amount || 0),
    0,
  );

  return (
    <main className="fortune-history-page">
      <style>{`
        .fortune-history-page {
          min-height: 100dvh;
          padding-bottom: max(28px, env(safe-area-inset-bottom));
          background:
            radial-gradient(ellipse at 50% 4%, rgba(255, 231, 157, .52), transparent 42%),
            linear-gradient(180deg, #ff634f 0%, #ff7b36 46%, #ff9a53 100%);
          color: #42231b;
          font-family: Arial, sans-serif;
        }
        .fortune-history-page *,
        .fortune-history-page *::before,
        .fortune-history-page *::after {
          box-sizing: border-box;
        }
        .fortune-history-screen {
          width: min(100%, 512px);
          min-height: 100dvh;
          margin: 0 auto;
          padding: 0 18px 30px;
        }
        .fortune-history-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          height: 58px;
          align-items: center;
          justify-content: center;
          margin: 0 -18px;
          padding: 0 18px;
          background: rgba(244, 64, 62, .96);
          color: #fff;
          box-shadow: 0 4px 14px rgba(116, 34, 17, .12);
        }
        .fortune-history-back {
          position: absolute;
          left: 16px;
          display: inline-flex;
          min-width: 42px;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border-radius: 999px;
          color: inherit;
          font-size: 14px;
          text-decoration: none;
        }
        .fortune-history-header h1 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          text-align: center;
        }
        .fortune-history-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 22px 0 18px;
        }
        .fortune-history-stat {
          min-width: 0;
          padding: 15px 12px;
          border: 1px solid rgba(255, 255, 255, .8);
          border-radius: 16px;
          background: rgba(255, 247, 224, .96);
          text-align: center;
          box-shadow: 0 5px 0 rgba(150, 48, 28, .12);
        }
        .fortune-history-stat-label {
          display: block;
          color: #794a36;
          font-size: 13px;
        }
        .fortune-history-stat strong {
          display: block;
          margin-top: 6px;
          color: #b72b25;
          font-size: 20px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }
        .fortune-history-list {
          display: grid;
          gap: 11px;
        }
        .fortune-history-entry {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, .82);
          border-radius: 15px;
          background: #fff6e4;
          box-shadow: 0 4px 0 rgba(150, 48, 28, .12);
        }
        .fortune-history-entry-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border-radius: 50%;
          background: #f34854;
          color: #fff;
        }
        .fortune-history-entry-info {
          min-width: 0;
          flex: 1;
        }
        .fortune-history-entry-title {
          display: block;
          color: #39221c;
          font-size: 15px;
          font-weight: 700;
        }
        .fortune-history-entry-date {
          display: block;
          margin-top: 5px;
          color: #755e51;
          font-size: 12px;
        }
        .fortune-history-entry-wallet {
          display: block;
          margin-top: 4px;
          color: #755e51;
          font-size: 11px;
        }
        .fortune-history-entry-amount {
          flex: 0 0 auto;
          color: #b72b25;
          font-size: 15px;
          font-weight: 800;
          text-align: right;
          white-space: nowrap;
        }
        .fortune-history-state {
          margin-top: 22px;
          padding: 22px 16px;
          border: 1px solid rgba(255, 255, 255, .82);
          border-radius: 18px;
          background: #fff7e9;
          text-align: center;
        }
        .fortune-history-state p {
          margin: 8px 0 0;
          color: #694e40;
          line-height: 1.5;
        }
        .fortune-history-retry {
          margin-top: 14px;
          border: 0;
          border-radius: 999px;
          padding: 10px 18px;
          background: #eb2857;
          color: #fff;
          font: inherit;
          font-weight: 700;
        }
        .fortune-history-loading {
          display: flex;
          min-height: 220px;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .fortune-history-loading svg {
          animation: fortune-history-spin 1s linear infinite;
        }
        @keyframes fortune-history-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fortune-history-loading svg { animation: none; }
        }
      `}</style>

      <div className="fortune-history-screen">
        <header className="fortune-history-header">
          <Link className="fortune-history-back" href="/checkin" aria-label="Retour au jeu">
            <ChevronLeft size={24} aria-hidden="true" />
            <span>Retour</span>
          </Link>
          <h1>Historique des gains</h1>
        </header>

        {isLoading ? (
          <div className="fortune-history-loading" role="status" aria-label="Chargement des gains">
            <Loader2 size={30} />
          </div>
        ) : isError ? (
          <div className="fortune-history-state" role="alert">
            <p>Impossible de charger votre historique de gains.</p>
            <button
              className="fortune-history-retry"
              type="button"
              onClick={() => void refetch()}
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <section className="fortune-history-summary" aria-label="Résumé des gains du jeu">
              <div className="fortune-history-stat">
                <span className="fortune-history-stat-label">Total gagné</span>
                <strong>{formatAmount(totalWinnings)} FCFA</strong>
              </div>
              <div className="fortune-history-stat">
                <span className="fortune-history-stat-label">Gains reçus</span>
                <strong>{wins.length}</strong>
              </div>
            </section>

            {wins.length > 0 ? (
              <section className="fortune-history-list" aria-label="Gains reçus">
                {wins.map((win) => (
                  <article className="fortune-history-entry" key={win.id}>
                    <span className="fortune-history-entry-icon" aria-hidden="true">
                      <Trophy size={21} />
                    </span>
                    <span className="fortune-history-entry-info">
                      <span className="fortune-history-entry-title">Gain du tirage</span>
                      <time className="fortune-history-entry-date" dateTime={win.createdAt}>
                        {formatDate(win.createdAt)}
                      </time>
                      <span className="fortune-history-entry-wallet">
                        {win.type === FORTUNE_WHEEL_PAYOUT_TRANSACTION_TYPE
                          ? "Solde de retrait"
                          : "Solde de dépôt"}
                      </span>
                    </span>
                    <span className="fortune-history-entry-amount">
                      +{formatAmount(win.amount)} FCFA
                    </span>
                  </article>
                ))}
              </section>
            ) : (
              <EmptyState className="fortune-history-state">
                <p>Aucun gain de jeu reçu pour le moment.</p>
              </EmptyState>
            )}
          </>
        )}
      </div>
    </main>
  );
}
