import "./_group.css";
import { CircleUserRound, ClipboardList, Send } from "lucide-react";

export function ReferenceMatch() {
  return (
    <main className="deposit-preview deposit-target">
      <style>{`
        .deposit-target { min-height:100dvh; color:#292929; background:#fff; font-family:Arial,"Segoe UI",sans-serif; }
        .dr-screen { width:100%; max-width:512px; min-height:100dvh; margin:0 auto; padding-bottom:110px; background:#fff; }
        .dr-header { position:relative; height:60px; display:grid; place-items:center; font-size:20px; font-weight:700; }
        .dr-back { position:absolute; top:10px; left:12px; width:40px; height:40px; display:grid; place-items:center; border:0; background:transparent; font-size:28px; color:#292929; }
        .dr-content { margin:82px 20px 0; }
        .dr-label,.dr-quick-title { margin:0; color:#333; font-size:20px; font-weight:400; line-height:1.25; }
        .dr-input { height:53px; display:flex; align-items:center; margin-top:26px; border:1px solid #dedede; border-radius:6px; background:#fafafa; }
        .dr-prefix { padding:0 8px 0 16px; font-size:14px; font-weight:700; }
        .dr-input input { width:100%; height:100%; min-width:0; border:0; outline:0; padding:0 12px; background:transparent; font:17px Arial,sans-serif; }
        .dr-input input::placeholder { color:#777; }
        .dr-quick-title { margin:19px 0 20px; }
        .dr-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); justify-items:center; gap:14px 12px; }
        .dr-amount { width:100%; max-width:102px; aspect-ratio:1; border:1px solid #dedede; border-radius:50%; background:#fff; color:#858585; font:18px Arial,sans-serif; }
        .dr-amount:first-child { border-color:#f0d59b; background:#fffaf1; color:#dfa32d; }
        .dr-country { margin-top:64px; }
        .dr-country label { display:block; margin-bottom:12px; color:#294657; font-size:18px; }
        .dr-country select { width:100%; height:52px; padding:0 14px; border:1px solid #e2e2e2; border-radius:8px; background:#fff; color:#333; font:16px Arial,sans-serif; }
        .dr-notes { margin-top:28px; padding:17px 14px 15px; border:1px solid #f0f0f0; border-radius:8px; color:#34495a; }
        .dr-notes h2 { margin:0 0 18px; padding-left:13px; border-left:5px solid #e8d9a5; color:#414141; font-size:20px; }
        .dr-notes p { margin:0 0 17px; font-size:16px; line-height:1.55; }
        .dr-footer { position:fixed; z-index:20; bottom:0; left:50%; width:min(100%,512px); padding:18px 20px 20px; transform:translateX(-50%); background:#fff; box-shadow:0 -7px 20px rgba(0,0,0,.055); }
        .dr-footer button { width:100%; height:59px; border:0; border-radius:999px; background:#ed2055; color:#fff; font-size:19px; font-weight:700; }
        .dr-tools { position:fixed; z-index:30; top:40%; right:0; display:grid; gap:6px; }
        .dr-tools button { width:48px; height:48px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.8); border-radius:50%; background:#ec2054; color:#fff; box-shadow:0 2px 5px #9d2c4c55; }
        @media(max-width:380px) { .dr-content{margin-right:16px;margin-left:16px}.dr-grid{gap:12px 8px}.dr-amount{font-size:15px}.dr-footer{padding-right:16px;padding-left:16px} }
      `}</style>
      <div className="dr-screen">
        <header className="dr-header"><button className="dr-back" aria-label="Retour">‹</button><span>recharger</span></header>
        <section className="dr-content">
          <h1 className="dr-label">Montant du dépôt</h1>
          <label className="dr-input"><span className="dr-prefix">FCFA</span><input placeholder="Saisissez le montant du dépôt" /></label>
          <h2 className="dr-quick-title">Montant rapide</h2>
          <div className="dr-grid">
            {[3000, 7000, 15000, 30000, 50000, 100000, 200000, 500000].map(value => (
              <button key={value} className="dr-amount">{value.toLocaleString("fr-FR")}</button>
            ))}
          </div>
          <div className="dr-country"><label>Pays du paiement</label><select><option>Sélectionnez un pays</option><option>Togo</option><option>Bénin</option></select></div>
          <section className="dr-notes">
            <h2>Remarques importantes</h2>
            <p>1. Veuillez ne pas modifier le montant du dépôt après avoir lancé le paiement.</p>
            <p>2. Effectuez chaque dépôt depuis cette page et ne sauvegardez pas vos informations de paiement.</p>
            <p>3. Le montant minimum de dépôt est de 4 000 FCFA.</p>
            <p>4. Les dépôts sont généralement traités en quelques minutes. Si le solde n’est pas crédité, contactez le service client.</p>
            <p>5. Pour un montant important, vous pouvez effectuer plusieurs dépôts plus petits.</p>
          </section>
        </section>
        <footer className="dr-footer"><button>Déposez maintenant</button></footer>
        <aside className="dr-tools" aria-label="Accès rapides">
          <button aria-label="Telegram"><Send size={24} /></button>
          <button aria-label="Tâches"><ClipboardList size={24} /></button>
          <button aria-label="Service"><CircleUserRound size={24} /></button>
        </aside>
      </div>
    </main>
  );
}
