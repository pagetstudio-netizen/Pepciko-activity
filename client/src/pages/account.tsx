import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight, Loader2, LogOut, Settings2, X } from "lucide-react";
import depositIcon from "@assets/recharge_(2)_1793892889058.png";
import withdrawalIcon from "@assets/withdraw_(2)_1793892889030.png";
import orderIcon from "@assets/order_(1)_1793892889004.png";
import bankCardIcon from "@assets/bank_card_1793892888970.png";
import commissionIcon from "@assets/commission_1793892888944.png";
import rewardIcon from "@assets/reward_1793892888911.png";
import serviceIcon from "@assets/service_(3)_1793892888878.png";
import vipIcon from "@assets/vip_(2)_1793892888853.png";
import telegramIcon from "@assets/telegram_(4)_1793892888815.png";
import noticeIcon from "@assets/notice_(2)_1793892888553.png";
import vip0Badge from "@assets/lv0_(1)_1793923540354.png";
import vip1Badge from "@assets/lv1_(1)_1793923540435.png";
import vip2Badge from "@assets/lv2_(1)_1793923540409.png";
import vip3Badge from "@assets/lv3_(1)_1793923540379.png";
import vip6Badge from "@assets/lv6_(1)_1793923540333.png";
import vip8Badge from "@assets/lv8_(1)_1793923540309.png";
import copyIcon from "@assets/copy_1793892889190.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { copyTextWithToast } from "@/lib/copy-to-clipboard";
import { apiRequest } from "@/lib/queryClient";
import { ADMIN_PATH } from "@/lib/admin-path";
import { PEPSICO_LOGO } from "@/lib/john-deere-assets";
import GiftCodeModal from "@/components/gift-code-modal";
import "./account.css";

type VipLevelsResponse = {
  currentLevel: number;
  levels: {
    level: number;
    thresholdFcfa: number;
    progressFcfa: number;
    progressPercent: number;
  }[];
};

const vipBadges: Record<number, string> = {
  0: vip0Badge,
  1: vip1Badge,
  2: vip2Badge,
  3: vip3Badge,
  6: vip6Badge,
  8: vip8Badge,
};

function getVipBadge(level: number) {
  if (vipBadges[level]) return vipBadges[level];
  const available = Object.keys(vipBadges).map(Number).sort((a, b) => a - b);
  const nearest = available.reduce((best, item) =>
    Math.abs(item - level) < Math.abs(best - level) ? item : best, available[0]);
  return vipBadges[nearest];
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { data: vipLevels } = useQuery<VipLevelsResponse>({
    queryKey: ["/api/user/vip-levels"],
    enabled: Boolean(user),
  });
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showGiftCodeModal, setShowGiftCodeModal] = useState(
    () => new URLSearchParams(window.location.search).get("giftCode") === "open",
  );
  const [adminPin, setAdminPin] = useState("");

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await apiRequest("POST", "/api/admin/verify-pin", { pin });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Code PIN incorrect");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowPinModal(false);
      setAdminPin("");
      navigate(ADMIN_PATH);
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  if (!user) return null;

  const vipLevel = vipLevels?.currentLevel ?? 0;
  const nextVipLevel = vipLevels?.levels.find((level) => level.level > vipLevel);
  const currentVipBadge = getVipBadge(vipLevel);
  const formatFcfa = (value: string | number | null | undefined) => {
    const amount = Number(value || 0);
    return `${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-FR")} FCFA`;
  };
  const maskedPhone = user.phone.length > 5
    ? `${user.phone.slice(0, 2)}${"*".repeat(Math.max(5, user.phone.length - 6))}${user.phone.slice(-4)}`
    : "••••";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
  const handleAdminClick = () => {
    setDrawerOpen(false);
    if (user.isAdminPasswordRequired === false) {
      navigate(ADMIN_PATH);
      return;
    }
    setShowPinModal(true);
  };
  const handleInstall = async () => {
    const installPrompt = (window as Window & { _installPrompt?: BeforeInstallPromptEvent | null })._installPrompt;
    if (!installPrompt) {
      toast({ title: "Téléchargement indisponible", description: "Ouvrez ce site dans un navigateur compatible pour l’installer." });
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      toast({ title: "Installation non disponible", description: "Vous pourrez réessayer depuis le menu de votre navigateur." });
    } finally {
      (window as Window & { _installPrompt?: BeforeInstallPromptEvent | null })._installPrompt = null;
    }
  };
  const copyReferralId = async () => {
    await copyTextWithToast(user.referralCode, {
      successTitle: "Copie réussie",
      failureDescription: "Votre navigateur n’a pas autorisé l’accès au presse-papiers.",
    });
  };
  const handleGiftCodeModalChange = (open: boolean) => {
    setShowGiftCodeModal(open);
    if (!open && new URLSearchParams(window.location.search).get("giftCode") === "open") navigate("/account", { replace: true });
  };

  const actionTiles = [
    { label: "Recharger", icon: depositIcon, path: "/deposit" },
    { label: "Retirer", icon: withdrawalIcon, path: "/withdrawal" },
    { label: "Mes commandes", icon: orderIcon, path: "/orders" },
    { label: "Carte bancaire", icon: bankCardIcon, path: "/wallet" },
  ];
  const businessTiles = [
    { label: "Mes Deposit", icon: commissionIcon, path: "/deposits-history?from=account" },
    { label: "Mes Withdrawal", icon: rewardIcon, path: "/withdrawal-history?from=account" },
  ];
  const serviceTiles = [
    { label: "Aide", icon: serviceIcon, path: "/service" },
    { label: "VIP", icon: vipIcon, path: "/vip" },
    { label: "Telegram", icon: telegramIcon, path: "/service" },
    { label: "Notice", icon: noticeIcon, path: "/notice" },
  ];

  return (
    <main className="account-page">
      <div className="account-shell">
        <section className="account-identity" aria-label="Profil du compte">
          <img className="account-avatar" src={PEPSICO_LOGO} alt="PepsiCo" />
          <span className="account-identity-copy">
            <span className="account-name-row">
              <span className="account-name">{user.fullName}</span>
              <span className="account-vip-tag">VIP{vipLevel}</span>
            </span>
            <span className="account-id-line">
              <span>{maskedPhone}</span>
              <span className="account-id">ID : {user.referralCode}</span>
              <button type="button" className="account-copy" onClick={() => void copyReferralId()} aria-label="Copier mon identifiant de parrainage">
                <img src={copyIcon} alt="" aria-hidden="true" />
              </button>
            </span>
          </span>
          <button type="button" className="account-open-profile" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu du profil">
            <ChevronRight className="account-identity-chevron" aria-hidden="true" />
          </button>
        </section>

        <section className="account-balances" aria-label="Soldes du compte">
          <div><strong>{formatFcfa(user.depositBalance)}</strong><span>Solde de dépôt</span></div>
          <div><strong>{formatFcfa(user.withdrawalBalance)}</strong><span>Solde de retrait</span></div>
        </section>

        <section className="account-main-card" aria-label="Niveau VIP et opérations">
          <div className="account-vip-panel">
            <div className="account-vip-heading">
              <img src={currentVipBadge} alt="" aria-hidden="true" />
              <strong>Niveau VIP</strong>
              <span>VIP {vipLevel}</span>
            </div>
            {nextVipLevel ? (
              <div className="account-vip-progress">
                <p>
                  Le passage à VIP{nextVipLevel.level} nécessite{" "}
                  <strong>
                    {formatFcfa(Math.max(0, nextVipLevel.thresholdFcfa - nextVipLevel.progressFcfa))}
                  </strong>{" "}
                  supplémentaires.
                </p>
                <div
                  className="account-vip-progress-track"
                  role="progressbar"
                  aria-label={`Progression vers VIP ${nextVipLevel.level}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(100, Math.max(0, nextVipLevel.progressPercent)))}
                >
                  <span
                    style={{
                      transform: `scaleX(${Math.min(100, Math.max(0, nextVipLevel.progressPercent)) / 100})`,
                    }}
                  />
                </div>
              </div>
            ) : vipLevels?.levels.length ? (
              <p className="account-vip-max-level">Vous avez atteint le niveau VIP maximal.</p>
            ) : null}
            <img className="account-vip-badge" src={currentVipBadge} alt={`Badge VIP ${vipLevel}`} />
          </div>
          <nav className="account-tile-grid account-actions" aria-label="Opérations">
            {actionTiles.map((item) => (
              <button type="button" key={item.label} onClick={() => navigate(item.path)} className="account-tile">
                <img src={item.icon} alt="" aria-hidden="true" /><span>{item.label}</span>
              </button>
            ))}
          </nav>
        </section>

        <section className="account-section-card">
          <h2>Mon activité</h2>
          <nav className="account-tile-grid account-business" aria-label="Mon activité">
            {businessTiles.map((item) => (
              <button type="button" key={item.label} onClick={() => navigate(item.path)} className="account-tile">
                <img src={item.icon} alt="" aria-hidden="true" /><span>{item.label}</span>
              </button>
            ))}
          </nav>
        </section>

        <section className="account-section-card account-other-services">
          <h2>Autres services</h2>
          <nav className="account-tile-grid account-services" aria-label="Autres services">
            {serviceTiles.map((item) => (
              <button type="button" key={item.label} onClick={() => navigate(item.path)} className="account-tile">
                <img src={item.icon} alt="" aria-hidden="true" /><span>{item.label}</span>
              </button>
            ))}
          </nav>
        </section>
      </div>

      {drawerOpen && (
        <div className="account-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
          <aside className="account-drawer" aria-label="Menu du profil">
            <button type="button" className="account-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Fermer le menu"><X /></button>
            <div className="account-drawer-head">
              <img src={PEPSICO_LOGO} alt="PepsiCo" />
              <div><strong>{user.fullName}</strong><span className="account-drawer-vip">VIP{vipLevel}</span>
                <span className="account-drawer-meta"><b>ID : {user.referralCode}</b><span>{maskedPhone}</span></span>
              </div>
            </div>
            <button type="button" className="account-profile-link" onClick={() => { setDrawerOpen(false); navigate("/account/info"); }}>
              <Settings2 aria-hidden="true" /><span>Profil utilisateur</span><ChevronRight aria-hidden="true" />
            </button>
            {user.isAdmin && <button type="button" className="account-profile-link" onClick={handleAdminClick}><Settings2 aria-hidden="true" /><span>Administration</span><ChevronRight aria-hidden="true" /></button>}
            <button type="button" className="account-logout-button" onClick={() => void handleLogout()}><LogOut aria-hidden="true" />Déconnexion</button>
          </aside>
        </div>
      )}

      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-center">Code d’accès administrateur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">Entrez votre code PIN pour accéder au panel administrateur.</p>
            <Input type="password" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Code PIN" className="text-center text-2xl tracking-widest" maxLength={8} data-testid="input-admin-pin" />
            <Button onClick={() => { if (adminPin.length < 4) { toast({ title: "Le code PIN doit contenir au moins 4 caractères", variant: "destructive" }); return; } verifyPinMutation.mutate(adminPin); }} disabled={verifyPinMutation.isPending || adminPin.length < 4} className="w-full bg-[#367c2b] hover:bg-[#285f20]" data-testid="button-verify-pin">
              {verifyPinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <GiftCodeModal open={showGiftCodeModal} onOpenChange={handleGiftCodeModalChange} />
    </main>
  );
}
