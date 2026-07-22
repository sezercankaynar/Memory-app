import type { Memory } from "../types";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default function Collage({
  memories,
  onOpen,
}: {
  memories: Memory[];
  onOpen: (items: Memory[], index: number) => void;
}) {
  if (!memories.length) return <Empty />;
  return (
    <div className="collage">
      {memories.map((m, i) => (
        <button key={m.id} className="tile" onClick={() => onOpen(memories, i)}>
          <div className="img">
            {m.media_type === "video" ? (
              <video src={m.media_url} muted className="cover" />
            ) : (
              <img src={m.media_url} alt={m.place || ""} className="cover" loading="lazy" />
            )}
            {m.media_type === "video" && <span className="play">▶</span>}
          </div>
          <div className="rail" style={{ background: m.author?.color || "#c9702f" }} />
          <div className="meta">
            <div className="p">{m.place || "Konum"}</div>
            <div className="d">{fmt(m.taken_at)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="empty">
      Henüz anı yok. Sağ üstteki <b>＋ Anı ekle</b> ile ilk fotoğrafınızı yükleyin.
    </div>
  );
}
