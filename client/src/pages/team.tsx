import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { buildReferralLink } from "@/lib/referral-link";
import { copyTextWithToast } from "@/lib/copy-to-clipboard";
import commissionIllustration from "@assets/team-total-illustration.png";
import referralIllustration from "@assets/team-referral-illustration.png";
import levelOneMedal from "@assets/lv1_(1)_1793890089762.png";
import levelTwoMedal from "@assets/lv2_(1)_1793890089505.png";
import levelThreeMedal from "@assets/lv3_(1)_1793890089725.png";
import "./team.css";

type TeamLevel = 1 | 2 | 3;

interface TeamStats {
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalCommission: number;
  level1Commission: number;
  level2Commission: number;
  level3Commission: number;
  level1Invested: number;
  level2Invested: number;
  level3Invested: number;
  teamRechargeAmount: number;
}

const levels: Array<{ level: TeamLevel; medal: string; alt: string }> = [
  { level: 1, medal: levelOneMedal, alt: "Médaille argentée du niveau 1" },
  { level: 2, medal: levelTwoMedal, alt: "Médaille bronze du niveau 2" },
  { level: 3, medal: levelThreeMedal, alt: "Médaille dorée du niveau 3" },
];

const formatAmount = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function TeamPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats, isError: statsError } = useQuery<TeamStats>({
    queryKey: ["/api/team/stats"],
  });

  const { data: settings, isError: settingsError } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  if (!user) return null;

  const currency = "FCFA";
  const invitationLink = user.referralCode
    ? buildReferralLink(window.location.origin, user.referralCode)
    : "";

  const totalMembers =
    (stats?.level1Count ?? 0) +
    (stats?.level2Count ?? 0) +
    (stats?.level3Count ?? 0);

  const configuredRates = ([1, 2, 3] as TeamLevel[])
    .map((level) => Number(settings?.[`level${level}Commission`]))
    .filter(Number.isFinite);
  const totalRate = configuredRates.length
    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
        configuredRates.reduce((sum, rate) => sum + rate, 0),
      )}%`
    : "—";

  const levelData: Record<TeamLevel, { registered: number; active: number; rate: string; revenue: number }> = {
    1: {
      registered: stats?.level1Count ?? 0,
      active: stats?.level1Invested ?? 0,
      rate: settings?.level1Commission ?? "0",
      revenue: stats?.level1Commission ?? 0,
    },
    2: {
      registered: stats?.level2Count ?? 0,
      active: stats?.level2Invested ?? 0,
      rate: settings?.level2Commission ?? "0",
      revenue: stats?.level2Commission ?? 0,
    },
    3: {
      registered: stats?.level3Count ?? 0,
      active: stats?.level3Invested ?? 0,
      rate: settings?.level3Commission ?? "0",
      revenue: stats?.level3Commission ?? 0,
    },
  };

  const copyInvitationLink = async () => {
    if (!invitationLink) {
      toast({ title: "Lien indisponible", description: "Votre code de parrainage n’est pas disponible." });
      return;
    }

    const copied = await copyTextWithToast(invitationLink, {
      successTitle: "Copie réussie",
      failureDescription: "Veuillez sélectionner et copier le lien manuellement.",
    });
    if (!copied) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <main className="team-page">
      <div className="team-page-shell">
        <header className="team-header">
          <button type="button" onClick={() => navigate("/")} aria-label="Retour à l’accueil">
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1>Équipe</h1>
        </header>

        <section className="team-commission-card" aria-label="Commission totale">
          <img src={commissionIllustration} alt="" aria-hidden="true" />
          <div className="team-commission-copy">
            <span>Commission totale</span>
            <strong>
              {formatAmount(stats?.totalCommission ?? 0)} <small>{currency}</small>
            </strong>
          </div>
        </section>

        <section className="team-referral-card" aria-label="Lien de parrainage">
          <div className="team-referral-copy">
            <p>Partagez votre lien de parrainage et commencez à gagner de l&apos;argent.</p>
            <div className="team-referral-actions">
              <span className="team-referral-link" title={invitationLink}>{invitationLink}</span>
              <button
                type="button"
                onClick={() => void copyInvitationLink()}
                aria-label={copied ? "Lien de parrainage copié" : "Copier le lien de parrainage"}
                aria-live="polite"
              >
                {copied ? "Copié" : "Copie"}
              </button>
            </div>
          </div>
          <img src={referralIllustration} alt="" aria-hidden="true" />
        </section>

        <section className="team-summary-card" aria-label="Résumé de l’équipe">
          <div>
            <span>Taille de l&apos;équipe</span>
            <strong>{formatAmount(totalMembers)}</strong>
          </div>
          <div>
            <span>Taux d&apos;équipe</span>
            <strong>{totalRate}</strong>
          </div>
          <div>
            <span>Revenu total</span>
            <strong>{formatAmount(stats?.totalCommission ?? 0)} {currency}</strong>
          </div>
        </section>

        <section className="team-level-grid" aria-label="Niveaux de l’équipe">
          {levels.map(({ level, medal, alt }) => {
            const data = levelData[level];
            return (
              <article className="team-level-card" key={level}>
                <img className="team-level-medal" src={medal} alt={alt} />
                <span className="team-level-label">Enregistré/Actif</span>
                <strong className="team-level-count">
                  {formatAmount(data.registered)} / {formatAmount(data.active)}
                </strong>
                <div className="team-level-commission">
                  <span>Pourcentage de commission</span>
                  <strong>{Number.isFinite(Number(data.rate))
                    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(data.rate))}%`
                    : "—"}
                  </strong>
                </div>
                <div className="team-level-revenue">
                  <span>Revenu total</span>
                  <strong>{formatAmount(data.revenue)} {currency}</strong>
                </div>
                <button
                  type="button"
                  className="team-level-details"
                  onClick={() => navigate(`/team-details?level=${level}`)}
                  data-testid={`team-level-details-${level}`}
                  aria-label={`Voir les détails du niveau ${level}`}
                >
                  Détails
                </button>
              </article>
            );
          })}
        </section>

        {(statsError || settingsError) && (
          <p className="team-page-error" role="status">
            Certaines données de l’équipe ne sont pas disponibles pour le moment.
          </p>
        )}
      </div>
    </main>
  );
}
