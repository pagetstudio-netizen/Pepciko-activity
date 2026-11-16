import "./_group.css";
import { useEffect, useState } from "react";
import { AlertCircle, Check, ChevronRight, Copy, X } from "lucide-react";

type PaymentOperator = {
  id: string;
  name: string;
  manual: boolean;
};

const operators: PaymentOperator[] = [
  { id: "yas", name: "YAS", manual: false },
  { id: "moov", name: "Moov Money", manual: true },
];

export function RobotPayUnified() {
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [operatorId, setOperatorId] = useState("yas");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const selectedOperator = operators.find((operator) => operator.id === operatorId)!;
  const isManual = selectedOperator.manual;
  const copy = language === "fr"
    ? {
        intro: "Veuillez remplir votre mode de paiement et le compte de paiement réel que vous utiliserez pour effectuer le paiement.",
        amount: "Montant de paiement:",
        choose: "Veuillez sélectionner un mode de paiement",
        phone: "Veuillez saisir votre compte de paiement réel",
        warning: "Veuillez remplir votre compte de paiement avec précision. Un remplissage incorrect peut entraîner la perte des fonds transférés.",
        confirm: "Confirmer",
      }
    : {
        intro: "Please enter the payment method and the real payment account you will use to make the payment.",
        amount: "Payment amount:",
        choose: "Please select a payment method",
        phone: "Enter your real payment account",
        warning: "Please enter your payment account carefully. Incorrect details may result in the loss of transferred funds.",
        confirm: "Confirm",
      };

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, []);

  async function copyPaymentAccount() {
    try {
      await navigator.clipboard.writeText("Compte de paiement configuré");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function confirmPayment() {
    if (!phone.trim() || (isManual && !reference.trim())) return;
    setSubmitted(true);
  }

  return (
    <main
      style={{ fontFamily: "Roboto, Arial, sans-serif" }}
      className="relative h-[100dvh] overflow-hidden overscroll-none bg-[#4a4a4a] px-0"
    >
      <button
        type="button"
        aria-label="Fermer le paiement"
        className="fixed right-2 top-2 z-30 flex h-[8vw] w-[8vw] min-h-8 min-w-8 max-h-10 max-w-10 items-center justify-center rounded-full border-2 border-white bg-[#777] text-white shadow-md"
      >
        <X className="h-4 w-4" strokeWidth={3} />
      </button>
      <div className="fixed right-3 top-[48%] z-20 h-[16vw] w-[16vw] max-h-20 max-w-20 -translate-y-1/2">
        <img
          src={`/__mockup/images/robotpay-language-${language}.png`}
          alt={language === "fr" ? "Français sélectionné" : "English selected"}
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          aria-label="English"
          aria-pressed={language === "en"}
          onClick={() => setLanguage("en")}
          className="absolute left-[10%] top-[15%] h-[43%] w-[45%] rounded-full"
        />
        <button
          type="button"
          aria-label="Français"
          aria-pressed={language === "fr"}
          onClick={() => setLanguage("fr")}
          className="absolute bottom-[14%] right-[8%] h-[43%] w-[45%] rounded-full"
        />
      </div>
      <section
        className="mx-auto mt-[clamp(70px,9.4dvh,92px)] w-[89%] max-w-[456px] overflow-hidden rounded-[20px] bg-white shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
        style={{ maxHeight: "calc(100dvh - clamp(82px, 10dvh, 96px))" }}
      >

        {submitted ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center px-7 py-10 text-center">
            <Check className="h-20 w-20 rounded-full bg-[#22a45a] p-4 text-white" />
            <h1 className="mt-5 text-xl font-bold text-[#343434]">Paiement en cours</h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[#666]">
              Le paiement de 3 000 FCFA est en cours de traitement.
            </p>
          </div>
        ) : (
          <div className="px-[clamp(18px,6vw,27px)] pb-[clamp(17px,3.4dvh,29px)] pt-[clamp(18px,4.2dvh,40px)]">
            <div className="flex justify-center pb-[clamp(20px,3.8dvh,36px)]">
              <img
                src="/__mockup/images/gpay-logo.png"
                alt="GPay"
                className="h-[clamp(52px,7.2dvh,64px)] w-[clamp(52px,7.2dvh,64px)] object-contain"
              />
            </div>

            <p className="pr-2 text-[clamp(13px,1.75dvh,15px)] font-normal leading-[1.45] text-[#555]">
                {copy.intro}
            </p>
            <p className="mt-[clamp(12px,2.8dvh,24px)] text-[clamp(13px,1.75dvh,15px)] font-medium text-[#555]">
              {copy.amount} <span className="font-bold text-[#d88921]">FCFA 3000</span>
            </p>

            <div className="mt-[clamp(19px,4.3dvh,39px)] pr-8">
              <p className="text-[clamp(12px,1.65dvh,14px)] font-medium leading-5 text-[#777]">{copy.choose}</p>
            </div>

            <div className="mt-[clamp(8px,1.7dvh,15px)] flex flex-wrap justify-center gap-3 pr-14">
              {operators.map((operator) => {
                const active = operator.id === operatorId;
                return (
                  <button
                    key={operator.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setOperatorId(operator.id)}
                    className={`relative flex min-h-[clamp(72px,11dvh,96px)] w-[calc(50%-0.5rem)] max-w-[180px] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2 transition-colors ${
                      active
                        ? "border-[#d4b36b] bg-[#fff7ee] shadow-[0_5px_15px_rgba(110,80,30,0.12)]"
                        : "border-[#e6e6e6] bg-white hover:border-[#d4b36b]"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f1f2] text-xs font-bold text-[#535d67]">
                      {operator.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-[#555]">{operator.name}</span>
                    {active && <Check className="absolute right-2 top-2 h-4 w-4 text-[#bd9142]" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-[clamp(18px,3dvh,27px)] flex min-h-[clamp(46px,6.2dvh,54px)] items-center overflow-hidden rounded-xl border border-[#c9c9c9] px-3 focus-within:border-[#d4a54e]">
              <span className="mr-3 shrink-0 border-r border-[#e4e4e4] pr-3 text-sm font-semibold text-[#c17b22]">
                +228
              </span>
              <input
                aria-label="Compte de paiement réel"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 8))}
                type="tel"
                inputMode="numeric"
                placeholder={copy.phone}
                className="w-full min-w-0 bg-transparent py-3 text-[clamp(12px,1.55dvh,14px)] text-[#555] outline-none placeholder:text-[#aaa]"
              />
            </div>

            {isManual && (
              <div className="mt-3 space-y-2 rounded-xl border border-[#e7d8bd] bg-[#fffaf2] p-3">
                <div>
                  <p className="text-xs text-[#8b7a61]">Bénéficiaire</p>
                  <p className="mt-1 font-semibold text-[#454545]">Titulaire du compte configuré</p>
                </div>
                <div>
                  <p className="text-xs text-[#8b7a61]">Numéro de paiement</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-[#555]">Compte configuré par l’administration</p>
                    <button
                      type="button"
                      onClick={copyPaymentAccount}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-[#d9bd8e] px-2 py-1.5 text-xs font-semibold text-[#906119]"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copié" : "Copier"}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#8b7a61]">Code USSD configuré par l’administration</p>
                <label className="block text-sm font-semibold text-[#555]">
                  Référence ou message de confirmation <span className="text-red-500">*</span>
                  <textarea
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    rows={3}
                    placeholder="Saisissez la référence reçue après le paiement..."
                    className="mt-2 w-full resize-none rounded-lg border border-[#d2d2d2] bg-white p-3 text-sm font-normal outline-none focus:border-[#d4a54e]"
                  />
                </label>
              </div>
            )}

            <div className="-mx-[clamp(18px,6vw,27px)] mt-[clamp(12px,2.2dvh,20px)] flex items-start gap-2 bg-[#fbefef] px-[clamp(18px,6vw,27px)] py-[clamp(9px,1.8dvh,14px)] text-[clamp(11px,1.4dvh,12px)] leading-[1.45] text-[#bd5e62]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d08083]" />
              <p>{copy.warning}</p>
            </div>

            <button
              type="button"
              onClick={confirmPayment}
              disabled={!phone.trim() || (isManual && !reference.trim())}
              className="mx-auto mt-[clamp(13px,2.6dvh,22px)] flex h-[clamp(48px,7dvh,58px)] w-[43.5vw] min-w-[174px] max-w-[222px] items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#f6ca6a] to-[#dc982d] px-5 font-semibold text-white shadow-[0_5px_13px_rgba(176,119,32,0.2)] transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
            >
              {copy.confirm} <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
