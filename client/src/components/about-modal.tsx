import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PEPSICO_LOGO } from "@/lib/john-deere-assets";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
              <img src={PEPSICO_LOGO} alt="PepsiCo" className="w-10 h-10 object-contain" />
            </div>
            À propos de PepsiCo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Cette plateforme permet de consulter votre compte, les produits et les opérations disponibles.
          </p>
          <div className="bg-secondary rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-foreground">À propos de PepsiCo, Inc.</h4>
            <ul className="space-y-1">
              <li>Entreprise du secteur des aliments et des boissons.</li>
              <li>Cette plateforme est un service indépendant et distinct.</li>
            </ul>
            <a className="inline-block text-primary underline" href="https://www.pepsico.com/about" target="_blank" rel="noreferrer">
              Consulter le site officiel
            </a>
          </div>
          <p className="text-xs">
            Version 1.0.0 - Tous droits réservés
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
