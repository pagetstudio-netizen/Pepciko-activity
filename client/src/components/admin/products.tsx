import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Edit, Loader2, TrendingUp, Plus, Trash2 } from "lucide-react";
import { getRobotProductImage } from "@/lib/john-deere-assets";
import type { Product, ProductType } from "@shared/schema";
import {
  PRODUCT_IMAGE_URL,
  WELLNESS_PRODUCT_IMAGE_URL,
} from "@shared/product-catalog";
import {
  getWellnessCardTotalRevenue,
  getWellnessDailyEarnings,
} from "@shared/wellness-product-policy";
import {
  getActivityDailyProfitEstimate,
  getActivityTotalPayout,
} from "@shared/activity-product-policy";
import {
  formatWellnessProductName,
  getNextWellnessProductNumber,
} from "@shared/wellness-product-names";
import {
  formatActivityProductName,
  getNextActivityProductNumber,
} from "@shared/activity-product-names";
import {
  formatStableProductName,
  getNextStableProductVipLevel,
} from "@shared/stable-product-names";
import EmptyState from "@/components/empty-state";

const productSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  price: z.string().min(1, "Prix requis"),
  dailyEarnings: z.string().min(1, "Valeur des gains requise"),
  activityProfit: z.string().optional(),
  cycleDays: z.string().min(1, "Durée requise"),
  imageUrl: z.string().optional(),
  launchDate: z.string().optional(),
  launchTime: z.string().optional(),
  stockLimit: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;
type ActivityProductDraft = Pick<ProductForm, "price" | "activityProfit" | "cycleDays" | "stockLimit">;
type ActivityProductPayload = Omit<ActivityProductDraft, "stockLimit"> & { stockLimit: number | null };
type AdminProduct = Product & { stockCount?: number };

const emptyActivityDraft = (): ActivityProductDraft => ({
  price: "",
  activityProfit: "",
  cycleDays: "3",
  stockLimit: "",
});

export default function AdminProducts() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showActivityBatch, setShowActivityBatch] = useState(false);
  const [productView, setProductView] = useState<ProductType>("stable");
  const [activityLaunchDate, setActivityLaunchDate] = useState("");
  const [activityLaunchTime, setActivityLaunchTime] = useState("");
  const [activityRows, setActivityRows] = useState<ActivityProductDraft[]>([emptyActivityDraft()]);
  const [activityFormError, setActivityFormError] = useState("");

  const { data: products, isLoading } = useQuery<AdminProduct[]>({
    queryKey: ["/api/admin/products/all"],
  });
  const visibleProducts = (products || []).filter(
    (product) => product.productType === productView && !product.isArchived,
  );
  const nextActivitySequence = getNextActivityProductNumber(products || []);
  const nextStableProductName = formatStableProductName(
    getNextStableProductVipLevel(products || []),
  );
  const nextWellnessProductName = formatWellnessProductName(
    getNextWellnessProductNumber(products || []),
  );

  const editForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", price: "", dailyEarnings: "", cycleDays: "80", imageUrl: PRODUCT_IMAGE_URL, launchDate: "", launchTime: "", stockLimit: "" },
  });

  const createForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: nextStableProductName, price: "", dailyEarnings: "", cycleDays: "80", imageUrl: PRODUCT_IMAGE_URL, launchDate: "", launchTime: "", stockLimit: "" },
  });
  const resetCreateForm = () => createForm.reset({
    name: productView === "wellness" ? nextWellnessProductName : nextStableProductName,
    price: "",
    dailyEarnings: "",
    cycleDays: productView === "wellness" ? "2" : "80",
    imageUrl: productView === "wellness" ? WELLNESS_PRODUCT_IMAGE_URL : PRODUCT_IMAGE_URL,
    launchDate: "",
    launchTime: "",
    stockLimit: "",
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, productType }: {
      data: ProductForm & { totalReturn?: number };
      productType: ProductType;
    }) => {
      const path = productType === "wellness"
        ? "/api/admin/products/wellness"
        : "/api/admin/products";
      const response = await apiRequest("POST", path, data);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: (_created, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: variables.productType === "wellness" ? "Produit Bien-être créé !" : "Produit créé !" });
      setShowCreateForm(false);
      resetCreateForm();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const activityBatchMutation = useMutation({
    mutationFn: async (data: { launchDate: string; launchTime: string; products: ActivityProductPayload[] }) => {
      const response = await apiRequest("POST", "/api/admin/products/bulk-activity", data);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: (created: Product[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: `${created.length} produit(s) d’activité créé(s)` });
      setProductView("activity");
      setShowActivityBatch(false);
      setActivityRows([emptyActivityDraft()]);
      setActivityLaunchDate("");
      setActivityLaunchTime("");
      setActivityFormError("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Product> }) => {
      const response = await apiRequest("PATCH", `/api/admin/products/${id}`, data);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produit mis à jour!" });
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/products/${id}`, { isActive });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/products/${id}`, {});
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Erreur");
      }
      return response.json();
    },
    onSuccess: (result: { archived?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: result.archived ? "Produit retiré du catalogue" : "Produit supprimé",
        description: result.archived
          ? "Des achats ou commissions y sont associés. L’historique a été conservé."
          : undefined,
      });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (product: Product) => {
    setSelectedProduct(product);
    editForm.reset({
      name: product.name,
      price: product.price.toString(),
      dailyEarnings: (product.productType === "wellness"
        ? product.totalReturn
        : product.dailyEarnings).toString(),
      activityProfit: product.productType === "activity"
        ? Math.max(0, product.totalReturn - product.price).toString()
        : "",
      cycleDays: product.cycleDays.toString(),
      imageUrl: product.productType === "wellness"
        ? product.imageUrl || WELLNESS_PRODUCT_IMAGE_URL
        : PRODUCT_IMAGE_URL,
      launchDate: product.launchDate || "",
      launchTime: product.launchTime || "",
      stockLimit: product.stockLimit?.toString() || "",
    });
  };

  const handleUpdate = (data: ProductForm) => {
    if (!selectedProduct) return;
    const price = parseInt(data.price);
    const cycleDays = parseInt(data.cycleDays);
    const isWellness = selectedProduct.productType === "wellness";
    const isActivity = selectedProduct.productType === "activity";
    const totalReturn = isWellness ? parseInt(data.dailyEarnings) : undefined;
    const fixedProfit = isActivity ? parseInt(data.activityProfit || "0") : undefined;
    const dailyEarnings = isWellness
      ? getWellnessDailyEarnings(
        getWellnessCardTotalRevenue(price, totalReturn || 0),
        cycleDays,
      )
      : isActivity
        ? getActivityDailyProfitEstimate(fixedProfit || 0, cycleDays)
        : parseInt(data.dailyEarnings);
    updateMutation.mutate({
      id: selectedProduct.id,
      data: {
        ...(selectedProduct.productType !== "activity" ? { name: data.name } : {}),
        price,
        dailyEarnings,
        cycleDays,
        ...(isActivity
          ? { profit: fixedProfit }
          : { totalReturn: totalReturn ?? dailyEarnings * cycleDays }),
        imageUrl: selectedProduct.productType === "wellness"
          ? data.imageUrl || WELLNESS_PRODUCT_IMAGE_URL
          : PRODUCT_IMAGE_URL,
        ...(selectedProduct.productType === "activity"
          ? {
            launchDate: data.launchDate,
            launchTime: data.launchTime,
            stockLimit: data.stockLimit?.trim() ? Number(data.stockLimit) : null,
          }
          : {}),
      },
    });
  };

  const handleCreate = (data: ProductForm) => {
    const productType = productView;
    const cycleDays = parseInt(data.cycleDays);
    const totalReturn = productType === "wellness" ? parseInt(data.dailyEarnings) : undefined;
    const dailyEarnings = productType === "wellness"
      ? getWellnessDailyEarnings(
        getWellnessCardTotalRevenue(parseInt(data.price), totalReturn || 0),
        cycleDays,
      )
      : parseInt(data.dailyEarnings);
    createMutation.mutate({
      productType,
      data: {
        ...data,
        dailyEarnings: dailyEarnings.toString(),
        ...(totalReturn !== undefined ? { totalReturn } : {}),
        name: productType === "wellness" ? nextWellnessProductName : nextStableProductName,
      },
    });
  };

  const updateActivityRow = (index: number, field: keyof ActivityProductDraft, value: string) => {
    setActivityRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row,
    ));
  };

  const submitActivityBatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activityLaunchDate || !activityLaunchTime) {
      setActivityFormError("Indiquez la date et l’heure locales de lancement.");
      return;
    }
    if (activityRows.some((row) =>
      !Number.isSafeInteger(Number(row.price)) || Number(row.price) <= 0
      || !Number.isSafeInteger(Number(row.activityProfit)) || Number(row.activityProfit) <= 0
      || !Number.isSafeInteger(Number(row.cycleDays)) || Number(row.cycleDays) <= 0
      || getActivityTotalPayout(Number(row.price), Number(row.activityProfit)) <= 0
      || (Boolean(row.stockLimit?.trim())
        && (!Number.isSafeInteger(Number(row.stockLimit)) || Number(row.stockLimit) <= 0 || Number(row.stockLimit) > 2_147_483_647))
    )) {
      setActivityFormError("Complétez le prix, le bénéfice fixe et la durée de chaque produit, puis indiquez une limite de places valide ou laissez-la vide.");
      return;
    }
    setActivityFormError("");
    activityBatchMutation.mutate({
      launchDate: activityLaunchDate,
      launchTime: activityLaunchTime,
      products: activityRows.map((row) => ({
        ...row,
        stockLimit: row.stockLimit?.trim() ? Number(row.stockLimit) : null,
      })),
    });
  };

  const ProductFormFields = ({
    form,
    isPending,
    submitLabel,
    showSchedule = false,
    automaticName = false,
    allowCustomImage = false,
  }: {
    form: any;
    isPending: boolean;
    submitLabel: string;
    showSchedule?: boolean;
    automaticName?: boolean;
    allowCustomImage?: boolean;
  }) => (
    <form onSubmit={form.handleSubmit(submitLabel === "Créer" ? handleCreate : handleUpdate)} className="space-y-4">
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>{showSchedule || automaticName ? "Nom attribué automatiquement" : "Nom du produit"}</FormLabel>
          <FormControl>
            <Input
              {...field}
              readOnly={showSchedule || automaticName}
              placeholder={showSchedule || automaticName ? "Nom attribué automatiquement" : "Ex. : Tracteur série 5E"}
            />
          </FormControl>
          {(showSchedule || automaticName) && (
            <p className="text-xs text-muted-foreground">
              Le nom du produit est attribué automatiquement et ne peut pas être modifié.
            </p>
          )}
          <FormMessage />
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="price" render={({ field }) => (
          <FormItem>
            <FormLabel>Prix (F)</FormLabel>
            <FormControl><Input {...field} type="number" placeholder="Ex: 15000" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {showSchedule ? (
          <FormField control={form.control} name="activityProfit" render={({ field }) => (
            <FormItem>
              <FormLabel>Bénéfice fixe (F)</FormLabel>
              <FormControl><Input {...field} type="number" min="1" step="1" placeholder="Ex. : 1250" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ) : (
          <FormField control={form.control} name="dailyEarnings" render={({ field }) => (
            <FormItem>
              <FormLabel>{allowCustomImage ? "Bénéfice total du cycle (F)" : "Gains/jour (F)"}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  placeholder={allowCustomImage ? "Ex: 4000" : "Ex: 300"}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
      </div>
      <FormField control={form.control} name="cycleDays" render={({ field }) => (
        <FormItem>
          <FormLabel>Durée (jours)</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="number"
              min={1}
              step="1"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      {allowCustomImage && (
        <p className="text-sm text-muted-foreground">
          Gain journalier calculé :{" "}
          <strong className="text-foreground">
            {getWellnessDailyEarnings(
              getWellnessCardTotalRevenue(
                Number(form.watch("price")) || 0,
                Number(form.watch("dailyEarnings")) || 0,
              ),
              Number(form.watch("cycleDays")) || 0,
            ).toLocaleString("fr-FR")} FCFA/jour
          </strong>
        </p>
      )}
      {allowCustomImage && (
        <FormField control={form.control} name="imageUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Image du produit</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="https://… ou /chemin/vers/image"
                aria-label="Adresse de l’image du produit"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Utilisez une adresse HTTPS publique ou un chemin d’image du site.
            </p>
            <FormMessage />
          </FormItem>
        )} />
      )}
      <div className="flex items-center gap-3 rounded-md border p-3">
        <img
          src={allowCustomImage
            ? form.watch("imageUrl") || WELLNESS_PRODUCT_IMAGE_URL
            : PRODUCT_IMAGE_URL}
          alt={allowCustomImage ? "Aperçu de l’image du produit Bien-être" : "Illustration PepsiCo Poppi commune aux produits"}
          className="h-16 w-20 rounded object-cover"
        />
        <div>
          <p className="text-sm font-medium">
            {allowCustomImage ? "Aperçu de l’image Bien-être" : "Image commune aux produits"}
          </p>
          <p className="text-xs text-muted-foreground">
            {allowCustomImage ? "L’image sera conservée avec l’offre." : "Stable et activité"}
          </p>
        </div>
      </div>
      {showSchedule && (
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="launchDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Date de lancement</FormLabel>
              <FormControl><Input {...field} type="date" required /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="launchTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Heure locale</FormLabel>
              <FormControl><Input {...field} type="time" required /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      )}
      {showSchedule && (
        <FormField control={form.control} name="stockLimit" render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre maximum de places <span className="text-muted-foreground font-normal">(facultatif)</span></FormLabel>
            <FormControl>
              <Input {...field} type="number" min="1" step="1" placeholder="Ex. : 30 — vide = sans limite" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}
      {form.watch("price") && form.watch("dailyEarnings") && form.watch("cycleDays") && (
        <div className="bg-primary/10 rounded-lg p-3 text-sm">
          {allowCustomImage ? (
            <>
              <p className="text-muted-foreground">Bénéfice du cycle :</p>
              <p className="font-semibold text-primary">
                {Number(form.watch("dailyEarnings")).toLocaleString("fr-FR")} F
              </p>
              <p className="mt-1 text-muted-foreground">Revenu total à répartir (prix + bénéfice) :</p>
              <p className="font-bold text-primary text-lg">
                {getWellnessCardTotalRevenue(
                  Number(form.watch("price")) || 0,
                  Number(form.watch("dailyEarnings")) || 0,
                ).toLocaleString("fr-FR")} F
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">Retour total estimé :</p>
              <p className="font-bold text-primary text-lg">
                {(parseInt(form.watch("dailyEarnings") || "0") * parseInt(form.watch("cycleDays") || "0")).toLocaleString("fr-FR")} F
              </p>
            </>
          )}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-product">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : submitLabel}
      </Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant={productView === "stable" ? "default" : "outline"} onClick={() => setProductView("stable")}>
          Produits stables ({products?.filter((product) => product.productType === "stable").length || 0})
        </Button>
        <Button variant={productView === "wellness" ? "default" : "outline"} onClick={() => setProductView("wellness")}>
          Bien-être ({products?.filter((product) => product.productType === "wellness").length || 0})
        </Button>
        <Button variant={productView === "activity" ? "default" : "outline"} onClick={() => setProductView("activity")}>
          Produits d’activité ({products?.filter((product) => product.productType === "activity").length || 0})
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{visibleProducts.length} produit(s)</p>
        {productView === "stable" || productView === "wellness" ? (
          <Button disabled={isLoading} onClick={() => { setShowCreateForm(true); resetCreateForm(); }} data-testid="button-add-product">
            <Plus className="w-4 h-4 mr-2" />
            {productView === "wellness" ? "Nouveau produit Bien-être" : "Nouveau produit stable"}
          </Button>
        ) : (
          <Button onClick={() => { setShowActivityBatch(true); setActivityFormError(""); }} data-testid="button-add-activity-batch">
            <Plus className="w-4 h-4 mr-2" />
            Créer un lot
          </Button>
        )}
      </div>

      {isLoading ? (
        Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
      ) : visibleProducts.length > 0 ? (
        visibleProducts.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={getRobotProductImage(product.imageUrl, product.id, product.name, product.productType)}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = product.productType === "wellness"
                        ? WELLNESS_PRODUCT_IMAGE_URL
                        : PRODUCT_IMAGE_URL;
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {product.productType === "activity"
                          ? "Activité"
                          : product.productType === "wellness" ? "Bien-être" : "Stable"}
                      </Badge>
                      {product.isFree && <Badge variant="secondary" className="text-xs">Gratuit</Badge>}
                      <Badge variant={product.isActive ? "default" : "outline"} className="text-xs">
                        {product.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {product.price.toLocaleString()} F — {product.productType === "activity"
                        ? `${Math.max(0, product.totalReturn - product.price).toLocaleString()} F de bénéfice fixe, versé à l’échéance`
                        : `${product.dailyEarnings.toLocaleString()} F/jour, versés à l’échéance`}
                    </p>
                    {product.productType === "activity" && product.launchDate && product.launchTime && (
                      <p className="text-xs text-muted-foreground">
                        Lancement GMT : {product.launchDate} à {product.launchTime}
                      </p>
                    )}
                    {product.productType === "activity" && (
                      <p className={`text-xs ${product.stockLimit != null && (product.stockCount || 0) >= product.stockLimit ? "text-destructive" : "text-muted-foreground"}`}>
                        {product.stockLimit == null
                          ? `Places : ${product.stockCount || 0} — sans limite`
                          : `Places : ${product.stockCount || 0} / ${product.stockLimit}${(product.stockCount || 0) >= product.stockLimit ? " — complet" : ""}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={product.isActive}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: product.id, isActive: checked })}
                    data-testid={`switch-product-${product.id}`}
                  />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(product)} data-testid={`button-edit-product-${product.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {!product.isFree && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => { if (confirm(`Supprimer "${product.name}" ?`)) deleteMutation.mutate(product.id); }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Prix</p>
                  <p className="font-medium text-foreground">{product.price.toLocaleString()} F</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {product.productType === "activity" ? "Bénéfice fixe" : "Gains/jour calculés"}
                  </p>
                  <p className="font-medium text-foreground">
                    {(product.productType === "activity"
                      ? Math.max(0, product.totalReturn - product.price)
                      : product.productType === "wellness"
                        ? getWellnessDailyEarnings(
                          getWellnessCardTotalRevenue(product.price, product.totalReturn),
                          product.cycleDays,
                        )
                        : product.dailyEarnings).toLocaleString()} F
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {product.productType === "wellness"
                      ? "Revenu total"
                      : product.productType === "activity"
                        ? `Total reçu (${product.cycleDays}j)`
                        : `Total (${product.cycleDays}j)`}
                  </p>
                  <p className="font-medium text-primary">
                    {(product.productType === "wellness"
                      ? getWellnessCardTotalRevenue(product.price, product.totalReturn)
                      : product.totalReturn).toLocaleString()} F
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <EmptyState className="py-8">
          {productView === "activity"
            ? "Aucun produit d’activité planifié."
            : productView === "wellness" ? "Aucun produit Bien-être." : "Aucun produit stable."}
        </EmptyState>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateForm} onOpenChange={(open) => { if (!open) { setShowCreateForm(false); resetCreateForm(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {productView === "wellness" ? "Nouveau produit Bien-être" : "Nouveau produit stable"}
            </DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <ProductFormFields
              form={createForm}
              isPending={createMutation.isPending}
              submitLabel="Créer"
              automaticName
              allowCustomImage={productView === "wellness"}
            />
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier — {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <ProductFormFields
              form={editForm}
              isPending={updateMutation.isPending}
              submitLabel="Enregistrer"
              showSchedule={selectedProduct?.productType === "activity"}
              automaticName={selectedProduct?.productType !== "activity"}
              allowCustomImage={selectedProduct?.productType === "wellness"}
            />
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showActivityBatch} onOpenChange={(open) => {
        setShowActivityBatch(open);
        if (!open) {
          setActivityRows([emptyActivityDraft()]);
          setActivityLaunchDate("");
          setActivityLaunchTime("");
          setActivityFormError("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un lot de produits d’activité</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitActivityBatch} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              L’heure est en GMT (UTC). À 16 h GMT, il sera 17 h au Bénin et au Cameroun.
              Les gains sont versés en une fois à l’échéance.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="activity-launch-date">Date de lancement</label>
                <Input
                  id="activity-launch-date"
                  type="date"
                  value={activityLaunchDate}
                  onChange={(event) => setActivityLaunchDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="activity-launch-time">Heure GMT</label>
                <Input
                  id="activity-launch-time"
                  type="time"
                  value={activityLaunchTime}
                  onChange={(event) => setActivityLaunchTime(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-3">
              {activityRows.map((row, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Produit {index + 1}</p>
                    {activityRows.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Supprimer le produit ${index + 1} du lot`}
                        onClick={() => setActivityRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <p className="col-span-2 text-sm text-muted-foreground">
                      Nom attribué :{" "}
                      <strong className="text-foreground">
                        {formatActivityProductName(nextActivitySequence + index)}
                      </strong>
                    </p>
                    <Input
                      aria-label={`Prix du produit ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={row.price}
                      onChange={(event) => updateActivityRow(index, "price", event.target.value)}
                      placeholder="Prix (FCFA)"
                      required
                    />
                    <Input
                      aria-label={`Bénéfice fixe du produit ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={row.activityProfit}
                      onChange={(event) => updateActivityRow(index, "activityProfit", event.target.value)}
                      placeholder="Bénéfice fixe (FCFA)"
                      required
                    />
                    <Input
                      aria-label={`Durée du produit ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={row.cycleDays}
                      onChange={(event) => updateActivityRow(index, "cycleDays", event.target.value)}
                      placeholder="Durée (jours)"
                      required
                    />
                    <Input
                      aria-label={`Nombre maximum de places du produit ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      value={row.stockLimit}
                      onChange={(event) => updateActivityRow(index, "stockLimit", event.target.value)}
                      placeholder="Places maximum (facultatif)"
                    />
                    <p className="col-span-2 text-sm text-muted-foreground">
                      Total reçu à l’échéance (prix inclus) :{" "}
                      <strong className="text-foreground">
                        {getActivityTotalPayout(
                          Number(row.price || 0),
                          Number(row.activityProfit || 0),
                        ).toLocaleString("fr-FR")} FCFA
                      </strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {activityRows.length < 50 && (
              <Button type="button" variant="outline" onClick={() => setActivityRows((current) => [...current, emptyActivityDraft()])}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un produit au lot
              </Button>
            )}
            {activityFormError && <p className="text-sm text-destructive" role="alert">{activityFormError}</p>}
            <Button type="submit" className="w-full" disabled={activityBatchMutation.isPending}>
              {activityBatchMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : `Créer ${activityRows.length} produit${activityRows.length > 1 ? "s" : ""} planifié${activityRows.length > 1 ? "s" : ""}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
