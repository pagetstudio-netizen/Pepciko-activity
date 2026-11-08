import { ArrowLeft, HelpCircle, Users } from "lucide-react";
import "./_group.css";

const tasks = [
  { id: 1, description: "Inviter 3 personnes à investir", reward: 500, current: 0, required: 3, status: "Reçu" },
  { id: 2, description: "Inviter 5 personnes à investir", reward: 1200, current: 0, required: 5, status: "Reçu" },
  { id: 3, description: "Inviter 10 personnes à investir", reward: 2500, current: 0, required: 10, status: "Reçu" },
];

export function Current() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[432px] flex-col bg-gray-100 text-gray-900">
      <div className="flex-1 overflow-y-auto pb-24">
        <header
          className="relative px-4 pb-6 pt-4"
          style={{ background: "linear-gradient(180deg, #fff1c9 0%, #eef2fa 100%)" }}
        >
          <button type="button" className="mb-3 grid h-8 w-8 place-items-center" aria-label="Retour">
            <ArrowLeft className="h-6 w-6 text-gray-700" />
          </button>
          <h1 className="mb-4 text-xl font-bold">Recevoir</h1>
          <section className="relative overflow-hidden rounded-2xl bg-[#0b1733]">
            <img
              src="/__mockup/images/pepsico-logo-rewards-current.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <div className="relative z-10 flex items-center justify-between px-5 py-5">
              <div>
                <p className="text-sm text-white/80">FCFA</p>
                <p className="text-3xl font-black text-white">0</p>
                <p className="mt-1 text-xs text-white/70">Remplissez ces tâches pour obtenir 4 200 FCFA</p>
              </div>
              <HelpCircle className="h-6 w-6 text-white/60" />
            </div>
          </section>
        </header>

        <section className="mt-2 px-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-[#ffde00]" />
            <h2 className="text-base font-bold">Liste des tâches</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {tasks.map((task, index) => (
              <article
                key={task.id}
                className={`flex items-center gap-3 px-4 py-4 ${index < tasks.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf4e6]">
                  <Users className="h-5 w-5 text-[#367c2b]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">{task.description}</span>
                  <span className="mt-0.5 block text-xs text-gray-400">Récompense : {task.reward.toLocaleString("fr-FR")} FCFA</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500">({task.current}/{task.required})</span>
                <span className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400">{task.status}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
