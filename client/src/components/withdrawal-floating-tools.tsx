import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import telegramIcon from "@assets/telegram_(6)_1794096566582.png";
import serviceIcon from "@assets/service_(5)_1794096566673.png";
import ordersIcon from "@assets/order_(2)_1794096566697.png";
import { openAdminConfiguredLink } from "@/lib/quick-links";
import "./withdrawal-floating-tools.css";

interface WithdrawalToolSettings {
  channelLink?: string | null;
  channelEnabled?: boolean | string;
  supportLink?: string | null;
  supportEnabled?: boolean | string;
}

interface WithdrawalFloatingToolsProps {
  containerClassName?: string;
  buttonClassName?: string;
}

export default function WithdrawalFloatingTools({
  containerClassName = "withdrawal-floating-tools",
  buttonClassName = "withdrawal-floating-tools__button",
}: WithdrawalFloatingToolsProps) {
  const [location, navigate] = useLocation();
  const { data: settings } = useQuery<WithdrawalToolSettings>({
    queryKey: ["/api/settings/links"],
  });

  const openChannel = () =>
    openAdminConfiguredLink(settings?.channelLink, settings?.channelEnabled, () => navigate("/service"));
  const openSupport = () =>
    openAdminConfiguredLink(settings?.supportLink, settings?.supportEnabled, () => navigate("/service"));

  return (
    <aside className={containerClassName} aria-label="Raccourcis">
      <button
        type="button"
        className={buttonClassName}
        aria-label="Ouvrir le lien officiel configuré"
        onClick={openChannel}
      >
        <img className="floating-quick-action-icon" src={telegramIcon} alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={buttonClassName}
        aria-label="Contacter le service client"
        onClick={openSupport}
      >
        <img className="floating-quick-action-icon" src={serviceIcon} alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={buttonClassName}
        aria-label="Voir mes commandes"
        onClick={() => navigate(`/orders?from=${encodeURIComponent(location)}`)}
      >
        <img className="floating-quick-action-icon" src={ordersIcon} alt="" aria-hidden="true" />
      </button>
    </aside>
  );
}
