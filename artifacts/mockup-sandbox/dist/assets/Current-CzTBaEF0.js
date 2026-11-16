import{r as d,j as r}from"./index-ti0hz0dt.js";import{C as l}from"./chevron-left-B1bLGv22.js";import"./createLucideIcon-YifHdIiS.js";function f(){const[i,a]=d.useState(""),e="XOF",n=40,s=1500,t=18;return r.jsxs("main",{className:"withdraw-current",children:[r.jsx("style",{children:`
        .withdraw-current {
          --withdrawal-gold: #efc85a;
          min-height: 100dvh;
          overflow-x: hidden;
          background: #111;
          color: #f4f1eb;
          font-family: Georgia, "Times New Roman", serif;
        }
        .withdraw-current,
        .withdraw-current * {
          box-sizing: border-box;
        }
        .withdraw-current .withdraw-screen {
          width: min(100%, 432px);
          min-height: 100dvh;
          margin: 0 auto;
          padding: 30px 0 28px;
          overflow-x: hidden;
          background: #111;
        }
        .withdraw-current .withdraw-header {
          height: 40px;
          margin: 0;
          padding-left: 10px;
        }
        .withdraw-current .withdraw-back {
          display: grid;
          width: 40px;
          height: 40px;
          min-width: 40px;
          max-width: 40px;
          place-items: center;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #f2f2f2;
          cursor: pointer;
        }
        .withdraw-current .withdraw-back svg {
          width: 28px;
          height: 28px;
          stroke-width: 2.5;
        }
        .withdraw-current .withdraw-top-row {
          display: grid;
          width: 100%;
          min-height: 140px;
          grid-template-columns: 34.5% 57.5%;
          column-gap: 4%;
          align-items: start;
          margin: 13px 0 21px 4%;
        }
        .withdraw-current .balance-card {
          min-width: 0;
          margin: 0;
          padding: 18px 0 0;
        }
        .withdraw-current .balance-label {
          margin: 0;
          color: #aaa8a5;
          font-size: 17px;
          font-weight: 400;
          line-height: 1.15;
        }
        .withdraw-current .balance-value {
          margin: 8px 0 0;
          color: #f6f4ef;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0;
          line-height: 1.1;
          white-space: nowrap;
        }
        .withdraw-current .wallet-edit {
          display: flex;
          width: 112px;
          height: 40px;
          align-items: center;
          justify-content: center;
          margin-top: 14px;
          padding: 0 10px;
          border: 0;
          border-radius: 23px;
          background: #252525;
          color: #f4f1eb;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }
        .withdraw-current .withdraw-promo {
          width: 100%;
          aspect-ratio: 496 / 280;
          border-radius: 18px 0 0 18px;
           background-image: url("/__mockup/images/withdrawal/current-promo.png");
          background-position: 100% 15.75%;
          background-repeat: no-repeat;
          background-size: 174.1935% 617.1429%;
        }
        .withdraw-current .amount-panel {
          width: 92%;
          margin: 0 0 0 4%;
          padding: 23px 11px 24px;
          border-radius: 18px;
          background: #24232f;
          color: #f4f1eb;
        }
        .withdraw-current .amount-field {
          display: flex;
          height: 56px;
          align-items: center;
          gap: 14px;
          padding: 0 16px;
          border: 0;
          border-radius: 30px;
          background: #fff0c9;
        }
        .withdraw-current .amount-field input {
          order: 2;
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #151515;
          font-family: Arial, sans-serif;
          font-size: 17px;
          font-weight: 700;
        }
        .withdraw-current .amount-field input::placeholder {
          color: #74716c;
          opacity: 1;
        }
        .withdraw-current .amount-currency {
          order: 1;
          flex: 0 0 auto;
          color: #16130d;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 20px;
          font-weight: 700;
        }
        .withdraw-current .amount-details {
          display: none;
        }
        .withdraw-current .password-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
          color: #666;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
        }
        .withdraw-current .password-field input {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          border: 1px solid #d5d5d5;
          border-radius: 12px;
          outline: none;
          background: #fff;
          color: #303030;
          font-family: Arial, sans-serif;
          font-size: 16px;
        }
        .withdraw-current .wallet-panel {
          margin: 28px 0 0;
        }
        .withdraw-current .wallet-prompt {
          margin: 0;
          color: #f5f3ee;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.25;
        }
        .withdraw-current .wallet-account-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 82px;
          gap: 10px;
          margin-top: 10px;
        }
        .withdraw-current .wallet-account-number {
          display: flex;
          min-width: 0;
          height: 56px;
          align-items: center;
          overflow: hidden;
          padding: 0 18px;
          border-radius: 30px;
          background: #fff0c9;
          color: #171717;
          font-family: Arial, sans-serif;
          font-size: 17px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .withdraw-current .wallet-choice {
          display: flex;
          width: 82px;
          min-height: 56px;
          height: 56px;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0 5px;
          border: 0;
          border-radius: 6px;
          background: #1f1f20;
          color: #fff;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 17px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }
        .withdraw-current .submit {
          width: 100%;
          height: 56px;
          min-height: 56px;
          margin: 50px 0 0;
          border: 0;
          border-radius: 30px;
          background: var(--withdrawal-gold);
          color: #211b10;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
        }
        .withdraw-current .instructions {
          padding: 23px 0 0;
        }
        .withdraw-current .rules-heading {
          margin: 0 0 9px;
          color: #f4f1eb;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
        }
        .withdraw-current .instructions-title {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0;
          color: #ffe000;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 19px;
          font-weight: 700;
          line-height: 1.25;
        }
        .withdraw-current .instructions-list {
          display: block;
          margin: 22px 0 0;
          padding-left: 22px;
          color: #f6f4ef;
        }
        .withdraw-current .instructions-list li {
          margin: 0 0 14px;
          padding-left: 0;
          color: #f6f4ef;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          font-weight: 400;
          line-height: 1.45;
        }
        .withdraw-current .instructions-list li::marker,
        .withdraw-current .instructions-list strong {
          color: #ffe000;
          font-weight: 700;
        }
        @media (max-width: 360px) {
          .withdraw-current .withdraw-screen { padding-top: 28px; }
          .withdraw-current .wallet-account-row {
            grid-template-columns: minmax(0, 1fr) 74px;
            gap: 8px;
          }
          .withdraw-current .wallet-choice {
            width: 74px;
            font-size: 16px;
          }
          .withdraw-current .amount-panel {
            padding-right: 9px;
            padding-left: 9px;
          }
          .withdraw-current .instructions-list li { font-size: 16px; }
        }
      `}),r.jsxs("div",{className:"withdraw-screen",children:[r.jsx("header",{className:"withdraw-header",children:r.jsx("button",{type:"button",className:"withdraw-back","aria-label":"Retour",children:r.jsx(l,{"aria-hidden":"true"})})}),r.jsxs("div",{className:"withdraw-top-row",children:[r.jsx("section",{className:"balance-card","aria-label":"Solde disponible",children:r.jsxs("div",{className:"balance-copy",children:[r.jsx("p",{className:"balance-label",children:"Solde de retrait"}),r.jsxs("p",{className:"balance-value",children:[Math.round(n).toLocaleString("fr-FR")," ",e]}),r.jsx("button",{type:"button",className:"wallet-edit",children:"Enregistrer"})]})}),r.jsx("div",{className:"withdraw-promo",role:"img","aria-label":"Retrait — Retirer des fonds du solde"})]}),r.jsxs("section",{className:"amount-panel","aria-label":"Faire un retrait",children:[r.jsxs("label",{className:"amount-field",children:[r.jsx("span",{className:"amount-currency",children:e}),r.jsx("input",{type:"number",value:i,onChange:o=>a(o.target.value),placeholder:"Montant du retrait","aria-label":"Montant de retrait"})]}),r.jsxs("div",{className:"amount-details","aria-hidden":"true",children:[r.jsxs("span",{children:["Montant reçu : 0 ",e]}),r.jsxs("span",{children:["Taux de frais : ",t,"%"]})]}),r.jsxs("label",{className:"password-field",children:[r.jsx("span",{children:"Mot de passe de retrait"}),r.jsx("input",{type:"password",autoComplete:"current-password",placeholder:"Saisissez votre mot de passe"})]}),r.jsxs("section",{className:"wallet-panel","aria-label":"Portefeuille de retrait",children:[r.jsx("p",{className:"wallet-prompt",children:"Paramètres du compte de retrait"}),r.jsxs("div",{className:"wallet-account-row",children:[r.jsx("div",{className:"wallet-account-number","aria-label":"Compte de Amina K., 9142383341",children:"9142383341"}),r.jsx("button",{type:"button",className:"wallet-choice",children:"Compte"})]})]}),r.jsx("button",{type:"button",className:"submit",children:"Confirmer"}),r.jsxs("section",{className:"instructions","aria-label":"Instructions de retrait",children:[r.jsx("h2",{className:"rules-heading",children:"Règles de retrait :"}),r.jsxs("p",{className:"instructions-title",children:[r.jsx("span",{"aria-hidden":"true",children:"📢"}),"Instructions de retrait"]}),r.jsxs("ol",{className:"instructions-list",children:[r.jsxs("li",{children:["Montant minimum de retrait :"," ",r.jsxs("strong",{children:[s.toLocaleString("fr-FR")," ",e]}),"."]}),r.jsxs("li",{children:["Les retraits sont possibles de"," ",r.jsxs("strong",{children:[String(9).padStart(2,"0"),"h00 à"," ",String(17).padStart(2,"0"),"h00"]})," ","tous les jours."]}),r.jsxs("li",{children:["Des frais de transaction ",r.jsxs("strong",{children:["de ",t," %"]})," seront facturés pour chaque retrait."]}),r.jsxs("li",{children:["Un produit actif est nécessaire pour effectuer un retrait, dans la limite de"," ",r.jsxs("strong",{children:[2," demande(s) par jour"]}),"."]})]})]})]})]})]})}export{f as default};
