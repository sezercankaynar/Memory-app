# Rotamız — Ortak Anı Haritası

İki kişinin (örneğin bir çiftin) ayrı hesaplarla giriş yapıp, farklı cihazlardan
yükledikleri fotoğraf ve videoları **konum ve tarihle** birlikte **ortak bir harita,
kolaj ve zaman tüneli** üzerinde birleştirdiği web uygulaması.

- 🗺️ **Gerçek Mapbox haritası** — fotoğraflar çekildikleri konuma iğnelenir
- 🔍 **Bölgesel kümeleme** — uzaklaştıkça yakın anılar gruplanır (5, 9+ …); kümeye
  tıklayınca fotoğraflar tek tek **slider** ile görüntülenir
- 👥 **Çok kullanıcı, ortak albüm** — her kullanıcı kendi anılarını yükler, ikisi de
  hepsini görür; kişiye göre renk ve filtre
- 📍 **Otomatik konum/tarih** — fotoğrafın EXIF GPS'i ve çekim tarihi otomatik okunur;
  yoksa haritadan elle seçilir
- 🖼️ **Kolaj** ve **Zaman Tüneli** görünümleri
- ⚡ **Canlı senkron** — partner yeni anı eklediğinde anında görünür

Teknoloji: **React + Vite + TypeScript**, **Mapbox GL JS**, **Supabase** (Auth +
Postgres + Storage), **exifr**.

---

## Kurulum

### 1. Bağımlılıklar
```bash
npm install
```

### 2. Supabase projesi
1. [supabase.com](https://supabase.com) üzerinde ücretsiz bir proje oluşturun.
2. **SQL Editor**'ü açın ve `supabase/schema.sql` dosyasının tamamını çalıştırın.
   Bu; tablolar (profiles, albums, album_members, memories), güvenlik kuralları (RLS)
   ve `media` adlı depolama alanını (storage bucket) oluşturur.
3. **Project Settings → API** bölümünden `Project URL` ve `anon public` anahtarını alın.

### 3. Mapbox token
1. [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/)
   adresinden ücretsiz bir **public token** (`pk....`) oluşturun.

### 4. Ortam değişkenleri
```bash
cp .env.example .env
```
`.env` dosyasını doldurun:
```
VITE_MAPBOX_TOKEN=pk....
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi....
```

### 5. Çalıştır
```bash
npm run dev      # geliştirme (http://localhost:5173)
npm run build    # üretim derlemesi
npm run preview  # üretim önizlemesi
```

---

## Kullanım akışı

1. **Sezer** kayıt olur → "Yeni albüm" oluşturur → bir **davet kodu** alır (üst bardaki
   "Partneri davet et" ile kopyalanır).
2. **Ayşenur** kayıt olur → "Koda katıl" ile bu kodu girer → aynı albüme dahil olur.
3. İkisi de kendi cihazından **＋ Anı ekle** ile fotoğraf/video yükler; konum ve tarih
   otomatik okunur (gerekiyorsa haritadan düzeltilir).
4. Anılar **Harita**, **Kolaj** ve **Zaman Tüneli**'nde ortak görünür.

---

## Proje yapısı

```
src/
├── context/       Auth ve Albüm durum yönetimi (React Context)
├── components/    MapView (Mapbox + kümeleme), MemorySlider, UploadDialog,
│                  Collage, Timeline, Onboarding, SetupNotice
├── pages/         Login, Home
├── lib/           supabase, config (Mapbox), exif (EXIF okuma)
├── types.ts       Ortak tipler
└── styles.css     Tema (açık/koyu) ve tüm arayüz stilleri
supabase/
└── schema.sql     Veritabanı şeması + RLS + storage politikaları
```

## Notlar
- Depolama alanı `media` **public** okunur şekilde ayarlıdır (public URL ile görüntüleme).
  Gizlilik gerekiyorsa imzalı URL'lere (signed URL) geçilebilir.
- `.env` sürüm kontrolüne **dahil edilmez**; anahtarlarınız yerelde kalır.
