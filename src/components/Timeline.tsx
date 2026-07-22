import type { Memory } from "../types";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default function Timeline({
  memories,
  onOpen,
}: {
  memories: Memory[];
  onOpen: (items: Memory[], index: number) => void;
}) {
  const sorted = [...memories].sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1));
  if (!sorted.length)
    return <div className="empty">Henüz anı yok. İlk anınızı ekleyin, burada zaman sırasıyla görünsün.</div>;

  return (
    <div className="timeline">
      {sorted.map((m, i) => (
        <button
          key={m.id}
          className="tl-item"
          style={{ ["--c" as string]: m.author?.color || "#c9702f" }}
          onClick={() => onOpen(sorted, i)}
        >
          <div className="date">{fmt(m.taken_at)}</div>
          <div className="place">{m.place || "Konum"}</div>
          {m.caption && <div className="cap">{m.caption}</div>}
          <div className="by" style={{ color: m.author?.color || "#c9702f" }}>
            {m.author?.display_name || "Bilinmiyor"} yükledi
          </div>
        </button>
      ))}
    </div>
  );
}
