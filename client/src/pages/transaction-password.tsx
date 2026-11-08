import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import "./transaction-password.css";

const STATUS_KEY = ["/api/auth/transaction-password/status"];

export default function TransactionPasswordPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const next = new URLSearchParams(search).get("next") === "withdraw" ? "/withdraw" : "/";
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaCountdown, setCaptchaCountdown] = useState<number | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState("");

  const statusQuery = useQuery<{ hasPassword: boolean }>({
    queryKey: STATUS_KEY,
    enabled: Boolean(user),
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/transaction-password", {
        password,
        captchaCode,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Impossible d’enregistrer le mot de passe.");
      return result as { success: boolean };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      toast({ title: "Mot de passe créé", description: "Il sera demandé pour confirmer vos retraits." });
      navigate(next);
    },
    onError: (error: Error) => toast({
      title: "Vérification impossible",
      description: error.message,
      variant: "destructive",
    }),
  });

  useEffect(() => {
    if (captchaCountdown === null) return;
    if (captchaCountdown > 0) {
      const timer = window.setTimeout(() => {
        setCaptchaCountdown((remaining) => remaining === null ? null : remaining - 1);
      }, 1000);
      return () => window.clearTimeout(timer);
    }

    setCaptchaCountdown(null);
    setCaptchaLoading(true);
    void apiRequest("POST", "/api/auth/captcha", { scope: "transaction_password" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Impossible de générer le code.");
        setCaptchaImage(result.image);
        setCaptchaError("");
      })
      .catch((error: Error) => setCaptchaError(error.message))
      .finally(() => setCaptchaLoading(false));
  }, [captchaCountdown]);

  async function startCaptcha() {
    setCaptchaError("");
    setCaptchaImage("");
    setCaptchaCode("");
    try {
      const response = await apiRequest("POST", "/api/auth/captcha/start", { scope: "transaction_password" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Impossible de demander un code.");
      setCaptchaCountdown(Number(result.countdownSeconds) || 5);
    } catch (error) {
      setCaptchaError(error instanceof Error ? error.message : "Impossible de demander un code.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (statusQuery.data?.hasPassword) return;
    if (password.length < 6 || password.length > 128) {
      toast({
        title: "Mot de passe invalide",
        description: "Choisissez un mot de passe de 6 à 128 caractères.",
        variant: "destructive",
      });
      return;
    }
    if (captchaCode.trim().length !== 6) {
      toast({
        title: "Code manquant",
        description: "Saisissez les 6 caractères affichés dans l’image.",
        variant: "destructive",
      });
      return;
    }
    setupMutation.mutate();
  }

  const returnToNext = () => navigate(next);

  return (
    <main className="transaction-password-page">
      <div className="transaction-password-shell">
        <header className="transaction-password-header">
          <button type="button" onClick={returnToNext} aria-label="Retour">
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1>Définition du mot de passe de retrait</h1>
        </header>

        {statusQuery.isLoading ? (
          <div className="transaction-password-loading" aria-label="Chargement">
            <Loader2 className="animate-spin" />
          </div>
        ) : statusQuery.data?.hasPassword ? (
          <section className="transaction-password-already">
            <h2>Un mot de passe est déjà défini</h2>
            <p>Il sera demandé pour confirmer chaque demande de retrait.</p>
            <button type="button" onClick={returnToNext}>Continuer</button>
          </section>
        ) : (
          <form className="transaction-password-form" onSubmit={handleSubmit}>
            <div className="transaction-password-field">
              <label htmlFor="transaction-captcha">Code de vérification</label>
              {captchaImage && (
                <img className="transaction-captcha-image" src={captchaImage} alt="Code de vérification à recopier" />
              )}
              <div className="transaction-password-input-row">
                <input
                  id="transaction-captcha"
                  value={captchaCode}
                  onChange={(event) => setCaptchaCode(event.target.value.toUpperCase().slice(0, 6))}
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="Saisissez le code affiché"
                  aria-invalid={Boolean(captchaError)}
                />
                <button
                  type="button"
                  onClick={startCaptcha}
                  disabled={captchaLoading || captchaCountdown !== null}
                >
                  {captchaCountdown !== null ? `${captchaCountdown}s` : captchaLoading ? "…" : "Générer"}
                </button>
              </div>
              {captchaError && <p className="transaction-password-error" role="alert">{captchaError}</p>}
            </div>

            <div className="transaction-password-field">
              <label htmlFor="transaction-password">Mot de passe de retrait</label>
              <div className="transaction-password-input-row">
                <input
                  id="transaction-password"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  placeholder="Créez un mot de passe"
                  aria-label="Mot de passe de retrait"
                />
                <button
                  type="button"
                  className="transaction-password-visibility"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              className="transaction-password-submit"
              type="submit"
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? <Loader2 className="animate-spin" /> : "Enregistrer le mot de passe"}
            </button>
          </form>
        )}

        <aside className="transaction-password-notes">
          <h2>Remarques importantes</h2>
          <p>1. Ce mot de passe est indispensable pour effectuer vos retraits. Conservez-le en lieu sûr.</p>
          <p>2. N’utilisez pas le même mot de passe que pour vous connecter.</p>
          <p>3. En cas d’oubli, contactez le service client avant de demander un retrait.</p>
        </aside>
      </div>
    </main>
  );
}
