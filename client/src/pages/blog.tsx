import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Gift, ShieldCheck } from "lucide-react";
import ruleIcon from "@assets/rule_icon_1793891936043.png";
import publishIcon from "@assets/publish_1793891935916.png";
import rulesArt from "@assets/rewards_icon_(1)_1793891974221.png";
import BlogImageLightbox from "@/components/blog-image-lightbox";
import "./blog.css";

export interface BlogPost {
  id: number | string;
  content: string;
  createdAt: string;
  authorPhone: string;
  images?: string[];
  rewardAmount?: string | number;
}

export default function BlogPage() {
  const [, navigate] = useLocation();
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const { data: posts, isLoading, isError, refetch } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts"],
    queryFn: async () => {
      const response = await fetch("/api/blog/posts", { credentials: "include" });
      if (!response.ok) throw new Error("Impossible de charger les publications.");
      return response.json();
    },
  });

  return (
    <main className="pepsi-blog-page">
      <div className="pepsi-blog-scroll">
        <header className="pepsi-blog-hero">
          <h1>Blog d&apos;investissement</h1>
          <div className="pepsi-blog-actions">
            <button className="pepsi-blog-action" type="button" onClick={() => window.dispatchEvent(new Event("open-blog-rules"))}>
              <img src={ruleIcon} alt="" />
              <span><strong>Règles du blog</strong><small>Guide des tâches</small></span>
            </button>
            <button className="pepsi-blog-action" type="button" onClick={() => navigate("/blog/create")}>
              <img src={publishIcon} alt="" />
              <span><strong>Créer un article</strong><small>Investissement</small></span>
            </button>
          </div>
        </header>

        <section className="pepsi-blog-feed" aria-label="Publications de la communauté">
          {isLoading ? (
            <div className="pepsi-blog-loading" role="status" aria-label="Chargement des publications">
              {[0, 1].map((key) => <div className="pepsi-post-skeleton" key={key}><i /><span /><span /></div>)}
            </div>
          ) : isError ? (
            <div className="pepsi-blog-state pepsi-blog-error" role="alert">
              <span>Les publications ne sont pas disponibles pour le moment.</span>
              <button type="button" onClick={() => void refetch()}>Réessayer</button>
            </div>
          ) : posts?.length ? (
            <div className="pepsi-post-list">
              {posts.map((post) => (
                <article className="pepsi-post" key={post.id}>
                  <div className="pepsi-post-author-row">
                    <img src="/pepsico-logo.jpg" className="pepsi-post-avatar" alt="" />
                    <div className="pepsi-post-author">
                      <strong>{post.authorPhone}</strong>
                    </div>
                    <ShieldCheck className="pepsi-post-check" size={18} aria-label="Membre" />
                  </div>
                  <p className="pepsi-post-content">{post.content}</p>
                  {Number(post.rewardAmount) > 0 && (
                    <div className="pepsi-post-reward">
                      <Gift size={16} aria-hidden="true" />
                      Récompense créditée : {Number(post.rewardAmount).toLocaleString("fr-FR")} FCFA
                    </div>
                  )}
                  {!!post.images?.length && (
                    <div className="pepsi-post-images">
                      {post.images.map((image, index) => (
                        <button
                          type="button"
                          className="pepsi-post-image-button"
                          key={image}
                          onClick={() => setSelectedImage({
                            src: image,
                            alt: `Capture d’écran ${index + 1} de la publication`,
                          })}
                          aria-label={`Agrandir la capture ${index + 1}`}
                        >
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="pepsi-blog-state pepsi-blog-empty">
              <span className="pepsi-empty-mark"><BookOpen size={25} /></span>
              <h3>La conversation commence ici</h3>
              <p>Aucune publication pour le moment. Partagez votre expérience avec la communauté.</p>
              <button type="button" onClick={() => navigate("/blog/create")}>Écrire une publication</button>
            </div>
          )}
        </section>
      </div>
      <BlogRulesSheet />
      <BlogImageLightbox image={selectedImage} onClose={() => setSelectedImage(null)} />
    </main>
  );
}

function BlogRulesSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("open-blog-rules", show);
    return () => window.removeEventListener("open-blog-rules", show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const scrollContainer = document.querySelector<HTMLElement>(".pepsi-blog-scroll");
    const previousScroll = scrollContainer?.style.overflowY;
    document.body.style.overflow = "hidden";
    if (scrollContainer) scrollContainer.style.overflowY = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (scrollContainer) scrollContainer.style.overflowY = previousScroll || "";
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="pepsi-rules-overlay" onClick={() => setOpen(false)} role="presentation">
      <section className="pepsi-rules-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="blog-rules-title">
        <img className="pepsi-rules-art" src={rulesArt} alt="" />
        <h2 id="blog-rules-title">Partagez des captures d&apos;écran de retrait pour obtenir des récompenses en espèces</h2>
        <div className="pepsi-rules-copy">
          <p>Veuillez soumettre : la page de retrait d&apos;aujourd&apos;hui et une preuve de paiement. Après validation, vous recevrez une récompense de 10 à 600 FCFA.</p>
        </div>
        <button className="pepsi-rules-understood" type="button" onClick={() => setOpen(false)}>Je comprends</button>
      </section>
    </div>
  );
}
