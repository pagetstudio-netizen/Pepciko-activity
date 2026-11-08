import { toast } from "@/hooks/use-toast";

export interface CopyToastMessages {
  successTitle?: string;
  successDescription?: string;
  failureTitle?: string;
  failureDescription?: string;
}

function copyWithLegacyCommand(value: string) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  field.style.top = "0";
  field.style.opacity = "0";
  field.style.pointerEvents = "none";
  document.body.appendChild(field);

  let copied = false;
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, value.length);
    copied = document.execCommand("copy");
  } finally {
    field.remove();
  }

  if (!copied) throw new Error("Le navigateur n’a pas autorisé la copie.");
}

export async function copyTextWithToast(
  value: string,
  messages: CopyToastMessages = {},
): Promise<boolean> {
  try {
    if (!value) throw new Error("Aucun texte à copier.");

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        copyWithLegacyCommand(value);
      }
    } else {
      copyWithLegacyCommand(value);
    }

    toast({
      title: messages.successTitle ?? "Copie réussie",
      description: messages.successDescription,
    });
    return true;
  } catch {
    toast({
      title: messages.failureTitle ?? "Copie impossible",
      description: messages.failureDescription ?? "Veuillez sélectionner et copier le texte manuellement.",
      variant: "destructive",
    });
    return false;
  }
}
