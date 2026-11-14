import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";
import { loadTawkWidget, openTawkChat } from "@/lib/tawk-to";
import telegramIcon from "@assets/image_1794149794918.png";
import supportIcon from "@assets/image_1794149807415.png";
import rechargeIcon from "@assets/image_1794149820846.png";
import "./service-screenshot.css";

interface LinksSettings {
  supportLabel?: string;
  supportEnabled?: string | boolean;
  channelLink?: string;
  channelLabel?: string;
  channelEnabled?: string | boolean;
}

const faqs = [
  {
    prefix: "Q",
    question: "Problèmes de paiement ?",
    answer: "En cas de problème de paiement, veuillez contacter directement le service client.",
  },
  {
    prefix: "Problèmes",
    question: "de paiement avec votre commande ?",
    answer: "Pour tout problème de paiement de commande, veuillez contacter immédiatement notre service client.",
  },
];

function enabled(value?: string | boolean) {
  return value !== false && value !== "false";
}

export default function ServicePage() {
  const [, navigate] = useLocation();
  const { data: settings } = useQuery<LinksSettings>({
    queryKey: ["/api/settings/links"],
  });
  const channelLink = settings?.channelLink || "https://t.me/sybotx";
  const supportEnabled = Boolean(settings) && enabled(settings?.supportEnabled);
  const channelEnabled = enabled(settings?.channelEnabled);

  useEffect(() => {
    if (settings && supportEnabled) loadTawkWidget();
  }, [settings, supportEnabled]);

  return (
    <main className="service-client-page">
      <div className="service-client-screen">
        <header className="service-client-header">
          <button
            type="button"
            className="service-client-back"
            onClick={() => navigate("/account")}
            aria-label="Retour au compte"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <div className="service-client-heading">
            <h1>Centre d'aide</h1>
          </div>
        </header>

        <div className="service-client-content">
          <section className="service-shortcuts" aria-label="Contacts officiels">
            <a
              className={`service-shortcut${!channelEnabled ? " is-disabled" : ""}`}
              href={channelEnabled ? channelLink : undefined}
              target={channelEnabled ? "_blank" : undefined}
              rel={channelEnabled ? "noopener noreferrer" : undefined}
              aria-disabled={!channelEnabled}
            >
              <span className="service-shortcut-icon">
                <img src={telegramIcon} alt="" aria-hidden="true" />
              </span>
              <strong>Chaîne Telegram</strong>
            </a>
            <button
              type="button"
              className={`service-shortcut${!supportEnabled ? " is-disabled" : ""}`}
              onClick={openTawkChat}
              disabled={!supportEnabled}
            >
              <span className="service-shortcut-icon">
                <img src={supportIcon} alt="" aria-hidden="true" />
              </span>
              <strong>Assistance en ligne</strong>
            </button>
          </section>

          <Link className="service-report-card" href="/service/deposit-not-received" aria-label="Signaler un dépôt non reçu">
            <div className="service-report-icon">
              <img src={rechargeIcon} alt="" aria-hidden="true" />
            </div>
            <div className="service-report-copy">
              <h2>Votre dépôt n'a pas encore été reçu&nbsp;?</h2>
              <p>Après avoir débité votre compte avec succès, si le solde n'a pas été crédité sur celui-ci, veuillez le fournir ici et le personnel du service client vous aidera à résoudre ce problème&nbsp;!</p>
            </div>
          </Link>

          <a
            className="service-telegram-card"
            href={channelEnabled ? channelLink : undefined}
            target={channelEnabled ? "_blank" : undefined}
            rel={channelEnabled ? "noopener noreferrer" : undefined}
            aria-disabled={!channelEnabled}
          >
            <span className="service-telegram-icon"><img src={telegramIcon} alt="" aria-hidden="true" /></span>
            <span className="service-telegram-copy">
              <strong>Télégramme</strong>
              <span>Suivez notre chaîne Telegram officielle pour être au courant des dernières actualités et recevoir des bonus exclusifs.</span>
            </span>
          </a>

          <section className="service-help-card" aria-label="Questions fréquentes">
            <h2>Questions fréquentes</h2>
            <div className="service-faq-list">
              {faqs.map((faq) => (
                <details className="service-faq-item" key={faq.question} open>
                  <summary>
                    <span className="service-faq-prefix">{faq.prefix}</span>
                    <span>{faq.question}</span>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className="service-faq-answer">
                    <span>UN</span>
                    <p>{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
      <WithdrawalFloatingTools
        containerClassName="service-floating-tools"
        buttonClassName="service-floating-button"
      />
    </main>
  );
}
