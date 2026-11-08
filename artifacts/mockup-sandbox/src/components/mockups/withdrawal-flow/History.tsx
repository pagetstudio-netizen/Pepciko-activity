export function History() {
  return (
    <main className="withdrawal-history">
      <style>{`
        .withdrawal-history {
          min-height: 100dvh;
          background: #fff;
          color: #252528;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          position: relative;
        }
        .wh-header {
          height: 61px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #fafafa;
          font-size: 21px;
          font-weight: 700;
        }
        .wh-back {
          position: absolute;
          left: 22px;
          top: 13px;
          font-size: 32px;
          line-height: 1;
          font-weight: 300;
        }
        .wh-balance {
          text-align: center;
          padding-top: 52px;
          color: #58585b;
        }
        .wh-amount {
          color: #df245b;
          font-size: 32px;
          line-height: 1.2;
          font-weight: 500;
        }
        .wh-amount small {
          font-size: 15px; color: #bcbcc0; vertical-align: 6px; margin-right: 4px;
        }
        .wh-caption { font-size: 18px; margin-top: 5px; }
        .wh-fab-stack {
          position: fixed; right: 0; top: 39%;
          display: flex; flex-direction: column; gap: 11px;
        }
        .wh-fab {
          width: 47px; height: 47px; border-radius: 50%; background: #ed245d;
          display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.12);
        }
        .wh-fab svg { width: 26px; height: 26px; }
        @media (min-width: 700px) {
          .wh-fab-stack { right: max(0px, calc((100vw - 512px)/2)); }
        }
      `}</style>
      <header className="wh-header"><span className="wh-back">‹</span>retirer l'enregistrement</header>
      <section className="wh-balance">
        <div className="wh-amount"><small>FCFA</small>0,00</div>
        <div className="wh-caption">Solde du compte</div>
      </section>
      <div className="wh-fab-stack" aria-hidden="true">
        <span className="wh-fab"><svg viewBox="0 0 24 24" fill="none"><path d="m3 11 17-7-6 17-3-7-8-3Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/><path d="m11 14 9-10" stroke="white" strokeWidth="2"/></svg></span>
        <span className="wh-fab"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="white" strokeWidth="1.8"/><path d="M9 3h6v4H9zM8 11h8M8 15h8" stroke="white" strokeWidth="1.6"/></svg></span>
        <span className="wh-fab"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8"/><path d="M4 20c.6-4 3.3-6 8-6s7.4 2 8 6H4Z" fill="white"/></svg></span>
      </div>
    </main>
  );
}
