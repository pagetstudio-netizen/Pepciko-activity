import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPaymentMethodsForCountry, type ApiCountry } from "@/lib/countries";
import { Loader2, Trash2, CreditCard, ChevronLeft, ChevronRight, ChevronDown, Building2, UserRound, Smartphone, Shield, Check } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import type { WithdrawalWallet } from "@shared/schema";
import EmptyState from "@/components/empty-state";
import "./wallet.css";

const walletSchema = z.object({
  accountName: z.string().min(2, "Nom du titulaire requis"),
  accountNumber: z.string().min(8, "Numéro requis"),
  paymentMethod: z.string().min(2, "Moyen de paiement requis"),
});

type WalletForm = z.infer<typeof walletSchema>;

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const selectMode = params.get("from") === "withdrawal";
  const [showBankSheet, setShowBankSheet] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const bankPickerRef = useRef<HTMLDivElement | null>(null);

  const { data: wallets, isLoading } = useQuery<WithdrawalWallet[]>({
    queryKey: ["/api/wallets"],
  });
  // A user has one editable withdrawal account, so the legacy account-picker
  // list should never be shown, including on /wallet?from=withdrawal.
  const showForm = true;

  const { data: apiCountries = [] } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
  });

  useEffect(() => {
    if (!showBankSheet) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !bankPickerRef.current?.contains(event.target)) {
        setShowBankSheet(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowBankSheet(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showBankSheet]);

  const form = useForm<WalletForm>({
    resolver: zodResolver(walletSchema),
    defaultValues: { accountName: "", accountNumber: "", paymentMethod: "" },
  });

  const primaryWallet = wallets?.find((wallet) => wallet.isDefault) ?? wallets?.[0];
  const formInitialized = useRef(false);

  useEffect(() => {
    if (!showForm || isLoading || formInitialized.current) return;
    formInitialized.current = true;
    if (!primaryWallet) return;

    form.reset({
      accountName: primaryWallet.accountName,
      accountNumber: primaryWallet.accountNumber,
      paymentMethod: primaryWallet.paymentMethod,
    });
    setSelectedMethod(primaryWallet.paymentMethod);
  }, [form, isLoading, primaryWallet, showForm]);

  const addMutation = useMutation({
    mutationFn: async (data: WalletForm) => {
      const response = await apiRequest("POST", "/api/wallets", {
        ...data,
        country: user!.country,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: (savedWallet: WithdrawalWallet) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Compte de retrait enregistré" });
      form.reset({
        accountName: savedWallet.accountName,
        accountNumber: savedWallet.accountNumber,
        paymentMethod: savedWallet.paymentMethod,
      });
      setSelectedMethod(savedWallet.paymentMethod);
      if (selectMode) {
        localStorage.setItem("selectedWalletId", savedWallet.id.toString());
        navigate("/withdrawal");
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (walletId: number) => {
      const response = await apiRequest("DELETE", `/api/wallets/${walletId}`, {});
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Portefeuille supprimé !" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (walletId: number) => {
      const response = await apiRequest("PATCH", `/api/wallets/${walletId}/default`, {});
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectWallet = (wallet: WithdrawalWallet) => {
    if (selectMode) {
      localStorage.setItem("selectedWalletId", wallet.id.toString());
      navigate("/withdrawal");
    }
  };

  const handleChooseMethod = (method: string) => {
    setSelectedMethod(method);
    form.setValue("paymentMethod", method);
    setShowBankSheet(false);
  };

  const handleSubmit = () => {
    form.handleSubmit((data) => addMutation.mutate(data))();
  };

  if (!user) return null;

  const paymentMethods = getPaymentMethodsForCountry(user.country, apiCountries);
  const backLink = selectMode ? "/withdrawal" : "/account";
  const withdrawalBalance = Number(user.withdrawalBalance ?? 0);
  const formattedWithdrawalBalance = (Number.isFinite(withdrawalBalance) ? withdrawalBalance : 0)
    .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ─── ADD FORM VIEW ─── */
  if (showForm) {
    return (
      <main className="wallet-info-page">
        <div className="wallet-info-content">
          <header className="wallet-info-header">
            <button
              type="button"
              className="wallet-info-back"
              onClick={() => navigate(backLink)}
              aria-label="Retour"
              data-testid="button-back-form"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <h1>Informations sur la carte bancaire</h1>
          </header>

          <section className="wallet-info-balance" aria-label="Solde de retrait">
            <strong><span>FCFA</span> {formattedWithdrawalBalance}</strong>
            <span className="wallet-info-balance-label">Solde de retrait</span>
          </section>

          <form
            className="wallet-info-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <div className="wallet-info-field">
              <label htmlFor="wallet-method-trigger">Sélectionner l’opérateur</label>
              <div className="wallet-operator-picker" ref={bankPickerRef}>
                <button
                  id="wallet-method-trigger"
                  type="button"
                  className={`wallet-info-control wallet-operator-trigger${form.formState.errors.paymentMethod ? " has-error" : ""}`}
                  onClick={() => setShowBankSheet((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={showBankSheet}
                  aria-controls="wallet-operator-options"
                  aria-label="Sélectionner l’opérateur"
                  data-testid="button-select-bank"
                >
                  <Building2 aria-hidden="true" />
                  <span className={selectedMethod ? "has-value" : ""}>
                    {selectedMethod || "Veuillez sélectionner un opérateur"}
                  </span>
                  <ChevronDown aria-hidden="true" className={showBankSheet ? "is-open" : ""} />
                </button>
                {showBankSheet && (
                  <div
                    id="wallet-operator-options"
                    className="wallet-operator-menu"
                    role="listbox"
                    aria-label="Opérateurs disponibles"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={!selectedMethod}
                      className="wallet-operator-option is-placeholder"
                      onClick={() => handleChooseMethod("")}
                    >
                      Veuillez sélectionner un opérateur
                    </button>
                    {paymentMethods.length > 0 ? paymentMethods.map((method) => (
                      <button
                        type="button"
                        role="option"
                        key={method}
                        aria-selected={selectedMethod === method}
                        className={`wallet-operator-option${selectedMethod === method ? " is-selected" : ""}`}
                        onClick={() => handleChooseMethod(method)}
                        data-testid={`button-bank-${method}`}
                      >
                        {method}
                      </button>
                    )) : (
                      <div className="wallet-operator-empty">
                        Aucun opérateur disponible pour votre pays.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {form.formState.errors.paymentMethod && (
                <p className="wallet-info-error">{form.formState.errors.paymentMethod.message}</p>
              )}
            </div>

            <div className="wallet-info-field">
              <label htmlFor="wallet-account-name">Nom du titulaire du compte</label>
              <div className={`wallet-info-control${form.formState.errors.accountName ? " has-error" : ""}`}>
                <UserRound aria-hidden="true" />
                <input
                  {...form.register("accountName")}
                  id="wallet-account-name"
                  autoComplete="name"
                  placeholder="Nom du titulaire du compte"
                  data-testid="input-wallet-name"
                />
              </div>
              {form.formState.errors.accountName && (
                <p className="wallet-info-error">{form.formState.errors.accountName.message}</p>
              )}
            </div>

            <div className="wallet-info-field">
              <label htmlFor="wallet-account-number">Numéro de téléphone</label>
              <div className={`wallet-info-control${form.formState.errors.accountNumber ? " has-error" : ""}`}>
                <Smartphone aria-hidden="true" />
                <input
                  {...form.register("accountNumber")}
                  id="wallet-account-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Numéro associé à l’opérateur"
                  data-testid="input-wallet-number"
                />
              </div>
              {form.formState.errors.accountNumber && (
                <p className="wallet-info-error">{form.formState.errors.accountNumber.message}</p>
              )}
            </div>

            <section className="wallet-info-notes" aria-label="Informations importantes">
              <p><span>1.</span> Vous ne pouvez enregistrer qu’un seul compte de retrait.</p>
              <p><span>2.</span> Le numéro doit correspondre au compte de l’opérateur sélectionné.</p>
              <p><span>3.</span> Vérifiez le nom du titulaire et le numéro avant d’enregistrer.</p>
            </section>
          </form>
        </div>

        <div className="wallet-info-footer">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={addMutation.isPending}
            className="wallet-info-submit"
            data-testid="button-confirm-wallet"
          >
            {addMutation.isPending ? (
              <span className="wallet-info-pending"><Loader2 aria-hidden="true" /> Enregistrement...</span>
            ) : primaryWallet ? (
              "Enregistrer les modifications"
            ) : (
              "Ajouter un compte de retrait"
            )}
          </button>
        </div>
      </main>
    );
  }

  /* ─── LIST VIEW ─── */
  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* Header */}
      <div
        className="flex items-center px-4 py-4"
        style={{ background: "linear-gradient(112deg, #55c9e5 0%, #3174d1 100%)" }}
      >
        <Link href={backLink}>
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20" data-testid="button-back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-base">
          {selectMode ? "Sélectionner un compte" : "Liste des comptes bancaires"}
        </h1>
        <div className="w-9" />
      </div>

      {/* Wallet list */}
      <div className="flex-1 px-4 pt-4 pb-28 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#3174d1]" />
          </div>
        ) : wallets && wallets.length > 0 ? (
          wallets.map((wallet) => (
            <div
              key={wallet.id}
              onClick={() => selectMode && handleSelectWallet(wallet)}
              className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 ${
                selectMode ? "cursor-pointer active:opacity-80" : ""
              } ${wallet.isDefault ? "border-l-4 border-[#3174d1]" : ""}`}
              data-testid={`wallet-card-${wallet.id}`}
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-gray-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">{wallet.paymentMethod}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{wallet.accountName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{wallet.accountNumber}</p>
                {wallet.isDefault && (
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-[#3174d1]" />
                    <span className="text-xs text-[#3174d1] font-medium">Par défaut</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!selectMode && (
                <div className="flex items-center gap-1">
                  {!wallet.isDefault && (
                    <button
                      onClick={() => setDefaultMutation.mutate(wallet.id)}
                      disabled={setDefaultMutation.isPending}
                      className="p-2"
                      data-testid={`button-set-default-${wallet.id}`}
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(wallet.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2"
                    data-testid={`button-delete-wallet-${wallet.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-[#3174d1]" />
                  </button>
                </div>
              )}

              {selectMode && (
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
            </div>
          ))
        ) : (
           <EmptyState className="text-center py-10 flex flex-col items-center gap-2">
            <p className="text-gray-500 text-sm">Aucun compte bancaire enregistré</p>
            <p className="text-gray-400 text-xs mt-1">Ajoutez un compte pour effectuer des retraits</p>
           </EmptyState>
        )}
      </div>

    </div>
  );
}
