import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import bindCardIllustration from "@assets/bind_card_1793924366936.png";
import dialogIcon from "@assets/dialog_icon_1793924366976.png";
import withdrawalHistoryIcon from "@assets/history_1793924367002.png";
import "./withdrawal.css";

interface WalletData {
  id: number;
  accountName: string;
  accountNumber: string;
  paymentMethod: string;
  country: string;
  isDefault: boolean;
}

interface UserProduct {
  id: number;
  status: string;
  daysRemaining: number;
  productType: "stable" | "activity" | "wellness";
}

interface WithdrawalSettings {
  withdrawalFees: number;
  withdrawalStartHour: number;
  withdrawalEndHour: number;
  maxWithdrawalsPerDay: number;
  minWithdrawal: number;
}

const formatFcfa = (amount: number) =>
  `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;

export default function WithdrawalPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [amount, setAmount] = useState<number | "">("");
  const [transactionPassword, setTransactionPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const [showBindPrompt, setShowBindPrompt] = useState(false);

  const transactionPasswordStatus = useQuery<{ hasPassword: boolean }>({
    queryKey: ["/api/auth/transaction-password/status"],
    enabled: Boolean(user),
  });

  const { data: withdrawalSettings } = useQuery<WithdrawalSettings>({
    queryKey: ["/api/settings/withdrawal"],
    enabled: Boolean(user),
  });

  const { data: wallets = [], isLoading: walletsLoading } = useQuery<WalletData[]>({
    queryKey: ["/api/wallets"],
    enabled: Boolean(user),
  });

  const { data: userProducts = [] } = useQuery<UserProduct[]>({
    queryKey: ["/api/user/products"],
    enabled: Boolean(user),
  });

  const minWithdrawal = withdrawalSettings?.minWithdrawal ?? 1500;
  const withdrawalFee = withdrawalSettings?.withdrawalFees ?? 18;
  const withdrawalStartHour = withdrawalSettings?.withdrawalStartHour ?? 9;
  const withdrawalEndHour = withdrawalSettings?.withdrawalEndHour ?? 17;
  const maxWithdrawalsPerDay = withdrawalSettings?.maxWithdrawalsPerDay ?? 1;
  const balance = Number(user?.withdrawalBalance ?? 0);
  const hasActiveStableProduct = userProducts.some(
    (product) =>
      product.status === "active" &&
      product.daysRemaining > 0 &&
      product.productType === "stable",
  );

  useEffect(() => {
    if (user && transactionPasswordStatus.data && !transactionPasswordStatus.data.hasPassword) {
      navigate("/transaction-password/setup?next=withdraw");
    }
  }, [user, transactionPasswordStatus.data, navigate]);

  useEffect(() => {
    if (walletsLoading) return;

    if (wallets.length === 0) {
      localStorage.removeItem("selectedWalletId");
      setSelectedWallet(null);
      return;
    }

    const storedId = localStorage.getItem("selectedWalletId");
    const storedWallet = storedId
      ? wallets.find((wallet) => wallet.id === Number(storedId))
      : undefined;

    if (storedId) localStorage.removeItem("selectedWalletId");
    setSelectedWallet(storedWallet ?? wallets.find((wallet) => wallet.isDefault) ?? wallets[0]);
  }, [wallets, walletsLoading]);

  useEffect(() => {
    if (walletsLoading) return;
    if (wallets.length === 0) setShowBindPrompt(true);
    else setShowBindPrompt(false);
  }, [wallets.length, walletsLoading]);

  useEffect(() => {
    if (!showBindPrompt) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowBindPrompt(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showBindPrompt]);

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: number; walletId: number; transactionPassword: string }) => {
      const response = await apiRequest("POST", "/api/withdrawals", data);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Impossible d’envoyer la demande de retrait.");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Demande envoyée",
        description: "Votre demande de retrait a été envoyée.",
      });
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/history"] });
      setAmount("");
      setTransactionPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (wallets.length === 0) {
      setShowBindPrompt(true);
      return;
    }
    if (!selectedWallet) {
      navigate("/wallet?from=withdrawal&mode=form");
      return;
    }

    const hour = new Date().getHours();
    if (hour < withdrawalStartHour || hour >= withdrawalEndHour) {
      toast({
        title: "Horaires de retrait",
        description: `Les retraits sont disponibles de ${withdrawalStartHour}h à ${withdrawalEndHour}h.`,
        variant: "destructive",
      });
      return;
    }
    if (!hasActiveStableProduct) {
      toast({
        title: "Produit requis",
        description: "Vous devez avoir un produit stable actif pour effectuer un retrait.",
        variant: "destructive",
      });
      return;
    }
    if (!amount || !Number.isInteger(amount) || amount < minWithdrawal) {
      toast({
        title: "Montant invalide",
        description: `Le montant minimum est de ${formatFcfa(minWithdrawal)}.`,
        variant: "destructive",
      });
      return;
    }
    if (amount > balance) {
      toast({
        title: "Solde insuffisant",
        description: "Le montant demandé dépasse votre solde de retrait.",
        variant: "destructive",
      });
      return;
    }
    if (!transactionPassword) {
      toast({
        title: "Mot de passe requis",
        description: "Saisissez votre mot de passe de retrait.",
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate({
      amount,
      walletId: selectedWallet.id,
      transactionPassword,
    });
  };

  if (!user) return null;

  if (walletsLoading || transactionPasswordStatus.isLoading) {
    return (
      <main className="withdrawal-v2 withdrawal-v2__loading" aria-label="Chargement">
        <Loader2 aria-hidden="true" />
      </main>
    );
  }

  const startTime = `${String(withdrawalStartHour).padStart(2, "0")}:00`;
  const endTime = `${String(withdrawalEndHour).padStart(2, "0")}:00`;
  const selectedAccountLabel = selectedWallet
    ? `${selectedWallet.paymentMethod} · ${selectedWallet.accountNumber}`
    : "Sélectionnez un compte mobile money";

  return (
    <main className="withdrawal-v2">
      <div className="withdrawal-v2__screen">
        <header className="withdrawal-v2__header">
          <button
            type="button"
            className="withdrawal-v2__back"
            onClick={() => navigate("/account")}
            aria-label="Retour"
            data-testid="button-back"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1 className="withdrawal-v2__title">retirer</h1>
        </header>

        <form
          className="withdrawal-v2__form"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="withdrawal-v2__field">
            <label className="withdrawal-v2__label" htmlFor="withdrawal-amount">
              Montant du retrait
            </label>
            <div className="withdrawal-v2__control">
              <input
                id="withdrawal-amount"
                type="number"
                min={minWithdrawal}
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value ? Number(event.target.value) : "")}
                placeholder={`Montant minimum ${formatFcfa(minWithdrawal)}`}
                data-testid="input-withdrawal-amount"
              />
            </div>
          </div>

          <div className="withdrawal-v2__field">
            <label className="withdrawal-v2__label" htmlFor="withdrawal-password">
              Mot de passe de transaction
            </label>
            <div className="withdrawal-v2__control">
              <input
                id="withdrawal-password"
                type={passwordVisible ? "text" : "password"}
                value={transactionPassword}
                onChange={(event) => setTransactionPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Mot de passe de transaction"
                data-testid="input-transaction-password"
              />
              <button
                type="button"
                className="withdrawal-v2__password-toggle"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {passwordVisible
                  ? <Eye aria-hidden="true" />
                  : <EyeOff aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="withdrawal-v2__field">
            <label className="withdrawal-v2__label" htmlFor="withdrawal-account">
              Compte mobile money sélectionné
            </label>
            <button
              id="withdrawal-account"
              type="button"
              className="withdrawal-v2__account-select"
              onClick={() => {
                if (wallets.length === 0) setShowBindPrompt(true);
                else navigate("/wallet?from=withdrawal&mode=form");
              }}
              aria-label={selectedWallet
                ? `Compte ${selectedWallet.paymentMethod}, ${selectedWallet.accountNumber}`
                : "Sélectionner un opérateur de retrait"}
              data-testid="button-select-wallet"
            >
              <span>{selectedAccountLabel}</span>
              <ChevronDown aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="withdrawal-v2__history-link"
            onClick={() => navigate("/withdrawal-history?from=withdrawal")}
            data-testid="button-withdrawal-history"
          >
            <img src={withdrawalHistoryIcon} alt="" aria-hidden="true" />
            <span>Retraits récents</span>
            <ChevronRight aria-hidden="true" />
          </button>

          <section className="withdrawal-v2__rules" aria-label="Remarques importantes">
            <h2 className="withdrawal-v2__rules-title">Remarques importantes</h2>
            <ol>
              <li>Heures de retrait quotidiennes : {startTime} – {endTime}.</li>
              <li>Montant minimum de retrait : {formatFcfa(minWithdrawal)}.</li>
              <li>
                Un produit stable actif est nécessaire, dans la limite de{" "}
                {maxWithdrawalsPerDay} retrait{maxWithdrawalsPerDay > 1 ? "s" : ""} par jour.
              </li>
              <li>Taux de retrait : {withdrawalFee} %.</li>
            </ol>
          </section>
        </form>
      </div>

      <div className="withdrawal-v2__submit-bar">
        <button
          type="button"
          className="withdrawal-v2__submit"
          onClick={handleSubmit}
          disabled={withdrawMutation.isPending}
          data-testid="button-submit-withdrawal"
        >
          {withdrawMutation.isPending
            ? <Loader2 aria-hidden="true" />
            : "Demande de retrait"}
        </button>
      </div>

      <WithdrawalFloatingTools />

      {showBindPrompt && wallets.length === 0 && (
        <div
          className="withdrawal-v2__dialog-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowBindPrompt(false);
          }}
        >
          <section
            className="withdrawal-v2__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-bind-title"
            aria-describedby="withdrawal-bind-copy"
          >
            <h2 id="withdrawal-bind-title" className="withdrawal-v2__dialog-heading">
              <img src={dialogIcon} alt="" aria-hidden="true" />
              Petit rappel amical
            </h2>
            <img
              className="withdrawal-v2__bind-image"
              src={bindCardIllustration}
              alt=""
              aria-hidden="true"
            />
            <p id="withdrawal-bind-copy" className="withdrawal-v2__dialog-copy">
              Vous n’avez pas encore associé votre compte mobile money. Veuillez l’associer d’abord.
            </p>
            <div className="withdrawal-v2__dialog-actions">
              <button
                type="button"
                className="withdrawal-v2__dialog-button withdrawal-v2__dialog-button--cancel"
                onClick={() => setShowBindPrompt(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="withdrawal-v2__dialog-button withdrawal-v2__dialog-button--bind"
                onClick={() => navigate("/wallet?from=withdrawal&mode=form")}
              >
                Lier mon compte
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
