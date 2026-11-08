import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import "./auth-redesign.css";
import "./auth-reference.css";
import "./auth-screenshot.css";
import "./auth-pepsico.css";

interface AuthPageShellProps {
  children: ReactNode;
  mode: "login" | "register";
}

export function AuthPageShell({ children, mode }: AuthPageShellProps) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousScrollY = window.scrollY;
    const previousHtml = {
      height: html.style.height,
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
    };
    const previousBody = {
      height: body.style.height,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      position: body.style.position,
      top: body.style.top,
      right: body.style.right,
      bottom: body.style.bottom,
      left: body.style.left,
      width: body.style.width,
    };

    html.style.height = "100%";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";
    window.scrollTo(0, 0);

    return () => {
      html.style.height = previousHtml.height;
      html.style.overflow = previousHtml.overflow;
      html.style.overscrollBehavior = previousHtml.overscrollBehavior;
      body.style.height = previousBody.height;
      body.style.overflow = previousBody.overflow;
      body.style.overscrollBehavior = previousBody.overscrollBehavior;
      body.style.position = previousBody.position;
      body.style.top = previousBody.top;
      body.style.right = previousBody.right;
      body.style.bottom = previousBody.bottom;
      body.style.left = previousBody.left;
      body.style.width = previousBody.width;
      window.scrollTo(0, previousScrollY);
    };
  }, []);

  return (
    <main className="auth-redesign auth-screenshot auth-pepsico" data-mode={mode}>
      <div className={`auth-shell auth-shell-${mode}`}>
        <h1 className="auth-brand-title">Bienvenue chez PepsiCo</h1>
        <div className="auth-switch-ribbon">
          <button
            type="button"
            onClick={() => navigate(mode === "login" ? "/register" : "/login")}
          >
            {mode === "login" ? "Créer un compte" : "Se connecter"}
          </button>
        </div>

        <section className="auth-card" aria-label="Formulaire d’authentification">
          <h2 className="auth-screen-reader-title">
            {mode === "login" ? "Connexion" : "Inscription"}
          </h2>
          {children}
        </section>
      </div>
    </main>
  );
}