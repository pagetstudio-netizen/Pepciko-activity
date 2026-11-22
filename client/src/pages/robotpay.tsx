import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronRight, Copy, Loader2, ShieldCheck, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { copyTextWithToast } from "@/lib/copy-to-clipboard";
import { getPaymentOperatorLogo } from "@/lib/payment-operator-logos";
import EmptyState from "@/components/empty-state";
import type { ApiCountry } from "@/lib/countries";
import type { PaymentNumber } from "@shared/schema";

type Provider = "ashtech" | "sendavapay" | "drimpay";
type Operator = { id?: string; name?: string; operator?: string; slug?: string; code?: string; logoUrl?: string; requiresOtp?: boolean; status?: string; provider?: Provider; manualNumber?: PaymentNumber };
type ProviderInfo = { provider: Provider; name: string; providers?: Array<{ provider: Provider; name: string }> };
type Language = "fr" | "en";
const BANK_CLOSED_MESSAGE = "La banque n'est pas ouverte pour le moment.";

const CHECKOUT_COPY = {
  fr: {
    close: "Fermer le paiement",
    intro: "Veuillez remplir votre mode de paiement et le compte de paiement réel que vous utiliserez pour effectuer le paiement.",
    amount: "Montant de paiement:",
    choosePayment: "Veuillez sélectionner un mode de paiement",
    loadingOperators: "Chargement des opérateurs…",
    noOperators: "Aucun opérateur disponible pour ce pays.",
    operatorFallback: "Opérateur",
    manualPayment: "Paiement manuel",
    phoneLabel: "Compte de paiement réel",
    phonePlaceholder: "Veuillez saisir votre compte de paiement réel",
    beneficiary: "Bénéficiaire",
    paymentLink: "Lien de paiement",
    paymentNumber: "Numéro de paiement",
    copy: "Copier",
    ussd: "Code USSD :",
    manualInstructions: "Effectuez le paiement au bénéficiaire indiqué, puis saisissez la référence de confirmation reçue.",
    referenceLabel: "Référence ou message de confirmation",
    referencePlaceholder: "Saisissez la référence reçue...",
    warning: "Veuillez remplir votre compte de paiement avec précision. Un remplissage incorrect peut entraîner la perte des fonds transférés.",
    confirm: "Confirmer",
    securePage: "Ouvrir la page sécurisée pour terminer votre paiement.",
    openPaymentPage: "Ouvrir la page de paiement",
    otpWithUssd: "Composez ce code sur votre téléphone pour obtenir le code OTP, puis saisissez-le ci-dessous.",
    otpWithoutUssd: "Un code OTP vous a été envoyé. Saisissez-le ci-dessous.",
    otpPlaceholder: "Saisissez le code OTP",
    paymentFailed: "Paiement échoué",
    processing: "Paiement en cours de traitement",
    processingDetails: "Votre paiement est en cours de traitement. Veuillez patienter.",
    requestSent: "Demande envoyée",
    manualSuccess: "Votre référence ou message de paiement a été transmis à l’administration. Le dépôt sera crédité après vérification.",
    notificationFailed: "Votre demande #{id} est enregistrée, mais la notification Telegram n’a pas pu être envoyée. Ne refaites pas le paiement ; contactez l’administration.",
    operator: "Opérateur :",
    amountLabel: "Montant :",
    reference: "Référence :",
    pendingReference: "En attente",
    status: "Statut :",
    pendingApproval: "En attente de validation",
    approved: "Votre paiement a été approuvé",
    payer: "Payeur :",
    transactionId: "ID Transaction :",
    paymentDate: "Date Paiement :",
    securedBy: "Sécurisé par",
    backToSite: "Retourner sur le site",
    stepLabels: ["Paiement", "Confirmation", "Terminé"],
  },
  en: {
    close: "Close payment",
    intro: "Please enter the payment method and the real payment account you will use to make the payment.",
    amount: "Payment amount:",
    choosePayment: "Please select a payment method",
    loadingOperators: "Loading payment methods…",
    noOperators: "No payment method is available for this country.",
    operatorFallback: "Payment method",
    manualPayment: "Manual payment",
    phoneLabel: "Real payment account",
    phonePlaceholder: "Enter your real payment account",
    beneficiary: "Recipient",
    paymentLink: "Payment link",
    paymentNumber: "Payment number",
    copy: "Copy",
    ussd: "USSD code:",
    manualInstructions: "Pay the recipient shown, then enter the confirmation reference you received.",
    referenceLabel: "Confirmation reference or message",
    referencePlaceholder: "Enter the reference you received...",
    warning: "Please enter your payment account carefully. Incorrect details may result in the loss of transferred funds.",
    confirm: "Confirm",
    securePage: "Open the secure page to finish your payment.",
    openPaymentPage: "Open payment page",
    otpWithUssd: "Dial this code on your phone to receive the OTP, then enter it below.",
    otpWithoutUssd: "An OTP was sent to you. Enter it below.",
    otpPlaceholder: "Enter the OTP",
    paymentFailed: "Payment failed",
    processing: "Payment processing",
    processingDetails: "Your payment is being processed. Please wait.",
    requestSent: "Request sent",
    manualSuccess: "Your payment reference or message was sent to the administration. The deposit will be credited after review.",
    notificationFailed: "Your request #{id} was saved, but the Telegram notification could not be sent. Do not pay again; contact the administration.",
    operator: "Payment method:",
    amountLabel: "Amount:",
    reference: "Reference:",
    pendingReference: "Pending",
    status: "Status:",
    pendingApproval: "Awaiting review",
    approved: "Your payment was approved",
    payer: "Payer:",
    transactionId: "Transaction ID:",
    paymentDate: "Payment date:",
    securedBy: "Secured by",
    backToSite: "Return to the site",
    stepLabels: ["Payment", "Confirmation", "Complete"],
  },
} as const;

function Stepper({ step, language }: { step: number; language: Language }) {
  const labels = CHECKOUT_COPY[language].stepLabels;
  return (
    <div className="flex items-center justify-between mb-7">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className={`flex flex-col items-center text-center ${i <= step ? "text-[#1877d2]" : "text-gray-400"}`}>
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold ${i <= step ? "border-[#8fc4d8] bg-[#eef9fc]" : "border-gray-300 bg-white"}`}>
              {i < step ? <Check className="w-5 h-5" /> : i + 1}
            </div>
            <span className="text-[11px] leading-tight mt-1 w-24">{label}</span>
          </div>
          {i < 2 && <div className={`h-px flex-1 mx-1 mt-[-18px] ${i < step ? "bg-[#8fc4d8]" : "bg-gray-300"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function RobotPayPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const amount = Number(params.get("amount") || 0);
  const country = (params.get("country") || "").toUpperCase();
  const [language, setLanguage] = useState<Language>("fr");
  const copy = CHECKOUT_COPY[language];
  // 1 = combined operator + payer details, 2 = provider confirmation, 3 = success
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<Operator | null>(null);
  const [depositId, setDepositId] = useState<number | null>(null);
  const [transactionReference] = useState(() => `dépôt-${Math.floor(10000 + Math.random() * 90000)}`);
  const [paymentToken, setPaymentToken] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otp, setOtp] = useState("");
  const [ashtechOtp, setAshtechOtp] = useState("");
  const [ashtechOtpRequired, setAshtechOtpRequired] = useState(false);
  const [ussd, setUssd] = useState("");
  const [message, setMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [paymentLinkUnavailable, setPaymentLinkUnavailable] = useState(false);
  const [status, setStatus] = useState("pending");
  const [paymentProof, setPaymentProof] = useState("");
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [telegramNotificationFailed, setTelegramNotificationFailed] = useState(false);

  useEffect(() => {
    if (step !== 1) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [step]);

  const { data: countries = [] } = useQuery<ApiCountry[]>({ queryKey: ["/api/countries"] });
  const { data: providerInfo, isLoading: providerLoading, error: providerInfoError } = useQuery<ProviderInfo>({
    queryKey: ["/api/deposit/provider", country],
    queryFn: async () => {
      const res = await fetch(`/api/deposit/provider/${country}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Aucun canal automatique disponible");
      return data;
    },
    enabled: !!country,
  });
  const provider = providerInfo?.provider || "sendavapay";
  const activeProvider = operator?.provider || provider;
  const availableProviders = providerInfo?.providers || (providerInfo ? [{ provider: providerInfo.provider, name: providerInfo.name }] : []);
  const countryInfo = countries.find(c => c.code === country && c.isActive);
  const currency = "FCFA";
  const phonePrefix = countryInfo && "phonePrefix" in countryInfo ? countryInfo.phonePrefix : "";
  const paymentPhone = phone.trim().startsWith("+")
    ? phone.trim()
    : phonePrefix
      ? `+${phonePrefix}${phone.replace(/\D/g, "")}`
      : phone.trim();

  const { data: manualNumbers = [], isLoading: manualNumbersLoading, error: manualNumbersError } = useQuery<PaymentNumber[]>({
    queryKey: ["/api/payment-numbers", country],
    queryFn: async () => {
      const res = await fetch(`/api/payment-numbers?country=${encodeURIComponent(country)}&source=robotpay`, { credentials: "include" });
      if (!res.ok) throw new Error("Impossible de charger les numéros de paiement");
      return res.json();
    },
    enabled: !!country,
  });

  const { data: sendavaData, isLoading: sendavaLoading, error: sendavaError } = useQuery<{ success: boolean; data: Operator[] }>({
    queryKey: ["/api/sendavapay/operators", country],
    queryFn: async () => {
      const response = await fetch(`/api/sendavapay/operators/${country}?source=robotpay`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || BANK_CLOSED_MESSAGE);
      return data;
    },
    enabled: !!providerInfo && availableProviders.some(item => item.provider === "sendavapay") && !!country,
  });
  const { data: ashtechData, isLoading: ashtechLoading, error: ashtechError } = useQuery<any[]>({
    queryKey: ["/api/ashtechpay/countries"],
    queryFn: async () => {
      const response = await fetch("/api/ashtechpay/countries?source=robotpay", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || BANK_CLOSED_MESSAGE);
      return data;
    },
    enabled: !!providerInfo && availableProviders.some(item => item.provider === "ashtech"),
  });
  const { data: drimpayData, isLoading: drimpayLoading, error: drimpayError } = useQuery<{ country: string; operators: Operator[] }>({
    queryKey: ["/api/drimpay/operators", country],
    queryFn: async () => {
      const response = await fetch(`/api/drimpay/operators/${encodeURIComponent(country)}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de charger les opérateurs de paiement");
      return data;
    },
    enabled: !!providerInfo && availableProviders.some(item => item.provider === "drimpay") && !!country,
  });
  const ashtechCountryList = Array.isArray(ashtechData)
    ? ashtechData
    : Array.isArray((ashtechData as any)?.countries)
      ? (ashtechData as any).countries
      : Array.isArray((ashtechData as any)?.data)
        ? (ashtechData as any).data
        : [];
  const ashtechOperators: Operator[] = availableProviders.some(item => item.provider === "ashtech")
    ? (ashtechCountryList.find((c: any) => c.code?.toUpperCase() === country)?.operators || [])
      .map((x: any) => typeof x === "string" ? { name: x, id: x, provider: "ashtech" as const } : { ...x, provider: "ashtech" as const })
    : [];
  const sendavaOperators: Operator[] = availableProviders.some(item => item.provider === "sendavapay")
    ? (sendavaData?.data || []).filter((x: Operator) => x.status === "online").map(x => ({ ...x, provider: "sendavapay" as const }))
    : [];
  const drimpayOperators: Operator[] = availableProviders.some(item => item.provider === "drimpay")
    ? (drimpayData?.operators || []).map(operator => ({ ...operator, provider: "drimpay" as const }))
    : [];
  // When enabled for the country, DrimPay is selected automatically for its
  // supported operators. AshTechPay and SendavaPay remain the existing fallbacks.
  const automaticOperators: Operator[] = [...drimpayOperators, ...ashtechOperators, ...sendavaOperators];
  const normalizeOperatorName = (value: unknown) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const operatorNamesMatch = (first: unknown, second: unknown) => {
    const firstName = normalizeOperatorName(first);
    const secondName = normalizeOperatorName(second);
    return Boolean(firstName && secondName && (
      firstName === secondName || firstName.includes(secondName) || secondName.includes(firstName)
    ));
  };
  const getOperatorIdentifiers = (automatic: Operator) =>
    [automatic.name, automatic.operator, automatic.code, automatic.slug, automatic.id]
      .filter(Boolean);
  const matchesManualOperator = (automatic: Operator, manual: PaymentNumber) => {
    return getOperatorIdentifiers(automatic)
      .some(name => operatorNamesMatch(name, manual.operatorName));
  };
  const uniqueAutomaticOperators = automaticOperators.filter((automatic, index, list) =>
    list.findIndex(candidate =>
      getOperatorIdentifiers(candidate).some(candidateName =>
        getOperatorIdentifiers(automatic).some(automaticName =>
          operatorNamesMatch(candidateName, automaticName)
        )
      )
    ) === index
  );
  const automaticManualMatches = new Set<number>();
  const operators: Operator[] = [
    ...uniqueAutomaticOperators.map(automatic => {
      const manualNumber = automatic.provider === "drimpay"
        ? undefined
        : manualNumbers.find(number =>
            !automaticManualMatches.has(number.id) && matchesManualOperator(automatic, number),
          );
      if (manualNumber) automaticManualMatches.add(manualNumber.id);
      return manualNumber ? { ...automatic, manualNumber } : automatic;
    }),
    ...manualNumbers
      .filter(number => !uniqueAutomaticOperators.some(automatic => matchesManualOperator(automatic, number)))
      .map(number => ({
        id: `manual-${number.id}`,
        name: number.operatorName,
        manualNumber: number,
      })),
  ];
  const getOperatorKey = (candidate: Operator) => candidate.manualNumber
    ? `manual-${candidate.manualNumber.id}`
    : `${candidate.provider || "manual"}-${candidate.id || candidate.code || candidate.name || "operator"}`;
  const selectedOperatorKey = operator ? getOperatorKey(operator) : null;
  const loadingOperators = manualNumbersLoading || providerLoading || sendavaLoading || ashtechLoading || drimpayLoading;
  const lastPaymentQueryError = useRef<unknown>(null);
  const paymentQueryError = providerInfoError || manualNumbersError || sendavaError || ashtechError || drimpayError;

  useEffect(() => {
    if (!paymentQueryError) {
      lastPaymentQueryError.current = null;
      return;
    }
    if (lastPaymentQueryError.current === paymentQueryError) return;
    lastPaymentQueryError.current = paymentQueryError;
    toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" });
  }, [paymentQueryError, toast]);

  const sendavaMutation = useMutation({
    mutationFn: async () => {
      if (!operator?.id) throw new Error("Sélectionnez un opérateur");
      const created = await apiRequest("POST", "/api/sendavapay/create", {
        amount, country, operatorId: operator.id, operatorName: operator.name, payerPhone: paymentPhone, paymentSource: "robotpay",
      });
      if (!created.ok) throw new Error((await created.json()).message || "Création impossible");
      const data = await created.json();
      setDepositId(data.depositId); setPaymentToken(data.paymentToken);
      const initiated = await apiRequest("POST", "/api/sendavapay/initiate", {
        paymentToken: data.paymentToken, payerCountry: country, operatorId: operator.id,
        depositId: data.depositId, payerPhone: paymentPhone, paymentSource: "robotpay",
      });
      if (!initiated.ok) throw new Error((await initiated.json()).message || "Initiation impossible");
      return initiated.json();
    },
    onSuccess: (data) => {
      setMessage(data.message || "");
      if (["rejected", "failed", "expired", "cancelled", "canceled"].includes(String(data.status || "").toLowerCase())) {
        toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" });
        return;
      }
      if (data.requiresOtp && data.otpToken) { setOtpToken(data.otpToken); setUssd(data.ussdCode || ""); setStep(2); }
      else if (data.requiresRedirect && data.redirectUrl) { setRedirectUrl(data.redirectUrl); setStep(2); }
      else { setStep(2); setStatus("processing"); }
    },
    onError: () => toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" }),
  });
  const ashtechMutation = useMutation({
    mutationFn: async (otpCode?: string) => {
      if (!operator?.name) throw new Error("Sélectionnez un opérateur");
      const res = await apiRequest("POST", "/api/ashtechpay/collect", {
        amount, country, operator: operator.name, phone: phone.replace(/\D/g, ""), paymentSource: "robotpay",
        depositId: depositId || undefined, otp: otpCode || undefined,
      });
      if (!res.ok) throw new Error((await res.json()).message || "Initiation impossible");
      return res.json();
    },
    onSuccess: (data) => {
       setAshtechOtpRequired(false);
      setDepositId(data.depositId); setMessage(data.message || ""); setUssd(data.ussdCode || "");
      if (data.waveUrl) setRedirectUrl(data.waveUrl);
       if (["rejected", "failed", "expired", "cancelled", "canceled"].includes(String(data.status || "").toLowerCase())) {
         toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" });
         return;
       }
      setStep(2); setStatus(data.status || "processing");
    },
    onError: (e: any) => {
      if (e.data?.requiresOtp) {
        setDepositId(e.data.depositId || depositId);
        setAshtechOtpRequired(true);
        setUssd(e.data.ussdCode || "");
        setMessage(e.message || "Composez le code indiqué puis saisissez votre OTP.");
        setStep(2);
        return;
      }
      toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" });
    },
  });
  const drimpayMutation = useMutation({
    mutationFn: async () => {
      if (!operator?.id) throw new Error("Sélectionnez un opérateur");
      const response = await apiRequest("POST", "/api/drimpay/payin", {
        amount,
        country,
        operator: operator.id,
        phone: paymentPhone,
        paymentSource: "robotpay",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Initiation DrimPay impossible");
      return data;
    },
    onSuccess: (data) => {
      setDepositId(data.depositId);
      setRedirectUrl(typeof data.paymentUrl === "string" ? data.paymentUrl : "");
      setPaymentLinkUnavailable(Boolean(data.paymentLinkUnavailable));
      setMessage(data.message || "");
      setStatus(data.status || "processing");
      if (data.status === "approved") {
        setStep(3);
      } else if (data.status === "rejected") {
        setStep(1);
        toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" });
      } else {
        setStep(2);
      }
      if (data.status === "approved") {
        queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
      }
    },
    onError: () => toast({
      title: "Erreur de paiement",
      description: BANK_CLOSED_MESSAGE,
      variant: "destructive",
    }),
  });
  const manualMutation = useMutation({
    mutationFn: async () => {
      const number = operator?.manualNumber;
      if (!number) throw new Error("Numéro de paiement indisponible");
      if (!phone.trim()) throw new Error("Saisissez le numéro depuis lequel vous avez payé");
      if (!paymentProof.trim()) {
        throw new Error("Saisissez la référence ou le message de confirmation du paiement");
      }
      const res = await apiRequest("POST", "/api/deposits", {
        amount,
        accountName: user?.fullName || "",
        accountNumber: paymentPhone,
        paymentMethod: number.operatorName,
        country,
        paymentSource: "robotpay",
        paymentNumberId: number.id,
        channelName: number.paymentLink ? `${number.operatorName} - Lien de paiement` : `${number.operatorName} - ${number.phone}`,
        reference: null,
        paymentMessage: paymentProof.trim(),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Envoi impossible");
      return res.json();
    },
    onSuccess: (data) => {
      setDepositId(data.deposit?.id || null);
      setManualSubmitted(true);
      setTelegramNotificationFailed(data.telegramNotificationSent === false);
      setStatus("pending");
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
    },
    onError: () => toast({ title: "Erreur de dépôt", description: BANK_CLOSED_MESSAGE, variant: "destructive" }),
  });

  useEffect(() => {
    if (step !== 2 || !depositId || status === "approved" || status === "rejected") return;
    const timer = setInterval(async () => {
      const url = activeProvider === "ashtech"
        ? `/api/deposits/${depositId}/ashtechpay-status?source=robotpay`
        : activeProvider === "drimpay"
          ? `/api/deposits/${depositId}/drimpay-status`
          : `/api/deposits/${depositId}/sendavapay-status?source=robotpay`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        clearInterval(timer);
        setStatus("rejected");
        toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" });
        return;
      }
      setStatus(data.status);
      if (data.status === "approved") { setStep(3); clearInterval(timer); queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] }); }
      if (data.status === "rejected") { clearInterval(timer); toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" }); }
    }, 5000);
    return () => clearInterval(timer);
  }, [step, depositId, status, activeProvider, queryClient, toast]);

  const submitPhone = () => {
    if (!phone.trim()) { toast({ title: "Numéro requis", description: "Saisissez le numéro Mobile Money utilisé.", variant: "destructive" }); return; }
    if (!operator) { toast({ title: "Opérateur requis", description: "Sélectionnez votre opérateur.", variant: "destructive" }); return; }
    if (operator.manualNumber && !paymentProof.trim()) {
      toast({ title: "Confirmation de paiement requise", description: "Saisissez la référence ou le message reçu après le paiement.", variant: "destructive" });
      return;
    }
    setPaymentLinkUnavailable(false);
    if (operator.manualNumber) manualMutation.mutate();
    else {
      if (activeProvider === "ashtech") ashtechMutation.mutate(undefined);
      else if (activeProvider === "drimpay") drimpayMutation.mutate();
      else sendavaMutation.mutate();
    }
  };
  const submitOtp = async () => {
    if (activeProvider === "ashtech") {
      if (!ashtechOtp.trim()) return;
      ashtechMutation.mutate(ashtechOtp.trim());
      return;
    }
    const res = await apiRequest("POST", "/api/sendavapay/submit-otp", { otpToken, otp, paymentSource: "robotpay" });
    if (!res.ok) { toast({ title: "Erreur de paiement", description: BANK_CLOSED_MESSAGE, variant: "destructive" }); return; }
    setStep(2); setStatus("processing");
  };
  const busy = sendavaMutation.isPending || ashtechMutation.isPending || drimpayMutation.isPending || manualMutation.isPending;

  const copyPaymentNumber = async () => {
    const number = operator?.manualNumber;
    if (!number) return;
    const value = number.paymentLink || number.phone || "";
    await copyTextWithToast(value, {
      successTitle: "Copie réussie",
      failureDescription: number.paymentLink
        ? "Copiez le lien manuellement."
        : "Copiez le numéro manuellement.",
    });
  };

  const copyUssdCode = async () => {
    const code = operator?.manualNumber?.ussdCode;
    if (!code) return;
    await copyTextWithToast(code, {
      successTitle: "Code USSD copié",
      failureDescription: "Copiez le code USSD manuellement.",
    });
  };

  const chooseOperator = (nextOperator: Operator) => {
    setOperator(nextOperator);
    setPaymentProof("");
    setTelegramNotificationFailed(false);
  };

  if (!amount || !country) return <div className="min-h-screen flex items-center justify-center p-6 text-center">Données de dépôt invalides.</div>;

  return (
    <main
      style={{ fontFamily: "Roboto, Arial, sans-serif" }}
      className={`relative overscroll-none bg-[#4b4b4b] px-0 ${step === 1 ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh] overflow-y-auto"}`}
    >
      <div className={`mx-auto w-[89%] max-w-[456px] ${step === 1 ? "pt-[clamp(70px,9.4dvh,92px)]" : "py-[72px]"}`}>
        <button
          type="button"
          onClick={() => navigate("/deposit")}
          aria-label={copy.close}
          className="fixed right-2 top-2 z-30 flex h-[8vw] w-[8vw] min-h-8 min-w-8 max-h-10 max-w-10 items-center justify-center rounded-full border-2 border-white bg-[#777] text-white shadow-md"
        >
          <X className="h-4 w-4" strokeWidth={3} />
        </button>
        {step === 1 && (
          <div className="fixed right-3 top-[48%] z-20 h-[16vw] w-[16vw] max-h-20 max-w-20 -translate-y-1/2">
            <img
              src={language === "fr" ? "/robotpay-language-fr.png" : "/robotpay-language-en.png"}
              alt={language === "fr" ? "Français sélectionné" : "English selected"}
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              aria-label="English"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
              className="absolute left-[10%] top-[15%] h-[43%] w-[45%] rounded-full"
            />
            <button
              type="button"
              aria-label="Français"
              aria-pressed={language === "fr"}
              onClick={() => setLanguage("fr")}
              className="absolute bottom-[14%] right-[8%] h-[43%] w-[45%] rounded-full"
            />
          </div>
        )}
        <section
          style={step === 1 ? { maxHeight: "calc(100dvh - clamp(82px, 10dvh, 96px))" } : undefined}
          className="overflow-hidden rounded-[20px] bg-white shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
        >
          {step === 1 && (
            <div className="px-[clamp(18px,6vw,27px)] pb-[clamp(17px,3.4dvh,29px)] pt-[clamp(18px,4.2dvh,40px)]">
            <div className="flex justify-center pb-[clamp(20px,3.8dvh,36px)]">
                <img src="/gpay-logo.png" alt="GPay" className="h-[clamp(52px,7.2dvh,64px)] w-[clamp(52px,7.2dvh,64px)] object-contain" />
              </div>
              <p className="pr-2 text-[clamp(13px,1.75dvh,15px)] font-normal leading-[1.45] text-[#555]">
                {copy.intro}
              </p>
              <p className="mt-[clamp(12px,2.8dvh,24px)] text-[clamp(13px,1.75dvh,15px)] font-medium text-[#555]">
                {copy.amount} <span className="font-bold text-[#d88921]">FCFA {amount}</span>
              </p>

              <div className="mt-[clamp(19px,4.3dvh,39px)] flex items-center justify-between gap-3 pr-8">
                <p className="text-[clamp(12px,1.65dvh,14px)] font-medium leading-5 text-[#777]">{copy.choosePayment}</p>
              </div>

              {loadingOperators ? (
                <div className="flex min-h-[clamp(72px,11dvh,96px)] items-center justify-center gap-2 text-sm text-gray-500" aria-live="polite">
                  <Loader2 className="h-5 w-5 animate-spin text-[#d99a32]" />
                  {copy.loadingOperators}
                </div>
              ) : operators.length === 0 ? (
                paymentQueryError ? (
                  <div className="flex min-h-[clamp(72px,11dvh,96px)] items-center justify-center px-8 pr-14 text-center text-sm text-[#777]">
                    {copy.noOperators}
                  </div>
                ) : (
                  <EmptyState size="compact" className="robotpay-empty-operators min-h-[clamp(72px,11dvh,96px)] px-8 pr-14 text-sm text-[#777]">
                    <p>{copy.noOperators}</p>
                  </EmptyState>
                )
              ) : (
                <div className="mt-[clamp(8px,1.7dvh,15px)] flex flex-wrap justify-center gap-3 pr-14">
                  {operators.map((op, i) => {
                    const key = getOperatorKey(op);
                    const label = op.name || op.operator || op.code || copy.operatorFallback;
                    const logo = op.manualNumber?.logoUrl || getPaymentOperatorLogo(label) || op.logoUrl;
                    const selected = selectedOperatorKey === key;
                    return (
                      <button
                        key={`${key}-${i}`}
                        type="button"
                        onClick={() => chooseOperator(op)}
                        aria-pressed={selected}
                        className={`flex min-h-[clamp(72px,11dvh,96px)] w-[calc(50%-0.5rem)] max-w-[180px] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d49a35] ${
                          selected
                            ? "border-[#d4b36b] bg-[#fff7ee] shadow-[0_5px_15px_rgba(110,80,30,0.12)]"
                            : "border-[#e6e6e6] bg-white hover:border-[#d4b36b]"
                        }`}
                      >
                        {logo ? (
                          <img src={logo} alt="" className="h-8 w-8 rounded-md object-contain" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f1f2] text-[11px] font-bold text-[#535d67]">
                            {label.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-[#555]">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-[clamp(18px,3dvh,27px)]">
                <label htmlFor="robotpay-phone" className="sr-only">{copy.phoneLabel}</label>
                <div className="flex min-h-[clamp(46px,6.2dvh,54px)] items-center overflow-hidden rounded-xl border border-[#c9c9c9] px-3 focus-within:border-[#d4a54e]">
                  {phonePrefix && <span className="mr-3 shrink-0 border-r border-[#e4e4e4] pr-3 text-sm font-semibold text-[#c17b22]">+{phonePrefix}</span>}
                  <input
                    id="robotpay-phone"
                    value={phone}
                    onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 12))}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder={copy.phonePlaceholder}
                    className="w-full min-w-0 bg-transparent py-3 text-[clamp(12px,1.55dvh,14px)] text-[#555] outline-none placeholder:text-[#aaa]"
                  />
                </div>
              </div>

              {operator?.manualNumber && (
                <div className="mt-3 space-y-2 rounded-xl border border-[#e7d8bd] bg-[#fffaf2] p-3">
                  <div>
                    <p className="text-[10px] text-[#8b7a61]">{copy.beneficiary}</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#454545]">{operator.manualNumber.ownerName}</p>
                  </div>
                  {operator.manualNumber.paymentLink ? (
                    <div>
                      <p className="text-[10px] text-[#8b7a61]">{copy.paymentLink}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <a href={operator.manualNumber.paymentLink} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold text-[#ae771f] underline">{operator.manualNumber.paymentLink}</a>
                        <button type="button" onClick={copyPaymentNumber} className="flex shrink-0 items-center gap-1 rounded-md border border-[#d9bd8e] px-2 py-1 text-xs font-semibold text-[#906119]"><Copy className="h-3.5 w-3.5" /> {copy.copy}</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] text-[#8b7a61]">{copy.paymentNumber}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {operator.manualNumber.logoUrl && <img src={operator.manualNumber.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />}
                        <p className="min-w-0 flex-1 break-all font-mono text-sm font-bold text-[#555]">{operator.manualNumber.phone}</p>
                        <button type="button" onClick={copyPaymentNumber} className="flex shrink-0 items-center gap-1 rounded-md border border-[#d9bd8e] px-2 py-1 text-xs font-semibold text-[#906119]"><Copy className="h-3.5 w-3.5" /> {copy.copy}</button>
                      </div>
                    </div>
                  )}
                  {operator.manualNumber.ussdCode && <p className="text-xs text-[#735c3c]">{copy.ussd} <span className="font-mono font-semibold">{operator.manualNumber.ussdCode}</span></p>}
                  <p className="text-[11px] leading-4 text-[#777]">{copy.manualInstructions}</p>
                  <label htmlFor="robotpay-payment-proof" className="block text-xs font-semibold text-[#555]">
                    {copy.referenceLabel} <span className="text-red-500">*</span>
                    <textarea
                      id="robotpay-payment-proof"
                      value={paymentProof}
                      onChange={event => setPaymentProof(event.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder={copy.referencePlaceholder}
                      className="mt-1.5 w-full resize-none rounded-lg border border-[#d2d2d2] bg-white p-2.5 text-xs font-normal outline-none focus:border-[#d4a54e]"
                    />
                  </label>
                </div>
              )}

              <div className="-mx-[clamp(18px,6vw,27px)] mt-[clamp(12px,2.2dvh,20px)] flex items-start gap-2 bg-[#fbefef] px-[clamp(18px,6vw,27px)] py-[clamp(9px,1.8dvh,14px)] text-[clamp(11px,1.4dvh,12px)] leading-[1.45] text-[#bd5e62]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d08083]" />
                <p>{copy.warning}</p>
              </div>

              <button
                type="button"
                onClick={submitPhone}
                disabled={busy || !phone.trim() || !operator || (!!operator.manualNumber && !paymentProof.trim())}
                className="mx-auto mt-[clamp(13px,2.6dvh,22px)] flex h-[clamp(48px,7dvh,58px)] w-[43.5vw] min-w-[174px] max-w-[222px] items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#f6ca6a] to-[#dc982d] px-5 font-semibold text-white shadow-[0_5px_13px_rgba(176,119,32,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{copy.confirm} <ChevronRight className="h-5 w-5" /></>}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 p-5 text-center sm:p-7">
              <Stepper step={1} language={language} />
              {redirectUrl ? (
                <>
                  <p className="text-gray-700">{message || copy.securePage}</p>
                  <a href={redirectUrl} target="_blank" rel="noreferrer" className="block rounded-lg bg-[#1486d8] py-3 font-semibold text-white">{copy.openPaymentPage}</a>
                </>
              ) : (otpToken || ashtechOtpRequired) ? (
                <>
                  {ussd && <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-center font-mono text-xl font-bold tracking-widest text-[#00a526]">{ussd}</p>}
                  <p className="text-sm text-gray-600">{ussd ? copy.otpWithUssd : copy.otpWithoutUssd}</p>
                  <input value={activeProvider === "ashtech" ? ashtechOtp : otp} onChange={event => activeProvider === "ashtech" ? setAshtechOtp(event.target.value.replace(/\D/g, "")) : setOtp(event.target.value)} inputMode="numeric" placeholder={copy.otpPlaceholder} className="w-full rounded-lg border p-3 text-center text-xl" />
                  <button onClick={submitOtp} disabled={busy} className="w-full rounded-lg bg-[#1486d8] py-3 font-semibold text-white disabled:opacity-50">{copy.confirm}</button>
                </>
              ) : (
                <>
                  <ShieldCheck className="mx-auto h-16 w-16 animate-pulse text-green-400" />
                  <p className="text-lg font-semibold">{status === "rejected" ? copy.paymentFailed : copy.processing}</p>
                  <p className="text-sm text-gray-500">{status === "rejected" ? BANK_CLOSED_MESSAGE : copy.processingDetails}</p>
                </>
              )}
            </div>
          )}

          {step === 3 && (manualSubmitted ? (
            <div className="space-y-5 p-5 text-center sm:p-7">
              <Check className="mx-auto h-24 w-24 rounded-full bg-green-500 p-4 text-white" />
              <h2 className="text-xl text-gray-700">{copy.requestSent}</h2>
              <p className="text-sm text-gray-500">{telegramNotificationFailed ? copy.notificationFailed.replace("{id}", String(depositId ?? "")) : copy.manualSuccess}</p>
              <div className="rounded bg-gray-100 p-3 text-left text-sm leading-7 text-gray-700">
                <b>{copy.operator}</b> {operator?.name}<br />
                <b>{copy.amountLabel}</b> {amount.toLocaleString(language === "fr" ? "fr-FR" : "en-US")} {currency}<br />
                <b>{copy.reference}</b> {depositId ? `#${depositId}` : copy.pendingReference}<br />
                <b>{copy.status}</b> {copy.pendingApproval}
              </div>
              <button onClick={() => navigate("/")} className="text-lg text-[#4b91ef]">{copy.backToSite}</button>
            </div>
          ) : (
            <div className="space-y-5 p-5 text-center sm:p-7">
              <div className="border-b pb-3 text-left text-xl text-gray-700">ROBOTPAY - {countryInfo?.name || country}</div>
              <p className="text-left text-2xl text-gray-900">{amount.toLocaleString(language === "fr" ? "fr-FR" : "en-US")} {currency}</p>
              <Check className="mx-auto h-24 w-24 rounded-full bg-green-500 p-4 text-white" />
              <h2 className="text-xl text-gray-600">{copy.approved}</h2>
              <div className="rounded bg-gray-100 p-3 text-left text-sm leading-7 text-gray-700">
                <b>{copy.payer}</b> {phone}<br />
                <b>{copy.transactionId}</b> {transactionReference}<br />
                <b>{copy.paymentDate}</b> {new Date().toLocaleString(language === "fr" ? "fr-FR" : "en-US")}
              </div>
              <p className="pt-6 text-gray-500">🔒 {copy.securedBy} <b className="text-[#174d79]">ROBOTPAY</b></p>
              <button onClick={() => navigate("/")} className="text-lg text-[#4b91ef]">{copy.backToSite}</button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}