import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileImage,
  Headphones,
  MessageCircle,
  Paperclip,
  ShieldCheck,
  X,
} from "lucide-react";
import "./HelpCenter.css";

const asset = (name: string) => `/__mockup/images/service-client/${name}`;

const faqs = [
  {
    question: "Mon paiement n’apparaît pas. Que faire ?",
    answer:
      "Vérifiez d’abord le statut de l’opération dans votre portefeuille mobile. Si le compte a été débité, transmettez le numéro de commande et une preuve de paiement dans le formulaire de signalement.",
  },
  {
    question: "Combien de temps faut-il pour recevoir un dépôt ?",
    answer:
      "La plupart des dépôts sont crédités en quelques minutes. Selon votre opérateur, un délai supplémentaire peut être nécessaire. Gardez votre reçu jusqu’à la confirmation.",
  },
  {
    question: "Comment contacter l’assistance officielle ?",
    answer:
      "Utilisez le bouton Assistance en ligne pour joindre notre équipe, ou consultez la chaîne Telegram affichée sur cette page pour les actualités officielles.",
  },
];

export function HelpCenter() {
  const [screen, setScreen] = useState<"help" | "report">("help");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [order, setOrder] = useState("");
  const [payer, setPayer] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    setFiles((current) => [...current, ...picked].slice(0, 4));
    event.target.value = "";
  };

  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || !payer.trim() || !description.trim()) {
      setNotice("Veuillez compléter les champs obligatoires.");
      return;
    }
    setNotice("Votre signalement est prêt. Cette démonstration n’envoie aucune donnée.");
  };

  const returnToHelp = () => {
    setScreen("help");
    setNotice("");
  };

  return (
    <main className="hc-shell">
      <div className="hc-device">
        <header className="hc-topbar">
          <button className="hc-back" type="button" onClick={screen === "report" ? returnToHelp : () => setNotice("Retour au compte")} aria-label="Retour">
            <ArrowLeft size={21} />
          </button>
          <div className="hc-brand-lockup" aria-label="PepsiCo">
            <span className="hc-pepsi-mark"><span /></span>
            <span className="hc-brand-name">PepsiCo</span>
          </div>
          <span className="hc-region">AFRIQUE DE L’OUEST</span>
        </header>

        {screen === "help" ? (
          <div className="hc-content hc-help-screen">
            <section className="hc-intro">
              <div className="hc-intro-copy">
                <span className="hc-eyebrow"><span className="hc-live-dot" /> Assistance officielle</span>
                <h1>Centre<br />d’aide<span>.</span></h1>
                <p>Une question ? Nous sommes là pour vous guider, simplement.</p>
                <div className="hc-hours"><Clock3 size={14} /> Tous les jours · 10 h – 22 h</div>
              </div>
              <img className="hc-agent-image" src={asset("support-agent.jpg")} alt="Conseillère du service client" />
              <div className="hc-agent-caption"><span>À votre écoute</span><i /></div>
            </section>

            <section className="hc-shortcuts" aria-label="Accès rapides">
              <button className="hc-shortcut hc-shortcut-telegram" type="button" onClick={() => setNotice("Chaîne Telegram officielle — lien de démonstration.")}>
                <img src={asset("telegram.png")} alt="" />
                <span><strong>Chaîne Telegram</strong><small>Infos & actualités</small></span>
                <ArrowRight size={17} />
              </button>
              <button className="hc-shortcut hc-shortcut-support" type="button" onClick={() => setContactOpen(true)}>
                <img src={asset("support-icon.png")} alt="" />
                <span><strong>Assistance en ligne</strong><small>Parler à un conseiller</small></span>
                <ArrowRight size={17} />
              </button>
            </section>

            <button className="hc-deposit-card" type="button" onClick={() => { setScreen("report"); setNotice(""); }}>
              <span className="hc-deposit-art"><img src={asset("recharge.png")} alt="" /></span>
              <span className="hc-deposit-copy">
                <span className="hc-card-kicker">Besoin d’aide avec un dépôt ?</span>
                <strong>Votre dépôt n’est pas encore reçu&nbsp;?</strong>
                <span>Signalez-le en quelques étapes. Notre équipe vous accompagnera.</span>
                <span className="hc-inline-link">Signaler un dépôt <ArrowRight size={15} /></span>
              </span>
              <ChevronRight className="hc-deposit-chevron" size={19} />
            </button>

            <button className="hc-telegram-card" type="button" onClick={() => setNotice("Chaîne Telegram officielle — lien de démonstration.")}>
              <img className="hc-telegram-art" src={asset("telegram.png")} alt="" />
              <span className="hc-telegram-copy">
                <span className="hc-card-kicker">Communauté officielle</span>
                <strong>Suivez-nous sur Telegram</strong>
                <span>Retrouvez nos actualités et les informations utiles pour votre compte.</span>
              </span>
              <ExternalLink size={16} />
            </button>

            <section className="hc-faq-section">
              <div className="hc-section-heading">
                <div><span className="hc-card-kicker">Réponses rapides</span><h2>Questions fréquentes</h2></div>
                <span className="hc-faq-count">0{faqs.length}</span>
              </div>
              <div className="hc-faq-list">
                {faqs.map((faq, index) => {
                  const expanded = openFaq === index;
                  return (
                    <article className={`hc-faq-item${expanded ? " is-open" : ""}`} key={faq.question}>
                      <button type="button" className="hc-faq-question" aria-expanded={expanded} onClick={() => setOpenFaq(expanded ? null : index)}>
                        <span className="hc-faq-index">0{index + 1}</span>
                        <span>{faq.question}</span>
                        <ChevronDown size={18} />
                      </button>
                      {expanded && <p className="hc-faq-answer">{faq.answer}</p>}
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="hc-trust-note"><ShieldCheck size={17} /><span>Ne partagez jamais votre code secret ou votre mot de passe.</span></div>
            <footer className="hc-footer">PepsiCo · Assistance clientèle <span>WA</span></footer>
          </div>
        ) : (
          <div className="hc-content hc-report-screen">
            <button type="button" className="hc-return-link" onClick={returnToHelp}><ArrowDownLeft size={16} /> Centre d’aide</button>
            <div className="hc-form-heading">
              <span className="hc-form-icon"><img src={asset("recharge.png")} alt="" /></span>
              <div><span className="hc-eyebrow">Nous allons vous aider</span><h1>Dépôt non reçu</h1></div>
            </div>
            <p className="hc-form-intro">Indiquez les détails du dépôt concerné. Ces informations restent dans cette démonstration.</p>
            <form className="hc-report-form" onSubmit={submitReport}>
              <label className="hc-field">
                <span>Commande de recharge <b>*</b></span>
                <span className="hc-select-wrap">
                  <select value={order} onChange={(event) => setOrder(event.target.value)} required>
                    <option value="">Sélectionner une commande</option>
                    <option value="PC-240618-0872">PC-240618-0872 · 5 000 XOF</option>
                    <option value="PC-240617-1924">PC-240617-1924 · 10 000 XOF</option>
                    <option value="PC-240615-0431">PC-240615-0431 · 2 500 XOF</option>
                  </select>
                  <ChevronDown size={17} />
                </span>
              </label>
              <label className="hc-field">
                <span>Nom du payeur <b>*</b></span>
                <input value={payer} onChange={(event) => setPayer(event.target.value)} placeholder="Nom indiqué sur le paiement" required />
              </label>
              <label className="hc-field">
                <span>Description <b>*</b></span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Décrivez brièvement ce qui s’est passé…" rows={4} required />
              </label>
              <div className="hc-field">
                <span>Preuve de paiement <small>Facultatif · 4 fichiers maximum</small></span>
                <input ref={fileInput} className="hc-file-input" type="file" accept="image/*" multiple onChange={chooseFiles} />
                <button className="hc-upload-box" type="button" onClick={() => fileInput.current?.click()}>
                  <span className="hc-upload-icon"><Paperclip size={20} /></span>
                  <span><strong>Ajouter une photo</strong><small>JPG ou PNG · appuyez pour parcourir</small></span>
                  <FileImage size={18} className="hc-upload-side-icon" />
                </button>
                {files.length > 0 && <div className="hc-file-preview">
                  {files.map((file, index) => <div className="hc-file-chip" key={`${file.name}-${index}`}><FileImage size={15} /><span>{file.name}</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X size={14} /></button></div>)}
                </div>}
              </div>
              <div className="hc-form-security"><ShieldCheck size={16} /><span>Vos données sont utilisées uniquement pour traiter ce signalement.</span></div>
              <button className="hc-submit" type="submit">Envoyer le signalement <ArrowRight size={17} /></button>
              {notice && <div className={`hc-form-notice${notice.includes("prêt") ? " is-success" : ""}`} role="status">{notice.includes("prêt") && <Check size={16} />}{notice}</div>}
            </form>
            <button className="hc-contact-inline" type="button" onClick={() => setContactOpen(true)}><Headphones size={17} /> Besoin d’aide maintenant ? <strong>Contacter l’assistance</strong></button>
          </div>
        )}

        {notice && screen === "help" && <div className="hc-toast" role="status"><Check size={16} />{notice}<button type="button" aria-label="Fermer" onClick={() => setNotice("")}><X size={15} /></button></div>}

        {contactOpen && <div className="hc-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setContactOpen(false); }}>
          <section className="hc-contact-modal" role="dialog" aria-modal="true" aria-labelledby="hc-contact-title">
            <button className="hc-modal-close" type="button" aria-label="Fermer" onClick={() => setContactOpen(false)}><X size={19} /></button>
            <img src={asset("support-icon.png")} alt="" />
            <span className="hc-eyebrow">Assistance officielle</span>
            <h2 id="hc-contact-title">Comment pouvons-nous vous aider&nbsp;?</h2>
            <p>Notre équipe est disponible tous les jours de 10 h à 22 h. Choisissez le canal qui vous convient.</p>
            <button type="button" className="hc-modal-action" onClick={() => { setContactOpen(false); setNotice("Demande d’assistance — lien de démonstration."); }}><MessageCircle size={17} /> Ouvrir l’assistance <ArrowRight size={16} /></button>
            <div className="hc-modal-foot"><ShieldCheck size={15} /> N’envoyez jamais votre code secret.</div>
          </section>
        </div>}
      </div>
    </main>
  );
}
