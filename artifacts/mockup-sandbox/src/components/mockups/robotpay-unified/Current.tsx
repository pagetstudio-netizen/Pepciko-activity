import "./_group.css";
import { useState } from "react";
import { ChevronRight, Phone } from "lucide-react";

const operators = [
  { id: "yas", name: "YAS", kind: "Paiement automatique" },
  { id: "moov", name: "Moov Money", kind: "Paiement par numéro" },
];

export function Current() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<(typeof operators)[number] | null>(null);

  return (
    <main className="min-h-screen bg-[#4b91ef] p-3 font-sans sm:p-6">
      <div className="mx-auto max-w-xl">
        <div className="px-5 pb-6 pt-4 text-white">
          <p className="text-xl">Montant :</p>
          <p className="text-4xl font-bold">
            3 000 <span className="text-2xl font-normal">FCFA</span>
          </p>
        </div>
        {step === 0 ? (
          <div className="space-y-5">
            <p className="px-1 text-xl text-white">Sélectionnez le mode de paiement :</p>
            <div className="space-y-3">
              {operators.map((operator) => (
                <button
                  key={operator.id}
                  onClick={() => {
                    setSelected(operator);
                    setStep(1);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border-2 border-gray-100 bg-white px-4 py-4 text-left shadow-sm"
                >
                  <span>
                    <span className="block text-lg font-semibold text-[#14538a]">{operator.name}</span>
                    <span className="block text-xs text-gray-500">{operator.kind}</span>
                  </span>
                  <ChevronRight className="text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <section className="space-y-5 rounded-xl bg-white p-5 shadow-xl sm:p-8">
            <div className="bg-[#ffe0a0] px-3 py-2 text-sm leading-tight text-[#e65b28]">
              Veuillez sélectionner la même option que votre méthode de transfert.
            </div>
            {selected?.id === "moov" && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-xs text-gray-500">Numéro de paiement</p>
                <p className="mt-1 font-mono text-lg font-bold text-[#008f20]">+228 90 00 00 00</p>
                <p className="mt-2 text-xs text-gray-600">Nom du bénéficiaire : Compte de paiement</p>
              </div>
            )}
            <label className="block text-sm font-semibold">Veuillez entrer votre numéro de téléphone :</label>
            <div className="flex items-center rounded-lg border border-gray-300 px-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="shrink-0 border-r border-gray-200 pr-2 text-gray-600">+228</span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Numéro de téléphone"
                className="w-full px-3 py-3 outline-none"
              />
            </div>
            <p className="text-sm font-semibold">Choisissez la méthode de transfert</p>
            <div className="flex items-center gap-2 text-gray-700">
              <span className="h-4 w-4 rounded-full border-[4px] border-[#1686e8] ring-1 ring-[#1686e8]" />
              <span>{selected?.name}</span>
            </div>
            {selected?.id === "moov" && (
              <textarea
                rows={3}
                placeholder="Référence ou message de confirmation reçu"
                className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none"
              />
            )}
            <div className="flex items-center justify-center gap-5 pt-3">
              <button
                onClick={() => setStep(0)}
                className="w-[43%] rounded-md bg-[#78b9df] py-3 font-semibold text-white shadow-sm"
              >
                &lt; Retour
              </button>
              <button className="w-[43%] rounded-md bg-[#078ee8] py-3 font-semibold text-white shadow-sm">
                Suivant &gt;
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
