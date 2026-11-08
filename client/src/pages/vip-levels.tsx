import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import vipHero from "@assets/vip_logo_1793923540460.png";
import badge0 from "@assets/lv0_(1)_1793923540354.png";
import badge1 from "@assets/lv1_(1)_1793923540435.png";
import badge2 from "@assets/lv2_(1)_1793923540409.png";
import badge3 from "@assets/lv3_(1)_1793923540379.png";
import badge6 from "@assets/lv6_(1)_1793923540333.png";
import badge8 from "@assets/lv8_(1)_1793923540309.png";
import "./vip-levels.css";

type VipLevel = {
  level: number;
  thresholdFcfa: number;
  progressFcfa: number;
  progressPercent: number;
  isCurrent: boolean;
};

type VipLevelsResponse = {
  totalDeposits: number;
  currentLevel: number;
  levels: VipLevel[];
};

const badgeByLevel: Record<number, string> = {
  0: badge0,
  1: badge1,
  2: badge2,
  3: badge3,
  6: badge6,
  8: badge8,
};

function badgeFor(level: number) {
  if (badgeByLevel[level]) return badgeByLevel[level];
  const available = Object.keys(badgeByLevel).map(Number).sort((a, b) => a - b);
  const nearest = available.reduce((best, item) =>
    Math.abs(item - level) < Math.abs(best - level) ? item : best, available[0]);
  return badgeByLevel[nearest];
}

function formatFcfa(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
}

export default function VipLevelsPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<VipLevelsResponse>({
    queryKey: ["/api/user/vip-levels"],
  });

  const levels = [...(data?.levels ?? [])].sort((a, b) => a.level - b.level);

  return (
    <main className="vip-page">
      <header className="vip-page-header">
        <button type="button" className="vip-back" onClick={() => navigate("/account")} aria-label="Retour au compte">
          <ChevronLeft aria-hidden="true" />
        </button>
        <h1>Niveau VIP</h1>
        <span className="vip-header-spacer" aria-hidden="true" />
      </header>

      <div className="vip-content">
        <div className="vip-hero-wrap" aria-hidden="true">
          <img className="vip-hero-image" src={vipHero} alt="" />
        </div>

        {isLoading ? (
          <section className="vip-loading" aria-label="Chargement des niveaux VIP" role="status">
            <div className="vip-skeleton vip-skeleton-title" />
            <div className="vip-skeleton vip-skeleton-copy" />
            <div className="vip-skeleton vip-skeleton-line" />
            <div className="vip-skeleton vip-skeleton-title" />
            <div className="vip-skeleton vip-skeleton-copy" />
            <div className="vip-skeleton vip-skeleton-line" />
          </section>
        ) : isError ? (
          <section className="vip-error" role="alert">
            <strong>Impossible de charger vos niveaux VIP.</strong>
            <p>{error instanceof Error ? error.message : "Une erreur est survenue. Réessayez dans un instant."}</p>
            <button type="button" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw aria-hidden="true" className={isFetching ? "vip-refreshing" : ""} />
              Réessayer
            </button>
          </section>
        ) : levels.length === 0 ? (
          <section className="vip-empty">
            <img src={badge0} alt="" aria-hidden="true" />
            <h2>Aucun niveau disponible</h2>
            <p>Les niveaux VIP apparaîtront ici dès qu’ils seront configurés.</p>
          </section>
        ) : (
          <>
            <section className="vip-level-list" aria-label="Progression des niveaux VIP">
              {levels.map((item) => {
                const percent = Math.min(100, Math.max(0, Number(item.progressPercent) || 0));
                return (
                  <article
                    className={`vip-level-card${item.isCurrent ? " is-current" : ""}`}
                    key={item.level}
                    aria-current={item.isCurrent ? "step" : undefined}
                  >
                    <div className="vip-level-title">
                      <img src={badgeFor(item.level)} alt={`Badge VIP ${item.level}`} />
                      <h2>VIP {item.level}</h2>
                      {item.isCurrent && <span className="vip-current-tag">Votre niveau</span>}
                    </div>
                    <div className="vip-level-inner">
                      <p>
                        Passez au statut VIP{item.level} lorsque le cumul de vos recharges approuvées atteint{" "}
                        <strong>{formatFcfa(item.thresholdFcfa)}</strong>.
                      </p>
                      <div className="vip-progress-label">
                        <span>Recharges approuvées cumulées</span>
                        <span><b>{formatFcfa(item.progressFcfa)}</b> / {formatFcfa(item.thresholdFcfa)}</span>
                      </div>
                      <div
                        className="vip-progress-track"
                        role="progressbar"
                        aria-label={`Progression vers VIP ${item.level}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(percent)}
                      >
                        <span style={{ transform: `scaleX(${percent / 100})` }} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
