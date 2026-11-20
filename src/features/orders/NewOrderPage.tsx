import { useMemo, useRef, useState } from "react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import type { MenuProduct, OrderSource, PaymentStatus } from "../../types";
import {
  ORDER_SOURCES,
  getOrderSourceLabel,
  MENU_CATEGORIES,
} from "../../constants";
import { useMenuStore } from "../../stores/menuStore";
import { useOrderStore } from "../../stores/orderStore";
import { useNavStore } from "../../stores/navStore";
import { useAuthStore } from "../../stores/authStore";
import { useStoreStore } from "../../stores/storeStore";
import { formatCurrency, computeOrderTotals, generateUUID } from "../../utils";
import { notify } from "../../stores/notificationStore";
import { sound } from "../../utils/sound";
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

const sourceActiveStyles: Record<string, string> = {
  grab: "bg-primary border-primary text-white shadow-sm shadow-primary/30",
  gofood: "bg-danger border-danger text-white shadow-sm shadow-danger/30",
  shopeefood:
    "bg-warning border-warning text-white shadow-sm shadow-warning/30",
  manual: "bg-info border-info text-white shadow-sm shadow-info/30",
};

export default function NewOrderPage() {
  const products = useMenuStore((s) => s.products);
  const orders = useOrderStore((s) => s.orders);
  const addOrder = useOrderStore((s) => s.addOrder);
  const closeNewOrder = useNavStore((s) => s.closeNewOrder);
  const openOrderDetail = useNavStore((s) => s.openOrderDetail);
  const user = useAuthStore((s) => s.user);
  const store = useStoreStore((s) => s.store);

  const [selectedCategory, setSelectedCategory] = useState<string>("Lontong");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const clientRequestIdRef = useRef<string>(generateUUID());

  const ORDER_MENU_CATEGORIES = MENU_CATEGORIES.filter((c) => c !== "Semua");

  // Menghitung makanan yang sedang diproses di dapur dan belum selesai (status === 'diproses')
  const inProgressFoodMap = useMemo(() => {
    const map: Record<string, { orderCount: number; totalQty: number }> = {};
    for (const order of orders) {
      if (order.status?.toLowerCase?.() === "diproses") {
        for (const item of order.items || []) {
          const keys = [
            item.menuId,
            item.menuName ? item.menuName.toLowerCase().trim() : "",
          ].filter(Boolean);

          for (const key of keys) {
            if (!map[key]) {
              map[key] = { orderCount: 0, totalQty: 0 };
            }
            map[key].orderCount += 1;
            map[key].totalQty += item.quantity;
          }
        }
      }
    }
    return map;
  }, [orders]);

  const totalInProgressOrders = useMemo(() => {
    return orders.filter((o) => o.status?.toLowerCase?.() === "diproses").length;
  }, [orders]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active),
    [products],
  );

  const displayedProducts = useMemo(() => {
    return activeProducts.filter((p) => p.category === selectedCategory);
  }, [activeProducts, selectedCategory]);

  const form = useForm<NewOrderValues>({
    mode: "uncontrolled",
    initialValues: {
      source: "manual",
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
    if (!product.active || !product.available) {
      notify.warning(
        `Menu "${product.name}" sedang habis dan tidak dapat dipesan.`,
        "Menu Habis",
      );
      return;
    }
    sound.tap();
    const idx = form.values.items.findIndex((i) => i.menuId === product.id);
    if (idx >= 0) {
      const next = [...form.values.items];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      form.setFieldValue("items", next);
      notify.info(
        `Jumlah "${product.name}" ditambah menjadi ${next[idx].quantity}.`,
        "Item Ditambahkan",
      );
    } else {
      form.insertListItem("items", {
        menuId: product.id,
        quantity: 1,
        addonIds: [],
        note: "",
      });
      notify.success(
        `"${product.name}" dimasukkan ke daftar pesanan.`,
        "Menu Dipilih",
      );
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const item = form.values.items[index];
    if (!item) return;
    const nextQty = Math.max(1, item.quantity + delta);
    form.setFieldValue(`items.${index}.quantity`, nextQty);
  };

  const totals = useMemo(() => {
    const mapped = form.values.items.map((item) => {
      const product = findProduct(products, item.menuId);
      return {
        quantity: item.quantity,
        unitPrice: product?.price ?? 0,
        addons: [],
      };
    });
    return computeOrderTotals(mapped);
  }, [form.values.items, products]);

  const handleCancel = () => {
    form.reset();
    clientRequestIdRef.current = generateUUID();
    closeNewOrder();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (form.values.items.length === 0) {
      form.setFieldError("items", "Tambahkan minimal 1 item");
      notify.warning(
        "Pilih setidaknya 1 item menu sebelum menyimpan pesanan.",
        "Keranjang Kosong",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const items = form.values.items
        .map((item) => {
          const product = findProduct(products, item.menuId);
          if (!product) return null;
          return {
            menuId: product.id,
            menuName: product.name,
            variant: undefined,
            quantity: item.quantity,
            unitPrice: product.price,
            addons: [],
            note: item.note.trim() || undefined,
          };
        })
        .filter((i): i is NonNullable<typeof i> => Boolean(i));

      const res = await addOrder({
        storeId: store.id,
        clientRequestId: clientRequestIdRef.current,
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

      if (res.error) {
        notify.danger(res.error, "Gagal Menyimpan Pesanan");
        // Catatan: clientRequestIdRef.current sengaja tidak diubah agar retry memakai kunci yang sama
        return;
      }

      // Server mengonfirmasi sukses: ganti dengan UUID baru untuk draf berikutnya
      clientRequestIdRef.current = generateUUID();

      sound.order();

      notify.success(
        `Pesanan #${res.order.orderNumber} berhasil dicatat dan disimpan!`,
        "Pesanan Berhasil Disimpan",
      );

      openOrderDetail(res.order.id);
    } catch (err) {
      notify.danger(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan pesanan.",
        "Gagal Menyimpan Pesanan",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasErrors = Object.keys(form.errors).length > 0;

  return (
    <div className="w-full pb-[calc(140px+env(safe-area-inset-bottom))]">
      <div className="sticky top-[3rem] z-30 bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          type="button"
          onClick={handleCancel}
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
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 rounded-lg px-4 py-2.5 text-sm">
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
              const activeStyle =
                sourceActiveStyles[source.value] ??
                "bg-primary border-primary text-white";
              return (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => form.setFieldValue("source", source.value)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-150 cursor-pointer min-w-0 active:scale-95 ${
                    active
                      ? activeStyle
                      : "bg-white dark:bg-gray-750 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400"
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

          <div className="grid grid-cols-1 gap-3 mt-3">
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
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-primary transition-colors"
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
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Waktu Pesanan
              </label>
              <input
                type="datetime-local"
                {...form.getInputProps("orderDate")}
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary transition-colors"
              />
              {form.errors.orderDate && (
                <span className="text-xs text-danger dark:text-danger-400">
                  {form.errors.orderDate}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["dibayar", "belum_dibayar"] as const).map((status) => {
                  const active = form.values.paymentStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        form.setFieldValue("paymentStatus", status)
                      }
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 cursor-pointer active:scale-95 ${
                        active
                          ? status === "dibayar"
                            ? "bg-primary border-primary text-white shadow-xs shadow-primary/30"
                            : "bg-warning border-warning text-white shadow-xs shadow-warning/30"
                          : "bg-white dark:bg-gray-700/60 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {status === "dibayar" ? "Dibayar" : "Belum Dibayar"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Quick add menu */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          {totalInProgressOrders > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-info-50 dark:bg-info-950/40 border border-info-200 dark:border-info-800/60 text-info-800 dark:text-info-300 text-xs mb-3">
              <span className="w-2 h-2 rounded-full bg-info-500 animate-pulse mt-1 shrink-0" />
              <div className="leading-snug">
                <span className="font-semibold">Perhatian Antrean:</span> Ada{" "}
                <span className="font-bold">
                  {totalInProgressOrders} pesanan
                </span>{" "}
                sedang diproses di dapur. Menu yang diberi highlight biru
                memiliki pesanan aktif yang harus segera diselesaikan!
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm dark:text-gray-100">
              Pilih Item Menu
            </p>
            <span className="text-[11px] text-gray-400">
              {displayedProducts.length} item
            </span>
          </div>

          <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-2 hide-scrollbar">
            {ORDER_MENU_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  selectedCategory === cat
                    ? "bg-primary border-primary text-white"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-0.5">
            {displayedProducts.map((product) => {
              const isSoldOut = !product.available;
              const inProgressInfo =
                inProgressFoodMap[product.id] ||
                inProgressFoodMap[product.name.toLowerCase().trim()];
              const isProcessing = Boolean(
                inProgressInfo && inProgressInfo.totalQty > 0,
              );
              const currentQty =
                form.values.items.find((i) => i.menuId === product.id)
                  ?.quantity ?? 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleQuickAdd(product)}
                  disabled={isSoldOut}
                  className={`flex flex-col justify-between p-2.5 rounded-xl border transition-all duration-150 text-left ${
                    isSoldOut
                      ? "border-warning-300 dark:border-warning-700/60 bg-warning-50/70 dark:bg-warning-950/30 border-l-4 border-l-warning-500 cursor-not-allowed opacity-90"
                      : isProcessing
                        ? currentQty > 0
                          ? "border-info-500 dark:border-info-400 bg-info-50/90 dark:bg-info-950/40 border-l-4 border-l-info-500 ring-2 ring-primary-500 shadow-xs cursor-pointer active:scale-95"
                          : "border-info-300 dark:border-info-600 bg-info-50/70 dark:bg-info-950/30 border-l-4 border-l-info-500 hover:border-info-400 hover:shadow-xs cursor-pointer active:scale-95"
                        : currentQty > 0
                          ? "border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 shadow-xs border-l-4 cursor-pointer active:scale-95"
                          : "border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-700/60 hover:border-primary-400 hover:shadow-xs cursor-pointer active:scale-95"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 w-full">
                    <span
                      className={`text-xs font-semibold line-clamp-2 leading-snug ${
                        isSoldOut
                          ? "text-gray-700 dark:text-gray-300"
                          : isProcessing
                            ? "text-info-900 dark:text-info-200 font-bold"
                            : "dark:text-gray-100"
                      }`}
                    >
                      {product.name}
                    </span>
                    {isSoldOut ? (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-warning-100 dark:bg-warning-900/60 text-warning-800 dark:text-warning-300 text-[10px] font-bold border border-warning-200 dark:border-warning-800">
                        Habis
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-info-100 dark:bg-info-900/60 text-info-700 dark:text-info-300 text-[10px] font-bold border border-info-200 dark:border-info-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-info-500 animate-pulse" />
                            {inProgressInfo.totalQty} diproses
                          </span>
                        )}
                        {currentQty > 0 && (
                          <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                            {currentQty}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {isProcessing && !isSoldOut && (
                    <div className="mt-1">
                      <span className="text-[10px] font-semibold text-info-700 dark:text-info-300">
                        ⚡ Segera selesaikan pesanan
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between w-full mt-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50">
                    <span
                      className={`text-xs font-bold ${
                        isSoldOut
                          ? "text-gray-400 dark:text-gray-500"
                          : isProcessing
                            ? "text-info-800 dark:text-info-300"
                            : "text-primary-700 dark:text-primary-400"
                      }`}
                    >
                      {formatCurrency(product.price)}
                    </span>
                    {isSoldOut ? (
                      <span className="text-[10px] font-bold text-warning-700 dark:text-warning-400">
                        Habis
                      </span>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          isProcessing
                            ? "bg-info-100 dark:bg-info-900/50"
                            : "bg-primary-100 dark:bg-primary-900/50"
                        }`}
                      >
                        <PlusIcon
                          size={13}
                          color={isProcessing ? "#2563eb" : "#059669"}
                          className="shrink-0"
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {form.errors.items && (
            <span className="text-xs text-danger dark:text-danger-400 mt-2 block">
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
              const subtotal = item.quantity * product.price;
              const itemInProgress =
                inProgressFoodMap[item.menuId] ||
                inProgressFoodMap[product.name.toLowerCase().trim()];

              return (
                <div
                  key={item.menuId}
                  className={`rounded-xl border bg-white dark:bg-gray-800 p-3.5 ${
                    itemInProgress && itemInProgress.totalQty > 0
                      ? "border-info-200 dark:border-info-800 border-l-4 border-l-info-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm dark:text-gray-100 truncate">
                          {product.name}
                        </span>
                        {itemInProgress && itemInProgress.totalQty > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-info-50 dark:bg-info-950/60 text-info-700 dark:text-info-300 text-[10px] font-semibold border border-info-200 dark:border-info-800 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-info-500 animate-pulse" />
                            {itemInProgress.totalQty} diproses (segera selesaikan)
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(product.price)} / item
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(index, -1)}
                        className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer border-0 active:scale-90 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                      >
                        <MinusIcon size={16} color="#4b5563" />
                      </button>
                      <span className="w-10 text-center font-bold text-base dark:text-gray-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(index, 1)}
                        className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center cursor-pointer border-0 active:scale-90 hover:bg-primary-700 transition-all text-white shadow-xs"
                      >
                        <PlusIcon size={16} color="white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const itemName = product.name;
                          form.removeListItem("items", index);
                          notify.info(
                            `"${itemName}" dihapus dari pesanan.`,
                            "Item Dihapus",
                          );
                        }}
                        className="w-9 h-9 rounded-lg bg-danger-50 dark:bg-danger-900/20 hover:bg-danger-100 dark:hover:bg-danger-900/40 flex items-center justify-center cursor-pointer border-0 ml-1 active:scale-90 transition-all"
                      >
                        <TrashIcon size={16} color="#dc2626" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Catatan item (opsional)"
                      {...form.getInputProps(`items.${index}.note`)}
                      className="flex-1 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-primary transition-colors"
                    />
                    <span className="font-bold text-sm text-primary-700 dark:text-primary-400 whitespace-nowrap">
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
            className="mt-1.5 w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-primary transition-colors resize-none"
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
            <span className="font-bold text-lg text-primary dark:text-primary-400 leading-tight">
              {formatCurrency(totals.total)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-teal-600 text-white font-bold text-base transition-all border-0 shadow-md shadow-primary/25 ${
              isSubmitting
                ? "opacity-60 cursor-not-allowed"
                : "cursor-pointer hover:brightness-105 active:scale-98"
            }`}
          >
            <ShoppingCartIcon size={18} />
            {isSubmitting ? "Menyimpan..." : "Simpan Pesanan"}
          </button>
        </div>
      </div>
    </div>
  );
}
