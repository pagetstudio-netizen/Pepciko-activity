import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Task } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { buildReferralLink } from "@/lib/referral-link";
import { useToast } from "@/hooks/use-toast";
import { copyTextWithToast } from "@/lib/copy-to-clipboard";
import EmptyState from "@/components/empty-state";
import rewardIcon from "@assets/rewards_icon_1793891397579.png";
import "./tasks.css";

interface TaskWithStatus extends Task {
  isCompleted: boolean;
  canClaim: boolean;
  currentInvites: number;
}

type CopyKind = "code" | "link";

function formatFcfa(amount: number) {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} FCFA`;
}

export default function TasksPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState<CopyKind | null>(null);

  const { data: tasks, isLoading, isError, refetch } = useQuery<TaskWithStatus[]>({
    queryKey: ["/api/tasks"],
  });

  const claimMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/claim`, {});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Impossible de réclamer cette récompense.");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      refreshUser();
      toast({ title: "Récompense réclamée", description: "Le montant a été ajouté à votre compte." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const invitationLink = useMemo(() => {
    if (!user?.referralCode || typeof window === "undefined") return "";
    return buildReferralLink(window.location.origin, user.referralCode);
  }, [user?.referralCode]);

  if (!user) return null;

  const copyInvitationValue = async (value: string, kind: CopyKind) => {
    const copied = await copyTextWithToast(value, {
      successTitle: "Copie réussie",
      failureDescription: "Veuillez sélectionner et copier le texte manuellement.",
    });
    if (!copied) return;
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1300);
  };

  return (
    <main className="invite-reference-preview invite-page">
      <div className="invite-reference-scroll">
        <header className="invite-reference-header">
          <div className="invite-reference-titlebar">
            <button className="invite-reference-back" type="button" onClick={() => window.history.back()} aria-label="Retour">
              <span aria-hidden="true" />
            </button>
            <h1>Tâches</h1>
          </div>

          <section className="invite-reference-code-panel" aria-label="Lien de parrainage">
            <p className="invite-reference-share-copy">
              Partagez votre lien de parrainage et commencez à gagner de l&apos;argent.
            </p>
            <div className="invite-reference-link-line">
              <strong className="invite-reference-url">{invitationLink || "Lien indisponible"}</strong>
              <button
                className="invite-reference-copy-button"
                type="button"
                onClick={() => invitationLink && void copyInvitationValue(invitationLink, "link")}
                disabled={!invitationLink}
                aria-label="Copier le lien de parrainage"
              >
                {copied === "link" ? "Copié" : "Copie"}
              </button>
            </div>
          </section>
        </header>

        <section className="invite-reference-tiers" aria-label="Paliers de récompense">
          <h2 className="invite-reference-section-title">Récompenses pour les tâches</h2>
          {isLoading ? (
            <div className="invite-reference-skeletons" role="status" aria-label="Chargement des tâches">
              {[0, 1, 2].map((item) => (
                <div className="invite-reference-skeleton" key={item}>
                  <span className="invite-reference-skeleton-icon" />
                  <span className="invite-reference-skeleton-lines"><i /><i /><i /></span>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="invite-reference-error" role="alert">
              <span>Impossible de charger les tâches d&apos;invitation.</span>
              <button type="button" onClick={() => void refetch()}>Réessayer</button>
            </div>
          ) : tasks && tasks.length > 0 ? (
            tasks.map((task) => {
              const progress = Math.min(100, Math.max(0, task.currentInvites / Math.max(task.requiredInvites, 1) * 100));
              return (
                <article
                  className={`invite-reference-tier${task.isCompleted ? " is-completed" : ""}`}
                  key={task.id}
                  data-testid={`task-item-${task.id}`}
                >
                  <img className="invite-reference-reward-icon" src={rewardIcon} alt="" aria-hidden="true" />
                  <div className="invite-reference-tier-content">
                    <p className="invite-reference-requirement">
                      <strong>Exigence : Inviter {task.requiredInvites}</strong> personnes à activer
                    </p>
                    <p className="invite-reference-reward-line">
                      Récompenses : <strong className="invite-reference-reward">{formatFcfa(task.reward)}</strong>
                    </p>
                    <div className="invite-reference-progress-row">
                      <div className="invite-reference-progress-track" aria-label={`Progression ${task.currentInvites} sur ${task.requiredInvites}`}>
                        <span style={{ transform: `scaleX(${progress / 100})` }} />
                      </div>
                      {task.canClaim && !task.isCompleted ? (
                      <button
                        className="invite-reference-status invite-reference-claim-button"
                        type="button"
                        onClick={() => claimMutation.mutate(task.id)}
                        disabled={claimMutation.isPending}
                        data-testid={`button-claim-${task.id}`}
                      >
                        {claimMutation.isPending ? <Loader2 className="invite-claim-spinner" aria-label="Réclamation en cours" /> : "Réclamer"}
                      </button>
                      ) : (
                        <span className="invite-reference-count">
                          <strong>{task.currentInvites}</strong> / {task.requiredInvites}
                        </span>
                      )}
                    </div>
                    {task.isCompleted && <span className="invite-reference-completed-label">Récompense reçue</span>}
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState className="invite-reference-empty">
              <p>Aucune tâche d&apos;invitation disponible.</p>
            </EmptyState>
          )}
        </section>
      </div>
    </main>
  );
}
