import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import "./_group.css";

const methods = ["Togocel", "Moov Africa Togo"];

export function Current() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");

  return (
    <main className="wallet-current">
      <header className="current-header">
        <button type="button" className="flex h-full items-center gap-1 text-white">
          <ChevronLeft className="h-[22px] w-4" />
          <span className="text-sm">Dos</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-base font-normal">
          Compte de retrait
        </h1>
      </header>

      <section aria-label="Compte de retrait">
        <div className="current-field">
          <span className="current-label">Nom réel</span>
          <input aria-label="Nom réel" className="min-w-0 flex-1 bg-transparent outline-none" />
        </div>

        <button
          type="button"
          className="current-field w-full text-left"
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          <span className="current-label">Nom de la banque</span>
          <span className="current-value min-w-0 flex-1 truncate">
            {selectedMethod || "Sélectionner une banque"}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 text-gray-400" />
        </button>

        <div className="current-field">
          <span className="current-label">Compte bancaire</span>
          <input aria-label="Compte bancaire" className="min-w-0 flex-1 bg-transparent outline-none" />
        </div>
      </section>

      <button type="button" className="current-button">
        <Loader2 className="mr-2 h-4 w-4" />
        Sauvegarder
      </button>
      <p className="px-4 pt-2 text-center text-sm leading-6 text-[#333]">
        Veuillez renseigner vos véritables informations afin d’éviter tout échec de retrait.
      </p>

      {pickerOpen && (
        <div className="current-picker-overlay" role="presentation" onClick={() => setPickerOpen(false)}>
          <section
            className="current-picker-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir un opérateur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="current-picker-list" role="listbox" aria-label="Opérateurs disponibles">
              {methods.map((method) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedMethod === method}
                  key={method}
                  className="current-picker-option"
                  onClick={() => {
                    setSelectedMethod(method);
                    setPickerOpen(false);
                  }}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                    <span className="h-4 w-5 rounded-sm bg-current" />
                  </span>
                  <span className="flex-1">{method}</span>
                  {selectedMethod === method && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
