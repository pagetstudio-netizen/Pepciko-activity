import { ADMIN_PATH } from "./admin-path";

interface PageMetadata {
  title: string;
  description: string;
}

const COMPANY_DESCRIPTION =
  "Consultez les produits, les opérations et les informations de votre compte PepsiCo.";

const DEFAULT_TITLE = "Page introuvable";

const PAGE_TITLES: Record<string, string> = {
  "/": "Accueil",
  "/login": "Connexion",
  "/register": "Inscription",
  "/tg/pages/login/reset": "Inscription par invitation",
  "/invitation": "Inscription par invitation",
  "/rejoindre": "Rejoindre PepsiCo",
  "/tasks": "Tâches",
  "/task": "Tâches",
  "/invest": "Investir",
  "/notice": "Avis",
  "/blog": "Blog d'investissement",
  "/blog/create": "Article de blog",
  "/orders": "Commandes",
  "/team": "Partager",
  "/my-products": "Mes produits",
  "/checkin": "Roue de la fortune",
  "/daily-checkin": "Connexion quotidienne",
  "/account": "Mon compte",
  "/deposit": "Dépôt",
  "/robotpay": "Paiement RobotPay",
  "/withdrawal": "Retrait",
  "/deposit-history": "Historique des dépôts",
  "/deposits-history": "Historique des dépôts",
  "/history": "Historique du solde",
  "/withdrawal-history": "Historique des retraits",
  "/deposit-orders": "Ordres de dépôt",
  "/service": "Service client",
  "/wallet": "Compte de retrait",
  "/change-password": "Changer le mot de passe",
  "/about": "À propos",
  "/rules": "Règles",
  "/gift-code": "Code cadeau",
  "/team-details": "Équipe",
  "/daily-bonus": "Récompenses",
  "/rewards": "Récompenses",
  "/salary-bonus": "Bonus",
  "/banker": "Espace banquier",
};

function normalizedPath(location: string) {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function getPageMetadata(location: string): PageMetadata {
  const pathname = normalizedPath(location);
  let title = PAGE_TITLES[pathname];

  if (!title && /^\/products\/[^/]+$/.test(pathname)) {
    title = "Détail du produit";
  } else if (!title && /^\/notice\/[^/]+$/.test(pathname)) {
    title = "Avis de détails";
  } else if (!title && (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`))) {
    title = "Administration";
  }

  return {
    title: title || DEFAULT_TITLE,
    description: COMPANY_DESCRIPTION,
  };
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function applyPageMetadata(location: string) {
  const metadata = getPageMetadata(location);
  const title = `${metadata.title} | PepsiCo`;

  document.title = title;
  setMeta("name", "description", metadata.description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", metadata.description);
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", metadata.description);
}
