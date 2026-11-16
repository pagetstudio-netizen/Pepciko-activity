import{r as i,j as e}from"./index-ti0hz0dt.js";function d(){const[a,r]=i.useState(!0),[n,s]=i.useState(!1),[t,o]=i.useState(!1);return e.jsxs("main",{className:"withdrawal-reference",children:[e.jsx("style",{children:`
        .withdrawal-reference {
          --pink: #ed245d;
          --ink: #303033;
          --muted: #77777a;
          min-height: 100dvh;
          background: #fff;
          color: var(--ink);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          position: relative;
          overflow: hidden;
        }
        .wr-header {
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          font-size: 21px;
          font-weight: 700;
          color: #232326;
          border-bottom: 1px solid #f4f4f4;
        }
        .wr-back {
          position: absolute;
          left: 22px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 32px;
          font-weight: 300;
          line-height: 1;
        }
        .wr-content {
          padding: 78px 20px 150px;
          max-width: 660px;
          margin: 0 auto;
          color: #303033;
        }
        .wr-field { margin-bottom: 21px; }
        .wr-label { font-size: 17px; margin-bottom: 10px; }
        .wr-input {
          width: 100%;
          height: 58px;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          box-sizing: border-box;
          padding: 0 13px;
          display: flex;
          align-items: center;
          color: #858589;
          font-size: 17px;
          background: #fff;
        }
        .wr-password { justify-content: space-between; }
        .wr-eye { color: #4f5053; font-size: 19px; }
        .wr-history {
          height: 61px;
          border: 1px solid #e2e2e2;
          border-radius: 6px;
          display: flex;
          align-items: center;
          padding: 0 17px;
          gap: 10px;
          font-size: 17px;
          margin-top: 19px;
        }
        .wr-history img { width: 22px; height: 25px; object-fit: contain; }
        .wr-chevron { margin-left: auto; font-size: 28px; color: #aaa; }
        .wr-rules { margin-top: 64px; font-size: 18px; line-height: 1.54; color: #314050; }
        .wr-rules h2 {
          font-size: 21px;
          color: #39393b;
          border-left: 5px solid #ebdca8;
          padding-left: 13px;
          margin: 0 0 22px;
          line-height: 1.25;
        }
        .wr-rules p { margin: 0 0 14px; }
        .wr-submit-wrap {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: #fff;
          padding: 20px;
          box-shadow: 0 -5px 20px rgba(0,0,0,.06);
          z-index: 1;
        }
        .wr-submit {
          width: 100%;
          height: 57px;
          border: 0;
          border-radius: 32px;
          color: white;
          background: var(--pink);
          font-size: 18px;
        }
        .wr-fab-stack {
          position: fixed;
          right: 0;
          top: 39%;
          display: flex;
          flex-direction: column;
          gap: 11px;
          z-index: 4;
        }
        .wr-fab {
          width: 47px; height: 47px; border-radius: 50%;
          background: var(--pink); color: #fff; display: grid; place-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,.12);
        }
        .wr-fab svg { width: 26px; height: 26px; }
        .wr-scrim {
          position: fixed; inset: 0; background: rgba(0,0,0,.34);
          z-index: 5;
        }
        .wr-sheet {
          position: fixed; left: 0; right: 0; bottom: 0;
          z-index: 6; background: #fff; border-radius: 19px 19px 0 0;
          padding: 18px 20px 24px;
          box-sizing: border-box;
           height: 440px;
           min-height: 440px;
          box-shadow: 0 -4px 18px rgba(0,0,0,.08);
        }
        .wr-sheet-title {
          display: flex; align-items: center; gap: 5px;
          color: #649d63; font-size: 21px; font-weight: 700;
        }
        .wr-sheet-title img { width: 25px; height: 25px; }
        .wr-card-art {
          display: block; width: 142px; height: 118px; object-fit: contain;
          margin: 58px auto 13px;
        }
        .wr-sheet-copy {
          font-size: 20px; line-height: 1.22; color: #5f5f62;
          margin: 0 0 72px;
        }
        .wr-actions { display: flex; gap: 44px; align-items: center; }
        .wr-action {
          flex: 1; height: 54px; border: none; border-radius: 32px;
          font-size: 18px; font-weight: 700; color: white;
          white-space: nowrap;
        }
        .wr-cancel { background: #cecece; }
        .wr-link { background: linear-gradient(110deg,#ed245d,#f49bb1); }
        .wr-setup-card {
          margin: 38px 0 34px;
          padding: 0 1px;
          color: #5f5f62;
        }
        .wr-setup-card p { font-size: 17px; line-height: 1.45; }
        .wr-setup-field {
          border: 1px solid #dedede; border-radius: 6px; height: 52px;
          display: flex; align-items: center; padding: 0 13px; margin-top: 12px;
          font-size: 16px; color: #858589;
        }
        .wr-setup-actions { display:flex; gap:18px; margin-top:48px; }
        .wr-setup-actions .wr-action { font-size: 16px; }
        @media (min-width: 700px) {
          .wr-sheet { left: 50%; transform: translateX(-50%); width: min(100%, 512px); }
          .wr-fab-stack { right: max(0px, calc((100vw - 512px)/2)); }
        }
      `}),e.jsxs("header",{className:"wr-header",children:[e.jsx("span",{className:"wr-back",children:"‹"}),"retirer"]}),e.jsxs("section",{className:"wr-content",children:[e.jsxs("div",{className:"wr-field",children:[e.jsx("div",{className:"wr-label",children:"Montant du retrait"}),e.jsx("div",{className:"wr-input",children:"Montant compris entre 106 et 1 000 000 FCFA"})]}),e.jsxs("div",{className:"wr-field",children:[e.jsx("div",{className:"wr-label",children:"Mot de passe de transaction"}),e.jsxs("div",{className:"wr-input wr-password",children:[e.jsx("span",{children:"Mot de passe de transaction"}),e.jsx("span",{className:"wr-eye",onClick:()=>o(!t),role:"button","aria-label":"Afficher ou masquer le mot de passe",children:t?"◉":"◉̸"})]})]}),e.jsxs("div",{className:"wr-field",children:[e.jsx("div",{className:"wr-label",children:"Compte mobile money sélectionné"}),e.jsx("div",{className:"wr-input",children:"Sélectionnez un compte mobile money"})]}),e.jsxs("div",{className:"wr-history",children:[e.jsx("img",{src:"/__mockup/images/withdrawal/history-icon.png",alt:""}),e.jsx("span",{children:"Antécédents de sevrage"}),e.jsx("span",{className:"wr-chevron",children:"›"})]}),e.jsxs("section",{className:"wr-rules",children:[e.jsx("h2",{children:"Remarques importantes"}),e.jsx("p",{children:"1. Heures de retrait quotidiennes : 09:00:00 - 16:30:00"}),e.jsx("p",{children:"2. Retirez un montant compris entre 106 et 1 000 000"}),e.jsx("p",{children:"3. Afin de faciliter le règlement financier, vous ne pouvez effectuer qu'un seul retrait par jour."}),e.jsx("p",{children:"4. Taux de retrait : 5 %"})]})]}),e.jsxs("div",{className:"wr-fab-stack","aria-hidden":"true",children:[e.jsx("span",{className:"wr-fab",children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",children:[e.jsx("path",{d:"m3 11 17-7-6 17-3-7-8-3Z",stroke:"white",strokeWidth:"2",strokeLinejoin:"round"}),e.jsx("path",{d:"m11 14 9-10",stroke:"white",strokeWidth:"2"})]})}),e.jsx("span",{className:"wr-fab",children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",children:[e.jsx("rect",{x:"5",y:"4",width:"14",height:"17",rx:"2",stroke:"white",strokeWidth:"1.8"}),e.jsx("path",{d:"M9 3h6v4H9zM8 11h8M8 15h8",stroke:"white",strokeWidth:"1.6"})]})}),e.jsx("span",{className:"wr-fab",children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",children:[e.jsx("circle",{cx:"12",cy:"8",r:"4",stroke:"white",strokeWidth:"1.8"}),e.jsx("path",{d:"M4 20c.6-4 3.3-6 8-6s7.4 2 8 6H4Z",fill:"white"})]})})]}),e.jsx("div",{className:"wr-submit-wrap",children:e.jsx("button",{className:"wr-submit",children:"Demande de retrait"})}),a&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"wr-scrim"}),e.jsxs("section",{className:"wr-sheet",role:"dialog","aria-modal":"true",children:[e.jsxs("div",{className:"wr-sheet-title",children:[e.jsx("img",{src:"/__mockup/images/withdrawal/dialog-icon.png",alt:""}),"Petit rappel amical"]}),n?e.jsxs("div",{className:"wr-setup-card",children:[e.jsx("p",{children:"Associez votre compte mobile money pour recevoir vos retraits."}),e.jsx("div",{className:"wr-setup-field",children:"Sélectionnez votre opérateur"}),e.jsx("div",{className:"wr-setup-field",children:"Numéro du compte mobile money"}),e.jsxs("div",{className:"wr-setup-actions",children:[e.jsx("button",{className:"wr-action wr-cancel",onClick:()=>s(!1),children:"Retour"}),e.jsx("button",{className:"wr-action wr-link",onClick:()=>r(!1),children:"Continuer"})]})]}):e.jsxs(e.Fragment,{children:[e.jsx("img",{className:"wr-card-art",src:"/__mockup/images/withdrawal/bind-card.png",alt:""}),e.jsx("p",{className:"wr-sheet-copy",children:"Vous n'avez pas encore associé votre compte mobile money. Veuillez l'associer d'abord."}),e.jsxs("div",{className:"wr-actions",children:[e.jsx("button",{className:"wr-action wr-cancel",onClick:()=>r(!1),children:"Annuler"}),e.jsx("button",{className:"wr-action wr-link",onClick:()=>s(!0),children:"Lier un compte"})]})]})]})]})]})}export{d as ReferenceMatch};
