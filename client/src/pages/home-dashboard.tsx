import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { buildReferralLink } from "@/lib/referral-link";
import { copyTextWithToast } from "@/lib/copy-to-clipboard";
import rechargePink from "@assets/recharge_icon_1793865161680.png";
import withdrawPink from "@assets/withdraw_icon_1793865161768.png";
import teamPink from "@assets/team_icon_1793865161801.png";
import telegramPink from "@assets/telegram_icon_(1)_1793865161832.png";
import wheelIllustration from "@assets/image_1794155962953.png";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
type HomeQuickAction = {
  label: string;
  image: string;
  path?: string;
  externalUrl?: string;
  download?: boolean;
};

const quickActions: HomeQuickAction[] = [
  { label: "Recharger", image: rechargePink, path: "/deposit" },
  { label: "Retirer", image: withdrawPink, path: "/withdrawal" },
  { label: "Mon équipe", image: teamPink, path: "/team" },
  { label: "Télégramme", image: telegramPink, externalUrl: "telegram" },
];

const formatFcfa = (amount: number) =>
  `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
const formatBalanceFcfa = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0)} FCFA`;

export default function HomeDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [copiedInvite, setCopiedInvite] = useState(false);
  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });
  const { data: tasks = [] } = useQuery<Array<{ id: number; name: string; description: string; reward: number; requiredInvites: number }>>({
    queryKey: ["/api/tasks"],
  });
  const invitationLink = useMemo(() => {
    if (!user?.referralCode || typeof window === "undefined") return "";
    return buildReferralLink(window.location.origin, user.referralCode);
  }, [user?.referralCode]);
  const firstTask = tasks[0];
  const firstTaskIsActivation = firstTask
    ? /activation|activer|active/i.test(`${firstTask.name} ${firstTask.description}`)
    : false;

  const handleQuickAction = async (action: HomeQuickAction) => {
    if (action.download) {
      const installPrompt = (window as Window & {
        _installPrompt?: BeforeInstallPromptEvent | null;
      })._installPrompt;
      if (!installPrompt) {
        toast({
          title: "Téléchargement indisponible",
          description: "Ouvrez ce site dans un navigateur compatible pour l’installer.",
        });
        return;
      }
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
      } catch {
        toast({
          title: "Installation non disponible",
          description: "Vous pourrez réessayer depuis le menu de votre navigateur.",
        });
      } finally {
        (window as Window & { _installPrompt?: BeforeInstallPromptEvent | null })._installPrompt = null;
      }
      return;
    }
    if (action.externalUrl === "telegram") {
      const telegramUrl = settings.groupLink;
      if (telegramUrl) {
        try {
          const parsedUrl = new URL(telegramUrl);
          if (parsedUrl.protocol !== "https:") throw new Error("Lien Telegram invalide");
          window.open(parsedUrl.href, "_blank", "noopener,noreferrer");
        } catch {
          navigate("/service");
        }
      } else navigate("/service");
      return;
    }
    if (action.path) navigate(action.path);
  };

  const copyInvitation = async () => {
    if (!invitationLink) return;
    const copied = await copyTextWithToast(invitationLink, {
      successTitle: "Copie réussie",
    });
    if (!copied) return;
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1400);
  };

  if (!user) return null;

  return (
    <main className="rf-home">
      <style>{`
        .rf-home {
          min-height: 100dvh;
          padding: 29px 0 calc(70px + env(safe-area-inset-bottom, 0px));
          background: #111111;
          color: #f7f7f8;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        .rf-home, .rf-home * { box-sizing: border-box; }
        .rf-home-shell {
          width: 100%;
          max-width: 512px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .rf-hero {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 796 / 338;
          overflow: hidden;
          border-radius: 10px;
          background: #080808;
        }
        .rf-hero-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rf-hero-copy {
          position: absolute;
          inset: 0 auto 0 0;
          display: flex;
          width: 68%;
          flex-direction: column;
          justify-content: center;
          padding: 10px 0 10px 9%;
          background: linear-gradient(90deg, #050505 0%, #050505 78%, rgba(5,5,5,0) 100%);
          color: #fff;
          font-size: clamp(17px, 4.2vw, 22px);
          font-weight: 750;
          line-height: 1.38;
          text-transform: uppercase;
        }
        .rf-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: start;
          margin-top: 20px;
        }
        .rf-action {
          display: flex;
          min-width: 0;
          min-height: 80px;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          border: 0;
          padding: 0 2px;
          background: transparent;
          color: #f4f4f5;
          cursor: pointer;
          font: inherit;
        }
        .rf-action:active { transform: scale(.97); }
        .rf-action:focus-visible, .rf-product-buy:focus-visible, .rf-retry:focus-visible {
          outline: 2px solid #f3c244;
          outline-offset: 3px;
          border-radius: 8px;
        }
        .rf-action-icon {
          display: block;
          width: 56px;
          height: 56px;
          flex: 0 0 auto;
          object-fit: contain;
        }
        .rf-action-label {
          max-width: 100%;
          overflow: hidden;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.1;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rf-checkin {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 796 / 179;
          margin-top: 24px;
          overflow: hidden;
          border-radius: 12px;
          border: 0;
          padding: 0;
          background: #08090c;
          cursor: pointer;
        }
        .rf-checkin img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rf-checkin::before {
          position: absolute;
          z-index: 1;
          inset: 0 43% 0 0;
          background: linear-gradient(90deg, rgba(5,5,8,.98), rgba(5,5,8,.98) 78%, rgba(5,5,8,0));
          content: "";
          pointer-events: none;
        }
        .rf-checkin-label {
          position: absolute;
          top: 50%;
          left: 4%;
          transform: translateY(-50%);
          background: linear-gradient(95deg, #ffe500 7%, #ffbd42 43%, #f35e9b 94%);
          background-clip: text;
          color: transparent;
          font-size: clamp(23px, 7.3vw, 39px);
          font-weight: 750;
          letter-spacing: -.045em;
          line-height: 1;
          z-index: 2;
          -webkit-background-clip: text;
        }
        .rf-checkin:disabled { cursor: wait; }
        .rf-product-category-clip-defs {
          position: absolute;
          width: 0;
          height: 0;
          overflow: hidden;
        }
        .rf-product-category-buttons {
          display: grid;
          width: 100%;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 12px;
          margin: 14px 0 0;
        }
        .rf-product-category-button {
          position: relative;
          display: flex;
          min-width: 0;
          min-height: 54px;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          padding: 8px 10px;
          background: linear-gradient(90deg, #ffb800 0%, #ffd400 100%);
          box-shadow: none;
          color: #151515;
          isolation: isolate;
          clip-path: url(#rf-product-category-card-clip);
          font-size: clamp(13px, 3.5vw, 17px);
          font-weight: 750;
          line-height: 1.15;
          text-align: center;
          cursor: pointer;
          transition: filter .15s ease, transform .15s ease;
        }
        .rf-product-category-button::before {
          position: absolute;
          z-index: -1;
          inset: 0;
          background:
            repeating-linear-gradient(90deg, transparent 0 24px, rgba(255, 248, 101, .12) 25px 28px),
            radial-gradient(ellipse at 54% 45%, rgba(255, 242, 84, .6), transparent 48%);
          content: "";
          pointer-events: none;
        }
        .rf-product-category-watermark {
          position: absolute;
          z-index: -1;
          top: 50%;
          right: 2px;
          height: 145%;
          max-width: 38%;
          transform: translateY(-50%);
          object-fit: contain;
          opacity: .2;
          mix-blend-mode: multiply;
          pointer-events: none;
          user-select: none;
        }
        .rf-product-category-label {
          position: relative;
          z-index: 1;
        }
        .rf-product-category-button:hover { filter: brightness(1.05); }
        .rf-product-category-button:active { transform: scale(.98); }
        .rf-product-category-button:focus-visible {
          outline: 2px solid #f3c244;
          outline-offset: 3px;
        }
        .rf-product-list {
          display: grid;
          gap: 16px;
          margin-top: 25px;
        }
        .rf-product {
          min-width: 0;
          min-height: 154px;
          border-radius: 13px;
          padding: 16px 16px 14px;
          background: #23242f;
        }
        .rf-product-top {
          display: grid;
          min-width: 0;
          grid-template-columns: minmax(96px, 31%) minmax(0, 1fr);
          align-items: center;
          gap: 12px;
        }
        .rf-product-image {
          display: grid;
          width: 100%;
          aspect-ratio: 132 / 87;
          overflow: hidden;
          place-items: center;
          border-radius: 12px;
          background: #15161e;
        }
        .rf-product-image img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rf-product-image-fallback {
          color: #6b6d78;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .12em;
        }
        .rf-product-heading {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .rf-vip {
          min-width: 56px;
          border-radius: 30px;
          padding: 4px 11px 5px;
          background: #eac35c;
          color: #29231a;
          font-size: 12px;
          line-height: 1;
          text-align: center;
        }
        .rf-product-name {
          max-width: 100%;
          margin: 0;
          overflow: hidden;
          color: #f5f5f7;
          font-size: 16px;
          font-weight: 700;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rf-product-stock {
          max-width: 100%;
          color: #eac35c;
          font-size: 10px;
          font-weight: 600;
          line-height: 1.2;
        }
        .rf-product-stock.is-full { color: #ed8d79; }
        .rf-product-stats {
          display: grid;
          grid-template-columns: .8fr 1.12fr 1fr 64px;
          align-items: end;
          gap: 4px;
          margin-top: 17px;
        }
        .rf-stat { min-width: 0; }
        .rf-stat-value {
          display: block;
          overflow: hidden;
          color: #e5e5e8;
          font-size: 13px;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rf-stat-label {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: #8c8d98;
          font-size: 12px;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rf-product-buy {
          display: flex;
          min-height: 34px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 23px;
          padding: 0 6px;
          background: #feee48;
          color: #2a2818;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          transition: transform .15s ease, background-color .15s ease;
        }
        .rf-product-buy:hover { background: #ffdf22; }
        .rf-product-buy:active { transform: scale(.96); }
        .rf-product-buy:disabled { cursor: wait; opacity: .7; }
        @media (max-width: 390px) {
          .rf-home-shell { padding-right: 14px; padding-left: 14px; }
          .rf-action-icon { width: 54px; height: 54px; }
          .rf-action-label { font-size: 12px; letter-spacing: -.025em; }
          .rf-product { padding: 14px 12px 13px; }
          .rf-product-top { grid-template-columns: minmax(88px, 31%) minmax(0,1fr); gap: 10px; }
          .rf-product-stats { grid-template-columns: .8fr 1.1fr 1fr 58px; gap: 3px; margin-top: 16px; }
          .rf-stat-value, .rf-stat-label { font-size: 11px; }
          .rf-product-buy { min-height: 32px; padding: 0 4px; font-size: 11px; }
          .rf-product-name { font-size: 15px; }
          .rf-vip { min-width: 52px; font-size: 11px; }
        }
        .rf-loading-card {
          display: grid;
          min-height: 180px;
          gap: 12px;
          border-radius: 13px;
          padding: 18px;
          background: #23242f;
        }
        .rf-skeleton {
          border-radius: 7px;
          background: linear-gradient(100deg, #30313d 25%, #3a3b47 40%, #30313d 60%);
          background-size: 200% 100%;
          animation: rf-shimmer 1.4s ease-in-out infinite;
        }
        .rf-skeleton-line { width: 46%; height: 18px; }
        .rf-skeleton-wide { width: 100%; height: 46px; }
        @keyframes rf-shimmer { to { background-position-x: -200%; } }
        .rf-status {
          display: grid;
          min-height: 140px;
          place-items: center;
          gap: 12px;
          border-radius: 13px;
          padding: 20px;
          background: #23242f;
          color: #aaaab3;
          font-size: 14px;
          text-align: center;
        }
        .rf-retry {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #454653;
          border-radius: 20px;
          padding: 8px 13px;
          background: transparent;
          color: #f3c244;
          cursor: pointer;
          font: inherit;
        }
        .rf-purchase-modal {
          display: flex;
          width: min(388px, calc(100vw - 44px));
          height: 192px;
          flex-direction: column;
          overflow: hidden;
          border: 0;
          border-radius: 6px;
          padding: 0;
          background: #fff;
          color: #333;
          font-family: Roboto, Arial, sans-serif;
          box-shadow: 0 12px 34px rgba(0,0,0,.24);
          outline: none;
        }
        .rf-purchase-description {
          display: flex;
          min-height: 0;
          flex: 1;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 18px 16px;
          color: #333;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.4;
          text-align: center;
        }
        .rf-purchase-actions {
          display: grid;
          height: 56px;
          flex: 0 0 56px;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid #dadada;
          background: #f2f2f2;
        }
        .rf-purchase-action {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          color: #333;
          cursor: pointer;
          font-family: inherit;
          font-size: 16px;
          font-weight: 400;
          line-height: 1;
          text-transform: uppercase;
        }
        .rf-purchase-action + .rf-purchase-action {
          border-left: 1px solid #d5d5d5;
          color: #71acd2;
        }
        .rf-purchase-action:focus-visible {
          outline: 2px solid #71acd2;
          outline-offset: -4px;
        }
        .rf-purchase-action:disabled { cursor: wait; opacity: .65; }
        .rf-daily-bonus-notice {
          display: flex;
          width: min(388px, calc(100vw - 44px));
          height: 192px;
          flex-direction: column;
          overflow: hidden;
          border: 0;
          border-radius: 6px;
          padding: 0;
          background: #fff;
          color: #333;
          font-family: Roboto, Arial, sans-serif;
          box-shadow: 0 12px 34px rgba(0,0,0,.24);
          outline: none;
        }
        .rf-daily-bonus-notice-message {
          display: flex;
          min-height: 0;
          flex: 1;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 18px 16px;
          color: #333;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.4;
          text-align: center;
        }
        .rf-daily-bonus-notice-action {
          display: flex;
          width: 100%;
          height: 56px;
          flex: 0 0 56px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-top: 1px solid #dadada;
          padding: 0;
          background: #f2f2f2;
          color: #71acd2;
          cursor: pointer;
          font-family: inherit;
          font-size: 16px;
          font-weight: 400;
          line-height: 1;
          text-transform: uppercase;
        }
        .rf-daily-bonus-notice-action:focus-visible {
          outline: 2px solid #71acd2;
          outline-offset: -4px;
        }
        @media (prefers-reduced-motion: reduce) {
          .rf-home *, .rf-home *::before, .rf-home *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
        .rf-home {
          padding: 26px 0 calc(110px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(110deg, #ed2a5b 0%, #f15f80 100%);
          color: #171316;
          font-family: Arial, sans-serif;
        }
        .rf-home-shell { max-width: 512px; padding: 0 17px; }
        .rf-hero { aspect-ratio: 796 / 326; border-radius: 10px; background: #e73d70; }
        .rf-hero-image { object-fit: cover; }
        .rf-hero-copy { display: none; }
        .rf-balances { display:grid; grid-template-columns:1fr 1.15fr 1fr; gap:4px; margin:13px 0 39px; color:#fff; text-align:center; }
        .rf-balance-label { display:block; font-size:14px; line-height:1.25; white-space:nowrap; }
        .rf-balance-value { display:block; margin-top:5px; font-size:clamp(12px,4.2vw,18px); font-weight:700; line-height:1; white-space:nowrap; }
        .rf-actions { margin:0; min-height:110px; align-items:center; padding:12px 8px 9px; border-radius:10px; background:#f9d5d3; }
        .rf-action { min-height:82px; gap:5px; color:#171316; }
        .rf-action-icon { width:52px; height:52px; }
        .rf-action-label { color:#171316; font-size:13px; font-weight:700; }
        .rf-reference-stack { display:grid; gap:14px; margin-top:21px; }
        .rf-reference-card { position:relative; min-width:0; min-height:164px; overflow:hidden; border-radius:10px; padding:14px 17px; background:#f9d5d3; color:#242023; }
        .rf-reference-card h2 { position:relative; z-index:1; max-width:90%; margin:0 0 14px; font-size:19px; font-weight:700; line-height:1.35; }
        .rf-reference-card p { position:relative; z-index:1; max-width:88%; margin:0; color:#595255; font-size:15px; line-height:1.5; }
        .rf-team-card { min-height:132px; padding:8px 17px; }
        .rf-team-card h2 { margin-bottom:4px; }
        .rf-team-card .rf-invite-url { max-width:67%; font-size:14px; line-height:1.35; }
        .rf-team-card .rf-reference-illustration { right:8px; width:min(44%,165px); height:auto; max-height:130px; object-fit:contain; object-position:center; }
        .rf-invite-url { overflow-wrap:anywhere; }
        .rf-reference-illustration { position:absolute; z-index:0; right:2px; top:50%; width:38%; max-height:132px; height:auto; transform:translateY(-50%); object-fit:contain; }
        .rf-card-actions { position:relative; z-index:2; display:flex; gap:11px; margin-top:13px; }
        .rf-team-card .rf-card-actions { margin-top:6px; }
        .rf-pill-link { display:inline-flex; min-width:100px; height:31px; align-items:center; justify-content:center; gap:13px; border:0; border-radius:20px; padding:0 14px; background:#ec2054; color:#fff; font:inherit; font-size:16px; line-height:1; text-decoration:none; cursor:pointer; }
        .rf-pill-link:active { transform:scale(.97); }
        .rf-pill-link:focus-visible,.rf-float-button:focus-visible { outline:2px solid #fff; outline-offset:2px; }
        .rf-daily-card { min-height:164px; height:auto; overflow:hidden; padding:10px 17px; }
        .rf-daily-card h2 { max-width:90%; margin-bottom:8px; }
        .rf-daily-card p { max-width:78%; }
        .rf-daily-card .rf-card-actions { position:relative; left:auto; bottom:auto; margin:8px 0 0; }
        .rf-daily-card .rf-reference-illustration { top:54%; right:2px; left:auto; width:42%; height:auto; max-height:150px; object-fit:contain; }
        .rf-lottery-card { min-height:164px; padding:12px 17px 10px; }
        .rf-lottery-card h2 { margin-bottom:2px; }
        .rf-lottery-card p { max-width:45%; }
        .rf-lottery-card .rf-card-actions { margin-top:7px; }
        .rf-lottery-card .rf-reference-illustration { top:0; right:-34px; width:260px; height:260px; max-height:none; transform:none; object-fit:contain; object-position:center; }
        .rf-task-card { min-height:156px; padding:12px 17px; }
        .rf-task-card h2 { max-width:100%; margin-bottom:8px; }
        .rf-task-card p { max-width:67%; }
        .rf-task-card .rf-card-actions { margin-top:7px; }
        .rf-task-card .rf-reference-illustration { right:0; width:45%; max-height:100px; }
        .rf-task-amount { color:#e51e35; font-weight:700; font-size:20px; }
        .rf-commission-card { min-height:180px; margin-top:1px; padding:12px 17px 10px; }
        .rf-commission-card h2 { max-width:100%; margin:0 0 4px; font-size:17px; line-height:1.45; }
        .rf-commission-line { margin-top:2px !important; max-width:100% !important; }
        .rf-floating-tools { position:fixed; z-index:30; top:42%; right:max(calc((100vw - 512px)/2),0px); display:grid; gap:6px; transform:translateY(-50%); }
        .rf-float-button { display:grid; width:42px; height:42px; place-items:center; border:1px solid rgba(255,255,255,.8); border-radius:50%; padding:0; background:#fff; box-shadow:0 2px 5px #9d2c4c55; cursor:pointer; }
        .rf-float-button img { width:100%; height:100%; object-fit:contain; }
        @media(max-width:430px) {
          .rf-reference-card { padding-top:9px; padding-bottom:9px; }
          .rf-reference-card h2 { margin-bottom:5px; line-height:1.25; }
          .rf-reference-card p { line-height:1.35; }
          .rf-team-card { min-height:122px; padding-top:7px; padding-bottom:7px; }
          .rf-team-card h2 { margin-bottom:3px; }
          .rf-team-card .rf-invite-url { max-width:62%; line-height:1.25; }
          .rf-team-card .rf-card-actions { margin-top:5px; }
          .rf-daily-card { min-height:148px; padding-top:8px; padding-bottom:8px; }
          .rf-daily-card h2 { margin-bottom:5px; }
          .rf-daily-card .rf-card-actions { margin-top:5px; }
          .rf-lottery-card { min-height:148px; padding:8px 15px; }
          .rf-lottery-card h2 { margin-bottom:1px; }
          .rf-lottery-card .rf-card-actions { margin-top:5px; }
          .rf-task-card { min-height:140px; padding:8px 15px; }
          .rf-task-card h2 { margin-bottom:5px; }
          .rf-task-card .rf-card-actions { margin-top:5px; }
          .rf-commission-card { min-height:164px; padding:8px 15px; }
          .rf-commission-card h2 { margin-bottom:2px; }
          .rf-commission-line { margin-top:1px !important; }
        }
        @media(max-width:390px) { .rf-home-shell { padding:0 14px; } .rf-balance-label { font-size:12px; } .rf-balance-value { font-size:clamp(11px,4.1vw,16px); } .rf-reference-card { padding-left:15px; } .rf-team-card .rf-reference-illustration { right:5px; width:42%; } .rf-lottery-card p { max-width:40%; } .rf-lottery-card .rf-reference-illustration { top:0; right:-30px; width:235px; height:235px; max-height:none; transform:none; } }
      `}</style>

      <div className="rf-home-shell">
        <section className="rf-hero" aria-label="PepsiCo et pep+">
          <img className="rf-hero-image" src="/pepsico-home/pepsico-banner.png" alt="PepsiCo et pep+" />
        </section>

        <section className="rf-balances" aria-label="Soldes du compte">
          <div><span className="rf-balance-label">Recharger le solde</span><strong className="rf-balance-value">{formatBalanceFcfa(Number(user.depositBalance) || 0)}</strong></div>
          <div><span className="rf-balance-label">Revenu du produit</span><strong className="rf-balance-value">{formatBalanceFcfa(Number(user.totalEarnings) || 0)}</strong></div>
          <div><span className="rf-balance-label">Solde de retrait</span><strong className="rf-balance-value">{formatBalanceFcfa(Number(user.withdrawalBalance) || 0)}</strong></div>
        </section>

        <section className="rf-actions" aria-label="Actions rapides">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="rf-action"
              onClick={() => void handleQuickAction(action)}
              aria-label={action.label}
            >
              <img className="rf-action-icon" src={action.image} alt="" aria-hidden="true" />
              <span className="rf-action-label">{action.label}</span>
            </button>
          ))}
        </section>

        <section className="rf-reference-stack">
          <article className="rf-reference-card rf-team-card">
            <img className="rf-reference-illustration" src="/pepsico-home/team-illustration.png" alt="" aria-hidden="true" />
            <h2>Mon équipe</h2>
            <p className="rf-invite-url">{invitationLink || "Lien d’invitation indisponible"}</p>
            <div className="rf-card-actions">
              <button className="rf-pill-link" type="button" onClick={() => void copyInvitation()}>{copiedInvite ? "Copié" : "Copie"}</button>
              <button className="rf-pill-link" type="button" onClick={() => navigate("/team")}>Aller à <span aria-hidden="true">⟶</span></button>
            </div>
          </article>
          <article className="rf-reference-card rf-daily-card">
            <img className="rf-reference-illustration" src="/pepsico-home/calendar-illustration.png" alt="" aria-hidden="true" />
            <h2>Connectez-vous pour recevoir des récompenses</h2>
            <p>Connectez-vous chaque jour pour découvrir les récompenses disponibles.</p>
            <div className="rf-card-actions"><button className="rf-pill-link" type="button" onClick={() => navigate("/daily-checkin")}>Connectez-vous</button></div>
          </article>
          <article className="rf-reference-card rf-lottery-card">
            <img className="rf-reference-illustration" src={wheelIllustration} alt="" aria-hidden="true" />
            <h2>Tirage au sort</h2>
            <p>La roue de la chance continue de tourner avec de magnifiques cadeaux.</p>
            <div className="rf-card-actions"><button className="rf-pill-link" type="button" onClick={() => navigate("/checkin")}>Aller à <span aria-hidden="true">⟶</span></button></div>
          </article>
          <article className="rf-reference-card rf-task-card">
            <img className="rf-reference-illustration" src="/pepsico-home/task-illustration.png" alt="" aria-hidden="true" />
            <h2>Récompenses pour les tâches</h2>
            <p>
              {firstTask
                ? <>{firstTaskIsActivation ? "Bonus d’activation" : "Récompense de tâche"} : <strong className="rf-task-amount">{formatFcfa(Number(firstTask.reward) || 0)}</strong></>
                : "Consultez les tâches disponibles pour découvrir les récompenses."}
            </p>
            <div className="rf-card-actions"><button className="rf-pill-link" type="button" onClick={() => navigate("/tasks")}>Aller à <span aria-hidden="true">⟶</span></button></div>
          </article>
          <article className="rf-reference-card rf-commission-card">
            <h2>Si vous invitez un ami et qu’il active avec succès son compte, vous recevrez une commission !</h2>
            {[1, 2, 3].map((level) => (
              <p className="rf-commission-line" key={level}>
                Taux de commission (niveau {level}) : {settings[`level${level}Commission`] != null ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(settings[`level${level}Commission`]))} %` : "—"}
              </p>
            ))}
          </article>
        </section>

        <WithdrawalFloatingTools containerClassName="rf-floating-tools" buttonClassName="rf-float-button" />
      </div>
    </main>
  );
}
