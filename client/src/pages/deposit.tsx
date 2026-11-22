import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyTextWithToast } from "@/lib/copy-to-clipboard";
import {
  ChevronLeft, Copy, CheckCircle, Upload, Phone, Loader2,
  ImageIcon, ArrowRight, Zap, RefreshCw, ExternalLink,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ApiCountry } from "@/lib/countries";
import type { PaymentNumber } from "@shared/schema";
import { getPpayProsPhoneError, normalizePpayProsPhone } from "@shared/phone";
import { getPpayProsCountryRegistrationMessage } from "@shared/ppaypros";
import { getPaymentOperatorLogo } from "@/lib/payment-operator-logos";
import EmptyState from "@/components/empty-state";
import WithdrawalFloatingTools from "@/components/withdrawal-floating-tools";

const TON_GREEN = "#367C2B";
const TON_GREEN_DARK = "#25591C";
const TON_GRADIENT = `linear-gradient(112deg, ${TON_GREEN} 0%, ${TON_GREEN_DARK} 100%)`;
const DEPOSIT_ERROR_MESSAGE = "Impossible de traiter le dépôt. Réessayez ou contactez le service client.";

type Step =
  | "amount"
  | "select"
  | "form"
  | "sv-operator"
  | "sv-waiting"
  | "sv-otp"
  | "sv-redirect"
  | "westpay"
  | "ashtech-operator"
  | "ashtech-otp"
  | "ashtech-redirect"
  | "ashtech-waiting";

interface SvOperator {
  id: string;
  name: string;
  requiresOtp: boolean;
  status: string;
}

interface AshtechCountry {
  code: string;
  name: string;
  currency: string;
  operators: (string | { name?: string; code?: string; id?: string })[];
}

export default function DepositPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("amount");
  const [selectedNumber, setSelectedNumber] = useState<PaymentNumber | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [robotPayLoading, setRobotPayLoading] = useState(false);
  const robotPayTransitionTimer = useRef<number | null>(null);

  const [amount, setAmount] = useState<number | "">("");
  const [depositCountry, setDepositCountry] = useState("");
  const [senderPhone, setSenderPhone] = useState(user?.phone || "");
  const [screenshot, setScreenshot] = useState<string>("");
  const [screenshotName, setScreenshotName] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => () => {
    if (robotPayTransitionTimer.current !== null) {
      window.clearTimeout(robotPayTransitionTimer.current);
    }
  }, []);

  // SendavaPay state
  const [svCountry, setSvCountry] = useState(user?.country || "");
  const [svPhone, setSvPhone] = useState("");
  const [svOperator, setSvOperator] = useState<SvOperator | null>(null);
  const [svDepositId, setSvDepositId] = useState<number | null>(null);
  const [svPaymentToken, setSvPaymentToken] = useState<string>("");
  const [svOtpToken, setSvOtpToken] = useState<string>("");
  const [svOtp, setSvOtp] = useState<string>("");
  const [svUssdCode, setSvUssdCode] = useState<string>("");
  const [svOtpMessage, setSvOtpMessage] = useState<string>("");
  const [svRedirectUrl, setSvRedirectUrl] = useState<string>("");
  const [svStatus, setSvStatus] = useState<string>("");
  const [svPolling, setSvPolling] = useState(false);

  // AshtechPay state
  const [ashtechCountry, setAshtechCountry] = useState(user?.country || "");
  const [ashtechPhone, setAshtechPhone] = useState("");
  const [ashtechOperator, setAshtechOperator] = useState("");
  const [ashtechDepositId, setAshtechDepositId] = useState<number | null>(null);
  const [ashtechOtp, setAshtechOtp] = useState("");
  const [ashtechUssdCode, setAshtechUssdCode] = useState("");
  const [ashtechMessage, setAshtechMessage] = useState("");
  const [ashtechWaveUrl, setAshtechWaveUrl] = useState("");
  const [ashtechStatus, setAshtechStatus] = useState("");
  const [ashtechPolling, setAshtechPolling] = useState(false);

  const country = depositCountry;

  const { data: apiCountries = [] } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
  });

  const currency = "FCFA";

  const { data: platformSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });
  const MIN_DEPOSIT = parseInt(platformSettings?.minDeposit || "4000");
  const sendavapayEnabled = platformSettings?.sendavapayEnabled === "true";
  const sendavapayChannelName = platformSettings?.sendavapayChannelName || "SendavaPay";
  const westpayEnabled = platformSettings?.westpayEnabled === "true";
  const westpayChannelName = platformSettings?.westpayChannelName || "WestPay";
  const westpayCountries = platformSettings?.westpayCountries || "";
  const westpayAvailable = westpayEnabled && (
    !westpayCountries || westpayCountries.split(",").map(c => c.trim()).includes(country)
  );
  const ppayprosAvailable = (platformSettings?.ppayprosPayinCountries || "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .includes(country.toUpperCase());
  const inpayEnabled = platformSettings?.inpayEnabled === "true";
  const inpayChannelName = platformSettings?.inpayChannelName || "InPay";
  const inpayCountries = platformSettings?.inpayCountries || "";
  const inpayAvailable = inpayEnabled && inpayCountries
    .split(",")
    .map(c => c.trim().toUpperCase())
    .includes(country.toUpperCase());
  const ashtechEnabled = platformSettings?.ashtechEnabled === "true";
  const ashtechChannelName = platformSettings?.ashtechChannelName || "AshtechPay";
  const ashtechCountriesSetting = platformSettings?.ashtechCountries || "";
  const ashtechCountryAllowed = !ashtechCountriesSetting ||
    ashtechCountriesSetting.split(",").map(c => c.trim().toUpperCase()).includes(country.toUpperCase());
  const ashtechAvailable = ashtechEnabled && ashtechCountryAllowed;

  const activeDepositCountries = apiCountries.filter(c => c.isActive) as Array<{ code: string; name: string; currency: string }>;
  const ashtechConfiguredCountryCodes = ashtechCountriesSetting
    ? ashtechCountriesSetting.split(",").map(c => c.trim().toUpperCase()).filter(Boolean)
    : null;

  const { data: paymentNumbersList = [], isLoading: numbersLoading } = useQuery<PaymentNumber[]>({
    queryKey: ["/api/payment-numbers", country],
    queryFn: async () => {
      const res = await fetch(`/api/payment-numbers?country=${country}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!country,
  });

  // SendavaPay: load operators for selected country
  const { data: svOperatorsData, isLoading: svOperatorsLoading } = useQuery<{ success: boolean; data: SvOperator[] }>({
    queryKey: ["/api/sendavapay/operators", svCountry],
    queryFn: async () => {
      const res = await fetch(`/api/sendavapay/operators/${svCountry}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: step === "sv-operator" && !!svCountry,
  });
  const svOperators = (svOperatorsData?.data || []).filter(op => op.status === "online");

  const {
    data: ashtechCountries = [],
    isLoading: ashtechCountriesLoading,
    isError: ashtechCountriesFailed,
    refetch: refetchAshtechCountries,
  } = useQuery<AshtechCountry[]>({
    queryKey: ["/api/ashtechpay/countries"],
    queryFn: async () => {
      const res = await fetch("/api/ashtechpay/countries", { credentials: "include" });
      if (!res.ok) throw new Error("Impossible de charger les opérateurs");
      return res.json();
    },
    enabled: step === "ashtech-operator" && ashtechAvailable,
  });
  const availableAshtechCountries = ashtechCountries.filter(c =>
    activeDepositCountries.some(active => active.code.toUpperCase() === c.code.toUpperCase()) &&
    (!ashtechConfiguredCountryCodes || ashtechConfiguredCountryCodes.includes(c.code.toUpperCase()))
  );
  const selectedAshtechCountry = availableAshtechCountries.find(
    c => c.code.trim().toUpperCase() === ashtechCountry.trim().toUpperCase(),
  ) || availableAshtechCountries[0];
  const selectedAshtechCountryCode = selectedAshtechCountry?.code || "";
  const ashtechOperators = selectedAshtechCountry?.operators || [];

  // Poll deposit status
  useEffect(() => {
    if (step !== "sv-waiting" || !svDepositId || !svPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/deposits/${svDepositId}/sendavapay-status`, { credentials: "include" });
        const data = await res.json();
        setSvStatus(data.status);
        if (data.status === "approved") {
          clearInterval(interval);
          setSvPolling(false);
          toast({ title: "Paiement confirmé !", description: "Votre solde a été crédité." });
          refreshUser();
          queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
          // reset
          setStep("amount");
          setAmount("");
          setSvOperator(null);
          setSvDepositId(null);
          setSvPaymentToken("");
          setSvOtpToken("");
          setSvOtp("");
          setSvStatus("");
        } else if (data.status === "rejected") {
          clearInterval(interval);
          setSvPolling(false);
          toast({ title: "Paiement échoué", description: "Le paiement a été refusé ou annulé.", variant: "destructive" });
          setStep("sv-operator");
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, svDepositId, svPolling]);

  useEffect(() => {
    if (step !== "ashtech-waiting" || !ashtechDepositId || !ashtechPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/deposits/${ashtechDepositId}/ashtechpay-status`, { credentials: "include" });
        const data = await res.json();
        setAshtechStatus(data.status);
        if (data.status === "approved") {
          clearInterval(interval);
          setAshtechPolling(false);
          toast({ title: "Paiement confirmé !", description: "Votre solde a été crédité." });
          refreshUser();
          queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
          setStep("amount");
          setAmount("");
          setAshtechDepositId(null);
          setAshtechStatus("");
        } else if (data.status === "rejected") {
          clearInterval(interval);
          setAshtechPolling(false);
          toast({ title: "Paiement échoué", description: "Le paiement a été refusé ou annulé.", variant: "destructive" });
          setStep("ashtech-operator");
        }
      } catch {
        // Keep polling; a transient provider error must not lose the payment flow.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, ashtechDepositId, ashtechPolling]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const copyPhone = async (number: PaymentNumber) => {
    const value = number.paymentLink || number.phone || "";
    const copied = await copyTextWithToast(value, {
      successTitle: "Copie réussie",
      failureDescription: number.paymentLink
        ? "Copiez le lien manuellement."
        : "Copiez le numéro manuellement.",
    });
    if (!copied) return;
    setCopiedId(number.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop grand", description: "Maximum 5 Mo", variant: "destructive" });
      return;
    }
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!selectedNumber) throw new Error("Aucun numéro sélectionné");
      const res = await apiRequest("POST", "/api/deposits", {
        amount: Number(amount),
        accountName: user?.fullName || "",
        accountNumber: senderPhone,
        paymentMethod: selectedNumber.operatorName,
        country,
        paymentNumberId: selectedNumber.id,
        channelName: selectedNumber.paymentLink
          ? `${selectedNumber.operatorName} - Lien de paiement`
          : `${selectedNumber.operatorName} - ${selectedNumber.phone}`,
        screenshot: screenshot || null,
        paymentMessage: paymentMessage || null,
        reference: reference || null,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast(data.telegramNotificationSent === false
        ? {
            title: "Dépôt enregistré",
            description: "La notification à l’administration n’a pas abouti. Ne relancez pas le paiement ; contactez l’administration avec votre référence.",
            variant: "destructive",
          }
        : {
            title: "Demande envoyée !",
            description: "Votre dépôt est en attente de validation",
          });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
      refreshUser();
      setStep("amount");
      setSelectedNumber(null);
      setAmount("");
      setSenderPhone(user?.phone || "");
      setScreenshot("");
      setScreenshotName("");
      setPaymentMessage("");
      setReference("");
    },
    onError: () => toast({ title: "Erreur de dépôt", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" }),
  });

  // WestPay: create deposit + get redirect URL
  const [wpDepositId, setWpDepositId] = useState<number | null>(null);
  const [wpStatus, setWpStatus] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("wp_status");
    const did = params.get("wp_depositId");
    if (s) {
      setWpStatus(s);
      if (did) setWpDepositId(parseInt(did));
      // clean URL
      window.history.replaceState({}, "", "/deposit");
      if (s === "success") {
        toast({ title: "Paiement en cours de confirmation", description: "Votre dépôt sera crédité dès confirmation." });
        queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ppaypros_status") !== "returned") return;

    window.history.replaceState({}, "", "/deposit");
    toast({
      title: "Retour du paiement reçu",
      description: "Le solde sera crédité uniquement après confirmation du paiement.",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
  }, []);

  const wpInitiateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deposits", {
        amount: Number(amount),
        accountName: user?.fullName || "",
        accountNumber: user?.phone || "",
        paymentMethod: "WestPay",
        country,
        useWestpay: true,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur WestPay");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.westpayUrl) {
        window.location.href = data.westpayUrl;
      }
    },
    onError: () => toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" }),
  });

  const ppayprosInitiateMutation = useMutation({
    mutationFn: async () => {
      const countryCode = country.trim().toUpperCase();
      const accountCountry = (user?.country || countryCode).trim().toUpperCase();
      const customerPhone = normalizePpayProsPhone(accountCountry, user?.phone);
      if (!customerPhone) {
        throw new Error(getPpayProsPhoneError(accountCountry));
      }
      const res = await apiRequest("POST", "/api/deposits", {
        amount: Number(amount),
        accountName: user?.fullName || "",
        accountNumber: customerPhone,
        paymentMethod: "PPayPros",
        country,
        usePpaypros: true,
      });
      if (!res.ok) {
        const data = await res.json();
        const message = String(data.message || "");
        const registrationMessage = getPpayProsCountryRegistrationMessage(countryCode);
        throw new Error(
          message === registrationMessage
            ? message
            : /ppaypros/i.test(message)
            ? "Impossible de préparer le paiement. Réessayez ou contactez le service client."
            : message || "Impossible de préparer le paiement."
        );
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.ppayprosUrl) {
        window.location.assign(data.ppayprosUrl);
      } else {
        toast({ title: "Lien de paiement indisponible", description: "Aucun lien de paiement n'a été renvoyé.", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      const errorMessage = String(error.message || "");
      const signatureRejected = /signature verification failed/i.test(errorMessage);
      const registrationMessage = getPpayProsCountryRegistrationMessage(country);
      toast({
        title: errorMessage === registrationMessage
          ? "Pays du compte requis"
          : signatureRejected
            ? "Paiement refusé"
            : "Erreur de paiement",
        description: errorMessage === registrationMessage ? errorMessage : DEPOSIT_ERROR_MESSAGE,
        variant: "destructive",
      });
    },
  });

  const inpayInitiateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deposits", {
        amount: Number(amount),
        accountName: user?.fullName || "",
        accountNumber: user?.phone || "",
        paymentMethod: "InPay",
        country,
        useInpay: true,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur InPay");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.inpayUrl) {
        window.location.href = data.inpayUrl;
      }
    },
    onError: () => toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" }),
  });

  const ashtechCollectMutation = useMutation({
    mutationFn: async (otp?: string) => {
      if (!ashtechOperator || !ashtechPhone.trim()) throw new Error("Sélectionnez un opérateur et saisissez votre numéro");
      const res = await apiRequest("POST", "/api/ashtechpay/collect", {
        amount: Number(amount),
        country: selectedAshtechCountryCode,
        operator: ashtechOperator,
        phone: ashtechPhone.trim(),
        depositId: ashtechDepositId || undefined,
        otp: otp || undefined,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur AshtechPay");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setAshtechDepositId(data.depositId);
      setAshtechMessage(data.message || "");
      setAshtechUssdCode(data.ussdCode || "");
      if (data.waveUrl) {
        setAshtechWaveUrl(data.waveUrl);
        setStep("ashtech-redirect");
      } else if (data.requiresOtp) {
        setStep("ashtech-otp");
      } else {
        setAshtechPolling(true);
        setAshtechStatus(data.status || "pending");
        setStep("ashtech-waiting");
      }
    },
    onError: (e: any) => {
      if (e.data?.requiresOtp) {
        setAshtechDepositId(e.data.depositId || ashtechDepositId);
        setAshtechUssdCode(e.data.ussdCode || "");
        setAshtechMessage(e.message || "Composez le code indiqué puis saisissez le code OTP.");
        setAshtechOtp("");
        setStep("ashtech-otp");
        return;
      }
      toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" });
    },
  });

  // SendavaPay: create + initiate
  const svInitiateMutation = useMutation({
    mutationFn: async () => {
      if (!svOperator) throw new Error("Sélectionnez un opérateur");
      // Step 1: create payment on backend
      const createRes = await apiRequest("POST", "/api/sendavapay/create", {
        amount: Number(amount),
        country: svCountry,
        operatorId: svOperator.id,
        operatorName: svOperator.name,
        payerPhone: svPhone,
      });
      if (!createRes.ok) {
        const d = await createRes.json();
        throw new Error(d.message || "Erreur création paiement");
      }
      const createData = await createRes.json();
      setSvDepositId(createData.depositId);
      setSvPaymentToken(createData.paymentToken);

      // Step 2: initiate payment
      const initRes = await apiRequest("POST", "/api/sendavapay/initiate", {
        paymentToken: createData.paymentToken,
        payerCountry: svCountry,
        operatorId: svOperator.id,
        depositId: createData.depositId,
        payerPhone: svPhone,
      });
      if (!initRes.ok) {
        const d = await initRes.json();
        throw new Error(d.message || "Erreur initiation paiement");
      }
      return initRes.json();
    },
    onSuccess: (data: any) => {
      const isWave = svOperator?.name?.toLowerCase().includes("wave");
      if (data.requiresRedirect && data.redirectUrl && isWave) {
        // Seul Wave nécessite une redirection vers une page externe
        setSvRedirectUrl(data.redirectUrl);
        setStep("sv-redirect");
      } else if (data.requiresRedirect && !isWave) {
        // Les autres opérateurs (MTN, Moov, etc.) envoient un push USSD directement
        // sur le téléphone — pas besoin de redirection, on attend juste le webhook
        setSvPolling(true);
        setStep("sv-waiting");
      } else if (data.requiresOtp && data.otpToken) {
        // Orange Money (BF, CI, GN, ML, SN) — user must dial USSD then enter OTP
        setSvOtpToken(data.otpToken);
        setSvUssdCode(data.ussdCode || "");
        setSvOtpMessage(data.message || "");
        setStep("sv-otp");
      } else if (data.success) {
        // Standard push: invite sent directly to phone — wait for webhook
        setSvPolling(true);
        setStep("sv-waiting");
      } else {
        toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" }),
  });

  // SendavaPay: retry failed payment
  const svRetryMutation = useMutation({
    mutationFn: async () => {
      if (!svPaymentToken) throw new Error("Token de paiement manquant");
      const res = await apiRequest("POST", "/api/sendavapay/retry", {
        paymentToken: svPaymentToken,
        depositId: svDepositId,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur retry");
      }
      return res.json();
    },
    onSuccess: () => {
      // Reset to operator selection to re-initiate
      setSvOtp("");
      setSvOtpToken("");
      setSvStatus("");
      setSvPolling(false);
      setStep("sv-operator");
      toast({ title: "Prêt à réessayer", description: "Sélectionnez un opérateur et relancez le paiement." });
    },
    onError: () => toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" }),
  });

  // SendavaPay: submit OTP
  const svOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sendavapay/submit-otp", {
        otpToken: svOtpToken,
        otp: svOtp,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur OTP");
      }
      return res.json();
    },
    onSuccess: () => {
      setSvPolling(true);
      setStep("sv-waiting");
    },
    onError: () => toast({ title: "Erreur de paiement", description: DEPOSIT_ERROR_MESSAGE, variant: "destructive" }),
  });

  const handleAmountNext = () => {
    if (!amount || Number(amount) < MIN_DEPOSIT) {
      toast({
        title: "Montant invalide",
        description: `Le minimum est de ${MIN_DEPOSIT.toLocaleString()} ${currency}`,
        variant: "destructive",
      });
      return;
    }
    if (
      inpayAvailable &&
      (!Number.isInteger(Number(amount)) || Number(amount) % 5 !== 0)
    ) {
      toast({
        title: "Montant invalide",
        description: "Utilisez un montant entier multiple de 5 : 300, 305, 310…",
        variant: "destructive",
      });
      return;
    }
    if (ppayprosAvailable && !Number.isInteger(Number(amount))) {
      toast({
        title: "Montant invalide",
        description: "Ce paiement accepte uniquement un montant entier en FCFA.",
        variant: "destructive",
      });
      return;
    }

    openRobotPay();
  };

  const openRobotPay = () => {
    if (robotPayLoading) return;
    if (!depositCountry) {
      toast({ title: "Pays requis", description: "Sélectionnez le pays du paiement.", variant: "destructive" });
      return;
    }
    if (ppayprosAvailable) {
      const accountCountry = (user?.country || "").trim().toUpperCase();
      const selectedCountry = country.trim().toUpperCase();
      const registrationMessage = getPpayProsCountryRegistrationMessage(selectedCountry);
      if (registrationMessage && accountCountry !== selectedCountry) {
        toast({
          title: "Pays du compte requis",
          description: registrationMessage,
          variant: "destructive",
        });
        return;
      }
      if (!normalizePpayProsPhone(accountCountry, user?.phone)) {
        toast({
          title: "Numéro du compte invalide",
          description: getPpayProsPhoneError(accountCountry),
          variant: "destructive",
        });
        return;
      }
      ppayprosInitiateMutation.mutate();
      return;
    }
    if (inpayAvailable) {
      inpayInitiateMutation.mutate();
      return;
    }
    if (westpayAvailable) {
      wpInitiateMutation.mutate();
      return;
    }
    const robotPayUrl = `/robotpay?amount=${encodeURIComponent(Number(amount))}&country=${encodeURIComponent(depositCountry)}`;
    setRobotPayLoading(true);
    robotPayTransitionTimer.current = window.setTimeout(() => {
      robotPayTransitionTimer.current = null;
      navigate(robotPayUrl);
    }, 850);
  };

  const robotPayLoadingScreen = robotPayLoading ? (
    <div
      className="fixed inset-0 z-[10000] flex h-[100dvh] w-full items-center justify-center bg-[#eeeeee]"
      role="status"
      aria-live="polite"
      aria-label="Chargement de la page de paiement"
      data-testid="robotpay-transition-loading"
    >
      <Loader2 className="h-11 w-11 animate-spin text-[#17395a]" aria-hidden="true" />
    </div>
  ) : null;

  const handleSubmit = () => {
    if (!senderPhone.trim()) {
      toast({ title: "Numéro requis", description: "Entrez le numéro depuis lequel vous avez payé", variant: "destructive" });
      return;
    }
    if (!screenshot) {
      toast({ title: "Capture requise", description: "Veuillez joindre la capture d'écran du paiement", variant: "destructive" });
      return;
    }
    depositMutation.mutate();
  };

  if (!user) return null;

  // ── STEP 1: Amount ─────────────────────────────────────────────────────────
  if (step === "amount") return (
    <main className="recharge-reference min-h-screen bg-[#f7f6f3]">
      <style>{`
        .recharge-reference {
          color: #202124;
          font-family: Inter, Arial, sans-serif;
        }
        .recharge-reference .recharge-screen {
          width: 100%;
          max-width: 500px;
          min-height: 100vh;
          margin: 0 auto;
          overflow: hidden;
          padding-bottom: 28px;
          background: #f7f6f3;
        }
        .recharge-reference .recharge-topbar {
          position: relative;
          display: flex;
          height: 44px;
          align-items: center;
          justify-content: flex-start;
          background: transparent;
          color: white;
        }
        .recharge-reference .recharge-back {
          position: absolute;
          top: 2px;
          left: 15px;
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: white;
        }
        .recharge-reference .recharge-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          font-weight: 500;
        }
        .recharge-reference .brand-mark {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }
        .recharge-reference .history-button {
          position: absolute;
          top: 8px;
          right: 14px;
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: rgba(255,255,255,.15);
        }
        .recharge-reference .recharge-hero {
          position: relative;
          display: flex;
          height: 124px;
          align-items: center;
          margin: 16px 18px 0;
          padding: 0 18px;
          overflow: hidden;
          border: 2px solid rgba(255,255,255,.8);
          border-radius: 24px 24px 0 0;
          background: ${TON_GRADIENT};
          color: white;
        }
        .recharge-reference .minimum-label {
          position: relative;
          z-index: 1;
          max-width: 75%;
          font-size: 16px;
          font-weight: 500;
          line-height: 1.4;
        }
        .recharge-reference .gift-illustration {
          position: absolute;
          right: 12px;
          bottom: -8px;
          font-size: 76px;
          line-height: 1;
          filter: drop-shadow(0 3px 2px rgba(0,0,0,.18));
          pointer-events: none;
        }
        .recharge-reference .balance-card {
          position: relative;
          z-index: 1;
          display: flex;
          min-height: 96px;
          align-items: center;
          justify-content: center;
          margin: -23px 18px 20px;
          border-radius: 24px;
          background: white;
          box-shadow: 0 2px 8px rgba(24,37,49,.04);
          color: #777;
          font-size: 17px;
        }
        .recharge-reference .balance-value {
          margin-left: 7px;
          color: #df8a12;
          font-size: 22px;
          font-weight: 700;
        }
        .recharge-reference .amount-panel {
          margin: 0 18px 18px;
          padding: 12px 14px;
          border-radius: 15px;
          background: white;
        }
        .recharge-reference .amount-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 0 8px;
          border-bottom: 1px solid #dedede;
          color: #292929;
          font-size: 17px;
          font-weight: 500;
        }
        .recharge-reference .amount-heading-icon {
          display: block;
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          object-fit: contain;
          filter: invert(1) grayscale(1) contrast(1.2);
        }
        .recharge-reference .preset-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px 8px;
          margin-top: 10px;
        }
        .recharge-reference .preset {
          min-width: 0;
          height: 46px;
          border: 1px solid #a8a8a8;
          border-radius: 7px;
          background: white;
          color: #343434;
          font-size: 18px;
          font-weight: 500;
        }
        .recharge-reference .preset.active {
          border-color: ${TON_GREEN};
          background: ${TON_GRADIENT};
          color: white;
          box-shadow: 0 2px 4px rgba(0,84,145,.15);
        }
        .recharge-reference .amount-input {
          display: flex;
          height: 48px;
          align-items: center;
          overflow: hidden;
          margin-top: 10px;
          border: 1px solid #c9c9c9;
          border-radius: 5px;
          background: white;
        }
        .recharge-reference .amount-input input {
          width: 100%;
          height: 100%;
          min-width: 0;
          padding: 0 12px;
          border: 0;
          outline: 0;
          color: #30323b;
          background: transparent;
          font-size: 17px;
        }
        .recharge-reference .amount-input input::placeholder { color: #777; opacity: 1; }
        .recharge-reference .currency-prefix {
          flex: 0 0 auto;
          padding: 0 10px 0 13px;
          color: #30323b;
          font-size: 18px;
        }
        .recharge-reference .country-panel {
          margin: 0 18px 16px;
          padding: 14px;
          border-radius: 15px;
          background: white;
        }
        .recharge-reference .country-label {
          display: block;
          margin-bottom: 8px;
          color: #292929;
          font-size: 15px;
          font-weight: 600;
        }
        .recharge-reference .country-select {
          width: 100%;
          height: 48px;
          padding: 0 12px;
          border: 1px solid #c9c9c9;
          border-radius: 6px;
          background: white;
          color: #30323b;
          font-size: 15px;
        }
        .recharge-reference .continue {
          display: flex;
          width: calc(100% - 36px);
          height: 60px;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          border: 0;
          border-radius: 32px;
          background: ${TON_GRADIENT};
          color: white;
          font-size: 21px;
          font-weight: 500;
          box-shadow: 0 3px 5px rgba(233,168,0,.35);
        }
        .recharge-reference .continue:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
        .recharge-reference .instructions {
          margin: 0 18px;
          padding: 17px 14px 14px;
          border-radius: 15px;
          background: white;
          color: #292929;
        }
        .recharge-reference .instructions-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 16px;
          font-weight: 700;
        }
        .recharge-reference .instruction {
          margin: 0 0 10px;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.45;
        }
        .recharge-reference .instruction:last-child { margin-bottom: 0; }
        .recharge-reference .instruction-number { font-weight: 500; }
        @media (max-width: 380px) {
          .recharge-reference .amount-panel,
          .recharge-reference .country-panel,
          .recharge-reference .instructions { margin-right: 14px; margin-left: 14px; }
          .recharge-reference .preset-grid { gap: 6px; }
          .recharge-reference .preset { height: 44px; font-size: 17px; }
          .recharge-reference .continue { width: calc(100% - 28px); }
          .recharge-reference .instructions { padding: 15px 12px; }
        }

        .recharge-reference {
          color: #f5f0e3;
          background: #111111;
          font-family: Georgia, "Times New Roman", serif;
        }
        .recharge-reference .recharge-screen {
          width: 100%;
          max-width: 512px;
          min-height: 100vh;
          padding: 24px 0 28px;
          overflow-x: hidden;
          background: #111111;
        }
        .recharge-reference .recharge-top-row {
          display: grid;
          grid-template-columns: 34.5% 57.5%;
          column-gap: 4%;
          align-items: start;
          width: 100%;
          margin: 0 0 26px 4%;
        }
        .recharge-reference .balance-summary {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: flex-start;
          padding-top: 16px;
        }
        .recharge-reference .balance-label {
          color: #d7d4d0;
          font-size: clamp(15px, 3.2vw, 17px);
          line-height: 1.2;
        }
        .recharge-reference .balance-summary .balance-value {
          margin: 7px 0 0;
          color: #f4f0e9;
          font-size: clamp(17px, 3.6vw, 19px);
          line-height: 1.2;
          font-weight: 700;
        }
        .recharge-reference .wallet-link {
          display: flex;
          width: 132px;
          max-width: 100%;
          min-height: 46px;
          align-items: center;
          margin-top: 24px;
          padding: 6px 12px;
          border-radius: 24px;
          background: #24232f;
          color: #f4f0e3;
          font-size: clamp(16px, 3.5vw, 18px);
          font-weight: 700;
          line-height: 1;
          text-decoration: none;
        }
        .recharge-reference .recharge-promo {
          width: 100%;
          aspect-ratio: 496 / 280;
          overflow: hidden;
          border-radius: 18px;
          background-color: #efbc34;
          background-image: none;
          background-repeat: no-repeat;
          background-position: 100% 7.11%;
          background-size: 174.19% 617.14%;
        }
        .recharge-reference .amount-panel {
          margin: 0 4% 18px;
          padding: 26px 2.75% 20px;
          border-radius: 24px;
          background: #24232f;
          color: #f7f0dc;
        }
        .recharge-reference .preset-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 25px 7.5%;
          margin-top: 0;
        }
        .recharge-reference .preset {
          height: clamp(46px, 10.55vw, 54px);
          border: 0;
          border-radius: 999px;
          background: #fff0c8;
          color: #302b24;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(16px, 3.5vw, 18px);
          font-weight: 400;
        }
        .recharge-reference .preset.active {
          border: 0;
          background: #e9c45e;
          color: #302b24;
          box-shadow: none;
        }
        .recharge-reference .amount-input {
          height: clamp(58px, 12.9vw, 66px);
          margin-top: 25px;
          border: 0;
          border-radius: 999px;
          background: #fff0c8;
        }
        .recharge-reference .amount-input input {
          padding: 0 16px 0 4px;
          color: #292722;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(17px, 3.5vw, 19px);
          font-weight: 700;
        }
        .recharge-reference .amount-input input::placeholder {
          color: #817b70;
          font-weight: 400;
        }
        .recharge-reference .currency-prefix {
          padding: 0 12px 0 20px;
          color: #292722;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(16px, 3.3vw, 18px);
          font-weight: 700;
        }
        .recharge-reference .country-panel {
          margin: 22px 0 0;
          padding: 0;
          border-radius: 0;
          background: transparent;
        }
        .recharge-reference .country-label {
          margin-bottom: 12px;
          color: #f5f0e3;
          font-size: clamp(16px, 3.5vw, 18px);
          font-weight: 400;
        }
        .recharge-reference .country-select {
          height: 48px;
          padding: 0 42px 0 18px;
          appearance: none;
          border: 0;
          border-radius: 999px;
          background-color: #fff0c8;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23302b24' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 18px center;
          color: #302b24;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(15px, 3.2vw, 17px);
        }
        .recharge-reference .continue {
          width: 100%;
          height: clamp(58px, 12.9vw, 66px);
          margin: 58px 0 0;
          border: 0;
          border-radius: 999px;
          background: #e9c45e;
          color: #302b24;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(18px, 3.7vw, 20px);
          font-weight: 700;
          box-shadow: none;
        }
        .recharge-reference .continue:disabled {
          opacity: .58;
        }
        .recharge-reference .instructions {
          margin: 24px 0 0;
          padding: 0;
          border-radius: 0;
          background: transparent;
          color: #f5f0e3;
        }
        .recharge-reference .instructions-title {
          margin: 0 0 16px;
          color: #f4f0e3;
          font-size: clamp(17px, 3.5vw, 19px);
          font-weight: 700;
          line-height: 1.3;
        }
        .recharge-reference .instructions-subtitle {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 20px;
          color: #f1d11b;
          font-size: clamp(17px, 3.5vw, 19px);
          font-weight: 700;
        }
        .recharge-reference .instructions-subtitle svg {
          width: 20px;
          height: 20px;
          flex: 0 0 auto;
        }
        .recharge-reference .instruction {
          margin: 0 0 14px;
          color: #f3f0ed;
          font-size: clamp(15px, 3.5vw, 18px);
          line-height: 1.48;
        }
        .recharge-reference .instruction-number {
          color: #f1d11b;
          font-weight: 700;
        }
        .recharge-reference .instruction strong {
          color: #f1d11b;
          font-weight: 700;
        }
        @media (max-width: 380px) {
          .recharge-reference .amount-panel {
            margin-right: 4%;
            margin-left: 4%;
            padding-right: 2.75%;
            padding-left: 2.75%;
          }
          .recharge-reference .preset-grid {
            gap: 20px 6%;
          }
          .recharge-reference .continue {
            width: 100%;
          }
        }

        .recharge-reference {
          min-height: 100dvh;
          color: #292929;
          background: #fff;
          font-family: Arial, "Segoe UI", sans-serif;
        }
        .recharge-reference .recharge-screen {
          width: 100%;
          max-width: 512px;
          min-height: 100dvh;
          margin: 0 auto;
          padding: 0 0 calc(112px + env(safe-area-inset-bottom));
          overflow-x: hidden;
          background: #fff;
        }
        .recharge-reference .recharge-topbar {
          position: relative;
          height: 60px;
          background: #fff;
          color: #252525;
        }
        .recharge-reference .recharge-back {
          top: 10px;
          left: 12px;
          color: #252525;
        }
        .recharge-reference .recharge-title {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: #252525;
          font-size: 20px;
          font-weight: 700;
          text-transform: lowercase;
          pointer-events: none;
        }
        .recharge-reference .recharge-top-row,
        .recharge-reference .recharge-promo {
          display: none;
        }
        .recharge-reference .amount-panel {
          margin: 82px 20px 0;
          padding: 0 0 22px;
          border-radius: 0;
          background: transparent;
          color: #292929;
        }
        .recharge-reference .amount-heading {
          display: block;
          margin: 0;
          padding: 0;
          border: 0;
          color: #333;
          font-size: 20px;
          font-weight: 400;
          line-height: 1.25;
        }
        .recharge-reference .amount-input {
          height: 53px;
          margin-top: 26px;
          border: 1px solid #dedede;
          border-radius: 6px;
          background: #fafafa;
        }
        .recharge-reference .currency-prefix {
          padding: 0 8px 0 16px;
          color: #333;
          font-size: 15px;
          font-weight: 600;
        }
        .recharge-reference .amount-input input {
          color: #333;
          font-family: inherit;
          font-size: 17px;
        }
        .recharge-reference .amount-input input::placeholder {
          color: #777;
          font-weight: 400;
          opacity: 1;
        }
        .recharge-reference .quick-heading {
          margin: 19px 0 20px;
          color: #333;
          font-size: 20px;
          font-weight: 400;
          line-height: 1.25;
        }
        .recharge-reference .preset-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          justify-items: center;
          gap: 14px 12px;
          margin: 0;
        }
        .recharge-reference .preset {
          width: 100%;
          max-width: 102px;
          aspect-ratio: 1;
          height: auto;
          padding: 0;
          border: 1px solid #dedede;
          border-radius: 50%;
          background: #fff;
          color: #858585;
          font-family: inherit;
          font-size: 18px;
          font-weight: 400;
          transition: border-color 140ms ease, background-color 140ms ease, transform 140ms ease;
        }
        .recharge-reference .preset:active {
          transform: scale(.96);
        }
        .recharge-reference .preset.active {
          border-color: #f0d59b;
          background: #fffaf1;
          color: #dfa32d;
          box-shadow: none;
        }
        .recharge-reference .country-panel {
          margin: 64px 0 0;
          padding: 0;
          border-radius: 0;
          background: transparent;
        }
        .recharge-reference .country-label {
          display: block;
          margin: 0 0 12px;
          color: #294657;
          font-size: 18px;
          font-weight: 400;
        }
        .recharge-reference .country-select {
          width: 100%;
          height: 52px;
          padding: 0 14px;
          border: 1px solid #e2e2e2;
          border-radius: 8px;
          background: #fff;
          color: #333;
          font-family: inherit;
          font-size: 16px;
        }
        .recharge-reference .instructions {
          margin: 28px 0 0;
          padding: 17px 14px 15px;
          border: 1px solid #f0f0f0;
          border-radius: 8px;
          background: #fff;
          color: #34495a;
        }
        .recharge-reference .instructions-title {
          display: block;
          margin: 0 0 18px;
          padding-left: 13px;
          border-left: 5px solid #e8d9a5;
          color: #414141;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.3;
        }
        .recharge-reference .instructions-subtitle {
          display: none;
        }
        .recharge-reference .instruction {
          margin: 0 0 17px;
          color: #34495a;
          font-size: 16px;
          line-height: 1.55;
        }
        .recharge-reference .instruction-number {
          color: inherit;
          font-weight: 400;
        }
        .recharge-reference .instruction strong {
          color: inherit;
          font-weight: 700;
        }
        .recharge-reference .deposit-submit-bar {
          position: fixed;
          z-index: 60;
          right: 0;
          bottom: 0;
          left: 0;
          display: flex;
          justify-content: center;
          padding: 18px 20px calc(20px + env(safe-area-inset-bottom));
          background: #fff;
          box-shadow: 0 -7px 20px rgba(0, 0, 0, .055);
        }
        .recharge-reference .deposit-submit-bar .continue {
          width: min(100%, 472px);
          height: 59px;
          margin: 0;
          border: 0;
          border-radius: 999px;
          background: #ed2055;
          color: #fff;
          font-family: inherit;
          font-size: 19px;
          font-weight: 700;
          box-shadow: none;
        }
        .recharge-reference .deposit-submit-bar .continue:active {
          transform: scale(.99);
        }
        .recharge-reference .deposit-submit-bar .continue:disabled {
          cursor: not-allowed;
          opacity: .6;
        }
        @media (max-width: 380px) {
          .recharge-reference .amount-panel {
            margin-right: 16px;
            margin-left: 16px;
          }
          .recharge-reference .preset-grid {
            gap: 12px 8px;
          }
          .recharge-reference .preset {
            font-size: 15px;
          }
          .recharge-reference .deposit-submit-bar {
            padding-right: 16px;
            padding-left: 16px;
          }
        }
      `}</style>

      <div className="recharge-screen">
        <header className="recharge-topbar">
          <button
            type="button"
            className="recharge-back"
            onClick={() => navigate("/account")}
            aria-label="Retour"
            data-testid="button-back-deposit"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <span className="recharge-title">recharger</span>
        </header>

        <section className="amount-panel" aria-label="Montant de recharge">
          <label htmlFor="deposit-amount" className="amount-heading">Montant du dépôt</label>

          <label className="amount-input" htmlFor="deposit-amount">
            <span className="currency-prefix">{currency}</span>
            <input
              id="deposit-amount"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value ? Number(event.target.value) : "")}
              placeholder="Saisissez le montant du dépôt"
              aria-label="Montant du dépôt en FCFA"
            />
          </label>

          <h2 className="quick-heading">Montant rapide</h2>
          <div className="preset-grid">
            {[3000, 7000, 15000, 30000, 50000, 100000, 200000, 500000].map((preset) => (
              <button
                key={preset}
                className={`preset ${amount === preset ? "active" : ""}`}
                onClick={() => setAmount(preset)}
                aria-pressed={amount === preset}
              >
                {preset}
              </button>
            ))}
          </div>

          <section className="country-panel" aria-label="Pays du paiement">
            <label htmlFor="deposit-country" className="country-label">Pays du paiement</label>
            <select
              id="deposit-country"
              value={depositCountry}
              onChange={(event) => {
                setDepositCountry(event.target.value);
              }}
              className="country-select"
            >
              <option value="">Sélectionnez un pays</option>
              {activeDepositCountries.map((item) => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
          </section>

          <section className="instructions" aria-label="Instructions de recharge">
            <h2 className="instructions-title">Remarques importantes</h2>
            <p className="instruction"><span className="instruction-number">1.</span> Veuillez ne pas modifier le montant du dépôt après avoir lancé le paiement.</p>
            <p className="instruction"><span className="instruction-number">2.</span> Effectuez chaque dépôt depuis cette page et ne sauvegardez pas vos informations de paiement.</p>
            <p className="instruction"><span className="instruction-number">3.</span> Le montant minimum de dépôt est de <strong>{MIN_DEPOSIT.toLocaleString("fr-FR")} FCFA</strong>.</p>
            <p className="instruction"><span className="instruction-number">4.</span> Les dépôts sont généralement traités en quelques minutes. Si le solde n’est pas crédité, contactez le service client.</p>
            <p className="instruction"><span className="instruction-number">5.</span> Pour un montant important, vous pouvez effectuer plusieurs dépôts plus petits.</p>
          </section>
        </section>

        <div className="deposit-submit-bar">
          <button
            className="continue"
            onClick={handleAmountNext}
            disabled={robotPayLoading || !depositCountry || inpayInitiateMutation.isPending || wpInitiateMutation.isPending || ppayprosInitiateMutation.isPending}
          >
            {(inpayInitiateMutation.isPending || wpInitiateMutation.isPending || ppayprosInitiateMutation.isPending)
              ? "Chargement…"
              : "Déposez maintenant"}
          </button>
        </div>
        <WithdrawalFloatingTools />
      </div>
      {robotPayLoadingScreen}
    </main>
  );

  // ── Compatibility redirect for old in-app navigation ──────────────────────
  if (step === "select") return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-4">
        <button className="flex items-center gap-1 text-gray-800" onClick={() => setStep("amount")}>
          <ChevronLeft className="h-5 w-5" /><span className="font-semibold text-base">Choisir le pays</span>
        </button>
        <Link href="/history"><button className="rounded-full border border-[#00CC2C] px-3 py-1.5 text-xs font-semibold text-[#00CC2C]">Historique</button></Link>
      </header>
      <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 p-4">
        <div><p className="text-xs text-gray-500">Montant à déposer</p><p className="text-xl font-bold text-[#00CC2C]">{Number(amount).toLocaleString()} FCFA</p></div>
        <button onClick={() => setStep("amount")} className="text-xs text-[#00CC2C] underline">Modifier</button>
      </div>
      <div className="p-4">
        <div className="rounded-2xl border-2 border-[#00CC2C] bg-green-50 p-4">
          <p className="mb-2 text-sm font-bold text-gray-900">Pays du paiement</p>
          <select value={depositCountry} onChange={e => setDepositCountry(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-4 text-sm text-gray-700 outline-none">
            <option value="">Sélectionnez un pays</option>
            {activeDepositCountries.map(c => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
          </select>
          <p className="mt-2 text-xs text-gray-500">Seuls les pays activés par l’administration sont affichés.</p>
        </div>
        <button onClick={openRobotPay} disabled={!depositCountry} className="mt-5 w-full rounded-xl bg-[#00CC2C] py-3 font-semibold text-white disabled:opacity-50">Continuer vers le paiement</button>
      </div>
      {robotPayLoadingScreen}
    </div>
  );

  // ── STEP 3: Manual deposit form ────────────────────────────────────────────
  if (step === "form" && selectedNumber) return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-800" onClick={() => setStep("select")}>
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold text-base">Confirmer le paiement</span>
        </button>
      </header>

      <div className="p-4 space-y-4 pb-10">
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 flex items-center gap-3">
          {selectedNumber.logoUrl ? (
            <img src={selectedNumber.logoUrl} alt={selectedNumber.operatorName} className="w-10 h-10 rounded-lg object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-orange-100">
              <Phone className="w-5 h-5 text-[#00CC2C]" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-gray-500">{selectedNumber.paymentLink ? "Lien de paiement" : "Numéro destinataire"}</p>
            {selectedNumber.paymentLink ? (
              <a
                href={selectedNumber.paymentLink}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-1 text-sm font-bold text-[#00CC2C] underline"
              >
                <ExternalLink className="h-4 w-4" /> Ouvrir le lien de paiement
              </a>
            ) : (
              <p className="font-bold text-[#00CC2C] text-sm">{selectedNumber.operatorName} — {selectedNumber.phone}</p>
            )}
            <p className="text-xs text-gray-500">{selectedNumber.ownerName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Montant</p>
            <p className="font-bold text-gray-800">{Number(amount).toLocaleString()} {currency}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Votre numéro payeur</p>
          <div className="border border-gray-300 rounded-md flex items-center overflow-hidden bg-white">
            <Phone className="w-4 h-4 text-gray-400 ml-4" />
            <input
              type="tel"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="Numéro depuis lequel vous avez payé"
              className="flex-1 px-3 py-4 text-sm text-gray-700 outline-none bg-transparent"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Référence / ID transaction <span className="text-gray-400 font-normal">(optionnel)</span></p>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Numéro de référence de la transaction"
            className="w-full border border-gray-300 rounded-md px-4 py-4 text-sm text-gray-700 outline-none bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Message reçu après paiement <span className="text-gray-400 font-normal">(optionnel)</span></p>
          <textarea
            value={paymentMessage}
            onChange={(e) => setPaymentMessage(e.target.value)}
            placeholder="Collez ici le SMS ou message de confirmation reçu..."
            rows={3}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-700 outline-none bg-white resize-none"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Capture d'écran du paiement <span className="text-red-500">*</span></p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl py-7 flex flex-col items-center gap-2 transition-colors ${
              screenshot ? "border-green-400 bg-green-50" : "border-gray-300 bg-gray-50 hover:border-[#00CC2C] hover:bg-green-50"
            }`}
          >
            {screenshot ? (
              <><CheckCircle className="w-8 h-8 text-green-500" /><p className="text-sm font-medium text-green-600">{screenshotName}</p><p className="text-xs text-gray-400">Appuyez pour changer</p></>
            ) : (
              <><ImageIcon className="w-8 h-8 text-gray-400" /><p className="text-sm font-medium text-gray-600">Appuyez pour ajouter la capture</p><p className="text-xs text-gray-400">JPG, PNG — max 5 Mo</p></>
            )}
          </button>
          {screenshot && (
            <div className="mt-3 rounded-xl overflow-hidden border border-gray-100">
              <img src={screenshot} alt="Capture" className="w-full max-h-52 object-contain bg-gray-50" />
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={depositMutation.isPending}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-50"
          style={{ background: TON_GRADIENT }}
        >
          {depositMutation.isPending ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours...</span>
          ) : (
            <span className="flex items-center justify-center gap-2"><Upload className="w-5 h-5" /> Soumettre ma demande</span>
          )}
        </button>
      </div>
    </div>
  );

  // ── WESTPAY: Confirm + redirect ────────────────────────────────────────────
  if (step === "westpay") return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-800" onClick={() => setStep("select")}>
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold text-base">{westpayChannelName}</span>
        </button>
      </header>

      <div className="p-4 space-y-5 pb-10">
        {/* Amount recap */}
        <div className="mx-0 rounded-xl p-4 border border-orange-100 bg-orange-50 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Montant à déposer</p>
            <p className="text-xl font-bold text-[#00CC2C]">{Number(amount).toLocaleString()} {currency}</p>
          </div>
          <button onClick={() => setStep("amount")} className="text-xs text-[#00CC2C] underline">Modifier</button>
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00CC2C]" />
            <p className="font-semibold text-gray-900 text-sm">Comment ça marche ?</p>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            1. Cliquez <strong>Payer avec {westpayChannelName}</strong> — vous serez redirigé vers la page de paiement sécurisée.
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            2. Entrez votre numéro Mobile Money et validez le paiement USSD depuis votre téléphone.
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            3. Après paiement, vous serez automatiquement redirigé ici. Votre solde est crédité après confirmation.
          </p>
        </div>

        <button
          onClick={() => wpInitiateMutation.mutate()}
          disabled={wpInitiateMutation.isPending}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: TON_GRADIENT }}
        >
          {wpInitiateMutation.isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Redirection en cours...</>
          ) : (
            <><ExternalLink className="w-5 h-5" /> Payer avec {westpayChannelName}</>
          )}
        </button>

        <p className="text-xs text-center text-gray-400">
          Paiement sécurisé via {westpayChannelName} — USSD Mobile Money
        </p>
      </div>
    </div>
  );

  // ── ASHTECHPAY: Select country + operator ─────────────────────────────────
  if (step === "ashtech-operator") return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-800" onClick={() => setStep("select")}>
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold text-base">{ashtechChannelName}</span>
        </button>
        <Link href="/history"><button className="text-xs text-[#00CC2C] font-semibold px-3 py-1.5 rounded-full border border-[#00CC2C]">Historique</button></Link>
      </header>
      <div className="mx-4 mt-4 rounded-xl p-4 border border-orange-100 bg-orange-50 flex items-center justify-between">
        <div><p className="text-xs text-gray-500">Montant à déposer</p><p className="text-xl font-bold text-[#00CC2C]">{Number(amount).toLocaleString()} {currency}</p></div>
        <button onClick={() => setStep("amount")} className="text-xs text-[#00CC2C] underline">Modifier</button>
      </div>
      <div className="p-4 space-y-4 pb-10">
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Pays</p>
          {ashtechCountriesLoading ? <Loader2 className="w-6 h-6 animate-spin text-[#00CC2C] mx-auto" /> : ashtechCountriesFailed ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
              <p>Impossible de charger les pays et opérateurs AshtechPay.</p>
              <button type="button" onClick={() => void refetchAshtechCountries()} className="mt-2 font-semibold underline">
                Réessayer
              </button>
            </div>
          ) : availableAshtechCountries.length === 0 ? (
            <EmptyState size="compact" className="text-sm text-gray-400 text-center py-5">
              Aucun pays AshtechPay actif n’est disponible.
            </EmptyState>
          ) : (
            <select value={selectedAshtechCountryCode} onChange={(e) => { setAshtechCountry(e.target.value); setAshtechOperator(""); }}
              className="w-full border border-gray-300 rounded-md px-4 py-4 text-sm text-gray-700 outline-none bg-white appearance-none">
              {availableAshtechCountries.map(c => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
            </select>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Numéro Mobile Money</p>
          <div className="border border-gray-300 rounded-md flex items-center overflow-hidden bg-white">
            <Phone className="w-4 h-4 text-gray-400 ml-4 flex-shrink-0" />
            <input type="tel" inputMode="numeric" value={ashtechPhone} onChange={(e) => setAshtechPhone(e.target.value)}
              placeholder="Votre numéro Mobile Money" className="flex-1 px-3 py-4 text-sm text-gray-700 outline-none bg-transparent" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Opérateur Mobile Money</p>
          {ashtechCountriesFailed ? null : ashtechOperators.length === 0 ? <EmptyState size="compact" className="text-sm text-gray-400 text-center py-5">Aucun opérateur disponible pour ce pays</EmptyState> : (
            <div className="space-y-2">
              {ashtechOperators.map((operator, index) => {
                const name = typeof operator === "string" ? operator : (operator.name || operator.code || `Opérateur ${index + 1}`);
                const icon = getPaymentOperatorLogo(name);
                return <button key={`${name}-${index}`} onClick={() => setAshtechOperator(name)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 ${ashtechOperator === name ? "border-[#00CC2C] bg-green-50" : "border-gray-200 bg-white"}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    {icon ? <img src={icon} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" /> : null}
                    <span className="font-semibold text-gray-900 text-sm">{name}</span>
                  </span>
                  {ashtechOperator === name && <CheckCircle className="w-5 h-5 text-[#00CC2C]" />}
                </button>;
              })}
            </div>
          )}
        </div>
        <button onClick={() => ashtechCollectMutation.mutate(undefined)} disabled={!ashtechOperator || !ashtechPhone.trim() || ashtechCollectMutation.isPending}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-40" style={{ background: TON_GRADIENT }}>
          {ashtechCollectMutation.isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Initiation en cours...</span> : "Initier le paiement"}
        </button>
      </div>
    </div>
  );

  // ── ASHTECHPAY: OTP screen ────────────────────────────────────────────────
  if (step === "ashtech-otp") return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-2 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => setStep("ashtech-operator")} className="flex items-center gap-1 text-gray-800"><ChevronLeft className="w-5 h-5" /><span className="font-semibold text-base">Code OTP</span></button>
      </header>
      <div className="p-4 space-y-5 pb-10">
        <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4">
          <p className="font-bold text-gray-900 text-sm mb-2">{ashtechUssdCode ? "Code à composer" : "Code OTP"}</p>
          {ashtechUssdCode && <p className="bg-white rounded-xl border border-orange-200 px-4 py-3 text-center font-mono font-black text-2xl text-[#00CC2C] tracking-widest">{ashtechUssdCode}</p>}
          <p className="text-sm text-gray-600 mt-3">
            {ashtechUssdCode
              ? "Composez ce code sur votre téléphone pour obtenir le code OTP, puis saisissez-le ci-dessous."
              : "Un code OTP vous a été envoyé. Saisissez-le ci-dessous."}
          </p>
        </div>
        <input type="text" inputMode="numeric" value={ashtechOtp} onChange={(e) => setAshtechOtp(e.target.value)} maxLength={8}
          placeholder="Code OTP reçu par SMS" className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-center text-2xl tracking-widest font-black text-gray-800 outline-none bg-white focus:border-[#00CC2C]" />
        <button onClick={() => ashtechCollectMutation.mutate(ashtechOtp)} disabled={!ashtechOtp.trim() || ashtechCollectMutation.isPending}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-40" style={{ background: TON_GRADIENT }}>
          {ashtechCollectMutation.isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Vérification...</span> : "Valider le code OTP"}
        </button>
      </div>
    </div>
  );

  // ── ASHTECHPAY: Wave redirect ─────────────────────────────────────────────
  if (step === "ashtech-redirect") return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-2 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => setStep("ashtech-operator")} className="flex items-center gap-1 text-gray-800"><ChevronLeft className="w-5 h-5" /><span className="font-semibold text-base">Finaliser le paiement</span></button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center"><ExternalLink className="w-10 h-10 text-[#00CC2C]" /></div>
        <div><p className="font-bold text-gray-900 text-xl mb-2">Finaliser avec Wave</p><p className="text-sm text-gray-500">Ouvrez la page Wave pour confirmer votre dépôt de <strong>{Number(amount).toLocaleString()} {currency}</strong>.</p></div>
        <a href={ashtechWaveUrl} target="_blank" rel="noopener noreferrer" onClick={() => { setAshtechPolling(true); setStep("ashtech-waiting"); }}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg flex items-center justify-center gap-2" style={{ background: TON_GRADIENT }}>
          <ExternalLink className="w-5 h-5" /> Ouvrir Wave
        </a>
      </div>
    </div>
  );

  // ── ASHTECHPAY: Waiting / polling ─────────────────────────────────────────
  if (step === "ashtech-waiting") return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-2 px-4 py-4 bg-white border-b border-gray-100"><span className="font-semibold text-base text-gray-800">Paiement en cours</span></header>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center"><RefreshCw className="w-10 h-10 text-[#00CC2C] animate-spin" style={{ animationDuration: "2s" }} /></div>
        <div><p className="font-bold text-gray-900 text-xl">En attente de confirmation</p><p className="text-sm text-gray-500 mt-2">Validez le paiement sur votre téléphone. Cette page se met à jour automatiquement.</p></div>
        <div className="flex gap-3 w-full"><Link href="/history" className="flex-1"><button className="w-full py-3 rounded-full border border-[#00CC2C] text-[#00CC2C] font-semibold text-sm">Voir l'historique</button></Link>
          <button onClick={() => { setStep("amount"); setAmount(""); setAshtechDepositId(null); setAshtechPolling(false); setAshtechStatus(""); }} className="flex-1 py-3 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">Nouvelle recharge</button>
        </div>
      </div>
    </div>
  );

  // ── SENDAVAPAY: Select country + operator ──────────────────────────────────
  if (step === "sv-operator") return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-800" onClick={() => setStep("amount")}>
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold text-base">Top up</span>
        </button>
        <Link href="/history">
          <button className="text-xs text-[#00CC2C] font-semibold px-3 py-1.5 rounded-full border border-[#00CC2C]">Historique</button>
        </Link>
      </header>

      {/* Amount recap */}
      <div className="mx-4 mt-4 rounded-xl p-4 border border-orange-100 bg-orange-50 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Montant à déposer</p>
          <p className="text-xl font-bold text-[#00CC2C]">{Number(amount).toLocaleString()} {currency}</p>
        </div>
        <button onClick={() => setStep("amount")} className="text-xs text-[#00CC2C] underline">Modifier</button>
      </div>

      <div className="p-4 space-y-4 pb-10">
        {/* Country selector */}
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Pays</p>
          <select
            value={svCountry}
            onChange={(e) => { setSvCountry(e.target.value); setSvOperator(null); }}
            className="w-full border border-gray-300 rounded-md px-4 py-4 text-sm text-gray-700 outline-none bg-white appearance-none"
          >
            {activeDepositCountries.map((c: any) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Phone number */}
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Numéro Mobile Money</p>
          <div className="border border-gray-300 rounded-md flex items-center overflow-hidden bg-white">
            <Phone className="w-4 h-4 text-gray-400 ml-4 flex-shrink-0" />
            <input
              type="tel"
              inputMode="numeric"
              value={svPhone}
              onChange={(e) => setSvPhone(e.target.value)}
              placeholder="Numéro sur lequel envoyer la demande"
              className="flex-1 px-3 py-4 text-sm text-gray-700 outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Operator selector */}
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Opérateur Mobile Money</p>
          {svOperatorsLoading ? (
            <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#00CC2C]" />
            </div>
          ) : svOperators.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <EmptyState size="compact" className="text-sm">Aucun opérateur disponible pour ce pays</EmptyState>
            </div>
          ) : (
            <div className="space-y-2">
              {svOperators.map((op) => {
                const icon = getPaymentOperatorLogo(op.name);
                return (
                  <button
                    key={op.id}
                    onClick={() => setSvOperator(op)}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-all ${
                      svOperator?.id === op.id
                        ? "border-[#00CC2C] bg-green-50"
                        : "border-gray-200 bg-white hover:border-green-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {icon ? (
                        <img src={icon} alt={op.name} className="w-10 h-10 rounded-lg border border-gray-100 bg-white object-contain" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          svOperator?.id === op.id ? "bg-[#00CC2C] text-white" : "bg-gray-100 text-gray-600"
                        }`}>
                          {op.name.charAt(0)}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 text-sm">{op.name}</p>
                        {op.requiresOtp && <p className="text-xs text-[#00CC2C]">Code OTP requis</p>}
                      </div>
                    </div>
                    {svOperator?.id === op.id && <CheckCircle className="w-5 h-5 text-[#00CC2C]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => svInitiateMutation.mutate()}
          disabled={!svOperator || svInitiateMutation.isPending}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-40"
            style={{ background: TON_GRADIENT }}
        >
          {svInitiateMutation.isPending ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Initiation en cours...</span>
          ) : (
            <span className="flex items-center justify-center gap-2"><img src="/topup-icon.png" className="w-6 h-6 object-contain" alt="topup" /> Initier le paiement</span>
          )}
        </button>
      </div>
    </div>
  );

  // ── SENDAVAPAY: OTP screen ─────────────────────────────────────────────────
  if (step === "sv-otp") return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-2 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => setStep("sv-operator")} className="flex items-center gap-1 text-gray-800">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold text-base">Code OTP</span>
        </button>
      </header>

      <div className="p-4 space-y-5 pb-10">

        {/* Step 1 — Dial USSD code */}
        <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-[#00CC2C] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">1</span>
            </div>
            <p className="font-bold text-gray-900 text-sm">Composez ce code sur votre téléphone</p>
          </div>
          {svUssdCode ? (
            <div className="bg-white rounded-xl border border-orange-200 px-4 py-3 text-center">
              <p className="font-mono font-black text-2xl text-[#00CC2C] tracking-widest">{svUssdCode}</p>
              <p className="text-xs text-gray-400 mt-1">Composez ce code USSD sur votre téléphone</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Composez le code USSD de votre opérateur (ex&nbsp;: <span className="font-mono font-bold text-[#00CC2C]">*144#</span>) sur votre téléphone pour recevoir le code OTP par SMS.
            </p>
          )}
        </div>

        {/* Step 2 — Enter OTP */}
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-[#00CC2C] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">2</span>
            </div>
            <p className="font-bold text-gray-900 text-sm">Entrez le code OTP reçu par SMS</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Après avoir composé le code, vous recevrez un SMS avec un code OTP. Saisissez-le ci-dessous pour confirmer le paiement de <strong>{Number(amount).toLocaleString()} {currency}</strong>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={svOtp}
            onChange={(e) => setSvOtp(e.target.value)}
            placeholder="Code OTP reçu par SMS"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-center text-2xl tracking-widest font-black text-gray-800 outline-none bg-white focus:border-[#00CC2C]"
            maxLength={8}
          />
        </div>

        <button
          onClick={() => svOtpMutation.mutate()}
          disabled={!svOtp.trim() || svOtpMutation.isPending}
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-40"
          style={{ background: TON_GRADIENT }}
        >
          {svOtpMutation.isPending ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Vérification...</span>
          ) : "Valider le code OTP"}
        </button>
      </div>
    </div>
  );

  // ── SENDAVAPAY: Redirect screen (Wave, etc.) ──────────────────────────────
  if (step === "sv-redirect") return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-2 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => setStep("sv-operator")} className="flex items-center gap-1 text-gray-800">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-semibold text-base">Finaliser le paiement</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
          <ExternalLink className="w-10 h-10 text-[#00CC2C]" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-xl mb-2">Finaliser sur l'application</p>
          <p className="text-sm text-gray-500">
            Appuyez sur le bouton ci-dessous pour ouvrir la page de paiement de l'opérateur
            et confirmer votre dépôt de <strong>{Number(amount).toLocaleString()} {currency}</strong>.
          </p>
        </div>
        <a
          href={svRedirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-5 rounded-full text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
           style={{ background: TON_GRADIENT }}
          onClick={() => { setSvPolling(true); setStep("sv-waiting"); }}
        >
          <ExternalLink className="w-5 h-5" /> Ouvrir la page de paiement
        </a>
      </div>
    </div>
  );

  // ── SENDAVAPAY: Waiting / polling screen ────────────────────────────────────
  if (step === "sv-waiting") return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center gap-2 px-4 py-4 bg-white border-b border-gray-100">
        <span className="font-semibold text-base text-gray-800">Paiement en cours</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        {svStatus === "approved" ? (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-xl">Paiement confirmé !</p>
              <p className="text-sm text-gray-500 mt-1">Votre solde a été crédité de <strong>{Number(amount).toLocaleString()} {currency}</strong></p>
            </div>
          </>
        ) : svStatus === "rejected" ? (
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-xl">Paiement échoué</p>
              <p className="text-sm text-gray-500 mt-1">Le paiement a été refusé ou annulé.</p>
            </div>
            <div className="flex gap-3 w-full">
              {svPaymentToken && (
                <button
                  onClick={() => svRetryMutation.mutate()}
                  disabled={svRetryMutation.isPending}
                  className="flex-1 py-3 rounded-full text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                   style={{ background: TON_GRADIENT }}
                >
                  {svRetryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Réessayer
                </button>
              )}
              <button
                onClick={() => { setStep("amount"); setAmount(""); setSvOperator(null); setSvDepositId(null); setSvPaymentToken(""); setSvPolling(false); setSvStatus(""); }}
                className="flex-1 py-3 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm"
              >
                Nouvelle recharge
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-[#00CC2C] animate-spin" style={{ animationDuration: "2s" }} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-xl">En attente de confirmation</p>
              <p className="text-sm text-gray-500 mt-2">
                Une demande de paiement de <strong>{Number(amount).toLocaleString()} {currency}</strong> a été envoyée sur votre téléphone.<br />
                Acceptez-la sur votre téléphone. Cette page se met à jour automatiquement.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Link href="/history" className="flex-1">
                <button className="w-full py-3 rounded-full border border-[#00CC2C] text-[#00CC2C] font-semibold text-sm">
                  Voir l'historique
                </button>
              </Link>
              <button
                onClick={() => { setStep("amount"); setAmount(""); setSvOperator(null); setSvDepositId(null); setSvPaymentToken(""); setSvPolling(false); setSvStatus(""); }}
                className="flex-1 py-3 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm"
              >
                Nouvelle recharge
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return null;
}
