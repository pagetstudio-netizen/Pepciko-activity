import { useState } from "react";
import { ClipboardList, CircleUserRound, Send } from "lucide-react";
import "./_group.css";

const img = (asset: string) => `/__mockup/pepsico-home/${asset}`;
const formatFcfa = (amount: number) => `${amount.toLocaleString("fr-FR")} FCFA`;

export function Current() {
  const [copied, setCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"stable" | "activity">("stable");
  const referral = "https://pep.beveragebrands1.com/register?code=PEP854C5";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referral);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(true);
    }
  };

  return (
    <main className="pepsico-preview">
      <style>{`
        .pepsico-preview { padding:26px 0 24px; }
        .pp-shell { width:100%; max-width:512px; margin:0 auto; padding:0 17px; }
        .pp-banner { display:block; width:100%; aspect-ratio:796 / 326; object-fit:cover; border-radius:10px; }
        .pp-balances { display:grid; grid-template-columns:1fr 1.15fr 1fr; gap:4px; margin:13px 0 39px; color:#fff; text-align:center; }
        .pp-balance-label { display:block; font-size:14px; line-height:1.25; white-space:nowrap; }
        .pp-balance-value { display:block; margin-top:5px; font-size:20px; font-weight:700; line-height:1; white-space:nowrap; }
        .pp-actions { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:center; min-height:110px; padding:12px 8px 9px; border-radius:10px; background:#f9d7d8; }
        .pp-action { display:flex; min-width:0; min-height:82px; flex-direction:column; align-items:center; gap:5px; border:0; padding:0 2px; background:transparent; color:#171316; cursor:pointer; }
        .pp-action img { width:52px; height:52px; object-fit:contain; }
        .pp-action span { max-width:100%; overflow:hidden; font-size:13px; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
        .pp-stack { display:grid; gap:12px; margin-top:21px; }
        .pp-card { position:relative; min-width:0; overflow:hidden; border-radius:10px; padding:18px 17px; background:#f9d5d3; color:#242023; }
        .pp-card h2 { position:relative; z-index:1; max-width:90%; margin:0 0 14px; font-size:19px; font-weight:700; line-height:1.35; }
        .pp-card p { position:relative; z-index:1; max-width:88%; margin:0; color:#595255; font-size:15px; line-height:1.5; }
        .pp-team { min-height:160px; padding-top:17px; }
        .pp-team h2 { margin-bottom:9px; }
        .pp-team .pp-url { max-width:78%; font-size:14px; line-height:1.35; }
        .pp-team .pp-art { right:2px; width:45%; height:120px; max-height:none; object-fit:contain; }
        .pp-url { overflow-wrap:anywhere; }
        .pp-art { position:absolute; z-index:0; top:50%; right:2px; width:38%; max-height:132px; height:auto; transform:translateY(-50%); object-fit:contain; }
        .pp-controls { position:relative; z-index:2; display:flex; gap:11px; margin-top:13px; }
        .pp-pill { display:inline-flex; min-width:100px; height:31px; align-items:center; justify-content:center; gap:13px; border:0; border-radius:20px; padding:0 14px; background:#ec2054; color:white; font-size:16px; line-height:1; cursor:pointer; }
        .pp-pill:active,.pp-action:active { transform:scale(.97); }
        .pp-daily { min-height:208px; height:auto; overflow:hidden; padding:14px 17px; }
        .pp-daily h2 { max-width:90%; margin-bottom:12px; }
        .pp-daily p { max-width:78%; }
        .pp-daily .pp-controls { position:relative; left:auto; bottom:auto; margin:12px 0 0; }
        .pp-daily .pp-art { top:54%; right:2px; left:auto; width:42%; height:auto; max-height:150px; object-fit:contain; }
        .pp-lottery { min-height:157px; padding-top:18px; }
        .pp-lottery h2 { margin-bottom:4px; }
        .pp-lottery p { max-width:69%; }
        .pp-lottery .pp-art { right:-3px; width:48%; height:154px; max-height:none; object-fit:contain; }
        .pp-tasks { min-height:156px; }
        .pp-tasks h2 { max-width:100%; margin-bottom:15px; }
        .pp-tasks p { max-width:67%; }
        .pp-tasks .pp-art { right:0; width:45%; max-height:100px; }
        .pp-amount { color:#e51e35; font-size:20px; font-weight:700; }
        .pp-commission { min-height:200px; margin-top:1px; padding-top:30px; }
        .pp-commission h2 { max-width:100%; margin:0 0 16px; font-size:17px; line-height:1.45; }
        .pp-commission p { max-width:100%; margin-top:8px; }
        .pp-category { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:24px; }
        .pp-category button { min-height:54px; border:0; border-radius:24px; background:#ffca16; color:#211b15; font-size:14px; font-weight:700; cursor:pointer; }
        .pp-category button[aria-pressed="true"] { box-shadow:inset 0 0 0 2px #e91e59; }
        .pp-catalog { display:grid; gap:10px; margin-top:14px; }
        .pp-catalog-card { display:flex; align-items:center; justify-content:space-between; border-radius:10px; padding:14px; background:#f9d7d8; }
        .pp-catalog-card small { display:block; margin-top:4px; color:#6d6265; }
        .pp-catalog-card button { border:0; border-radius:20px; padding:8px 13px; background:#e91e59; color:white; cursor:pointer; }
        .pp-floats { position:fixed; z-index:4; top:42%; right:max(calc((100vw - 512px)/2),0px); display:grid; gap:6px; transform:translateY(-50%); }
        .pp-float { display:grid; width:42px; height:42px; place-items:center; border:1px solid #fff; border-radius:50%; padding:4px; background:#ec2054; box-shadow:0 2px 5px #9d2c4c55; cursor:pointer; }
        .pp-float img { width:100%; height:100%; object-fit:contain; }
        .pp-float span { color:white; font-size:22px; }
        @media(max-width:390px) { .pp-shell { padding:0 14px; } .pp-balance-label { font-size:12px; } .pp-balance-value { font-size:17px; } .pp-card { padding-left:15px; } }
      `}</style>
      <div className="pp-shell">
        <img className="pp-banner" src={img("pepsico-banner.png")} alt="PepsiCo et pep+" />
        <section className="pp-balances" aria-label="Soldes">
          <div><span className="pp-balance-label">Recharger le solde</span><strong className="pp-balance-value">{formatFcfa(184500)}</strong></div>
          <div><span className="pp-balance-label">Revenu du produit</span><strong className="pp-balance-value">{formatFcfa(28750)}</strong></div>
          <div><span className="pp-balance-label">Solde de retrait</span><strong className="pp-balance-value">{formatFcfa(12400)}</strong></div>
        </section>
        <section className="pp-actions" aria-label="Actions rapides">
          {[
            ["Recharger", "recharge.png"],
            ["Retirer", "withdraw.png"],
            ["Mon équipe", "team.png"],
            ["Télégramme", "telegram.png"],
          ].map(([label, icon]) => (
            <button className="pp-action" key={label} type="button" onClick={() => label === "Mon équipe" && document.getElementById("pp-team")?.scrollIntoView({ behavior: "smooth" })}>
              <img src={img(icon)} alt="" /><span>{label}</span>
            </button>
          ))}
        </section>
        <section className="pp-stack">
          <article className="pp-card pp-team" id="pp-team">
            <img className="pp-art" src={img("team-illustration.png")} alt="" />
            <h2>Mon équipe</h2><p className="pp-url">{referral}</p>
            <div className="pp-controls"><button className="pp-pill" type="button" onClick={() => void copyLink()}>{copied ? "Copié" : "Copie"}</button><button className="pp-pill" type="button" onClick={() => document.querySelector(".pp-category")?.scrollIntoView({ behavior: "smooth" })}>Aller à <span>⟶</span></button></div>
          </article>
          <article className="pp-card pp-daily">
            <img className="pp-art" src={img("calendar-illustration.png")} alt="" />
            <h2>Connectez-vous pour recevoir des récompenses</h2><p>Connectez-vous chaque jour pour découvrir les récompenses disponibles.</p>
            <div className="pp-controls"><button className="pp-pill" type="button">Connectez-vous</button></div>
          </article>
          <article className="pp-card pp-lottery">
            <img className="pp-art" src={img("wheel-illustration.png")} alt="" />
            <h2>Tirage au sort</h2><p>La roue de la chance continue de tourner avec de magnifiques cadeaux.</p>
            <div className="pp-controls"><button className="pp-pill" type="button">Aller à <span>⟶</span></button></div>
          </article>
          <article className="pp-card pp-tasks">
            <img className="pp-art" src={img("task-illustration.png")} alt="" />
            <h2>Récompenses pour les tâches</h2><p>Consultez les tâches disponibles pour découvrir les récompenses.</p>
            <div className="pp-controls"><button className="pp-pill" type="button">Aller à <span>⟶</span></button></div>
          </article>
          <article className="pp-card pp-commission">
            <h2>Si vous invitez un ami et qu’il active avec succès son compte, vous recevrez une commission !</h2>
            <p>Taux de commission (niveau 1) : —</p><p>Taux de commission (niveau 2) : —</p><p>Taux de commission (niveau 3) : —</p>
          </article>
        </section>
        <div className="pp-category" role="group" aria-label="Catégories de produits">
          <button type="button" aria-pressed={activeCategory === "stable"} onClick={() => setActiveCategory("stable")}>Produits stable</button>
          <button type="button" aria-pressed={activeCategory === "activity"} onClick={() => setActiveCategory("activity")}>Produits d’activité</button>
        </div>
        <section className="pp-catalog" aria-label="Catalogue produit">
          <article className="pp-catalog-card"><div><strong>{activeCategory === "stable" ? "Catalogue stable" : "Catalogue d’activité"}</strong><small>Les offres actives restent disponibles dans l’application.</small></div><button type="button">Voir</button></article>
        </section>
      </div>
      <aside className="pp-floats" aria-label="Raccourcis flottants">
        <button className="pp-float" aria-label="Telegram" type="button"><Send color="white" size={22} strokeWidth={2.5} aria-hidden="true" /></button>
        <button className="pp-float" aria-label="Tâches" type="button"><ClipboardList color="white" size={22} aria-hidden="true" /></button>
        <button className="pp-float" aria-label="Support" type="button"><CircleUserRound color="white" size={22} aria-hidden="true" /></button>
      </aside>
    </main>
  );
}
