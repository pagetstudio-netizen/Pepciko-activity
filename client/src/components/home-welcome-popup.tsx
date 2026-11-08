import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import telegramIcon from "@assets/telegram_icon_(2)_1793927342765.png";
import "./home-welcome-popup.css";

interface HomePopupSettings {
  groupLink?: string;
}

function safeTelegramUrl(value?: string) {
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export default function HomeWelcomePopup() {
  const [open, setOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();
  const lastUserId = useRef<string | null>(null);
  const pendingSessionPopup = useRef(false);
  const { data: transactionPasswordStatus, isLoading: transactionPasswordStatusLoading } =
    useQuery<{ hasPassword: boolean }>({
      queryKey: ["/api/auth/transaction-password/status"],
      enabled: Boolean(user) && !user?.isAdmin && !(user as any)?.isBanker,
    });
  const { data: settings, isLoading } = useQuery<HomePopupSettings>({
    queryKey: ["/api/settings"],
    enabled: open,
  });

  useEffect(() => {
    if (authLoading) return;

    const currentUserId = user?.id == null ? null : String(user.id);
    if (currentUserId === null) {
      pendingSessionPopup.current = false;
    } else if (lastUserId.current === null) {
      pendingSessionPopup.current = true;
    }
    lastUserId.current = currentUserId;

    const isAuthOrRobotPayPage =
      location === "/login"
      || location === "/register"
      || location === "/tg/pages/login/reset"
      || location === "/robotpay"
      || location === "/transaction-password/setup";
    const canShowSessionPopup =
      Boolean(user?.isAdmin || (user as any)?.isBanker)
      || transactionPasswordStatus?.hasPassword === true;
    if (
      pendingSessionPopup.current
      && !isAuthOrRobotPayPage
      && !transactionPasswordStatusLoading
      && canShowSessionPopup
    ) {
      pendingSessionPopup.current = false;
      setOpen(true);
    }
  }, [
    authLoading,
    location,
    transactionPasswordStatus?.hasPassword,
    transactionPasswordStatusLoading,
    user?.id,
    user?.isAdmin,
    (user as any)?.isBanker,
  ]);

  useEffect(() => {
    const showPopup = () => setOpen(true);
    window.addEventListener("home-tab-clicked", showPopup);
    return () => window.removeEventListener("home-tab-clicked", showPopup);
  }, []);

  const groupUrl = safeTelegramUrl(settings?.groupLink);
  const canJoinGroup = Boolean(groupUrl);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="home-welcome-overlay" />
        <DialogPrimitive.Content
          className="home-welcome-dialog"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="home-welcome-stage" aria-busy={isLoading}>
            <img
              className="home-welcome-icon"
              src={telegramIcon}
              alt=""
              aria-hidden="true"
            />

            <DialogPrimitive.Title className="home-welcome-title">
              Mises à jour officielles
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="home-welcome-description">
              Suivez notre chaîne Telegram officielle pour les dernières actualités et des avantages exclusifs
            </DialogPrimitive.Description>

            {canJoinGroup ? (
              <a
                className="home-welcome-telegram"
                href={groupUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Suivez-nous maintenant"
              >
                Suivez-nous maintenant
              </a>
            ) : (
              <button
                className="home-welcome-telegram is-unavailable"
                type="button"
                disabled
                aria-label="Suivez-nous maintenant"
                title="Le lien du groupe Telegram n’est pas configuré"
              >
                Suivez-nous maintenant
              </button>
            )}

            <DialogPrimitive.Close asChild>
              <button className="home-welcome-cancel" type="button">
                Annuler
              </button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}