import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlbum } from "../context/AlbumContext";
import { isMapboxConfigured } from "../lib/config";
import Onboarding from "../components/Onboarding";
import MapView from "../components/MapView";
import Collage from "../components/Collage";
import Timeline from "../components/Timeline";
import MemorySlider from "../components/MemorySlider";
import UploadDialog from "../components/UploadDialog";
import type { Memory } from "../types";

type View = "map" | "collage" | "timeline";

export default function Home() {
  const { profile, signOut } = useAuth();
  const { album, members, memories, loading } = useAlbum();

  const [view, setView] = useState<View>("map");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [slider, setSlider] = useState<{ items: Memory[]; index: number } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const visible = useMemo(
    () => memories.filter((m) => !hidden.has(m.user_id)),
    [memories, hidden],
  );

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }
  if (!album) return <Onboarding />;

  const toggleUser = (id: string) => {
    setHidden((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(album.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const open = (items: Memory[], index: number) => setSlider({ items, index });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo sm">
            Rota<span>·</span>mız
          </div>
        </div>

        <div className="members">
          {members.map((mem) => {
            const off = hidden.has(mem.id);
            return (
              <button
                key={mem.id}
                className={"who" + (off ? " off" : "")}
                onClick={() => toggleUser(mem.id)}
                title={off ? "Göster" : "Gizle"}
              >
                <span className="ava" style={{ background: mem.color }}>
                  {mem.display_name.charAt(0).toUpperCase()}
                </span>
                {mem.display_name}
              </button>
            );
          })}
          {members.length < 2 && (
            <button className="invite" onClick={copyInvite}>
              {copied ? "Kopyalandı ✓" : "＋ Partneri davet et"}
            </button>
          )}
        </div>

        <div className="actions">
          <button className="btn primary sm" onClick={() => setUploadOpen(true)}>
            ＋ Anı ekle
          </button>
          <button className="btn ghost sm" onClick={signOut} title={profile?.display_name}>
            Çıkış
          </button>
        </div>
      </header>

      <nav className="tabs">
        {(["map", "collage", "timeline"] as View[]).map((v) => (
          <button
            key={v}
            className={"tab" + (view === v ? " on" : "")}
            onClick={() => setView(v)}
          >
            <span className="tab-icon" aria-hidden>
              {v === "map" ? "🗺" : v === "collage" ? "🖼" : "🕰"}
            </span>
            <span className="tab-lbl">
              {v === "map" ? "Harita" : v === "collage" ? "Kolaj" : "Zaman Tüneli"}
            </span>
          </button>
        ))}
      </nav>

      <main className="stage">
        {view === "map" &&
          (isMapboxConfigured ? (
            <MapView memories={visible} onOpen={open} />
          ) : (
            <div className="empty">
              Harita için <code>VITE_MAPBOX_TOKEN</code> gerekiyor (README'ye bakın). Bu arada
              Kolaj ve Zaman Tüneli görünümlerini kullanabilirsiniz.
            </div>
          ))}
        {view === "collage" && <Collage memories={visible} onOpen={open} />}
        {view === "timeline" && <Timeline memories={visible} onOpen={open} />}
      </main>

      <button
        className="fab"
        onClick={() => setUploadOpen(true)}
        aria-label="Anı ekle"
      >
        ＋
      </button>

      {slider && (
        <MemorySlider items={slider.items} startIndex={slider.index} onClose={() => setSlider(null)} />
      )}
      {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} />}
    </div>
  );
}
