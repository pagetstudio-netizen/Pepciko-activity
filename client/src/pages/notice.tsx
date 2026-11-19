import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Task } from "@shared/schema";
import EmptyState from "@/components/empty-state";
import backIcon from "@assets/image_1794151162399.png";
import rechargeThumbnail from "@assets/notice-recharge-thumbnail.png";
import referralThumbnail from "@assets/notice-referral-thumbnail.png";
import loginThumbnail from "@assets/notice-vip-thumbnail.png";
import lotteryThumbnail from "@assets/notice-lottery-thumbnail.png";
import "./notice.css";

const notices = [
  {
    id: "recharge",
    title: "Bonus de recharge cumulatifs",
    date: "2026-10-29 09:45:27",
    image: rechargeThumbnail,
    details: [
      "Consultez l’historique de vos dépôts pour suivre chaque recharge et son statut de validation.",
      "Les montants des opérations sont affichés en FCFA. Seules les recharges approuvées sont confirmées sur votre compte.",
    ],
  },
  {
    id: "referral",
    title: "Récompenses de parrainage",
    date: "2026-10-29 09:44:58",
    image: referralThumbnail,
    details: [
      "Les paliers ci-dessous sont chargés depuis les tâches actuellement disponibles sur votre compte.",
      "Une personne parrainée est comptée après un dépôt approuvé et l’achat d’un produit stable payant. Les récompenses réclamées sont créditées sur le solde de retrait.",
    ],
  },
  {
    id: "login",
    title: "Bonus de connexion...",
    date: "2026-10-29 09:44:31",
    image: loginThumbnail,
    details: [
      "Le bonus quotidien dépend de votre niveau VIP : de 45 FCFA au niveau VIP1 à 150 FCFA à partir du niveau VIP8.",
      "Il est réservé aux comptes possédant au moins un produit stable actif et est crédité sur le solde de retrait.",
    ],
  },
  {
    id: "lottery",
    title: "Tirage au sort",
    date: "2026-10-29 09:43:55",
    image: lotteryThumbnail,
    details: [
      "Consultez la page du jeu pour voir vos tours disponibles, les résultats et les récompenses.",
      "Les gains confirmés du jeu sont crédités sur le solde de retrait.",
    ],
  },
];

interface ReferralTaskWithStatus extends Task {
  isCompleted: boolean;
  canClaim: boolean;
  currentInvites: number;
}

function formatDetailDate(timestamp: string) {
  const [date, time] = timestamp.split(" ");
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} ${time}`;
}

function formatFcfa(amount: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} FCFA`;
}

export default function NoticePage() {
  const [location, navigate] = useLocation();
  const selectedId = location.match(/^\/notice\/([^/?#]+)/)?.[1];
  const selectedNotice = notices.find((notice) => notice.id === selectedId);
  const referralTasksQuery = useQuery<ReferralTaskWithStatus[]>({
    queryKey: ["/api/tasks"],
    enabled: selectedNotice?.id === "referral",
  });

  return (
    <main className="notice-page">
      <header className="notice-header">
        <button
          type="button"
          className="notice-back"
          aria-label={selectedNotice ? "Retour aux avis" : "Retour à l’accueil"}
          onClick={() => navigate(selectedNotice ? "/notice" : "/")}
        >
          <img src={backIcon} alt="" aria-hidden="true" />
        </button>
        <h1>{selectedNotice ? "Avis de détails" : "Avis"}</h1>
      </header>

      {selectedNotice ? (
        <article className="notice-detail">
          <h2>{selectedNotice.title.replace("...", "")}</h2>
          <p className="notice-detail-date">
            PepsiCo {formatDetailDate(selectedNotice.date)}
          </p>
          <div className="notice-detail-copy">
            {selectedNotice.details.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          {selectedNotice.id === "referral" && (
            <section className="notice-referral-tasks" aria-labelledby="notice-referral-title">
              <h3 id="notice-referral-title">Tâches de parrainage disponibles</h3>
              {referralTasksQuery.isLoading ? (
                <p className="notice-referral-state" role="status">Chargement des tâches…</p>
              ) : referralTasksQuery.isError ? (
                <div className="notice-referral-state notice-referral-error" role="alert">
                  <span>Impossible de charger les tâches de parrainage.</span>
                  <button type="button" onClick={() => void referralTasksQuery.refetch()}>Réessayer</button>
                </div>
              ) : referralTasksQuery.data?.length ? (
                <div className="notice-referral-list">
                  {referralTasksQuery.data.map((task) => {
                    const progress = Math.min(100, Math.max(0, task.currentInvites / Math.max(task.requiredInvites, 1) * 100));
                    const status = task.isCompleted
                      ? "Récompense réclamée"
                      : task.canClaim
                        ? "Palier atteint — réclamation disponible"
                        : "En cours";
                    return (
                      <article className="notice-referral-task" key={task.id}>
                        <div className="notice-referral-task-heading">
                          <strong>{task.description}</strong>
                          <span>{formatFcfa(task.reward)}</span>
                        </div>
                        <p>{task.currentInvites} / {task.requiredInvites} membres qualifiés</p>
                        <div
                          className="notice-referral-progress"
                          role="progressbar"
                          aria-label={`Progression : ${task.currentInvites} sur ${task.requiredInvites}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                        >
                          <span style={{ transform: `scaleX(${progress / 100})` }} />
                        </div>
                        <small>{status}</small>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState size="compact" className="notice-referral-empty">
                  <p className="notice-referral-state">Aucune tâche de parrainage disponible pour le moment.</p>
                </EmptyState>
              )}
            </section>
          )}
        </article>
      ) : (
        <section className="notice-list" aria-label="Liste des avis">
          {notices.map((notice) => (
            <button
              key={notice.id}
              type="button"
              className="notice-card"
              onClick={() => navigate(`/notice/${notice.id}`)}
              aria-label={`Ouvrir l’avis : ${notice.title.replace("...", "")}`}
            >
              <img src={notice.image} alt="" className="notice-thumbnail" />
              <span className="notice-card-copy">
                <strong>{notice.title}</strong>
                <time dateTime={notice.date.replace(" ", "T")}>{notice.date}</time>
              </span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
