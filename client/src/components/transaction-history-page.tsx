import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import EmptyState from "@/components/empty-state";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";
import { getTransactionOrderNumber } from "@shared/transaction-order-number";
import "./transaction-history-page.css";

type HistoryKind = "deposit" | "withdrawal";

interface TransactionRecord {
  id: number;
  amount: number | string;
  status: string;
  createdAt: string;
  netAmount?: number | string | null;
  fees?: number | string | null;
}

const STATUS_LABELS: Record<string, string> = {
  approved: "Succès",
  pending: "En attente",
  processing: "En traitement",
  rejected: "Rejeté",
};

function formatNumber(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatFcfa(value: number | string | null | undefined) {
  const amount = formatNumber(value);
  return amount === "—" ? amount : `${amount} FCFA`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function statusClassFor(status: string) {
  return ["approved", "pending", "processing", "rejected"].includes(status)
    ? status
    : "pending";
}

export default function TransactionHistoryPage({ kind }: { kind: HistoryKind }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isDeposit = kind === "deposit";
  const endpoint = isDeposit ? "/api/deposits/history" : "/api/withdrawals/history";
  const title = isDeposit ? "Historique des dépôts" : "Historique des retraits";
  const query = useQuery<TransactionRecord[]>({
    queryKey: [endpoint],
    enabled: Boolean(user),
  });
  const from = new URLSearchParams(window.location.search).get("from");
  const backPath = from === "account" ? "/account" : isDeposit ? "/deposit" : "/withdrawal";

  if (!user) return null;

  const balance = isDeposit ? user.depositBalance : user.withdrawalBalance;
  const formattedBalance = formatNumber(balance);
  const transactions = query.data ?? [];

  return (
    <main className="transaction-history-page">
      <div className="transaction-history-page__screen">
        <header className="transaction-history-page__header">
          <button
            type="button"
            className="transaction-history-page__back"
            aria-label={backPath === "/account" ? "Retour au compte" : `Retour au ${isDeposit ? "dépôt" : "retrait"}`}
            data-testid="button-back"
            onClick={() => navigate(backPath)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1 className="transaction-history-page__title">{title}</h1>
        </header>

        <section className="transaction-history-page__balance" aria-label="Solde du compte">
          <p className="transaction-history-page__amount" data-testid="text-balance">
            {formattedBalance} <small>FCFA</small>
          </p>
          <p className="transaction-history-page__caption">Solde du compte</p>
        </section>

        {query.isLoading && (
          <div className="transaction-history-page__loading" aria-label="Chargement de l’historique" role="status">
            {[0, 1].map((index) => (
              <article className="transaction-history-page__loading-card" key={index}>
                <span />
                <span />
                <span />
                <span />
              </article>
            ))}
          </div>
        )}

        {query.isError && (
          <div className="transaction-history-page__error" role="alert">
            <p>Impossible de charger {isDeposit ? "les dépôts" : "les retraits"}.</p>
            <button type="button" onClick={() => void query.refetch()}>
              Réessayer
            </button>
          </div>
        )}

        {!query.isLoading && !query.isError && transactions.length === 0 && (
          <EmptyState className="transaction-history-page__empty">
            <p>{isDeposit ? "Aucun dépôt pour le moment." : "Aucun retrait pour le moment."}</p>
          </EmptyState>
        )}

        {!query.isLoading && !query.isError && transactions.length > 0 && (
          <section
            className="transaction-history-page__list"
            aria-label={isDeposit ? "Dépôts récents" : "Retraits récents"}
          >
            {transactions.map((transaction) => {
              const status = transaction.status.toLowerCase();
              const statusClass = statusClassFor(status);
              const statusLabel = STATUS_LABELS[status] ?? transaction.status;
              const transactionType = isDeposit ? "Dépôt" : "Retrait";
              const rows = [
                {
                  label: isDeposit ? "Montant du dépôt" : "Montant du retrait",
                  value: formatFcfa(transaction.amount),
                  valueClassName: "transaction-history-page__row-value--amount",
                },
                {
                  label: "Référence de commande",
                  value: getTransactionOrderNumber(isDeposit ? "deposit" : "withdrawal", transaction.id),
                  valueClassName: "transaction-history-page__order-number",
                },
                {
                  label: "Montant reçu",
                  value: isDeposit
                    ? status === "approved"
                      ? formatFcfa(transaction.amount)
                      : status === "rejected" ? "Rejeté" : "En attente"
                    : formatFcfa(transaction.netAmount),
                },
                ...(!isDeposit
                  ? [{ label: "Frais", value: formatFcfa(transaction.fees) }]
                  : []),
                {
                  label: "Heure de la demande",
                  value: formatDate(transaction.createdAt),
                },
              ];

              return (
                <article
                  className="transaction-history-page__item"
                  key={transaction.id}
                  data-testid={`${kind}-history-item-${transaction.id}`}
                >
                  <div className="transaction-history-page__type-wrap">
                    <span
                      className={`transaction-history-page__type transaction-history-page__type--${statusClass}`}
                      aria-label={`${transactionType} — ${statusLabel}`}
                      title={`${transactionType} — ${statusLabel}`}
                    >
                      {transactionType}
                    </span>
                  </div>
                  <div className="transaction-history-page__rows">
                    {rows.map((row) => (
                      <div className="transaction-history-page__row" key={row.label}>
                        <span>{row.label}</span>
                        <strong className={row.valueClassName ?? "transaction-history-page__row-value"}>
                          {row.value}
                        </strong>
                      </div>
                    ))}
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
