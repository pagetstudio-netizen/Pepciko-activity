import "./_group.css";

export function Current() {
  return (
    <main className="deposit-preview deposit-current">
      <style>{`
        .deposit-current {
          min-height: 100dvh;
          padding: 24px 0 28px;
          overflow: hidden;
          color: #f5f0e3;
          background: #111;
          font-family: Georgia, "Times New Roman", serif;
        }
        .dc-wrap { width: min(100%, 512px); margin: 0 auto; }
        .dc-summary { display:grid; grid-template-columns:34.5% 57.5%; gap:4%; margin:0 4% 26px; }
        .dc-balance { padding-top:16px; color:#d7d4d0; font-size:16px; }
        .dc-balance strong { display:block; margin-top:8px; color:#f4f0e9; font-size:20px; }
        .dc-promo { height:154px; overflow:hidden; border-radius:18px; }
        .dc-promo img { width:100%; height:100%; object-fit:cover; }
        .dc-panel { margin:0 4%; padding:26px 3%; border-radius:24px; background:#24232f; }
        .dc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px 6%; }
        .dc-amount { min-height:48px; border:0; border-radius:999px; background:#fff0c8; color:#302b24; font:16px Georgia,serif; }
        .dc-amount.selected { background:#e9c45e; }
        .dc-input { height:58px; margin-top:22px; padding:0 18px; border-radius:999px; background:#fff0c8; color:#302b24; display:flex; align-items:center; }
        .dc-country { margin-top:22px; color:#f5f0e3; }
        .dc-country select { width:100%; height:48px; margin-top:10px; border:0; border-radius:999px; padding:0 14px; }
        .dc-button { width:100%; height:58px; margin-top:28px; border:0; border-radius:999px; background:#e9c45e; color:#302b24; font:700 18px Georgia,serif; }
        .dc-notes { margin-top:26px; line-height:1.5; }
        .dc-notes h2 { font-size:19px; }
        .dc-notes p { margin:0 0 14px; font-size:15px; }
      `}</style>
      <div className="dc-wrap">
        <div className="dc-summary">
          <div className="dc-balance">Solde actuel<strong>500 FCFA</strong></div>
          <div className="dc-promo"><img src="/__mockup/images/deposit/current-promo.png" alt="" /></div>
        </div>
        <section className="dc-panel">
          <div className="dc-grid">
            {[3000, 3500, 7000, 15000, 30000, 50000, 100000, 200000, 500000].map((amount, index) => (
              <button className={`dc-amount${index === 0 ? " selected" : ""}`} key={amount}>
                {amount.toLocaleString("fr-FR")}
              </button>
            ))}
          </div>
          <div className="dc-input">FCFA&nbsp;&nbsp; Saisissez le montant du dépôt</div>
          <label className="dc-country">Pays du paiement<select><option>Sélectionnez un pays</option></select></label>
          <button className="dc-button">Recharger</button>
          <div className="dc-notes">
            <h2>Avis de dépôt.</h2>
            <p>Instructions de recharge</p>
            <p>1. Montant minimum de recharge : 4 000 FCFA.</p>
            <p>2. Le service de recharge est disponible 24h/24 et 7j/7.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
