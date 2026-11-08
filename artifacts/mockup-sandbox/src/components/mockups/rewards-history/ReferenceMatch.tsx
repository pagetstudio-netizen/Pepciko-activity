import { useState } from "react";
import { ArrowLeft, ClipboardList, Headset, Send, X } from "lucide-react";
import "./ReferenceMatch.css";

type QuickAction = "telegram" | "history" | "support";

const quickActions: { id: QuickAction; label: string; message: string }[] = [
  {
    id: "telegram",
    label: "Communauté",
    message: "Retrouvez la communauté PepsiCo et ses actualités.",
  },
  {
    id: "history",
    label: "Historique",
    message: "Vos récompenses de connexion apparaîtront ici dès votre premier check-in.",
  },
  {
    id: "support",
    label: "Assistance",
    message: "Besoin d’aide ? Contactez l’équipe d’assistance PepsiCo.",
  },
];

export function ReferenceMatch() {
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const selectedAction = quickActions.find((action) => action.id === activeAction);

  return (
    <main className="rewards-reference">
      <div className="rewards-reference__screen">
        <header className="rewards-reference__header">
          <button
            className="rewards-reference__back"
            type="button"
            aria-label="Retour"
            onClick={() => window.history.back()}
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <h1>Récompenses</h1>
          <span className="rewards-reference__header-spacer" aria-hidden="true" />
        </header>

        <section
          className="rewards-reference__content"
          aria-label="Historique des récompenses de connexion quotidienne"
        >
          <img
            className="rewards-reference__artwork"
            src="/__mockup/images/rewards-gift-reference.png"
            alt="Illustration d’un cadeau entouré de pièces et de rubans"
          />
          <p className="rewards-reference__total" aria-label="Total des récompenses : zéro franc CFA">
            0 <span>FCFA</span>
          </p>
          <p className="rewards-reference__caption">Récompenses du compte</p>
        </section>

        <nav className="rewards-reference__quick-actions" aria-label="Actions rapides">
          {quickActions.map((action) => {
            const Icon =
              action.id === "telegram" ? Send : action.id === "history" ? ClipboardList : Headset;
            const isActive = activeAction === action.id;
            return (
              <button
                key={action.id}
                type="button"
                className="rewards-reference__quick-button"
                aria-label={action.label}
                aria-expanded={isActive}
                onClick={() => setActiveAction(isActive ? null : action.id)}
              >
                <Icon aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        {selectedAction && (
          <aside className="rewards-reference__notice" role="status">
            <div>
              <strong>{selectedAction.label}</strong>
              <p>{selectedAction.message}</p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setActiveAction(null)}
            >
              <X aria-hidden="true" />
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
