import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CircleHelp, RotateCw, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import heroImage from "@assets/daily-checkin-hero-reference.png";
import "./daily-checkin.css";

interface DailyCheckinStatus {
  rewardAmount: number;
  hasActiveStableProduct: boolean;
  canClaim: boolean;
  nextClaimAt: string | null;
  streakDays: number;
  totalCapturedProfit: number;
  currentMonth: string;
  today: string;
  calendar: Array<{
    date: string;
    amount: number;
    claimed: boolean;
    isToday: boolean;
  }>;
}

interface ClaimResult {
  success: true;
  amount: number;
  withdrawalBalance: number;
  streakDays: number;
  totalCapturedProfit: number;
  nextClaimAt: string;
}

const STATUS_KEY = ["/api/daily-checkin/status"];
const formatFcfa = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)} FCFA`;

function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function monthTitle(value: string) {
  const date = parseDate(value.length === 7 ? `${value}-01` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function shortDate(value: string) {
  const date = parseDate(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

function monthDay(value: string) {
  return `${value.slice(5, 7)}-${value.slice(8, 10)}`;
}

export default function DailyCheckinPage() {
  const { user, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const [notice, setNotice] = useState("");
  const statusQuery = useQuery<DailyCheckinStatus>({
    queryKey: STATUS_KEY,
    enabled: Boolean(user),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/daily-checkin/claim", {});
      return response.json() as Promise<ClaimResult>;
    },
    onSuccess: async (result) => {
      setNotice(
        result.success && Number.isFinite(result.amount)
          ? `${formatFcfa(result.amount)} ont été ajoutés à votre solde de retrait.`
          : "La récompense n’a pas pu être confirmée. Actualisez votre compte.",
      );
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] }),
        refreshUser(),
      ]);
    },
    onError: (error: Error) => {
      setNotice(error.message || "Votre récompense n’a pas pu être récupérée. Réessayez.");
      void statusQuery.refetch();
    },
  });

  const calendarDays = useMemo(() => {
    const status = statusQuery.data;
    if (!status) return [];
    return [...status.calendar].sort((a, b) => a.date.localeCompare(b.date));
  }, [statusQuery.data]);

  if (!user) return null;
  const status = statusQuery.data;
  const isLoading = statusQuery.isLoading;
  const eligible = Boolean(status?.hasActiveStableProduct);
  const canClaim = Boolean(status?.canClaim && eligible && !claimMutation.isPending);
  const cooldownLabel = status?.nextClaimAt
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(status.nextClaimAt))
    : "";

  return (
    <main className="daily-checkin">
      <div className="daily-shell">
        <section className="daily-hero" aria-label="Daily check-in to Earn cash">
          <img className="daily-hero-image" src={heroImage} alt="Daily check-in to Earn cash" />
          <button className="daily-back" type="button" onClick={() => navigate("/")} aria-label="Retour à l’accueil">
            <span className="sr-only">Retour à l’accueil</span>
          </button>
        </section>

        <div className="daily-content">
          {isLoading ? (
            <section className="daily-loading" aria-label="Chargement de votre récompense">
              <div className="daily-skeleton daily-skeleton-title" />
              <div className="daily-skeleton daily-skeleton-stats" />
              <div className="daily-skeleton daily-skeleton-grid" />
            </section>
          ) : statusQuery.isError || !status ? (
            <section className="daily-error" role="alert">
              <span className="daily-error-icon"><CircleHelp aria-hidden="true" /></span>
              <h2>Votre calendrier ne répond pas</h2>
              <p>Impossible de vérifier votre récompense pour le moment. Vos gains déjà crédités restent acquis.</p>
              <button type="button" className="daily-retry" onClick={() => void statusQuery.refetch()}>
                <RotateCw aria-hidden="true" /> Réessayer
              </button>
            </section>
          ) : (
            <>
              <section className="daily-summary" aria-label="Votre progression et votre récompense">
                <div className="daily-stat">
                  <span className="daily-stat-number">{status.streakDays}</span>
                  <span className="daily-stat-caption">jour{status.streakDays > 1 ? "s" : ""} consécutif{status.streakDays > 1 ? "s" : ""}</span>
                </div>
                <div className="daily-stat-divider" aria-hidden="true" />
                <div className="daily-stat daily-stat-profit">
                  <span className="daily-stat-number">{formatFcfa(status.totalCapturedProfit)}</span>
                  <span className="daily-stat-caption">gains cumulés</span>
                </div>
                <button
                  type="button"
                  className={`daily-claim-button ${!canClaim ? "is-disabled" : ""}`}
                  onClick={() => {
                    if (!canClaim) return;
                    setNotice("");
                    claimMutation.mutate();
                  }}
                  disabled={!canClaim}
                  aria-describedby="daily-claim-help"
                >
                  {claimMutation.isPending
                    ? "Récupération…"
                    : !eligible
                      ? "Produit requis"
                      : status.canClaim
                        ? `Réclamer ${formatFcfa(status.rewardAmount)}`
                        : `À partir de ${cooldownLabel || "demain"}`}
                </button>
                <p className="daily-claim-help" id="daily-claim-help">
                  {!eligible
                    ? "Un produit stable actif est nécessaire pour réclamer le bonus."
                    : status.canClaim
                      ? `${formatFcfa(status.rewardAmount)} sont crédités au solde de retrait toutes les 24 heures.`
                      : `Prochaine réclamation${cooldownLabel ? ` à ${cooldownLabel}` : " demain"}.`}
                </p>
              </section>

              {notice && <p className={`daily-notice ${claimMutation.isError ? "has-error" : ""}`} role="status">{notice}</p>}

              <section
                className="daily-calendar-section"
                aria-label={`Calendrier des récompenses, ${monthTitle(status.currentMonth)}`}
              >
                <div className="daily-calendar-grid">
                  {calendarDays.map((day) => (
                    <div
                      key={day.date}
                      className={[
                        "daily-day",
                        day.claimed ? "is-claimed" : "",
                        day.isToday ? "is-today" : "",
                      ].filter(Boolean).join(" ")}
                      aria-label={`${shortDate(day.date)} : ${day.claimed ? `${formatFcfa(day.amount)} récupérés` : day.isToday ? "aujourd’hui" : "aucune récompense récupérée"}`}
                      aria-current={day.isToday ? "date" : undefined}
                    >
                      <span className="daily-day-date">{monthDay(day.date)}</span>
                      <span className="daily-day-reward">{formatFcfa(day.claimed ? day.amount : 0)}</span>
                      <span className="daily-day-mark" aria-hidden="true"><Star fill="currentColor" /></span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
