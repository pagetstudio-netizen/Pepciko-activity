type LinkEnabledValue = string | boolean | null | undefined;

export function openAdminConfiguredLink(
  url: string | null | undefined,
  enabled: LinkEnabledValue,
  onUnavailable: () => void,
) {
  if (!url?.trim() || enabled === false || enabled === "false") {
    onUnavailable();
    return;
  }

  try {
    const link = new URL(url);
    if (link.protocol !== "https:") throw new Error("Lien non sécurisé");
    window.open(link.href, "_blank", "noopener,noreferrer");
  } catch {
    onUnavailable();
  }
}
