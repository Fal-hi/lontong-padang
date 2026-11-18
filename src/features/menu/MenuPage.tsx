import { useState } from 'react';
import { Modal } from '@mantine/core';
import {
  PageContainer,
  SectionTitle,
  SearchBar,
  Toggle,
  FilterChip,
} from '../../components';
import { useMenuStore } from '../../stores/menuStore';
import { useStoreStore } from '../../stores/storeStore';
import { MENU_CATEGORIES } from '../../constants';
import type { MenuProduct } from '../../types';
import { formatCurrency } from '../../utils';
import { notify } from '../../stores/notificationStore';
import { PlusIcon } from '../../utils/icons';

export default function MenuPage() {
  const products = useMenuStore((s) => s.products);
  const addons = useMenuStore((s) => s.addons);
  const toggleAvailable = useMenuStore((s) => s.toggleAvailable);
  const toggleActive = useMenuStore((s) => s.toggleActive);
  const addProduct = useMenuStore((s) => s.addProduct);
  const store = useStoreStore((s) => s.store);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('Lontong');
  const [addPrice, setAddPrice] = useState('');
  const [addAddonIds, setAddAddonIds] = useState<string[]>([]);
  const [addError, setAddError] = useState('');

  const filtered = products.filter((p) => {
    const matchesSearch =
      search === '' || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === 'Semua' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAdd = () => {
    const price = Number(addPrice.replace(/[^0-9]/g, ''));
    if (!addName.trim()) {
      setAddError('Nama menu wajib diisi');
      notify.warning('Nama menu wajib diisi', 'Data Tidak Lengkap');
      return;
    }
    if (!price || price <= 0) {
      setAddError('Harga harus lebih dari 0');
      notify.warning('Harga harus lebih dari 0', 'Data Tidak Lengkap');
      return;
    }
    addProduct({
      storeId: store.id,
      name: addName.trim(),
      category: addCategory,
      price,
      addonIds: addAddonIds,
    });
    notify.success(`Menu "${addName.trim()}" berhasil ditambahkan ke daftar!`, 'Menu Baru');
    setAddOpen(false);
    setAddName('');
    setAddPrice('');
    setAddAddonIds([]);
    setAddError('');
  };

  const addonNames = (record: MenuProduct) =>
    record.addonIds
      .map((id) => addons.find((a) => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');

  return (
    <PageContainer>
      <section className="flex flex-col gap-3">
        <SectionTitle title="Daftar Menu" />

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari lontong, minuman, dll..."
        />

        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1 hide-scrollbar">
          {MENU_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              active={activeCategory === category}
              label={category}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {filtered.length} item menu
        </span>

        <div className="flex flex-col gap-2.5">
          {filtered.map((record) => {
            const borderStyle = !record.active
              ? "border-l-4 border-l-gray-400 opacity-60 bg-gray-50/50 dark:bg-gray-800/50"
              : !record.available
                ? "border-l-4 border-l-danger-500 bg-danger-50/20 dark:bg-danger-950/20"
                : "border-l-4 border-l-primary-500 hover:shadow-md hover:border-primary-300 transition-all duration-200";

            return (
              <div
                key={record.id}
                className={`p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-3 shadow-xs ${borderStyle}`}
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm dark:text-gray-100">
                      {record.name}
                    </span>
                    {!record.active && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                        Nonaktif
                      </span>
                    )}
                    {!record.available && record.active && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400">
                        Habis
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-700 dark:text-primary-400">
                      {formatCurrency(record.price)}
                    </span>
                    <span className="text-[11px] text-gray-400">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {record.category}
                    </span>
                  </div>
                  {record.addonIds.length > 0 && (
                    <span className="text-[11px] text-gray-400 truncate">
                      Tambahan: {addonNames(record)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-center gap-1 p-1.5 rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-700">
                    <Toggle
                      checked={record.available}
                      disabled={!record.active}
                      onChange={() => {
                        const nextState = !record.available;
                        toggleAvailable(record.id);
                        notify.info(
                          `"${record.name}" ditandai ${nextState ? "Tersedia" : "Habis"}.`,
                          "Ketersediaan Menu",
                        );
                      }}
                      label="Tersedia"
                    />
                    <span
                      className={`text-[9px] font-semibold leading-none ${
                        record.available && record.active
                          ? "text-primary dark:text-primary-400"
                          : "text-gray-400"
                      }`}
                    >
                      {record.available ? "Tersedia" : "Habis"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-1.5 rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-700">
                    <Toggle
                      checked={record.active}
                      onChange={() => {
                        const nextState = !record.active;
                        toggleActive(record.id);
                        notify.info(
                          `"${record.name}" ${nextState ? "diaktifkan" : "dinonaktifkan"}.`,
                          "Status Menu",
                        );
                      }}
                      label="Aktif"
                    />
                    <span
                      className={`text-[9px] font-semibold leading-none ${
                        record.active
                          ? "text-primary dark:text-primary-400"
                          : "text-gray-400"
                      }`}
                    >
                      {record.active ? "Aktif" : "Off"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">🍲</span>
              <span className="font-medium text-sm text-gray-500 dark:text-gray-400">
                Tidak ada item menu ditemukan
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Coba ubah kata kunci pencarian atau tambah menu baru
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 max-w-md mx-auto pointer-events-none z-40 px-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setAddError('');
            setAddOpen(true);
          }}
          className="pointer-events-auto w-12 h-12 rounded-full bg-gradient-to-r from-primary to-teal-600 shadow-lg shadow-primary/30 flex items-center justify-center cursor-pointer border-0 active:scale-90 hover:brightness-105 transition-all text-white"
          aria-label="Tambah menu"
        >
          <PlusIcon size={22} color="white" />
        </button>
      </div>

      <Modal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        title="Tambah Menu"
        centered
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Nama Menu
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Contoh: Lontong Sayur Gulai Cubadak"
              className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Kategori
            </label>
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none"
            >
              {MENU_CATEGORIES.filter((c) => c !== 'Semua').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Harga (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              placeholder="10000"
              className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Tambahan tersedia
            </label>
            <div className="flex flex-wrap gap-2">
              {addons.map((addon) => {
                const checked = addAddonIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() =>
                      setAddAddonIds((prev) =>
                        checked
                          ? prev.filter((id) => id !== addon.id)
                          : [...prev, addon.id],
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      checked
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {addon.name} ({formatCurrency(addon.price)})
                  </button>
                );
              })}
            </div>
          </div>
          {addError && (
            <span className="text-xs text-danger dark:text-danger-400">
              {addError}
            </span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity border-0 mt-1 active:scale-98"
          >
            Simpan Menu
          </button>
        </div>
      </Modal>
    </PageContainer>
  );
}
