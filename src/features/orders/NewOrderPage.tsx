import { useMemo, useState } from "react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import type { MenuProduct, OrderSource, PaymentStatus } from "../../types";
import { ORDER_SOURCES, getOrderSourceLabel, MENU_CATEGORIES } from "../../constants";
import { useMenuStore } from "../../stores/menuStore";
import { useOrderStore } from "../../stores/orderStore";
import { useNavStore } from "../../stores/navStore";
import { useAuthStore } from "../../stores/authStore";
import { useStoreStore } from "../../stores/storeStore";
import { formatCurrency, computeOrderTotals } from "../../utils";
import {
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "../../utils/icons";
import PlatformBadge from "../../components/PlatformBadge";

interface NewOrderItem {
  menuId: string;
  quantity: number;
  addonIds: string[];
  note: string;
}

interface NewOrderValues {
  source: OrderSource;
  externalOrderNumber: string;
  customerName: string;
  orderDate: string;
  paymentStatus: PaymentStatus;
  items: NewOrderItem[];
  notes: string;
}

const itemSchema = z.object({
  menuId: z.string().min(1, "Pilih menu"),
  quantity: z.number().min(1, "Jumlah minimal 1"),
  addonIds: z.array(z.string()),
  note: z.string(),
});

const schema = z.object({
  source: z.enum(["grab", "gofood", "shopeefood", "manual"]),
  externalOrderNumber: z.string(),
  customerName: z.string(),
  orderDate: z.string().min(1, "Waktu pesanan wajib diisi"),
  paymentStatus: z.enum(["dibayar", "belum_dibayar"]),
  items: z.array(itemSchema).min(1, "Tambahkan minimal 1 item"),
  notes: z.string(),
});

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function findProduct(
  products: MenuProduct[],
  id: string,
): MenuProduct | undefined {
  return products.find((p) => p.id === id);
}

export default function NewOrderPage() {
  const products = useMenuStore((s) => s.products);
  const addons = useMenuStore((s) => s.addons);
  const addOrder = useOrderStore((s) => s.addOrder);
  const closeNewOrder = useNavStore((s) => s.closeNewOrder);
  const openOrderDetail = useNavStore((s) => s.openOrderDetail);
  const user = useAuthStore((s) => s.user);
  const store = useStoreStore((s) => s.store);

  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  const activeProducts = useMemo(
    () => products.filter((p) => p.active),
    [products],
  );

  const displayedProducts = useMemo(() => {
    if (selectedCategory === 'Semua') return activeProducts;
    return activeProducts.filter((p) => p.category === selectedCategory);
  }, [activeProducts, selectedCategory]);

  const form = useForm<NewOrderValues>({
    mode: "uncontrolled",
    initialValues: {
      source: "grab",
      externalOrderNumber: "",
      customerName: "",
      orderDate: toLocalDateTimeInput(new Date()),
      paymentStatus: "belum_dibayar",
      items: [],
      notes: "",
    },
    validate: (values) =>
      zod4Resolver(schema)(values as unknown as Record<string, unknown>),
  });

  const handleQuickAdd = (product: MenuProduct) => {
    const idx = form.values.items.findIndex((i) => i.menuId === product.id);
    if (idx >= 0) {
      const next = [...form.values.items];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      form.setFieldValue("items", next);
    } else {
      form.insertListItem("items", {
        menuId: product.id,
        quantity: 1,
        addonIds: [],
        note: "",
      });
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const item = form.values.items[index];
    if (!item) return;
    const nextQty = Math.max(1, item.quantity + delta);
    form.setFieldValue(`items.${index}.quantity`, nextQty);
  };

  const toggleAddon = (index: number, addonId: string) => {
    const item = form.values.items[index];
    if (!item) return;
    const has = item.addonIds.includes(addonId);
    const next = {
      ...item,
      addonIds: has
        ? item.addonIds.filter((a) => a !== addonId)
        : [...item.addonIds, addonId],
    };
    form.setFieldValue(`items.${index}`, next);
  };

  const totals = useMemo(() => {
    const mapped = form.values.items.map((item) => {
      const product = findProduct(products, item.menuId);
      const addonsFor = item.addonIds
        .map((id) => addons.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      return {
        quantity: item.quantity,
        unitPrice: product?.price ?? 0,
        addons: addonsFor.map((a) => ({ price: a.price, quantity: 1 })),
      };
    });
    return computeOrderTotals(mapped);
  }, [form.values.items, products, addons]);

  const handleSubmit = () => {
    if (form.values.items.length === 0) {
      form.setFieldError("items", "Tambahkan minimal 1 item");
      return;
    }

    const items = form.values.items
      .map((item) => {
        const product = findProduct(products, item.menuId);
        if (!product) return null;
        const itemAddons = item.addonIds
          .map((id) => addons.find((a) => a.id === id))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .map((a) => ({
            id: a.id,
            name: a.name,
            price: a.price,
            quantity: 1,
          }));
        return {
          menuId: product.id,
          menuName: product.name,
          variant: undefined,
          quantity: item.quantity,
          unitPrice: product.price,
          addons: itemAddons,
          note: item.note.trim() || undefined,
        };
      })
      .filter((i): i is NonNullable<typeof i> => Boolean(i));

    const order = addOrder({
      storeId: store.id,
      source: form.values.source,
      externalOrderNumber: form.values.externalOrderNumber,
      customerName: form.values.customerName,
      orderDate: new Date(form.values.orderDate).toISOString(),
      items,
      notes: form.values.notes,
      paymentStatus: form.values.paymentStatus,
      createdBy: user?.id ?? "system",
      orderNumber: "",
    });

    openOrderDetail(order.id);
  };

  const hasErrors = Object.keys(form.errors).length > 0;

  return (
    <div className="w-full pb-[calc(140px+env(safe-area-inset-bottom))]">
      <div className="sticky top-[3rem] z-30 bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          type="button"
          onClick={closeNewOrder}
          className="flex items-center gap-1 cursor-pointer bg-transparent border-0 text-gray-600 dark:text-gray-300"
        >
          <ArrowLeftIcon size={18} />
          <span className="text-sm font-medium">Batal</span>
        </button>
        <h5 className="font-bold text-base dark:text-white">Pesanan Baru</h5>
        <div className="w-16" />
      </div>

      <div className="flex flex-col gap-3.5 px-4 pt-4">
        {hasErrors && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-2.5 text-sm">
            Mohon lengkapi data pesanan sebelum menyimpan.
          </div>
        )}

        {/* Source / platform */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          <p className="font-semibold text-sm mb-2 dark:text-gray-100">
            Sumber Pesanan
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_SOURCES.map((source) => {
              const active = form.values.source === source.value;
              return (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => form.setFieldValue("source", source.value)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer min-w-0 ${
                    active
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <PlatformBadge
                    source={source.value}
                    showLabel={false}
                    iconSize={16}
                  />
                  <span className="truncate">
                    {getOrderSourceLabel(source.value)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                No. Ref Eksternal (opsional)
              </label>
              <input
                type="text"
                placeholder={
                  form.values.source === "manual"
                    ? "Contoh: MT-12345"
                    : "No. pesanan dari platform"
                }
                {...form.getInputProps("externalOrderNumber")}
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Nama Pelanggan (opsional)
              </label>
              <input
                type="text"
                placeholder="Nama pelanggan"
                {...form.getInputProps("customerName")}
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Waktu Pesanan
              </label>
              <input
                type="datetime-local"
                {...form.getInputProps("orderDate")}
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors"
              />
              {form.errors.orderDate && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {form.errors.orderDate}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["dibayar", "belum_dibayar"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => form.setFieldValue("paymentStatus", status)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                      form.values.paymentStatus === status
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {status === "dibayar" ? "Dibayar" : "Belum Dibayar"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Quick add menu */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm dark:text-gray-100">
              Pilih Item Menu
            </p>
            <span className="text-[11px] text-gray-400">
              {displayedProducts.length} item
            </span>
          </div>

          <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-2 hide-scrollbar">
            {MENU_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  selectedCategory === cat
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
            {displayedProducts.map((product) => {
              const currentQty = form.values.items.find(i => i.menuId === product.id)?.quantity ?? 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleQuickAdd(product)}
                  className={`flex flex-col justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-left active:scale-97 ${
                    currentQty > 0
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-700/60 hover:border-emerald-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 w-full">
                    <span className="text-xs font-semibold dark:text-gray-100 line-clamp-2 leading-snug">
                      {product.name}
                    </span>
                    {currentQty > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {currentQty}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between w-full mt-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(product.price)}
                    </span>
                    <PlusIcon size={14} color="#059669" className="shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
          {form.errors.items && (
            <span className="text-xs text-red-600 dark:text-red-400 mt-2 block">
              {form.errors.items}
            </span>
          )}
        </section>

        {/* Items list */}
        {form.values.items.length > 0 && (
          <section className="flex flex-col gap-2">
            {form.values.items.map((item, index) => {
              const product = findProduct(products, item.menuId);
              if (!product) return null;
              const productAddons = addons.filter((a) =>
                product.addonIds.includes(a.id),
              );
              const itemAddonsTotal = item.addonIds
                .map((id) => addons.find((a) => a.id === id))
                .filter((a): a is NonNullable<typeof a> => Boolean(a))
                .reduce((s, a) => s + a.price, 0);
              const subtotal = item.quantity * product.price + itemAddonsTotal;

              return (
                <div
                  key={item.menuId}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold text-sm dark:text-gray-100 truncate">
                        {product.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(product.price)} / item
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(index, -1)}
                        className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer border-0"
                      >
                        <MinusIcon size={16} color="#4b5563" />
                      </button>
                      <span className="w-10 text-center font-bold text-base dark:text-gray-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(index, 1)}
                        className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center cursor-pointer border-0"
                      >
                        <PlusIcon size={16} color="white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => form.removeListItem("items", index)}
                        className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center cursor-pointer border-0 ml-1"
                      >
                        <TrashIcon size={16} color="#dc2626" />
                      </button>
                    </div>
                  </div>

                  {productAddons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {productAddons.map((addon) => {
                        const checked = item.addonIds.includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => toggleAddon(index, addon.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                              checked
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            +{addon.name} ({formatCurrency(addon.price)})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Catatan item (opsional)"
                      {...form.getInputProps(`items.${index}.note`)}
                      className="flex-1 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-emerald-500 transition-colors"
                    />
                    <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Catatan Pesanan (opsional)
          </label>
          <textarea
            rows={2}
            placeholder="Catatan untuk dapur / kurir"
            {...form.getInputProps("notes")}
            className="mt-1.5 w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-emerald-500 transition-colors resize-none"
          />
        </section>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <div className="flex flex-col gap-0 min-w-0">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Total ({form.values.items.reduce((s, i) => s + i.quantity, 0)}{" "}
              item)
            </span>
            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400 leading-tight">
              {formatCurrency(totals.total)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-base cursor-pointer hover:opacity-90 active:scale-98 transition-all border-0 shadow-md"
          >
            <ShoppingCartIcon size={18} />
            Simpan Pesanan
          </button>
        </div>
      </div>
    </div>
  );
}
