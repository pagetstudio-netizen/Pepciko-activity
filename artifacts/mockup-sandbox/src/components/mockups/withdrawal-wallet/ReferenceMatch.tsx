import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, FileText, Smartphone, UserRound } from "lucide-react";
import "./ReferenceMatch.css";

const operators = ["Togocel", "Moov Africa Togo"];

export function ReferenceMatch() {
  const [operator, setOperator] = useState("");
  const [holder, setHolder] = useState("");
  const [number, setNumber] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [pickerOpen]);

  const saveAccount = () => {
    if (!operator || holder.trim().length < 2 || number.replace(/\D/g, "").length < 8) {
      setNotice("Vérifiez l’opérateur, le nom du titulaire et le numéro mobile.");
      return;
    }
    setSaved(true);
    setNotice("Votre compte de retrait est enregistré.");
  };

  return (
    <main className="reference-wallet">
      <header className="reference-header">
        <button className="reference-back" type="button" aria-label="Retour" onClick={() => setNotice("Retour à la page précédente.")}>
          <ChevronLeft size={23} strokeWidth={2.2} />
        </button>
        <h1>Informations sur la carte bancaire</h1>
      </header>

      <section className="reference-balance" aria-label="Solde de retrait">
        <div className="reference-balance-amount"><span>FCFA</span> 0,00</div>
        <p>Solde de retrait</p>
      </section>

      <form className="reference-form" onSubmit={(event) => { event.preventDefault(); saveAccount(); }}>
        <div className="reference-field-group" ref={pickerRef}>
          <label htmlFor="wallet-operator">Sélectionner l’opérateur</label>
          <button
            id="wallet-operator"
            type="button"
            className={`reference-control reference-select${pickerOpen ? " is-open" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <FileText aria-hidden="true" size={17} />
            <span className={operator ? "has-value" : ""}>{operator || "Veuillez sélectionner un opérateur"}</span>
            <ChevronDown className="reference-chevron" size={18} />
          </button>
          {pickerOpen && (
              <div className="reference-dropdown" role="listbox" aria-label="Opérateurs disponibles">
              <div className="reference-dropdown-heading">Veuillez sélectionner un opérateur</div>
              {operators.map((name) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={operator === name}
                  key={name}
                  className="reference-operator-option"
                  onClick={() => {
                    setOperator(name);
                    setPickerOpen(false);
                    setNotice("");
                  }}
                >
                  <span>{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="reference-field-group">
          <label htmlFor="wallet-holder">Nom du titulaire du compte</label>
          <div className="reference-control">
            <UserRound aria-hidden="true" size={19} />
            <input
              id="wallet-holder"
              autoComplete="name"
              value={holder}
              onChange={(event) => { setHolder(event.target.value); setSaved(false); }}
              placeholder="Nom du titulaire du compte"
            />
          </div>
        </div>

        <div className="reference-field-group">
          <label htmlFor="wallet-number">Numéro de téléphone</label>
          <div className="reference-control">
            <Smartphone aria-hidden="true" size={19} />
            <input
              id="wallet-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={number}
              onChange={(event) => { setNumber(event.target.value); setSaved(false); }}
              placeholder="Numéro associé à l’opérateur"
            />
          </div>
        </div>

        <aside className="reference-guidance">
          <p>1. Vous ne pouvez enregistrer qu’un seul compte de retrait.</p>
          <p>2. Le numéro doit correspondre au compte de l’opérateur sélectionné.</p>
          <p>3. Vérifiez le nom du titulaire et le numéro avant d’enregistrer.</p>
        </aside>

        {notice && <p className={`reference-notice${saved ? " is-success" : ""}`} role="status">{notice}</p>}
        <button className="reference-submit" type="submit">{saved ? "Compte enregistré" : "Ajouter un compte de retrait"}</button>
      </form>
    </main>
  );
}
