import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PEPSICO_LOGO } from "@/lib/john-deere-assets";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import telegramIcon from "@assets/telegram_(6)_1794096566582.png";
import ordersIcon from "@assets/order_(2)_1794096566697.png";
import serviceIcon from "@assets/service_(5)_1794096566673.png";
import backIcon from "@assets/image_1794151162399.png";
import "./account-info.css";

export default function AccountInfoPage() {
  const { user, refreshUser, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? "");

  useEffect(() => {
    setFullName(user?.fullName ?? "");
  }, [user?.fullName]);

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("PATCH", "/api/user/profile", { fullName: name.trim() });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Impossible d’enregistrer le profil.");
      }
      return response.json().catch(() => ({}));
    },
    onSuccess: async () => {
      await refreshUser();
      toast({ title: "Profil enregistré", description: "Votre nom a bien été mis à jour." });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = fullName.trim();
    if (value.length < 2) {
      toast({ title: "Nom invalide", description: "Saisissez au moins deux caractères.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(value);
  };

  return (
    <main className="account-info-page">
      <header className="account-info-header">
        <button className="account-info-back" type="button" onClick={() => navigate("/account")} aria-label="Retour au compte">
          <img src={backIcon} alt="" aria-hidden="true" />
        </button>
        <h1>Informations du profil</h1>
        <span aria-hidden="true" />
      </header>
      <form className="account-info-form" onSubmit={submit}>
        <div className="account-info-brand">
          <img src={PEPSICO_LOGO} alt="Logo PepsiCo" />
          <p>Importer une nouvelle photo de profil</p>
          <span>Taille recommandée : 200 px × 200 px</span>
        </div>
        <label htmlFor="profile-full-name">Surnom</label>
        <input
          id="profile-full-name"
          name="fullName"
          type="text"
          autoComplete="name"
          maxLength={100}
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Votre nom complet"
        />
        <button className="account-info-save" type="submit" disabled={saveMutation.isPending || !fullName.trim()}>
          {saveMutation.isPending && <Loader2 aria-hidden="true" />}
          {saveMutation.isPending ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
        <button className="account-info-logout" type="button" onClick={async () => { await logout(); navigate("/login"); }}>Déconnexion</button>
      </form>
      <nav className="account-info-floating" aria-label="Raccourcis rapides">
        <button type="button" onClick={() => navigate("/service")} aria-label="Ouvrir le service Telegram">
          <img src={telegramIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => navigate("/notice")} aria-label="Ouvrir les avis">
          <img src={ordersIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => navigate("/service")} aria-label="Contacter le service">
          <img src={serviceIcon} alt="" aria-hidden="true" />
        </button>
      </nav>
    </main>
  );
}
