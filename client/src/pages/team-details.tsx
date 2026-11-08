import { useQuery } from "@tanstack/react-query";
import EmptyState from "@/components/empty-state";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import "./team-details.css";

type TeamLevel = 1 | 2 | 3;

const PEPSICO_LOGO = "/pepsico-logo.jpg";

interface TeamMember {
  id: number;
  fullName: string;
  phone: string;
  country: string;
  createdAt: string;
  totalInvested: number;
  totalRecharged: number;
  totalWithdrawn: number;
  hasActiveProduct: boolean;
}

interface TeamDetails {
  level1: TeamMember[];
  level2: TeamMember[];
  level3: TeamMember[];
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\s/g, "");
  if (digits.length <= 8) return `****${digits.slice(-4)}`;
  return `${digits.slice(0, 3)}****${digits.slice(-5)}`;
}

function formatMemberDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export default function TeamDetailsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const requestedLevel = Number(new URLSearchParams(window.location.search).get("level"));
  const activeLevel: TeamLevel = requestedLevel === 2 || requestedLevel === 3 ? requestedLevel : 1;

  const { data: team, isLoading, isError } = useQuery<TeamDetails>({
    queryKey: ["/api/team/details"],
  });

  const currency = "FCFA";
  const membersByLevel = {
    1: team?.level1 ?? [],
    2: team?.level2 ?? [],
    3: team?.level3 ?? [],
  }[activeLevel];

  return (
    <main className="team-details-page">
      <header className="team-details-header">
        <button
          type="button"
          className="team-details-back"
          onClick={() => navigate("/team")}
          data-testid="button-back-team"
          aria-label="Retour à la page Équipe"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h1 data-testid="text-page-title">Équipe LV.{activeLevel}</h1>
      </header>

      <section className="team-details-members" aria-label={`Membres de l’équipe niveau ${activeLevel}`}>
        {isLoading ? (
          <div className="team-details-loading" aria-label="Chargement des membres">
            <Skeleton className="h-[92px] w-full rounded-xl" />
            <Skeleton className="h-[92px] w-full rounded-xl" />
          </div>
        ) : isError ? (
          <p className="team-details-message team-details-error" role="alert">
            Impossible de charger les membres de l’équipe.
          </p>
        ) : membersByLevel.length === 0 ? (
          <EmptyState className="team-details-message">
            <p>Plus de données</p>
          </EmptyState>
        ) : (
          <div className="team-details-member-list">
            {membersByLevel.map((member) => (
              <article
                key={member.id}
                className="team-details-member"
                data-testid={`team-member-${member.id}`}
              >
                <img className="team-details-member-logo" src={PEPSICO_LOGO} alt="PepsiCo" />
                <div className="team-details-member-copy">
                  <div className="team-details-member-heading">
                    <strong>Mobile : {maskPhone(member.phone)}</strong>
                    {member.hasActiveProduct && <span className="team-details-purchased">Acheté</span>}
                  </div>
                  <div className="team-details-member-balances">
                    <span>
                      Recharge : <strong>{formatAmount(member.totalRecharged)} {currency}</strong>
                    </span>
                    <span>
                      Retrait : <strong>{formatAmount(member.totalWithdrawn)} {currency}</strong>
                    </span>
                  </div>
                  <time dateTime={member.createdAt}>
                    Date : {formatMemberDate(member.createdAt)}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
