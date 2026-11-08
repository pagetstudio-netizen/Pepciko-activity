import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { PEPSICO_LOGO } from "@/lib/john-deere-assets";

export default function AboutPage() {
  return (
    <main className="flex h-[100dvh] min-h-[100dvh] w-full justify-center bg-white">
      <div
        className="flex h-full w-full max-w-[432px] flex-col overflow-hidden bg-white text-[#303039]"
        style={{ fontFamily: "Roboto, Arial, sans-serif" }}
      >
        <header className="relative z-10 flex h-[48px] shrink-0 items-center bg-[#23242f] px-4 text-white">
          <Link
            href="/account"
            className="flex h-full items-center gap-0.5 text-white"
            data-testid="button-back"
          >
            <ChevronLeft className="h-[22px] w-4" strokeWidth={1.8} />
            <span className="text-[14px] font-normal">Dos</span>
          </Link>
          <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[20px] font-normal leading-none">
            Profil de l&apos;entreprise
          </h1>
        </header>

        <section
          aria-label="Profil de l'entreprise"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-[8px] pb-6"
        >
          <div className="mb-6 mt-5 flex items-center gap-4 rounded-xl bg-slate-50 p-4">
            <img src={PEPSICO_LOGO} alt="Logo PepsiCo" className="h-16 w-16 rounded-lg object-contain" />
            <div>
              <h2 className="text-lg font-semibold">PepsiCo</h2>
              <p className="text-sm text-slate-600">À propos de la plateforme</p>
            </div>
          </div>

          <h2 className="mb-3 text-base font-semibold">À propos de la plateforme</h2>
          <p className="mb-6 text-[16px] leading-[1.8]">
            Cette plateforme permet à ses utilisateurs de consulter leur compte et de suivre
            les produits et opérations proposés par le service.
          </p>

          <h2 className="mb-3 text-base font-semibold">PepsiCo, Inc.</h2>
          <p className="mb-4 text-[16px] leading-[1.8]">
            PepsiCo, Inc. est une entreprise internationale du secteur des aliments et des boissons.
          </p>
          <a
            className="inline-block rounded-lg px-4 py-3 font-medium text-white"
            style={{ backgroundColor: "#477006" }}
            href="https://www.pepsico.com/about"
            target="_blank"
            rel="noreferrer"
          >
            Visiter le site officiel de PepsiCo, Inc.
          </a>
        </section>
      </div>
    </main>
  );
}
