import type {
  AuditLog,
  MenuAddon,
  MenuProduct,
  Order,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  Store,
  User,
} from '../types';
import { todayKey, addDays, toDayKey, generateId } from '../utils';

// ---------------------------------------------------------------------------
// Store & users
// ---------------------------------------------------------------------------

export const mockStore: Store = {
  id: 'store-1',
  name: 'Lonpad Jauh',
  currency: 'IDR',
  address: 'Jl. Mengger Hilir No.183, Sukapura, Kec. Dayeuhkolot, Kabupaten Bandung, Jawa Barat 40267',
  phone: '082316321504',
  timezone: 'Asia/Jakarta',
};

export const mockUser: User = {
  id: 'user-owner',
  storeId: mockStore.id,
  username: 'admin',
  fullName: 'Mang Lontong',
  email: 'email-pemilik@contoh.com',
  role: 'owner',
};

export const mockStaffUser: User = {
  id: 'user-staff',
  storeId: mockStore.id,
  username: 'staff',
  fullName: 'Siti Rahayu',
  email: 'email-staff@contoh.com',
  role: 'staff',
};

// ---------------------------------------------------------------------------
// Menu master data
// ---------------------------------------------------------------------------

export const mockAddons: MenuAddon[] = [
  { id: 'addon-telur', name: 'Telur Bulat Balado', price: 5000, active: true },
  { id: 'addon-perkedel', name: 'Perkedel Kentang', price: 5000, active: true },
  { id: 'addon-kerupuk', name: 'Kerupuk', price: 2000, active: true },
  { id: 'addon-gorengan', name: 'Gorengan', price: 1000, active: true },
];

const MAIN_ADDONS = ['addon-telur', 'addon-perkedel', 'addon-kerupuk', 'addon-gorengan'];

const MENU_SEED: Array<{
  name: string;
  category: string;
  price: number;
  addonIds: string[];
  active?: boolean;
}> = [
  // Lontong (Semua Rp 10.000)
  { name: 'Lontong Sayur Gulai Cubadak', category: 'Lontong', price: 10000, addonIds: MAIN_ADDONS },
  { name: 'Lontong Sayur Gulai Tauco', category: 'Lontong', price: 10000, addonIds: MAIN_ADDONS },
  { name: 'Lontong Sayur Gulai Paku', category: 'Lontong', price: 10000, addonIds: MAIN_ADDONS },
  { name: 'Lontong Pical (Pecel)', category: 'Lontong', price: 10000, addonIds: MAIN_ADDONS },

  // Tambahan
  { name: 'Telur Bulat Balado', category: 'Tambahan', price: 5000, addonIds: [] },
  { name: 'Perkedel Kentang', category: 'Tambahan', price: 5000, addonIds: [] },
  { name: 'Kerupuk', category: 'Tambahan', price: 2000, addonIds: [] },
  { name: 'Gorengan', category: 'Tambahan', price: 1000, addonIds: [] },

  // Minuman Sachetan (Semua Rp 5.000)
  { name: 'Kopi Hitam Sachet', category: 'Minuman', price: 5000, addonIds: [] },
  { name: 'Kopi Susu Sachet', category: 'Minuman', price: 5000, addonIds: [] },
  { name: 'Teh Tarik Sachet', category: 'Minuman', price: 5000, addonIds: [] },
  { name: 'Nutrisari Sachet', category: 'Minuman', price: 5000, addonIds: [] },
  { name: 'Milo Sachet', category: 'Minuman', price: 5000, addonIds: [] },
  { name: 'Susu Jahe Sachet', category: 'Minuman', price: 5000, addonIds: [] },
  { name: 'Es Teh Manis', category: 'Minuman', price: 5000, addonIds: [] },
];

export const mockMenu: MenuProduct[] = MENU_SEED.map((m, i) => ({
  id: `menu-${i + 1}`,
  storeId: mockStore.id,
  name: m.name,
  category: m.category,
  price: m.price,
  addonIds: m.addonIds,
  available: true,
  active: m.active !== false,
}));

// ---------------------------------------------------------------------------
// Order generation helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dateAt(dayKey: string, hour: number, minute: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

function minutesAgo(dayKey: string, mins: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 9, 0, 0);
  dt.setMinutes(dt.getMinutes() - mins);
  return dt.toISOString();
}

const SOURCES: Array<{ value: OrderSource; weight: number; ext: (r: () => number) => string }> = [
  { value: 'grab', weight: 0.3, ext: () => `GR-${Math.random().toString(36).slice(2, 7).toUpperCase()}` },
  { value: 'gofood', weight: 0.3, ext: () => `GO-${Math.random().toString(36).slice(2, 7).toUpperCase()}` },
  { value: 'shopeefood', weight: 0.25, ext: () => `SF-${Math.random().toString(36).slice(2, 7).toUpperCase()}` },
  { value: 'manual', weight: 0.15, ext: () => `MAN-${Math.random().toString(36).slice(2, 7).toUpperCase()}` },
];

const CUSTOMERS = [
  'Andi Pratama',
  'Siti Rahayu',
  'Dewi Lestari',
  'Rizky Firmansyah',
  'Maya Putri',
  'Fajar Nugroho',
  'Rina Wulandari',
  'Hendra Kusuma',
  'Intan Permata',
  'Bagus Prakoso',
  'Lina Marlina',
  'Yoga Pratomo',
  'Nadia Safitri',
  'Agus Wijaya',
];

function pickSource(r: () => number): { value: OrderSource; ext: string } {
  const roll = r();
  let acc = 0;
  for (const s of SOURCES) {
    acc += s.weight;
    if (roll <= acc) return { value: s.value, ext: s.ext(r) };
  }
  const last = SOURCES[SOURCES.length - 1];
  return { value: last.value, ext: last.ext(r) };
}

interface OrderSeed {
  dayKey: string;
  seq: number;
  rng: () => number;
}

function buildOrder(seed: OrderSeed): Order {
  const r = seed.rng;
  const mains = mockMenu.filter((m) => m.category === 'Lontong' && m.active);
  const sides = mockMenu.filter((m) => m.category !== 'Lontong' && m.active);

  const main = mains[Math.floor(r() * mains.length)];
  const mainQty = 1 + Math.floor(r() * 3);

  const items = [];
  let addonsTotal = 0;

  const addonPick = () => {
    const addons = [];
    if (r() < 0.5) {
      const a = mockAddons[Math.floor(r() * mockAddons.length)];
      addons.push({ id: a.id, name: a.name, price: a.price, quantity: 1 });
      addonsTotal += a.price;
    }
    return addons;
  };

  items.push({
    id: generateId(),
    menuId: main.id,
    menuName: main.name,
    quantity: mainQty,
    unitPrice: main.price,
    addons: addonPick(),
    subtotal: mainQty * main.price,
  });

  if (r() < 0.6 && sides.length > 0) {
    const side = sides[Math.floor(r() * sides.length)];
    const sideQty = 1;
    items.push({
      id: generateId(),
      menuId: side.id,
      menuName: side.name,
      quantity: sideQty,
      unitPrice: side.price,
      addons: [],
      subtotal: sideQty * side.price,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal + addonsTotal;

  const source = pickSource(r);
  const statusRoll = r();
  const isRecent = seed.dayKey === todayKey();
  let status: OrderStatus;
  if (statusRoll < 0.08) status = 'dibatalkan';
  else if (!isRecent && statusRoll < 0.82) status = 'selesai';
  else if (statusRoll < 0.88) status = 'baru';
  else if (statusRoll < 0.95) status = 'diproses';
  else status = 'selesai';

  if (isRecent && status === 'selesai' && statusRoll > 0.9) status = 'diproses';

  const payment: PaymentStatus = r() < 0.85 ? 'dibayar' : 'belum_dibayar';

  const hour = 10 + Math.floor(r() * 10);
  const minute = Math.floor(r() * 60);
  const orderDate = dateAt(seed.dayKey, hour, minute);

  const createdAt = orderDate;
  const completedAt = status === 'selesai' ? dateAt(seed.dayKey, hour, minute + 15 + Math.floor(r() * 30)) : undefined;

  const orderNumber = `LP-${seed.dayKey.replaceAll('-', '')}-${String(seed.seq).padStart(4, '0')}`;

  return {
    id: `mock-${seed.dayKey}-${seed.seq}`,
    storeId: mockStore.id,
    orderNumber,
    externalOrderNumber: source.value === 'manual' ? undefined : source.ext,
    source: source.value,
    customerName: r() < 0.9 ? CUSTOMERS[Math.floor(r() * CUSTOMERS.length)] : undefined,
    orderDate,
    items,
    notes: r() < 0.2 ? 'Kuah gulai dipisah, kerupuk banyakin.' : undefined,
    subtotal,
    addonsTotal,
    total,
    status,
    paymentStatus: status === 'dibatalkan' ? 'belum_dibayar' : payment,
    createdAt,
    completedAt,
    createdBy: 'user-owner',
    dayKey: seed.dayKey,
  };
}

function buildAuditLogs(order: Order, userName: string): AuditLog[] {
  const logs: AuditLog[] = [
    {
      id: generateId(),
      storeId: order.storeId,
      orderId: order.id,
      actionType: 'ORDER_CREATED',
      userId: order.createdBy,
      userName,
      timestamp: order.createdAt,
    },
  ];
  if (order.status === 'selesai' && order.completedAt) {
    logs.push({
      id: generateId(),
      storeId: order.storeId,
      orderId: order.id,
      actionType: 'ORDER_COMPLETED',
      userId: order.createdBy,
      userName,
      timestamp: order.completedAt,
    });
  }
  if (order.status === 'dibatalkan') {
    logs.push({
      id: generateId(),
      storeId: order.storeId,
      orderId: order.id,
      actionType: 'ORDER_CANCELLED',
      userId: order.createdBy,
      userName,
      timestamp: order.createdAt,
      reason: 'Pesanan dibatalkan pelanggan',
    });
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Orders: explicit "today" + seeded history
// ---------------------------------------------------------------------------

function buildTodayOrders(): Order[] {
  const dayKey = todayKey();
  const offsets = [12, 8, 4, 25, 40, 1, 17, 55, 22, 9, 33, 15];
  const recipes: Array<{
    source: OrderSource;
    status: OrderStatus;
    payment: PaymentStatus;
    menu: number; // index into explicit list below
    qty: number;
    addon?: number;
    customer?: string;
    external?: string;
    note?: string;
  }> = [
    { source: 'grab', status: 'selesai', payment: 'dibayar', menu: 0, qty: 2, addon: 0, customer: 'Andi Pratama', external: 'GR-A1B2C3', note: 'Kuah dipisah' },
    { source: 'gofood', status: 'selesai', payment: 'dibayar', menu: 2, qty: 1, addon: 1, customer: 'Siti Rahayu', external: 'GO-X9Y8Z7' },
    { source: 'shopeefood', status: 'diproses', payment: 'dibayar', menu: 3, qty: 1, customer: 'Dewi Lestari', external: 'SF-K1M2N3', note: 'Banyakin bumbu pecelnya' },
    { source: 'grab', status: 'baru', payment: 'belum_dibayar', menu: 1, qty: 1, addon: 2, customer: 'Rizky Firmansyah', external: 'GR-D4E5F6', note: 'Kerupuk dibungkus terpisah' },
    { source: 'manual', status: 'selesai', payment: 'dibayar', menu: 0, qty: 1, customer: 'Rina Wulandari' },
    { source: 'gofood', status: 'selesai', payment: 'dibayar', menu: 2, qty: 1, customer: 'Fajar Nugroho', external: 'GO-P7Q8R9' },
    { source: 'grab', status: 'selesai', payment: 'dibayar', menu: 1, qty: 2, addon: 3, customer: 'Maya Putri', external: 'GR-H1J2K3' },
    { source: 'manual', status: 'dibatalkan', payment: 'belum_dibayar', menu: 3, qty: 1, customer: 'Bagus Prakoso', note: 'Pesanan dibatalkan pelanggan' },
    { source: 'shopeefood', status: 'baru', payment: 'belum_dibayar', menu: 0, qty: 1, addon: 0, customer: 'Intan Permata', external: 'SF-L4M5N6' },
    { source: 'gofood', status: 'diproses', payment: 'dibayar', menu: 1, qty: 1, customer: 'Agus Wijaya', external: 'GO-Q2W3E4' },
    { source: 'grab', status: 'selesai', payment: 'dibayar', menu: 2, qty: 2, addon: 2, customer: 'Nadia Safitri', external: 'GR-T5R6Y7' },
    { source: 'manual', status: 'selesai', payment: 'dibayar', menu: 3, qty: 1, customer: 'Lina Marlina' },
  ];

  const mains = mockMenu.filter((m) => m.category === 'Lontong' && m.active);

  return recipes.map((recipe, i) => {
    const main = mains[recipe.menu % mains.length];
    const addonsTotal = recipe.addon === undefined ? 0 : mockAddons[recipe.addon].price;
    const subtotal = recipe.qty * main.price;
    const item = {
      id: generateId(),
      menuId: main.id,
      menuName: main.name,
      quantity: recipe.qty,
      unitPrice: main.price,
      addons:
        recipe.addon === undefined
          ? []
          : [{ id: mockAddons[recipe.addon].id, name: mockAddons[recipe.addon].name, price: mockAddons[recipe.addon].price, quantity: 1 }],
      subtotal,
    };
    const orderDate = minutesAgo(dayKey, offsets[i]);
    const completedAt = recipe.status === 'selesai' ? minutesAgo(dayKey, offsets[i] - 18) : undefined;
    return {
      id: `today-${i + 1}`,
      storeId: mockStore.id,
      orderNumber: `LP-${dayKey.replaceAll('-', '')}-${String(i + 1).padStart(4, '0')}`,
      externalOrderNumber: recipe.external,
      source: recipe.source,
      customerName: recipe.customer,
      orderDate,
      items: [item],
      notes: recipe.note,
      subtotal,
      addonsTotal,
      total: subtotal + addonsTotal,
      status: recipe.status,
      paymentStatus: recipe.status === 'dibatalkan' ? 'belum_dibayar' : recipe.payment,
      createdAt: orderDate,
      completedAt,
      createdBy: 'user-owner',
      dayKey,
    };
  });
}

export function buildMockOrders(): Order[] {
  const orders: Order[] = [...buildTodayOrders()];

  for (let daysBack = 1; daysBack <= 34; daysBack += 1) {
    const dayKey = toDayKey(addDays(new Date(), -daysBack));
    const rng = mulberry32(hashSeed(`ricebox-${dayKey}`));
    const count = 5 + Math.floor(rng() * 6);
    for (let seq = 1; seq <= count; seq += 1) {
      orders.push(buildOrder({ dayKey, seq, rng }));
    }
  }

  return orders.sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
  );
}

export function buildMockAuditLogs(orders: Order[]): AuditLog[] {
  const logs: AuditLog[] = [];
  for (const order of orders) {
    const userName = order.createdBy === 'user-staff' ? 'Siti Rahayu' : 'Mang Lontong';
    logs.push(...buildAuditLogs(order, userName));
  }
  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export const mockOrders = buildMockOrders();
export const mockAuditLogs = buildMockAuditLogs(mockOrders);
