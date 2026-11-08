import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import BlogImageLightbox from "@/components/blog-image-lightbox";

interface BlogSubmission {
  id: number;
  content: string;
  createdAt: string;
  authorPhone: string;
  images: string[];
}

export default function AdminBlogSubmissions() {
  const { toast } = useToast();
  const [rewardAmounts, setRewardAmounts] = useState<Record<number, string>>({});
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const {
    data: submissions = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<BlogSubmission[]>({
    queryKey: ["/api/admin/blog/submissions"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, rewardAmount }: { id: number; rewardAmount: number }) => {
      const response = await apiRequest("POST", `/api/admin/blog/submissions/${id}/approve`, { rewardAmount });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(error.message || "La soumission n’a pas pu être approuvée.");
      }
      return response.json() as Promise<{ message: string; rewardAmount: number }>;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
      toast({ title: "Soumission approuvée", description: result.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const approve = (submission: BlogSubmission) => {
    const amount = Number(rewardAmounts[submission.id]);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      toast({
        title: "Récompense invalide",
        description: "Saisissez un montant entier supérieur à zéro en FCFA.",
        variant: "destructive",
      });
      return;
    }
    approveMutation.mutate({ id: submission.id, rewardAmount: amount });
  };

  const formatDate = (value: string) => new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Soumissions Blog</h2>
          <p className="text-sm text-muted-foreground">
            Vérifiez les captures, puis fixez la récompense à créditer au solde de retrait.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{submissions.length} en attente</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualiser
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Les soumissions ne sont pas disponibles.</p>
            <Button variant="outline" onClick={() => void refetch()}>Réessayer</Button>
          </CardContent>
        </Card>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Aucune soumission en attente</p>
            <p className="text-sm text-muted-foreground">Les nouvelles publications apparaîtront ici après leur envoi.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Soumission #{submission.id}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {submission.authorPhone} · {formatDate(submission.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    À approuver
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap break-words text-sm">{submission.content}</p>

                <div className="grid max-w-md grid-cols-2 gap-3">
                  {submission.images.map((image, index) => (
                    <button
                      type="button"
                      key={image}
                      className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                      onClick={() => setSelectedImage({
                        src: image,
                        alt: `Capture ${index + 1} de la soumission ${submission.id}`,
                      })}
                      aria-label={`Agrandir la capture ${index + 1}`}
                    >
                      <img
                        src={`${image}?variant=thumb`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={360}
                        height={360}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                        Voir en grand
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                  <div className="w-full space-y-2 sm:max-w-xs">
                    <Label htmlFor={`blog-reward-${submission.id}`}>Récompense à créditer (FCFA)</Label>
                    <Input
                      id={`blog-reward-${submission.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={rewardAmounts[submission.id] ?? ""}
                      onChange={(event) => setRewardAmounts((current) => ({
                        ...current,
                        [submission.id]: event.target.value,
                      }))}
                      placeholder="Ex. 1000"
                      disabled={approveMutation.isPending}
                    />
                  </div>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => approve(submission)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending && approveMutation.variables?.id === submission.id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Check className="mr-2 h-4 w-4" />}
                    Approuver et créditer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BlogImageLightbox image={selectedImage} onClose={() => setSelectedImage(null)} />
    </section>
  );
}
