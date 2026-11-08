export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-[#fff7f8] px-5 pb-28 pt-12">
      <section className="mx-auto flex min-h-[240px] max-w-[480px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
        <span className="mb-4 h-1.5 w-14 rounded-full bg-[#ed1f5b]" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-[#ed1f5b]">{title}</h1>
        <p className="mt-3 text-base text-[#777777]">Cette rubrique sera bientôt disponible.</p>
      </section>
    </main>
  );
}
