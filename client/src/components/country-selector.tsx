import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { ApiCountry } from "@/lib/countries";
import EmptyState from "@/components/empty-state";

interface CountrySelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (countryCode: string) => void;
  selectedCountryCode?: string;
}

export function CountrySelector({ open, onClose, onSelect, selectedCountryCode }: CountrySelectorProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 20, top: 140 });
  const { data: apiCountries, isLoading, isError, refetch } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
    enabled: open,
  });

  const countries = useMemo(
    () => (apiCountries || [])
      .filter((country) => country.isActive)
      .map((country) => ({
        code: country.code,
        name: country.name,
        phonePrefix: country.phonePrefix,
      }))
      .sort((first, second) => first.name.localeCompare(second.name, "fr")),
    [apiCountries],
  );
  const activeSelectedCountryCode = countries.some((country) => country.code === selectedCountryCode)
    ? selectedCountryCode
    : countries[0]?.code || "";

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = document.querySelector<HTMLElement>('[data-testid="button-select-country"]');
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 116;
      const rowHeight = 48;
      const maxHeight = Math.min(window.innerHeight * 0.78, 480);
      const contentHeight = isLoading || isError
        ? 96
        : Math.min(Math.max(countries.length * rowHeight, rowHeight), maxHeight);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      const top = Math.max(
        8,
        Math.min(rect.bottom - contentHeight, window.innerHeight - contentHeight - 8),
      );

      setMenuPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, countries.length, isLoading, isError]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="auth-picker-portal auth-redesign auth-screenshot">
      <div
        className="auth-picker-overlay"
        onClick={onClose}
        role="presentation"
      >
        <section
          ref={dialogRef}
          className="auth-picker-panel"
          style={{ left: menuPosition.left, top: menuPosition.top }}
          role="dialog"
          aria-modal="false"
          aria-label="Sélection du pays"
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="auth-picker-wheel">
            <div
              className="auth-picker-list"
              aria-label="Pays disponibles"
            >
              {isLoading ? (
                <div className="auth-picker-state" role="status">Chargement des pays…</div>
              ) : isError ? (
                <div className="auth-picker-state auth-picker-error" role="alert">
                  <span>Impossible de charger les pays.</span>
                  <button type="button" onClick={() => refetch()}>Réessayer</button>
                </div>
              ) : countries.length === 0 ? (
                <div className="auth-picker-state">
                  <EmptyState size="compact" className="auth-picker-empty">
                    Aucun pays disponible
                  </EmptyState>
                </div>
              ) : (
                countries.map((country) => {
                  const selected = country.code === activeSelectedCountryCode;
                  return (
                    <button
                      type="button"
                      key={country.code}
                      className={`auth-picker-row${selected ? " is-selected" : ""}`}
                      onClick={() => {
                        onSelect(country.code);
                        onClose();
                      }}
                      aria-pressed={selected}
                      aria-label={`${country.name} (+${country.phonePrefix})`}
                      data-country-code={country.code}
                      data-testid={`country-option-${country.code}`}
                    >
                      <span className="auth-picker-name">{country.code}</span>
                      <span className="auth-picker-prefix">(+{country.phonePrefix})</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}