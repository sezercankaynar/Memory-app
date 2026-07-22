export default function SetupNotice() {
  return (
    <div className="center-screen">
      <div className="card setup">
        <h1>Rotamız kurulumu</h1>
        <p>Uygulamayı çalıştırmak için bir kaç anahtar gerekiyor. Proje kökünde <code>.env</code> dosyası oluşturun:</p>
        <pre>
{`cp .env.example .env`}
        </pre>
        <ol>
          <li>
            <b>Supabase</b> — <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>'da
            ücretsiz proje açın, <code>supabase/schema.sql</code> dosyasını SQL Editor'de çalıştırın,
            ardından proje ayarlarından <code>VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code> değerlerini girin.
          </li>
          <li>
            <b>Mapbox</b> — <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer">Mapbox</a>'tan
            ücretsiz token alıp <code>VITE_MAPBOX_TOKEN</code> olarak girin.
          </li>
          <li>Sunucuyu yeniden başlatın: <code>npm run dev</code></li>
        </ol>
        <p className="muted">Ayrıntılı adımlar için depo kökündeki <code>README.md</code>.</p>
      </div>
    </div>
  );
}
