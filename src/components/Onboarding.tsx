import { useState } from "react";
import { useAlbum } from "../context/AlbumContext";

/** Kullanıcının henüz bir albümü yoksa: yeni albüm oluştur veya partnerin koduyla katıl. */
export default function Onboarding() {
  const { createAlbum, joinAlbum } = useAlbum();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("Rotamız");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ error?: string }>) => {
    setErr(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.error) setErr(res.error);
  };

  return (
    <div className="center-screen auth-bg">
      <div className="card auth">
        <div className="logo">
          Rota<span>·</span>mız
        </div>
        <p className="tagline">Ortak albümünüzü kurun</p>

        <div className="seg">
          <button className={tab === "create" ? "on" : ""} onClick={() => setTab("create")}>
            Yeni albüm
          </button>
          <button className={tab === "join" ? "on" : ""} onClick={() => setTab("join")}>
            Koda katıl
          </button>
        </div>

        {tab === "create" ? (
          <>
            <label>
              Albüm adı
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <p className="muted">
              Oluşturduktan sonra bir <b>davet kodu</b> alırsınız; partnerinize gönderin, o da
              "Koda katıl" ile aynı albüme girsin.
            </p>
            <button className="btn primary" disabled={busy} onClick={() => run(() => createAlbum(name))}>
              {busy ? "..." : "Albümü oluştur"}
            </button>
          </>
        ) : (
          <>
            <label>
              Davet kodu
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="partnerinizin gönderdiği kod"
              />
            </label>
            <button className="btn primary" disabled={busy || !code} onClick={() => run(() => joinAlbum(code))}>
              {busy ? "..." : "Albüme katıl"}
            </button>
          </>
        )}

        {err && <div className="banner error">{err}</div>}
      </div>
    </div>
  );
}
