# Warung Lontong Padang ("Lonpad Jauh") — Order & Bookkeeping App

Aplikasi manajemen pemesanan dan pembukuan kasir harian untuk warung lontong padang, dibangun dengan **React 19**, **TypeScript**, **Mantine UI / Tailwind CSS**, dan terintegrasi dengan **Supabase** (PostgreSQL + Auth + Row Level Security).

---

## 🚀 Panduan Setup Supabase & Menjalankan Aplikasi

> [!NOTE] Catatan Penggunaan Alamat Email
> Gunakan alamat email yang benar-benar Anda kuasai (misalnya email Google Workspace atau Gmail pribadi). **Jangan menulis atau memakai domain milik orang lain.** Seluruh contoh akun di panduan ini menggunakan placeholder `email-pemilik@contoh.com` dan `email-staff@contoh.com`.

### 1. Membuat Project Supabase
1. Masuk ke [Supabase Dashboard](https://supabase.com/dashboard).
2. Klik **New Project**, pilih nama organisasi, masukkan nama project (misal: `lonpad-jauh`), dan tentukan database password yang aman.
3. **Region:** Pilih **Southeast Asia (Singapore)** untuk latensi terendah.
4. Pada opsi konfigurasi tabel dan keamanan basis data:
   - **Centang "Enable RLS on new tables automatically":** Memastikan setiap tabel baru otomatis mengaktifkan perlindungan Row Level Security.
   - **Biarkan "Grant API access to new tables automatically" tercentang:** Migrasi belum memuat `GRANT` eksplisit per tabel; jika opsi ini dimatikan, semua query tabel akan gagal dengan error *"permission denied"*.
5. Tunggu project selesai dibuat (~1-2 menit).

---

### 2. Matikan Pendaftaran Publik (Wajib untuk Keamanan Warung)
Aplikasi kasir ini bersifat operasional internal. Orang luar tidak boleh mendaftarkan akun sendiri secara bebas:
1. Di Supabase Dashboard, buka menu **Authentication** $\rightarrow$ **Sign In / Up**.
2. Di bagian **User Signups**, **NONAKTIFKAN (OFF)** toggle:
   - **"Allow new users to sign up"**
3. Klik **Save**.
> Dengan mematikan opsi ini, endpoint `supabase.auth.signUp()` akan otomatis menolak setiap pendaftaran publik baru. Semua pengguna harus dibuat secara terkontrol oleh pemilik warung melalui dashboard.

---

### 3. Menjalankan Migrasi Basis Data (SQL Editor)
Buka Supabase Dashboard $\rightarrow$ menu **SQL Editor** di sisi kiri.
Jalankan file migrasi secara berurutan, **SATU FILE PER RUN** (migrasi 03 dan 05 berisi `ALTER TYPE ... ADD VALUE` yang harus berdiri sendiri dalam transaksinya masing-masing; migrasi 05 harus selesai sebelum migrasi 06 dijalankan):

1. **Migrasi 1 (Skema Dasar & RLS):**
   - Buka file [`supabase/migrations/20261119000001_initial_schema.sql`](supabase/migrations/20261119000001_initial_schema.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run**. Pastikan sukses tanpa error.
   - *Catatan:* Jika migrasi 01 gagal di policy `storage.objects` dengan pesan *"must be owner"*, buat policy storage tersebut lewat menu **Dashboard > Storage > Policies**.
2. **Migrasi 2 (Fixes, Advisory Locks & Hardened Security):**
   - Buka file [`supabase/migrations/20261119000002_fixes.sql`](supabase/migrations/20261119000002_fixes.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run**.
3. **Migrasi 3 (Audit Enum Registration):**
   - Buka file [`supabase/migrations/20261119000003_audit_enum.sql`](supabase/migrations/20261119000003_audit_enum.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run** (wajib berdiri sendiri).
4. **Migrasi 4 (Hardening, No Delete Menu, Correct Order NULL Filter & Best Selling Menu):**
   - Buka file [`supabase/migrations/20261119000004_hardening.sql`](supabase/migrations/20261119000004_hardening.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run**.
5. **Migrasi 5 (Audit Enum Reopen Registration):**
   - Buka file [`supabase/migrations/20261119000005_audit_enum_reopen.sql`](supabase/migrations/20261119000005_audit_enum_reopen.sql).
   - Salin pernyataan `ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'DAY_REOPENED';` dan klik **Run** (wajib selesai sebelum migrasi 06).
6. **Migrasi 6 (Fixes 2: Advisory Locks Status/Payment, Tolak Mundur, Reopen Day, Toggle Closed Day):**
   - Buka file [`supabase/migrations/20261119000006_fixes2.sql`](supabase/migrations/20261119000006_fixes2.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run**.
7. **Migrasi 7 (Restriksi Pembatalan Pesanan Selesai Khusus Super Admin):**
   - Buka file [`supabase/migrations/20261119000007_cancel_completed_admin_only.sql`](supabase/migrations/20261119000007_cancel_completed_admin_only.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run**.
8. **Migrasi 8 (Cabut Akses anon):**
   - Buka file [`supabase/migrations/20261119000008_revoke_anon.sql`](supabase/migrations/20261119000008_revoke_anon.sql).
   - Salin seluruh isinya ke SQL Editor dan klik **Run**.

---

### 4. Query Verifikasi Setelah Migrasi 08
Setelah Migrasi 08 selesai dijalankan, jalankan ketiga query verifikasi berikut di SQL Editor untuk memastikan integritas skema dan keamanan akses:

1. **Verifikasi Seluruh Tabel Publik Mengaktifkan RLS:**
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   ```
   - **Hasil yang Diharapkan:** Kolom `rowsecurity` bernilai `true` untuk semua tabel di skema `public`.

2. **Verifikasi Pencabutan Hak Akses Role `anon`:**
   ```sql
   select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public';
   ```
   - **Hasil yang Diharapkan:** **0 baris (kosong)**.

3. **Verifikasi Pencabutan Izin DML Langsung (`authenticated`):**
   ```sql
   select table_name, privilege_type 
   from information_schema.role_table_grants 
   where grantee = 'authenticated' 
     and table_schema = 'public' 
     and table_name in ('orders','order_items','order_item_addons','order_corrections','audit_logs','daily_closings') 
     and privilege_type in ('INSERT','UPDATE','DELETE');
   ```
   - **Hasil yang Diharapkan:** **0 baris (kosong)** (seluruh penulisan wajib melalui fungsi RPC transaksional).

---

### 5. Jalankan Seed Data Master Toko (`supabase/seed.sql`)
Di **SQL Editor** Supabase, jalankan file [`supabase/seed.sql`](supabase/seed.sql).
> [!IMPORTANT]
> **Langkah ini HARUS dijalankan sebelum membuat akun user.** Trigger database `on_auth_user_created` otomatis menautkan pengguna baru ke baris toko pertama di tabel `stores`. Jika pengguna dibuat sebelum seed toko dijalankan, `store_id` pada profil akan bernilai `NULL`!

File ini **HANYA** memuat data master toko dan menu awal:
- Baris Toko `Lonpad Jauh` (ID: `a0000000-0000-0000-0000-000000000001`).
- 4 Addon menu (Telur Bulat Balado, Perkedel, Kerupuk, Gorengan).
- 15 Produk menu master (Lontong Sayur Cubadak, Tauco, Paku, Pical, dll).
- Relasi produk addon `product_addons`.

> [!CAUTION] PERINGATAN SEED SAMPLE:
> File [`supabase/seed_sample.sql`](supabase/seed_sample.sql) berisi data pesanan contoh, item dummy, dan pengeluaran dummy untuk pengujian lokal/staging. **JANGAN PERNAH dijalankan di database produksi!**

---

### 6. Buat Akun Pemilik di Supabase Auth
1. Di Supabase Dashboard, buka menu **Authentication** $\rightarrow$ **Users**.
2. Klik tombol **Add User** $\rightarrow$ **Create User**:
   - **Email:** Masukkan email pemilik yang Anda kuasai (contoh: `email-pemilik@contoh.com`).
   - **Password:** Masukkan kata sandi yang unik dan kuat (bukan `123456` dan bukan password email Anda).
   - Centang **Auto Confirm User?** $\rightarrow$ **Yes**.
   - Klik **Create User**.
3. **Ketentuan Akun:** Terapkan prinsip satu orang satu akun. Jangan menggunakan akun secara bergantian antar karyawan demi jejak audit yang akurat.
4. Trigger database `on_auth_user_created` secara otomatis membuat profil di tabel `public.profiles` dengan `store_id` toko yang sudah tersedia dari Langkah 5.

---

### 7. Bootstrap Akun Menjadi Super Admin
Buka kembali menu **SQL Editor** dan jalankan query berikut:
```sql
UPDATE public.profiles 
SET role = 'super_admin', full_name = 'Pemilik Warung' 
WHERE lower(email) = lower('email-pemilik@contoh.com');

SELECT email, full_name, role, store_id FROM public.profiles ORDER BY role, email;
```
- **Hasil yang Diharapkan:** Tepat satu pengguna dengan `role = 'super_admin'`, dan kolom `store_id` terisi (tidak boleh `NULL`). Jika `store_id` kosong, berarti `seed.sql` belum dijalankan sebelum user dibuat.

---

### 8. Tambah Staff Kasir di Dashboard
1. Buka kembali **Authentication** $\rightarrow$ **Users** $\rightarrow$ **Add User** $\rightarrow$ **Create User**:
   - **Email:** Masukkan email staff yang Anda kuasai (contoh: `email-staff@contoh.com`).
   - **Password:** Masukkan kata sandi staff yang kuat.
   - Centang **Auto Confirm User?** $\rightarrow$ **Yes**.
   - Klik **Create User**.
2. Di **SQL Editor**, lengkapi nama lengkap staff:
```sql
UPDATE public.profiles 
SET full_name = 'Nama Staff' 
WHERE lower(email) = lower('email-staff@contoh.com');
```

---

### 9. Uji Peran di SQL Editor (Sebelum Memasukkan Data Asli)
Lakukan pengujian peran berikut di **SQL Editor** Supabase **SEBELUM** memasukkan data transaksi riil toko.
Pengujian ini sepenuhnya **aman** karena setiap blok dibungkus dalam transaksi dengan `rollback;` sehingga tidak meninggalkan data sampah di database.

Dapatkan UUID masing-masing pengguna terlebih dahulu:
```sql
select id, email, role from public.profiles;
```
Salin UUID staff ke `<UUID-STAFF>` dan UUID admin ke `<UUID-ADMIN>`. Jalankan tiap blok query secara terpisah (karena transaksi akan dibatalkan otomatis setelah error terjadi):

#### A. Staff Tidak Boleh Membaca Pengeluaran (Harus 0 Baris)
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-STAFF>","role":"authenticated"}', true);
select * from public.expenses;
rollback;
```
- **Hasil yang Diharapkan:** Mengembalikan `0 rows` (kosong).

#### B. Staff Tidak Boleh Memanggil Laporan Keuangan (Harus ERROR 42501)
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-STAFF>","role":"authenticated"}', true);
select public.get_financial_summary(current_date - 7, current_date);
rollback;
```
- **Hasil yang Diharapkan:** Error `42501`: *"Akses Ditolak: Hanya super_admin yang berhak mengakses laporan keuangan lengkap."*

#### C. Staff Tidak Boleh Insert Langsung ke `orders` (Harus ERROR Permission Denied)
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-STAFF>","role":"authenticated"}', true);
insert into public.orders (store_id, order_number, total, day_key) 
values ('a0000000-0000-0000-0000-000000000001','LP-HACK',1000,current_date);
rollback;
```
- **Hasil yang Diharapkan:** Error `42501`: *"permission denied for table orders"*.

#### D. Staff Tidak Boleh Mengubah Role (Harus ERROR 42501)
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-STAFF>","role":"authenticated"}', true);
update public.profiles set role = 'super_admin' where id = '<UUID-STAFF>';
rollback;
```
- **Hasil yang Diharapkan:** Error `42501`: *"Akses Ditolak: Hanya super_admin yang berhak mengubah peran, toko, atau ID akun."*

#### E. Super Admin Boleh Memanggil Laporan Keuangan (Harus Berhasil)
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-ADMIN>","role":"authenticated"}', true);
select public.get_financial_summary(current_date - 7, current_date);
rollback;
```
- **Hasil yang Diharapkan:** Query berhasil dieksekusi dan mengembalikan JSON summary keuangan toko.

> [!WARNING]
> Seluruh skenario pengujian lain yang dilakukan melalui DevTools console browser (seperti `create_order`, pembatalan, koreksi, dll.) **akan meninggalkan data uji coba permanen di pembukuan**. Oleh karena itu, pengujian melalui console browser **HANYA boleh dijalankan pada project Supabase terpisah (sandbox / staging)**!

---

### 10. Konfigurasi Environment Variable (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` dan masukkan konfigurasi API dari Supabase Dashboard (**Project Settings** $\rightarrow$ **API**):
- **Project URL:** Masukkan URL project Anda.
- **Kunci Publik:** Masukkan kunci publik (di dashboard berlabel `"anon"` atau `"publishable key"`).
```env
# Project URL (API URL)
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Project API Anon Key (public anon / publishable key)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
> [!CAUTION] PERINGATAN KERAS KUNCI API:
> **JANGAN PERNAH** memasukkan atau memakai `service_role` atau `secret key` di kode frontend! Kunci `service_role` membypass seluruh perlindungan Row Level Security.
> Sebelum melakukan `git push`, pastikan file `.env` telah diabaikan oleh git:
> ```bash
> git check-ignore .env
> ```
> *(Hasilnya harus mencetak `.env`)*.

---

### 11. Menjalankan Frontend & Login
1. Jalankan development server:
   ```bash
   bun run dev
   ```
2. Buka `http://localhost:5173` di browser.
3. Masuk menggunakan email asli yang didaftarkan (`email-pemilik@contoh.com` atau `email-staff@contoh.com`) beserta kata sandi.
   - **Nol Akses Tabel Sebelum Login:** Aplikasi tidak membaca tabel database apa pun sebelum sesi terautentikasi (seluruh izin role `anon` pada skema `public` telah dicabut via Migrasi 08). Autentikasi berjalan murni melalui endpoint Supabase Auth (`supabase.auth.signInWithPassword`).
   - **Peniadaan Login Username:** Login menggunakan username **tidak didukung**. Kolom `username` pada profil hanya dipertahankan untuk tampilan nama/identitas kasir di antarmuka aplikasi.
   - **Validasi Klien & Pesan Error:** Input email divalidasi di browser (wajib memuat tanda `@`). Jika salah, sistem langsung menampilkan peringatan *"Gunakan alamat email untuk login"* tanpa menghubungi server. Untuk kombinasi kredensial yang salah, sistem menampilkan satu pesan umum *"Email atau kata sandi salah"*, sementara gangguan koneksi server menampilkan *"Tidak dapat terhubung ke server, coba lagi"*.

---

## ⚙️ Operasional di Free Plan (Supabase Paket Gratis)

1. **Penanganan Auto-Pause (Inaktivitas 7 Hari):**
   - Pada paket gratis Supabase, project database akan otomatis di-*pause* jika tidak ada aktivitas selama 7 hari berturut-turut.
   - Jika aplikasi menampilkan error koneksi database, buka [Supabase Dashboard](https://supabase.com/dashboard) dan klik **Restore Project**. Proses pemulihan membutuhkan waktu 1–2 menit.
2. **Ketiadaan Backup Otomatis & Prosedur Ekspor CSV Mandiri:**
   - Supabase Free Plan tidak menyediakan pencadangan otomatis point-in-time recovery.
   - Pemilik warung **wajib melakukan ekspor data bulanan secara mandiri**:
     - Buka **Table Editor** di Supabase Dashboard.
     - Pilih tabel `orders`, klik tombol **Export** $\rightarrow$ **Export as CSV**.
     - Ulangi untuk tabel `order_items`, `order_item_addons`, dan `expenses`.
     - Simpan berkas CSV tersebut di media penyimpanan aman (Google Drive / hard disk eksternal).
3. **Penanganan Staff Lupa Kata Sandi:**
   - Aplikasi tidak mengaktifkan reset password publik melalui email anonim.
   - Jika staff lupa kata sandi, super admin dapat langsung memperbarui kata sandi staff melalui menu **Authentication** $\rightarrow$ **Users** $\rightarrow$ klik user yang bersangkutan $\rightarrow$ **Send Password Recovery** atau ubah kata sandi secara langsung.

---

### 6. Menjalankan Frontend Development Server & Verifikasi Bundle
```bash
# Menjalankan dev server
bun run dev

# Membangun produksi & validasi tipe TypeScript
bun run build

# Menjalankan linter ESLint
bun run lint

# Menjalankan preview bundle produksi lokal
bun run preview

# Verifikasi kebersihan bundle produksi (seluruhnya harus mengembalikan 0 baris / kosong):
grep -rIlE "[\"']123456[\"']" dist/
grep -rIl "contoh.com" dist/
grep -rIl "lonpadjauh.com" dist/
grep -rIl "window.supabase" dist/
grep -rIl "DEMO_CREDENTIALS" dist/
```

---

## 🔒 Pembuktian Keamanan & Skenario Uji Manual

> [!CAUTION] PERINGATAN KERAS: JANGAN JALANKAN SKENARIO UJI INI DI DATABASE PRODUKSI!
> Pengujian manual ini memanipulasi data riil, menyisipkan rekaman uji coba, dan menguji celah keamanan / edge cases. **Gunakan project Supabase terpisah (development / staging / branch sandbox) untuk pengujian.** Jangan pernah mengeksekusi skenario uji coba ini pada database produksi live warung!

### 💡 Catatan Ketersediaan Client & Cara Pengujian
- **DevTools Browser Console:** Dalam aplikasi frontend standar (Vite/production), objek `supabase` tidak ditempelkan ke objek global `window` demi alasan keamanan. Namun, saat Anda menjalankan dalam mode lokal (`bun run dev`), helper `window.supabase` telah diaktifkan secara otomatis setelah login. Buka DevTools Console (`F12` $\rightarrow$ Console) saat halaman aplikasi terbuka.
- **SQL Editor Supabase:** Semua skenario juga dapat diuji secara langsung di **SQL Editor** Supabase dengan meniru identitas user menggunakan:
  ```sql
  -- Meniru konteks user staff atau super_admin:
  SELECT set_config('request.jwt.claims', '{"sub": "<uuid_user_di_auth.users>"}', true);
  ```
- **Zona Waktu Toko (Asia/Jakarta):** Seluruh perbandingan tanggal toko menggunakan WIB (`Asia/Jakarta`). Jangan gunakan `toISOString().split('T')[0]` karena UTC berselisih hingga 7 jam. Gunakan helper:
  ```js
  const getJakartaDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
  };
  ```

---

### Skenario 1: Dua `create_order` Bersamaan (Advisory Lock & Idempotensi)
- **Tujuan:** Membuktikan `pg_advisory_xact_lock(hashtext(v_store_id::text))` dan `client_request_id` mencegah duplicate order dan race condition nomor urut.
- **Langkah Uji (DevTools Browser Console saat login):**
  ```js
  const requestId = crypto.randomUUID();
  const payload = {
    client_request_id: requestId,
    customer_name: "Uji Race Condition",
    source: "manual",
    payment_status: "belum_dibayar",
    items: [{
      menu_id: "c0000000-0000-0000-0000-000000000001", // Lontong Sayur Cubadak
      quantity: 1,
      variant: "Biasa",
      addons: []
    }]
  };

  // Jalankan 2 request create_order secara paralel dengan client_request_id yang sama
  const [res1, res2] = await Promise.all([
    supabase.rpc('create_order', { p_order: payload }),
    supabase.rpc('create_order', { p_order: payload })
  ]);

  console.log('Error 1:', res1.error);
  console.log('Error 2:', res2.error);
  console.log('Order 1:', res1.data?.orderNumber, res1.data?.id);
  console.log('Order 2:', res2.data?.orderNumber, res2.data?.id);
  console.log('Apakah ID Sama (Idempoten)?', res1.data?.id === res2.data?.id);
  ```
- **Hasil yang Diharapkan:** Kedua request berhasil tanpa error (`res.error === null`). Keduanya mengembalikan ID pesanan dan nomor urut yang identik (`res1.data.id === res2.data.id`). Hanya 1 baris pesanan yang dibuat di database.

---

### Skenario 2: `create_order` Tanpa Items atau Quantity Tidak Valid
- **Tujuan:** Memvalidasi penolakan items kosong dan pembatasan quantity antara 1 dan 1000.
- **Langkah Uji (DevTools Browser Console):**
  ```js
  // 1. Items kosong
  const test1 = await supabase.rpc('create_order', {
    p_order: { customer_name: 'Test', items: [] }
  });
  console.log('Test 1 (Items Kosong) Error:', test1.error?.message);

  // 2. Quantity 0
  const test2 = await supabase.rpc('create_order', {
    p_order: {
      customer_name: 'Test',
      items: [{ menu_id: 'c0000000-0000-0000-0000-000000000001', quantity: 0 }]
    }
  });
  console.log('Test 2 (Quantity 0) Error:', test2.error?.message);

  // 3. Quantity 1500 (> 1000)
  const test3 = await supabase.rpc('create_order', {
    p_order: {
      customer_name: 'Test',
      items: [{ menu_id: 'c0000000-0000-0000-0000-000000000001', quantity: 1500 }]
    }
  });
  console.log('Test 3 (Quantity > 1000) Error:', test3.error?.message);
  ```
- **Hasil yang Diharapkan:**
  - Test 1 ditolak: `"Items pesanan wajib berupa array dan tidak boleh kosong."` (Error `22023`).
  - Test 2 & 3 ditolak: `"Jumlah item (quantity) harus di antara 1 dan 1000."` (Error `22023`).

---

### Skenario 3: Dua `update_order_status` Bersamaan pada Toko yang Sama
- **Tujuan:** Membuktikan transaksi status terkunci secara serial via `pg_advisory_xact_lock` sehingga tidak terjadi state inconsistency.
- **Langkah Uji (DevTools Browser Console):**
  ```js
  // Buat pesanan baru terlebih dahulu
  const { data: newOrder, error: errCreate } = await supabase.rpc('create_order', {
    p_order: {
      customer_name: 'Uji Konkurensi Status',
      source: 'manual',
      payment_status: 'belum_dibayar',
      items: [{ menu_id: 'c0000000-0000-0000-0000-000000000001', quantity: 1 }]
    }
  });
  console.log('Buat Pesanan:', newOrder?.id, 'Error:', errCreate);

  // Jalankan 2 pembaruan status secara paralel pada pesanan yang sama
  const [resA, resB] = await Promise.all([
    supabase.rpc('update_order_status', { p_order_id: newOrder.id, p_status: 'diproses' }),
    supabase.rpc('update_order_status', { p_order_id: newOrder.id, p_status: 'selesai' })
  ]);

  console.log('Hasil A:', resA.data, 'Error A:', resA.error);
  console.log('Hasil B:', resB.data, 'Error B:', resB.error);
  ```
- **Hasil yang Diharapkan:**
  - Kedua pemanggilan dieksekusi secara serial berkat advisory transaction lock.
  - Jika `resA` diproses lebih dulu (`baru` $\rightarrow$ `diproses`), maka `resB` melanjutkan dari `diproses` $\rightarrow$ `selesai`.
  - Pesanan berakhir pada status `'selesai'` yang valid dan setiap perubahan tercatat rapi di `audit_logs`.

---

### Skenario 4: `update_order_status` Menolak Transisi Mundur (`diproses` $\rightarrow$ `baru`)
- **Tujuan:** Memastikan alur pemrosesan pesanan tidak dapat dimundurkan dari `diproses` kembali ke `baru`.
- **Langkah Uji (DevTools Browser Console):**
  ```js
  // Ambil pesanan yang berstatus 'diproses'
  const { data: orders } = await supabase.from('orders').select('id, status').eq('status', 'diproses').limit(1);
  if (orders && orders.length > 0) {
    const res = await supabase.rpc('update_order_status', {
      p_order_id: orders[0].id,
      p_status: 'baru'
    });
    console.log('Hasil Transisi Mundur:', res.data);
    console.log('Error Transisi Mundur:', res.error?.message, 'Code:', res.error?.code);
  }
  ```
- **Hasil yang Diharapkan:** Ditolak dengan pesan:
  `"Transisi status mundur dari diproses ke baru tidak diizinkan."` (Error `22023`).

---

### Skenario 5: `toggle_order_payment` pada Hari yang Sudah Ditutup (Staff vs Super Admin)
- **Tujuan:** Membuktikan bahwa hari yang sudah ditutup tidak boleh diubah oleh `staff`, tetapi dapat diubah oleh `super_admin` dengan alasan wajib.
- **Langkah Uji:**
  ```js
  // Ambil pesanan dari hari yang sudah ditutup
  const { data: closedDays } = await supabase.from('daily_closings').select('day_key').limit(1);
  const targetDay = closedDays[0].day_key;
  const { data: orders } = await supabase.from('orders').select('id').eq('day_key', targetDay).limit(1);
  const orderId = orders[0].id;

  // 1. Uji saat login sebagai staff
  const staffRes = await supabase.rpc('toggle_order_payment', { p_order_id: orderId });
  console.log('Staff Toggle Payment Error:', staffRes.error?.message, 'Code:', staffRes.error?.code);

  // 2. Uji saat login sebagai super_admin TANPA alasan (Harus ditolak)
  const adminNoReason = await supabase.rpc('toggle_order_payment', {
    p_order_id: orderId,
    p_reason: ''
  });
  console.log('Admin Tanpa Alasan Error:', adminNoReason.error?.message);

  // 3. Uji saat login sebagai super_admin DENGAN alasan (Harus Berhasil)
  const adminWithReason = await supabase.rpc('toggle_order_payment', {
    p_order_id: orderId,
    p_reason: 'Pelanggan transfer susulan via QRIS'
  });
  console.log('Admin Dengan Alasan Sukses:', adminWithReason.data, 'Error:', adminWithReason.error);
  ```
- **Hasil yang Diharapkan:**
  - Staff ditolak: `"Hari pesanan (YYYY-MM-DD) telah ditutup. Status pembayaran tidak dapat diubah oleh staff."` (Error `22023`).
  - Super admin tanpa alasan ditolak: `"Perubahan status pembayaran pada hari yang sudah ditutup wajib menyertakan alasan."` (Error `22023`).
  - Super admin dengan alasan berhasil mengubah status dan alasan tercatat di `audit_logs` (`action_type: PAYMENT_UPDATED`).

---

### Skenario 6: `reopen_store_day` oleh Staff vs Super Admin
- **Tujuan:** Membuktikan bahwa pembukaan kembali hari yang sudah ditutup hanya dapat dilakukan oleh `super_admin` dengan alasan wajib, dan ditolak untuk `staff`.
- **Langkah Uji:**
  ```js
  const today = getJakartaDate(0);

  // 1. Staff mencoba membuka kembali hari yang ditutup
  const staffReopen = await supabase.rpc('reopen_store_day', {
    p_day_key: today,
    p_reason: 'Staff ingin buka lagi'
  });
  console.log('Staff Reopen Error:', staffReopen.error?.message, 'Code:', staffReopen.error?.code);

  // 2. Super admin tanpa alasan
  const adminReopenNoReason = await supabase.rpc('reopen_store_day', {
    p_day_key: today,
    p_reason: ' '
  });
  console.log('Admin Reopen No Reason Error:', adminReopenNoReason.error?.message);

  // 3. Super admin dengan alasan sah
  const adminReopenSuccess = await supabase.rpc('reopen_store_day', {
    p_day_key: today,
    p_reason: 'Koreksi transaksi kasir sore'
  });
  console.log('Admin Reopen Sukses:', adminReopenSuccess.data, 'Error:', adminReopenSuccess.error);
  ```
- **Hasil yang Diharapkan:**
  - Staff ditolak: `"Akses Ditolak: Hanya super_admin yang berhak membuka kembali hari yang sudah ditutup."` (Error `42501`).
  - Super admin tanpa alasan ditolak: `"Pembukaan kembali hari yang sudah ditutup wajib menyertakan alasan."` (Error `22023`).
  - Super admin dengan alasan berhasil: baris `daily_closings` hari itu dihapus, dan tercatat di `audit_logs` (`action_type: DAY_REOPENED`) dengan summary lama disimpan di kolom `old_value`.

---

### Skenario 7: Staff Membatalkan / Mengubah Pesanan Hari Kemarin (Asia/Jakarta)
- **Tujuan:** Memastikan staff hanya boleh memodifikasi pesanan hari ini (`day_key = hari ini`), pesanan lampau hanya boleh oleh `super_admin`.
- **Langkah Uji (DevTools Browser Console saat login sebagai staff):**
  ```js
  const yesterday = getJakartaDate(-1);
  const { data: oldOrders } = await supabase.from('orders').select('id, day_key').eq('day_key', yesterday).limit(1);

  if (oldOrders && oldOrders.length > 0) {
    const res = await supabase.rpc('cancel_order', {
      p_order_id: oldOrders[0].id,
      p_reason: 'Membatalkan pesanan kemarin'
    });
    console.log('Hasil Batal Pesanan Kemarin:', res.data);
    console.log('Error Batal Pesanan Kemarin:', res.error?.message, 'Code:', res.error?.code);
  }
  ```
- **Hasil yang Diharapkan:** Ditolak dengan kode `42501`:
  `"Akses Ditolak: Staff hanya dapat membatalkan pesanan pada hari ini (...). Pesanan tanggal ... hanya dapat dibatalkan oleh super_admin."`

---

### Skenario 8: Koreksi Pesanan Setelah Harga Menu Naik (Price Retention)
- **Tujuan:** Membuktikan `correct_order` mempertahankan harga asli item lama yang sudah dibeli dan hanya mengenakan harga baru pada item yang baru ditambahkan, serta mengabaikan item dengan `menu_id` NULL.
- **Langkah Uji:**
  1. Buat pesanan lontong padang (harga master Rp 10.000, ID: `c0000000-0000-0000-0000-000000000001`).
  2. Super admin menaikkan harga lontong di tabel `menu_products` menjadi Rp 12.000.
  3. Lakukan koreksi pesanan dengan menambahkan item baru (Es Teh Manis Rp 5.000, ID: `c0000000-0000-0000-0000-000000000015`) dan tetap menyertakan Lontong:
  ```js
  const res = await supabase.rpc('correct_order', {
    p_order_id: '<order_id>',
    p_reason: 'Tambah minum es teh manis',
    p_correction: {
      items: [
        { menu_id: 'c0000000-0000-0000-0000-000000000001', quantity: 1, variant: 'Biasa' },
        { menu_id: 'c0000000-0000-0000-0000-000000000015', quantity: 1, variant: 'Biasa' }
      ]
    }
  });
  console.log('Koreksi Sukses:', res.data, 'Error:', res.error);
  ```
  4. Periksa baris di `order_items`:
     ```sql
     SELECT menu_name, unit_price FROM public.order_items WHERE order_id = '<order_id>';
     ```
- **Hasil yang Diharapkan:** Lontong Padang tetap bertarif **Rp 10.000** (harga lama dipertahankan), sedangkan Es Teh Manis bertarif **Rp 5.000**.

---

### Skenario 9: `close_store_day` Tanggal Besok (Future Date Rejection via Asia/Jakarta Date)
- **Tujuan:** Menolak upaya penutupan buku pada tanggal masa depan berdasarkan waktu Asia/Jakarta.
- **Langkah Uji (DevTools Browser Console saat login sebagai super admin):**
  ```js
  const tomorrow = getJakartaDate(1);
  const res = await supabase.rpc('close_store_day', { p_day_key: tomorrow });
  console.log('Hasil Close Hari Besok:', res.data);
  console.log('Error Close Hari Besok:', res.error?.message, 'Code:', res.error?.code);
  ```
- **Hasil yang Diharapkan:** Ditolak dengan kode `22023`:
  `"Tanggal penutupan buku (...) tidak boleh melebihi tanggal hari ini (...)."`

---

### Skenario 10: Staff Mengubah Harga Menu Master (`menu_products.price`)
- **Tujuan:** Memastikan trigger `protect_menu_product_price` menolak perubahan harga menu oleh staff.
- **Langkah Uji (DevTools Browser Console saat login sebagai staff):**
  ```js
  const { data: menu } = await supabase.from('menu_products').select('id, price').limit(1);
  const res = await supabase
    .from('menu_products')
    .update({ price: 1000 })
    .eq('id', menu[0].id);
  console.log('Hasil Update Harga oleh Staff:', res.data);
  console.log('Error Update Harga oleh Staff:', res.error?.message, 'Code:', res.error?.code);
  ```
- **Hasil yang Diharapkan:** Ditolak dengan kode `42501`:
  `"Akses Ditolak: Hanya super_admin yang berhak mengubah harga produk menu."`

---

### Skenario 11: Direct DML pada `orders` Ditolak Total
- **Tujuan:** Memastikan DML langsung telah di-REVOKE dari `authenticated` dan `anon` sehingga manipulasi harus lewat RPC Security Definer.
- **Langkah Uji (DevTools Browser Console):**
  ```js
  const res = await supabase.from('orders').insert({
    order_number: 'LP-HACK',
    total: 1000,
    store_id: 'a0000000-0000-0000-0000-000000000001'
  });
  console.log('Hasil Direct Insert:', res.data);
  console.log('Error Direct Insert:', res.error?.message, 'Code:', res.error?.code);
  ```
- **Hasil yang Diharapkan:** Ditolak dengan pesan: `"permission denied for table orders"` (Error `42501`).

---

### Skenario 12: Staff Membatalkan Pesanan Selesai (Ditolak 42501) vs Super Admin (Berhasil)
- **Tujuan:** Membuktikan bahwa pesanan berstatus `'selesai'` HANYA dapat dibatalkan oleh `super_admin` guna mencegah staf membatalkan pesanan selesai untuk menutupi selisih uang kas di laci kasir.
- **Langkah Uji A: Percobaan oleh Staff (Ditolak di UI dan Database)**
  1. Login ke aplikasi sebagai user dengan peran `staff` (misal: `email-staff@contoh.com`).
  2. Buka halaman **Daftar Pesanan** (`/orders`) atau **Detail Pesanan** (`/orders/:id`) yang berstatus **Selesai** pada hari ini.
  3. **Verifikasi Tampilan UI:**
     - Tombol **"Batalkan"** dalam kondisi dinonaktifkan (`disabled`).
     - Arahkan kursor atau lihat teks bantuan: *"Hanya super admin yang dapat membatalkan pesanan selesai"*.
  4. **Verifikasi Proteksi RPC Database (DevTools Console):**
     Jika staf mem-bypass UI dan memanggil fungsi RPC secara langsung:
     ```js
     // Ganti dengan UUID pesanan hari ini yang berstatus 'selesai'
     const orderSelesaiId = '<uuid_pesanan_selesai>';
     
     const res = await supabase.rpc('cancel_order', {
       p_order_id: orderSelesaiId,
       p_reason: 'Staf mencoba membatalkan pesanan selesai'
     });
     console.log('Hasil Batal Staff:', res.data);
     console.log('Error Batal Staff:', res.error?.message, 'Code:', res.error?.code);
     ```
  5. **Hasil yang Diharapkan (Staff):** Panggilan database digagalkan dengan exception PostgreSQL kode `42501`:
     `"Akses Ditolak: Hanya super admin yang dapat membatalkan pesanan selesai."`
     Pesan error ini otomatis muncul di komponen pesan error aplikasi.

- **Langkah Uji B: Pembatalan oleh Super Admin (Berhasil)**
  1. Login ke aplikasi sebagai user dengan peran `super_admin` (misal: `email-pemilik@contoh.com`).
  2. Buka pesanan selesai yang sama di halaman daftar pesanan atau detail pesanan.
  3. **Verifikasi Tampilan UI:**
     - Tombol **"Batalkan"** dalam kondisi AKTIF dan dapat diklik.
  4. Klik tombol **"Batalkan"**, masukkan alasan pembatalan pada dialog konfirmasi (misal: *"Pelanggan komplain makanan basi, uang dikembalikan"*), lalu klik konfirmasi pembatalan. (Atau via DevTools Console):
     ```js
     const res = await supabase.rpc('cancel_order', {
       p_order_id: orderSelesaiId,
       p_reason: 'Pelanggan komplain makanan basi, uang dikembalikan'
     });
     console.log('Hasil Batal Super Admin:', res.data);
     ```
  5. **Hasil yang Diharapkan (Super Admin):**
     - Pesanan berhasil dibatalkan.
     - Status pesanan berubah menjadi `'dibatalkan'`.
     - Riwayat dicatat dalam tabel `order_corrections` dan `audit_logs` dengan aksi `'ORDER_CANCELLED'` beserta catatan alasan pembatalan.
