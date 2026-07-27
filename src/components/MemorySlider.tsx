import { useEffect, useState } from "react";
import type { Memory } from "../types";
import { useAuth } from "../context/AuthContext";
import { useAlbum } from "../context/AlbumContext";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

/** Bir veya birden çok anıyı tam ekran, kaydırmalı görüntüler. */
export default function MemorySlider({
  items,
  startIndex = 0,
  onClose,
}: {
  items: Memory[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const [deleting, setDeleting] = useState(false);
  const { session } = useAuth();
  const { deleteMemory } = useAlbum();
  const m = items[i];
  const multi = items.length > 1;
  const isOwn = !!(session && m && m.user_id === session.user.id);

  const handleDelete = async () => {
    if (!m) return;
    if (!confirm("Bu anıyı silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
    setDeleting(true);
    const { error } = await deleteMemory(m);
    setDeleting(false);
    if (error) {
      alert("Silinemedi: " + error);
      return;
    }
    if (items.length <= 1) {
      onClose();
    } else {
      const nextIdx = i >= items.length - 1 ? i - 1 : i;
      items.splice(i, 1);
      setI(nextIdx);
    }
  };
  const next = () => setI((v) => (v + 1) % items.length);
  const prev = () => setI((v) => (v - 1 + items.length) % items.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (multi && e.key === "ArrowRight") next();
      if (multi && e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [multi, onClose]);

  if (!m) return null;
  const initial = (m.author?.display_name || "?").charAt(0).toUpperCase();

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="memcard" role="dialog" aria-modal="true">
        <div className="hero">
          <button className="close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
          {multi && (
            <>
              <button className="arrow prev" onClick={prev} aria-label="Önceki">
                ‹
              </button>
              <button className="arrow next" onClick={next} aria-label="Sonraki">
                ›
              </button>
              <span className="counter">
                {i + 1} / {items.length}
              </span>
            </>
          )}
          {m.media_type === "video" ? (
            <video src={m.media_url} controls playsInline className="media" />
          ) : (
            <img src={m.media_url} alt={m.place || "Anı"} className="media" />
          )}
        </div>
        <div className="body">
          <div className="place">{m.place || "Konum"}</div>
          <div className="coord">
            {m.lat.toFixed(4)}° K, {m.lon.toFixed(4)}° D
          </div>
          {m.caption && <div className="cap">{m.caption}</div>}
          <div className="foot">
            <span className="ava" style={{ background: m.author?.color || "#c9702f" }}>
              {initial}
            </span>
            <span>{m.author?.display_name || "Bilinmiyor"} yükledi</span>
            <span className="date">{fmt(m.taken_at)}</span>
            {isOwn && (
              <button
                className="btn ghost sm danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ marginLeft: "auto" }}
              >
                {deleting ? "Siliniyor…" : "Sil"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
