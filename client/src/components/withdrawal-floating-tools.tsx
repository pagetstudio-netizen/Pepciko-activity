import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import telegramIcon from "@assets/telegram_(6)_1794096566582.png";
import serviceIcon from "@assets/service_(5)_1794096566673.png";
import ordersIcon from "@assets/order_(2)_1794096566697.png";
import { openTawkChat } from "@/lib/tawk-to";
import { openAdminConfiguredLink } from "@/lib/quick-links";
import "./withdrawal-floating-tools.css";

const POSITION_STORAGE_KEY = "floating-quick-actions-position-v1";
const VIEWPORT_MARGIN = 8;

interface FloatingPosition {
  left: number;
  top: number;
}

interface PositionRatio {
  x: number;
  y: number;
}

interface WithdrawalToolSettings {
  channelLink?: string | null;
  channelEnabled?: boolean | string;
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
  const toolsRef = useRef<HTMLElement | null>(null);
  const positionRef = useRef<FloatingPosition | null>(null);
  const savedRatioRef = useRef<PositionRatio | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { data: settings } = useQuery<WithdrawalToolSettings>({
    queryKey: ["/api/settings/links"],
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PositionRatio;
        if (
          Number.isFinite(parsed.x) && parsed.x >= 0 && parsed.x <= 1 &&
          Number.isFinite(parsed.y) && parsed.y >= 0 && parsed.y <= 1
        ) {
          savedRatioRef.current = parsed;
        }
      }
    } catch {
      savedRatioRef.current = null;
    }

    const applySavedPosition = () => {
      const ratio = savedRatioRef.current;
      const tools = toolsRef.current;
      if (!ratio || !tools) return;

      const rect = tools.getBoundingClientRect();
      const availableX = Math.max(0, window.innerWidth - rect.width - VIEWPORT_MARGIN * 2);
      const availableY = Math.max(0, window.innerHeight - rect.height - VIEWPORT_MARGIN * 2);
      const nextPosition = {
        left: VIEWPORT_MARGIN + ratio.x * availableX,
        top: VIEWPORT_MARGIN + ratio.y * availableY,
      };
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    };

    applySavedPosition();
    window.addEventListener("resize", applySavedPosition);
    return () => {
      window.removeEventListener("resize", applySavedPosition);
      dragCleanupRef.current?.();
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || dragCleanupRef.current) return;
    const tools = event.currentTarget;
    const startRect = tools.getBoundingClientRect();
    const startPosition = positionRef.current || { left: startRect.left, top: startRect.top };
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!moved && Math.hypot(deltaX, deltaY) < 6) return;

      moved = true;
      setIsDragging(true);
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - startRect.width - VIEWPORT_MARGIN);
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - startRect.height - VIEWPORT_MARGIN);
      const nextPosition = {
        left: Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, startPosition.left + deltaX)),
        top: Math.min(maxTop, Math.max(VIEWPORT_MARGIN, startPosition.top + deltaY)),
      };
      positionRef.current = nextPosition;
      setPosition(nextPosition);
      moveEvent.preventDefault();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      if (dragCleanupRef.current === cleanup) dragCleanupRef.current = null;
    };

    const handleEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== event.pointerId) return;
      if (moved) {
        const finalPosition = positionRef.current || startPosition;
        const availableX = Math.max(0, window.innerWidth - startRect.width - VIEWPORT_MARGIN * 2);
        const availableY = Math.max(0, window.innerHeight - startRect.height - VIEWPORT_MARGIN * 2);
        const ratio = {
          x: availableX ? Math.min(1, Math.max(0, (finalPosition.left - VIEWPORT_MARGIN) / availableX)) : 0,
          y: availableY ? Math.min(1, Math.max(0, (finalPosition.top - VIEWPORT_MARGIN) / availableY)) : 0,
        };
        savedRatioRef.current = ratio;
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(ratio));
        } catch {
          // The group remains movable for this session if browser storage is unavailable.
        }
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      cleanup();
      setIsDragging(false);
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  };

  const positionStyle = position
    ? { left: `${position.left}px`, top: `${position.top}px`, right: "auto", transform: "none" }
    : undefined;

  const openChannel = () =>
    openAdminConfiguredLink(settings?.channelLink, settings?.channelEnabled, () => navigate("/service"));
  const openSupport = () => {
    if (!settings || settings.supportEnabled === false || settings.supportEnabled === "false") {
      navigate("/service");
      return;
    }
    openTawkChat();
  };

  return (
    <aside
      ref={toolsRef}
      className={`${containerClassName}${isDragging ? " withdrawal-floating-tools--dragging" : ""}`}
      style={positionStyle}
      aria-label="Raccourcis flottants — faites glisser le groupe pour le déplacer"
      onPointerDown={handlePointerDown}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }}
    >
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
