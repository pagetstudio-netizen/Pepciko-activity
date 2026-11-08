import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { Link } from "wouter";
import "./checkin-game-visual.css";
import numberOne from "../../../attached_assets/_411483bfde8d9ce5a37e92d12f992725_1794098831658.jpg";
import numberTwo from "../../../attached_assets/_44cb0059172d7c3dc43ebf4c763fb3b9_1794098831687.jpg";
import numberThree from "../../../attached_assets/_81d949cd0bc4ee3a3fd020e63e235522_1794098831719.jpg";
import numberFour from "../../../attached_assets/_7f0e144f5c5b18f96b3d7ccf1060bccc_1794098831749.jpg";
import numberFive from "../../../attached_assets/_ffe981e5596a3e393e2f731888ad216f_1794098831780.jpg";
import numberSix from "../../../attached_assets/_21d732c55296e2ebf78ab85d9bc14030_1794098831807.jpg";
import numberSeven from "../../../attached_assets/_cca1b30984e61aac5e7c101defde43c5_1794098831830.jpg";
import numberEight from "../../../attached_assets/_a649bb2ad3f2331920f27cfb7490f527_1794098831853.jpg";
import numberNine from "../../../attached_assets/_e6f10c391296532fd8f96888875cc5d8_1794098831877.jpg";
import drawButton from "../../../attached_assets/draw_btn_1794098831632.png";

interface CheckinGameVisualProps {
  recentWins: Array<{ id: number; amount: number; createdAt: string }>;
  userPhoneLabel: string;
  labels: number[];
  selectedTileIndex?: number | null;
  totalWinnings?: number;
  totalWins?: number;
  isStatsLoading?: boolean;
  isStatsError?: boolean;
  isSpinning: boolean;
  isClaiming: boolean;
  availableSpins: number;
  resultAmount: number | null;
  isLossResult: boolean;
  resultMessage: string | null;
  isNoSpinsModalOpen: boolean;
  errorMessage: string | null;
  onDismissNoSpins: () => void;
  onDismissResult: () => void;
  onPlay: () => void;
}

const TILES = [
  { number: 9, image: numberNine },
  { number: 8, image: numberEight },
  { number: 7, image: numberSeven },
  { number: 6, image: numberSix },
  { number: 5, image: numberFive },
  { number: 4, image: numberFour },
  { number: 3, image: numberThree },
  { number: 2, image: numberTwo },
  { number: 1, image: numberOne },
];

function formatPrize(amount: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(amount)
    .replace(/[\u202f\u00a0]/g, "\u00a0");
}

function formatRecordDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export default function CheckinGameVisual({
  recentWins,
  userPhoneLabel,
  labels,
  selectedTileIndex = null,
  totalWinnings,
  totalWins,
  isStatsLoading = false,
  isStatsError = false,
  isSpinning,
  isClaiming,
  availableSpins,
  resultAmount,
  isLossResult,
  resultMessage,
  isNoSpinsModalOpen,
  errorMessage,
  onDismissNoSpins,
  onDismissResult,
  onPlay,
}: CheckinGameVisualProps) {
  const [activeTileIndex, setActiveTileIndex] = useState<number | null>(null);
  const hasAvailableSpins = availableSpins > 0;
  const actionDisabled = isSpinning || isClaiming;
  const statusMessage = isClaiming
    ? "Vérification du résultat par le serveur…"
    : isSpinning
      ? "Tirage en cours…"
      : `${availableSpins} tour${availableSpins === 1 ? "" : "s"} disponible${availableSpins === 1 ? "" : "s"}`;
  const dialogKind =
    resultAmount !== null || isLossResult
      ? "result"
      : isNoSpinsModalOpen
        ? "no-spins"
        : null;
  const dismissDialog = dialogKind === "result" ? onDismissResult : onDismissNoSpins;
  const actionDescription = !hasAvailableSpins
    ? "Afficher les conditions pour obtenir un tour"
    : isClaiming
      ? "Le serveur confirme le résultat"
      : isSpinning
        ? "Tirage en cours"
        : `Lancer le tirage, ${availableSpins} tour${availableSpins === 1 ? "" : "s"} disponible${availableSpins === 1 ? "" : "s"}`;

  useEffect(() => {
    if (!isSpinning || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveTileIndex(null);
      return;
    }

    let nextIndex = 0;
    setActiveTileIndex(nextIndex);
    const interval = window.setInterval(() => {
      nextIndex = (nextIndex + 1) % TILES.length;
      setActiveTileIndex(nextIndex);
    }, 110);

    return () => window.clearInterval(interval);
  }, [isSpinning]);

  useEffect(() => {
    if (!dialogKind) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      document.getElementById("fortune-wheel-dialog-close")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissDialog();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dialogKind, dismissDialog]);

  return (
    <main className={`fortune-redesign${isSpinning ? " is-spinning" : ""}${isClaiming ? " is-claiming" : ""}`}>
      <div className="fortune-redesign__shell">
        <header className="fortune-redesign__intro">
          <Link href="/" className="fortune-redesign__back" aria-label="Retour à l’accueil">
            <ChevronLeft aria-hidden="true" />
            <span>Retour</span>
          </Link>
        </header>

        <section className="fortune-redesign__hero" aria-labelledby="fortune-title">
          <h1 id="fortune-title">Happy Lucky wheel</h1>
        </section>

        <section className="fortune-redesign__game" aria-label="Jeu de tirage">
          <div className="fortune-redesign__game-heading">
            <span className="fortune-redesign__game-kicker">Diverse Gifts, 100% Winning</span>
          </div>
          <div className="fortune-redesign__machine">
            <div className="fortune-redesign__machine-rim">
              <div className="fortune-redesign__tiles" role="list" aria-label="Grille des numéros, de 9 à 1">
                {TILES.map((tile, position) => {
                  const prizeIndex = position;
                  const amount = labels[prizeIndex];
                  const isTileActive = isSpinning
                    ? activeTileIndex === position
                    : selectedTileIndex === prizeIndex;
                  return (
                    <div
                      className={`fortune-redesign__tile${isTileActive ? " is-selected" : ""}${isTileActive && isSpinning ? " is-drawing" : ""}`}
                      key={tile.number}
                      role="listitem"
                    >
                      <span className="fortune-redesign__number-art">
                        <img src={tile.image} alt={`Numéro ${tile.number}`} />
                      </span>
                      <span className="fortune-redesign__tile-value">{formatPrize(amount ?? 0)} FCFA</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="fortune-redesign__draw-wrap">
            <button
              className="fortune-redesign__go"
              type="button"
              onClick={onPlay}
              disabled={actionDisabled}
              aria-label={actionDescription}
              aria-busy={isSpinning || isClaiming}
            >
              <img src={drawButton} alt="" aria-hidden="true" />
            </button>
            <div className="fortune-redesign__status-wrap" aria-live="polite" role="status">
              <p className="fortune-redesign__status">
                <Ticket aria-hidden="true" />
                <span>{statusMessage}</span>
              </p>
              {resultAmount !== null && !isLossResult ? (
                <p className="fortune-redesign__result">Crédité au solde de retrait : <strong>{formatPrize(resultAmount)} FCFA</strong></p>
              ) : null}
              {isLossResult ? <p className="fortune-redesign__result">Résultat confirmé : aucun gain crédité sur ce tour.</p> : null}
            </div>
          </div>
          {errorMessage && <p className="fortune-redesign__error" role="alert">{errorMessage}</p>}
        </section>

        <section className="fortune-redesign__summary" aria-label="Résumé des gains">
          {isStatsLoading ? (
            <p className="fortune-redesign__summary-note" role="status">Chargement de votre bilan…</p>
          ) : isStatsError ? (
            <p className="fortune-redesign__summary-note" role="alert">Votre bilan est momentanément indisponible.</p>
          ) : totalWinnings !== undefined && totalWins !== undefined ? (
            <>
              <div className="fortune-redesign__stat">
                <span>Montant du gain</span>
                <strong>{formatPrize(totalWinnings)} <small>FCFA</small></strong>
              </div>
              <div className="fortune-redesign__stat">
                <span>Nombre de tirages au sort chanceux</span>
                <strong>{totalWins}</strong>
              </div>
            </>
          ) : (
            <p className="fortune-redesign__summary-note">Vos gains et tirages confirmés apparaîtront ici.</p>
          )}
        </section>

        <section className="fortune-redesign__rules" aria-labelledby="fortune-rules-title">
          <h2 id="fortune-rules-title">Spécifications des règles du jeu</h2>
          <p className="fortune-redesign__rules-subtitle">Règlement du tirage au sort</p>
          <ul className="fortune-redesign__rules-list">
            <li>Règle 1 : Tout achat d’un produit donne droit à une participation au tirage au sort.</li>
            <li>Règle 2 : Chaque invitation adressée à un membre valide donne droit à une participation au tirage au sort.</li>
          </ul>
        </section>

        <section className="fortune-redesign__records" aria-labelledby="fortune-records-title">
          <h2 id="fortune-records-title">Bilan des tirages</h2>
          <p>Derniers records de victoire</p>
          <div className="fortune-redesign__records-table-wrap">
            <table className="fortune-redesign__records-table">
              <thead>
                <tr><th>Temps</th><th>Utilisateur</th><th>prix</th></tr>
              </thead>
              <tbody>
                {recentWins.length ? recentWins.map((win) => (
                  <tr key={win.id}>
                    <td>{formatRecordDate(win.createdAt)}</td>
                    <td>{userPhoneLabel}</td>
                    <td>{formatPrize(win.amount)} FCFA</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="fortune-redesign__records-empty">Aucun gain enregistré pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <Link
        href="/fortune-wheel/history"
        className="fortune-redesign__floating-history"
        aria-label="Enregistrement : ouvrir la page Mes gains"
      >
        <span>Enregistrement</span>
        <ChevronRight aria-hidden="true" />
      </Link>
      {dialogKind && (
        <div className="fortune-wheel-modal-backdrop">
          <section
            className="fortune-wheel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fortune-wheel-dialog-title"
            aria-describedby="fortune-wheel-dialog-description"
          >
            <div className="fortune-wheel-modal__content">
              <p className="fortune-redesign__eyebrow">{dialogKind === "result" ? "RÉSULTAT DU TIRAGE" : "VOS TOURS"}</p>
              <h2 id="fortune-wheel-dialog-title">
                {dialogKind === "result" ? isLossResult ? "Aucun gain cette fois" : "Gain confirmé" : "Aucun tour disponible"}
              </h2>
              {dialogKind === "result" ? (
                <>
                  <p id="fortune-wheel-dialog-description" className="fortune-wheel-modal__message">
                    {resultMessage || (isLossResult ? "Aucun gain sur ce tour." : `Vous avez gagné ${formatPrize(resultAmount ?? 0)} FCFA.`)}
                  </p>
                  <p className="fortune-wheel-modal__detail">
                    {isLossResult ? "Le résultat a été confirmé par le serveur. Aucun montant n’a été crédité." : `${formatPrize(resultAmount ?? 0)} FCFA ont été crédités sur votre solde de retrait.`}
                  </p>
                </>
              ) : (
                <>
                  <p id="fortune-wheel-dialog-description" className="fortune-wheel-modal__message">Aucun tour disponible pour le moment.</p>
                  <p className="fortune-wheel-modal__detail">Règle 1 : Tout achat d’un produit donne droit à une participation au tirage au sort.</p>
                  <p className="fortune-wheel-modal__detail">Règle 2 : Chaque invitation adressée à un membre valide donne droit à une participation au tirage au sort.</p>
                </>
              )}
            </div>
            <div className="fortune-wheel-modal__footer">
              <button id="fortune-wheel-dialog-close" type="button" onClick={dismissDialog} autoFocus>Compris</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
