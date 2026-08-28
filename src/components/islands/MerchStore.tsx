import { useEffect, useState } from "react";
import { toast } from "sonner";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  sizes: string[];
};

type CartLine = { product: Product; size: string | null; quantity: number };

export function MerchStore() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (await getSupabase())
        .from("merch_products")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (!active) return;
      if (!error && data) setProducts(data as Product[]);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const add = (product: Product, size: string | null) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === product.id && l.size === size);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i]!, quantity: next[i]!.quantity + 1 };
        return next;
      }
      return [...prev, { product, size, quantity: 1 }];
    });
    toast.success(`${product.name} agregado`);
  };

  const total = cart.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0);

  const checkout = async () => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const { data: order, error } = await (await getSupabase())
        .from("merch_orders")
        .insert({ user_id: user.id, total })
        .select("id")
        .single();
      if (error) throw error;
      const items = cart.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_name: l.product.name,
        quantity: l.quantity,
        size: l.size,
        unit_price: l.product.price,
      }));
      const { error: itemsError } = await (await getSupabase()).from("merch_order_items").insert(items);
      if (itemsError) throw itemsError;
      setCart([]);
      toast.success("Pedido reservado. Paga por Yape/Plin y recógelo en el evento.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos crear tu pedido");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1fr_320px]">
      <div>
        {isLoading && <p className="text-muted-foreground">Cargando productos…</p>}
        <div className="grid gap-6 sm:grid-cols-2">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={add} />
          ))}
        </div>
      </div>

      <aside className="print-block h-fit bg-card p-5 lg:sticky lg:top-24">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <ShoppingBag className="size-5" /> Tu pedido
        </h2>
        {cart.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Aún no agregas productos.</p>
        )}
        <ul className="mt-4 space-y-3">
          {cart.map((l, i) => (
            <li key={`${l.product.id}-${l.size}`} className="flex items-start justify-between gap-2 text-sm">
              <span>
                {l.quantity}× {l.product.name}
                {l.size ? ` · ${l.size}` : ""}
              </span>
              <span className="flex items-center gap-2">
                S/ {(Number(l.product.price) * l.quantity).toFixed(2)}
                <button
                  aria-label="Quitar"
                  onClick={() => setCart((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        {cart.length > 0 && (
          <>
            <p className="mt-4 flex justify-between border-t pt-3 font-display">
              <span>Total</span>
              <span>S/ {total.toFixed(2)}</span>
            </p>
            <Button className="mt-4 w-full" onClick={checkout} disabled={busy}>
              {busy ? "Reservando…" : "Reservar pedido"}
            </Button>
          </>
        )}
      </aside>
    </main>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product, size: string | null) => void;
}) {
  const [size, setSize] = useState<string | null>(product.sizes?.[0] ?? null);

  return (
    <article className="print-block overflow-hidden bg-card">
      <div className="aspect-square bg-secondary">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg normal-case">{product.name}</h3>
        {product.description && (
          <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
        )}
        <p className="mt-2 font-display text-xl text-primary">S/ {Number(product.price).toFixed(2)}</p>

        {product.sizes?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`border-2 px-3 py-1 text-xs font-display ${
                  size === s ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <Button className="mt-4 w-full" variant="secondary" onClick={() => onAdd(product, size)}>
          Agregar
        </Button>
      </div>
    </article>
  );
}
