import{a as p,c,j as e,L as f}from"./index-Dk4VzOoT.js";import{E as u}from"./empty-state-tARkIP5W.js";import{i as m,F as x}from"./fortune-wheel-DZoRawzS.js";import{C as y}from"./chevron-left-45WLMgKT.js";import{L as g}from"./loader-circle-DTFTFd5f.js";import{c as b}from"./createLucideIcon-C7qpam5j.js";const j=b("Trophy",[["path",{d:"M6 9H4.5a2.5 2.5 0 0 1 0-5H6",key:"17hqa7"}],["path",{d:"M18 9h1.5a2.5 2.5 0 0 0 0-5H18",key:"lmptdp"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",key:"1nw9bq"}],["path",{d:"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",key:"1np0yb"}],["path",{d:"M18 2H6v7a6 6 0 0 0 12 0V2Z",key:"u46fv3"}]]);function a(i){const r=Number(i);return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number.isFinite(r)?r:0)}function N(i){const r=new Date(i);return Number.isNaN(r.getTime())?"Date indisponible":new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(r)}function A(){const{user:i}=p(),{data:r=[],isLoading:s,isError:l,refetch:d}=c({queryKey:["/api/transactions"],enabled:!!i});if(!i)return null;const n=r.filter(t=>m(t.type)).sort((t,o)=>new Date(o.createdAt).getTime()-new Date(t.createdAt).getTime()),h=n.reduce((t,o)=>t+Number(o.amount||0),0);return e.jsxs("main",{className:"fortune-history-page",children:[e.jsx("style",{children:`
        .fortune-history-page {
          min-height: 100dvh;
          padding-bottom: max(28px, env(safe-area-inset-bottom));
          background:
            radial-gradient(ellipse at 50% 4%, rgba(255, 231, 157, .52), transparent 42%),
            linear-gradient(180deg, #ff634f 0%, #ff7b36 46%, #ff9a53 100%);
          color: #42231b;
          font-family: Arial, sans-serif;
        }
        .fortune-history-page *,
        .fortune-history-page *::before,
        .fortune-history-page *::after {
          box-sizing: border-box;
        }
        .fortune-history-screen {
          width: min(100%, 512px);
          min-height: 100dvh;
          margin: 0 auto;
          padding: 0 18px 30px;
        }
        .fortune-history-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          height: 58px;
          align-items: center;
          justify-content: center;
          margin: 0 -18px;
          padding: 0 18px;
          background: rgba(244, 64, 62, .96);
          color: #fff;
          box-shadow: 0 4px 14px rgba(116, 34, 17, .12);
        }
        .fortune-history-back {
          position: absolute;
          left: 16px;
          display: inline-flex;
          min-width: 42px;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border-radius: 999px;
          color: inherit;
          font-size: 14px;
          text-decoration: none;
        }
        .fortune-history-header h1 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          text-align: center;
        }
        .fortune-history-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 22px 0 18px;
        }
        .fortune-history-stat {
          min-width: 0;
          padding: 15px 12px;
          border: 1px solid rgba(255, 255, 255, .8);
          border-radius: 16px;
          background: rgba(255, 247, 224, .96);
          text-align: center;
          box-shadow: 0 5px 0 rgba(150, 48, 28, .12);
        }
        .fortune-history-stat-label {
          display: block;
          color: #794a36;
          font-size: 13px;
        }
        .fortune-history-stat strong {
          display: block;
          margin-top: 6px;
          color: #b72b25;
          font-size: 20px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }
        .fortune-history-list {
          display: grid;
          gap: 11px;
        }
        .fortune-history-entry {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, .82);
          border-radius: 15px;
          background: #fff6e4;
          box-shadow: 0 4px 0 rgba(150, 48, 28, .12);
        }
        .fortune-history-entry-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border-radius: 50%;
          background: #f34854;
          color: #fff;
        }
        .fortune-history-entry-info {
          min-width: 0;
          flex: 1;
        }
        .fortune-history-entry-title {
          display: block;
          color: #39221c;
          font-size: 15px;
          font-weight: 700;
        }
        .fortune-history-entry-date {
          display: block;
          margin-top: 5px;
          color: #755e51;
          font-size: 12px;
        }
        .fortune-history-entry-wallet {
          display: block;
          margin-top: 4px;
          color: #755e51;
          font-size: 11px;
        }
        .fortune-history-entry-amount {
          flex: 0 0 auto;
          color: #b72b25;
          font-size: 15px;
          font-weight: 800;
          text-align: right;
          white-space: nowrap;
        }
        .fortune-history-state {
          margin-top: 22px;
          padding: 22px 16px;
          border: 1px solid rgba(255, 255, 255, .82);
          border-radius: 18px;
          background: #fff7e9;
          text-align: center;
        }
        .fortune-history-state p {
          margin: 8px 0 0;
          color: #694e40;
          line-height: 1.5;
        }
        .fortune-history-retry {
          margin-top: 14px;
          border: 0;
          border-radius: 999px;
          padding: 10px 18px;
          background: #eb2857;
          color: #fff;
          font: inherit;
          font-weight: 700;
        }
        .fortune-history-loading {
          display: flex;
          min-height: 220px;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .fortune-history-loading svg {
          animation: fortune-history-spin 1s linear infinite;
        }
        @keyframes fortune-history-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fortune-history-loading svg { animation: none; }
        }
      `}),e.jsxs("div",{className:"fortune-history-screen",children:[e.jsxs("header",{className:"fortune-history-header",children:[e.jsxs(f,{className:"fortune-history-back",href:"/checkin","aria-label":"Retour au jeu",children:[e.jsx(y,{size:24,"aria-hidden":"true"}),e.jsx("span",{children:"Retour"})]}),e.jsx("h1",{children:"Historique des gains"})]}),s?e.jsx("div",{className:"fortune-history-loading",role:"status","aria-label":"Chargement des gains",children:e.jsx(g,{size:30})}):l?e.jsxs("div",{className:"fortune-history-state",role:"alert",children:[e.jsx("p",{children:"Impossible de charger votre historique de gains."}),e.jsx("button",{className:"fortune-history-retry",type:"button",onClick:()=>{d()},children:"Réessayer"})]}):e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"fortune-history-summary","aria-label":"Résumé des gains du jeu",children:[e.jsxs("div",{className:"fortune-history-stat",children:[e.jsx("span",{className:"fortune-history-stat-label",children:"Total gagné"}),e.jsxs("strong",{children:[a(h)," FCFA"]})]}),e.jsxs("div",{className:"fortune-history-stat",children:[e.jsx("span",{className:"fortune-history-stat-label",children:"Gains reçus"}),e.jsx("strong",{children:n.length})]})]}),n.length>0?e.jsx("section",{className:"fortune-history-list","aria-label":"Gains reçus",children:n.map(t=>e.jsxs("article",{className:"fortune-history-entry",children:[e.jsx("span",{className:"fortune-history-entry-icon","aria-hidden":"true",children:e.jsx(j,{size:21})}),e.jsxs("span",{className:"fortune-history-entry-info",children:[e.jsx("span",{className:"fortune-history-entry-title",children:"Gain du tirage"}),e.jsx("time",{className:"fortune-history-entry-date",dateTime:t.createdAt,children:N(t.createdAt)}),e.jsx("span",{className:"fortune-history-entry-wallet",children:t.type===x?"Solde de retrait":"Solde de dépôt"})]}),e.jsxs("span",{className:"fortune-history-entry-amount",children:["+",a(t.amount)," FCFA"]})]},t.id))}):e.jsx(u,{className:"fortune-history-state",children:e.jsx("p",{children:"Aucun gain de jeu reçu pour le moment."})})]})]})]})}export{A as default};
