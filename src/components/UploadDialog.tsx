import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useAlbum } from "../context/AlbumContext";
import { extractMeta } from "../lib/exif";
import { MAPBOX_TOKEN, INITIAL_VIEW } from "../lib/config";
import type { MediaType } from "../types";

mapboxgl.accessToken = MAPBOX_TOKEN;

const prefersDark =
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
const STYLE = prefersDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";

type Status = "pending" | "uploading" | "done" | "error";

type Item = {
  file: File;
  preview: string;
  mediaType: MediaType;
  place: string;
  caption: string;
  date: string;
  pos: { lat: number; lon: number } | null;
  hasExifLoc: boolean;
  status: Status;
  error?: string;
};

export default function UploadDialog({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const { album } = useAlbum();

  const [items, setItems] = useState<Item[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const miniMap = useRef<mapboxgl.Map | null>(null);
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  const active = items[activeIdx];

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const updateActive = (patch: Partial<Item>) => updateItem(activeIdxRef.current, patch);

  const addFiles = async (fs: FileList | File[]) => {
    setGlobalErr(null);
    const arr = Array.from(fs);
    if (!arr.length) return;
    const built: Item[] = await Promise.all(
      arr.map(async (f) => {
        const meta = await extractMeta(f);
        const hasLoc = typeof meta.lat === "number" && typeof meta.lon === "number";
        return {
          file: f,
          preview: URL.createObjectURL(f),
          mediaType: (f.type.startsWith("video/") ? "video" : "photo") as MediaType,
          place: "",
          caption: "",
          date: meta.takenAt ? meta.takenAt.slice(0, 10) : "",
          pos: hasLoc ? { lat: meta.lat!, lon: meta.lon! } : null,
          hasExifLoc: hasLoc,
          status: "pending" as Status,
        };
      }),
    );
    setItems((prev) => {
      if (prev.length === 0) return built;
      // konum/tarih boşsa önceki anıdan miras al
      let lastPos = prev[prev.length - 1].pos;
      let lastDate = prev[prev.length - 1].date;
      const filled = built.map((it) => {
        const pos = it.pos ?? lastPos;
        const date = it.date || lastDate;
        if (pos) lastPos = pos;
        if (date) lastDate = date;
        return { ...it, pos, date };
      });
      return [...prev, ...filled];
    });
  };

  const removeAt = (idx: number) => {
    setItems((arr) => {
      const it = arr[idx];
      if (it) URL.revokeObjectURL(it.preview);
      const next = arr.filter((_, i) => i !== idx);
      return next;
    });
    setActiveIdx((cur) => {
      if (idx < cur) return cur - 1;
      if (idx === cur) return Math.max(0, cur - (cur > 0 ? 1 : 0));
      return cur;
    });
  };

  // aktif öğe için mini harita
  useEffect(() => {
    if (!active || !mapEl.current || active.status === "done") return;
    const start: [number, number] = active.pos
      ? [active.pos.lon, active.pos.lat]
      : INITIAL_VIEW.center;
    const m = new mapboxgl.Map({
      container: mapEl.current,
      style: STYLE,
      center: start,
      zoom: active.pos ? 11 : INITIAL_VIEW.zoom,
    });
    miniMap.current = m;
    const mk = new mapboxgl.Marker({ draggable: true, color: "#c9702f" })
      .setLngLat(start)
      .addTo(m);
    mk.on("dragend", () => {
      const ll = mk.getLngLat();
      updateActive({ pos: { lat: ll.lat, lon: ll.lng }, hasExifLoc: false });
    });
    m.on("click", (e) => {
      mk.setLngLat(e.lngLat);
      updateActive({ pos: { lat: e.lngLat.lat, lon: e.lngLat.lng }, hasExifLoc: false });
    });
    return () => {
      m.remove();
      miniMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, active?.file, active?.status]);

  const uploadOne = async (idx: number, it: Item): Promise<boolean> => {
    if (!session || !album) return false;
    if (!it.pos) {
      updateItem(idx, { status: "error", error: "Konum gerekli" });
      return false;
    }
    if (!it.date) {
      updateItem(idx, { status: "error", error: "Tarih gerekli" });
      return false;
    }
    updateItem(idx, { status: "uploading", error: undefined });
    try {
      const ext = it.file.name.split(".").pop() || (it.mediaType === "video" ? "mp4" : "jpg");
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("media").upload(path, it.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: it.file.type,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      const ins = await supabase.from("memories").insert({
        album_id: album.id,
        user_id: session.user.id,
        place: it.place || null,
        lat: it.pos.lat,
        lon: it.pos.lon,
        taken_at: new Date(it.date).toISOString(),
        media_url: pub.publicUrl,
        media_type: it.mediaType,
        caption: it.caption || null,
      });
      if (ins.error) throw ins.error;
      updateItem(idx, { status: "done" });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Yükleme başarısız.";
      updateItem(idx, { status: "error", error: msg });
      return false;
    }
  };

  const uploadAll = async () => {
    const missing = items.findIndex((it) => it.status !== "done" && (!it.pos || !it.date));
    if (missing >= 0) {
      setActiveIdx(missing);
      setGlobalErr("Bu anı için tarih ve konum gerekli.");
      return;
    }
    setBusy(true);
    setGlobalErr(null);
    const pending = items
      .map((it, i) => ({ it, i }))
      .filter((x) => x.it.status !== "done");
    let done = 0;
    for (const { it, i } of pending) {
      setProgress({ done, total: pending.length });
      const ok = await uploadOne(i, it);
      if (ok) done++;
    }
    setProgress({ done, total: pending.length });
    setBusy(false);
    const anyError = items.some((it, i) => {
      const p = pending.find((x) => x.i === i);
      return p && it.status === "error";
    });
    if (!anyError && done === pending.length) {
      setTimeout(onClose, 400);
    }
  };

  const canClose = !busy;
  const pendingCount = items.filter((it) => it.status !== "done").length;
  const doneCount = items.filter((it) => it.status === "done").length;

  return (
    <div className="scrim" onClick={(e) => canClose && e.target === e.currentTarget && onClose()}>
      <div className="dialog upload-dialog" role="dialog" aria-modal="true">
        <div className="dhead">
          <h2>
            {items.length === 0
              ? "Anı ekle"
              : items.length === 1
              ? "Anı ekle"
              : `${items.length} anı${doneCount ? ` · ${doneCount} yüklendi` : ""}`}
          </h2>
          <button className="close dark" onClick={onClose} disabled={!canClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <label className="dropzone">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="dz-inner">
              <div className="dz-icon">📷</div>
              <div>Fotoğraf veya video seç</div>
              <div className="muted">
                Birden fazla seçebilirsin · Konum &amp; tarih EXIF&apos;ten otomatik
              </div>
            </div>
          </label>
        ) : (
          <div className="dbody">
            <div className="thumbstrip">
              {items.map((it, i) => (
                <button
                  key={i}
                  className={
                    "thumb" +
                    (i === activeIdx ? " on" : "") +
                    (it.status === "done" ? " done" : "") +
                    (it.status === "error" ? " err" : "")
                  }
                  onClick={() => setActiveIdx(i)}
                  disabled={busy}
                  title={it.file.name}
                  type="button"
                >
                  {it.mediaType === "video" ? (
                    <video src={it.preview} muted playsInline preload="metadata" />
                  ) : (
                    <img src={it.preview} alt="" />
                  )}
                  {it.status === "done" && <span className="thumb-badge ok">✓</span>}
                  {it.status === "error" && <span className="thumb-badge err">!</span>}
                  {it.status === "uploading" && (
                    <span className="thumb-badge up">
                      <span className="mini-spin" />
                    </span>
                  )}
                  {items.length > 1 && it.status !== "done" && !busy && (
                    <span
                      className="thumb-x"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAt(i);
                      }}
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
              <label className={"thumb add" + (busy ? " disabled" : "")}>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span>＋</span>
              </label>
            </div>

            {active && active.status !== "done" ? (
              <>
                <div className="dpreview">
                  {active.mediaType === "video" ? (
                    <video src={active.preview} controls className="cover" playsInline />
                  ) : (
                    <img src={active.preview} alt="" className="cover" />
                  )}
                </div>

                <div className="dfields">
                  <label>
                    Yer adı
                    <input
                      value={active.place}
                      onChange={(e) => updateActive({ place: e.target.value })}
                      placeholder="İstanbul · Boğaz"
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Tarih
                    <input
                      type="date"
                      value={active.date}
                      onChange={(e) => updateActive({ date: e.target.value })}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Not
                    <textarea
                      value={active.caption}
                      onChange={(e) => updateActive({ caption: e.target.value })}
                      placeholder="O anı hatırla..."
                      rows={2}
                      disabled={busy}
                    />
                  </label>

                  <div className="locrow">
                    {active.hasExifLoc ? (
                      <span className="badge ok">
                        📍 Konum fotoğraftan okundu — gerekiyorsa haritadan düzeltin
                      </span>
                    ) : active.pos ? (
                      <span className="badge warn">
                        📍 Konum önceki anıdan alındı — kontrol edin
                      </span>
                    ) : (
                      <span className="badge warn">📍 Konum bulunamadı — haritadan seçin</span>
                    )}
                  </div>
                  <div ref={mapEl} className="minimap" />
                  {active.pos && (
                    <div className="coord small">
                      {active.pos.lat.toFixed(4)}° K, {active.pos.lon.toFixed(4)}° D
                    </div>
                  )}
                  {active.status === "error" && active.error && (
                    <div className="banner error">{active.error}</div>
                  )}
                </div>
              </>
            ) : (
              <div className="upload-done">
                <div className="ok-mark">✓</div>
                <div>Bu anı yüklendi</div>
                <div className="muted">Sol taraftan başka bir anıya geçebilirsin</div>
              </div>
            )}
          </div>
        )}

        {globalErr && (
          <div className="banner error" style={{ margin: "0 18px" }}>
            {globalErr}
          </div>
        )}
        {progress && progress.total > 0 && (
          <div className="progress-row">
            <div className="progress-bar">
              <div
                className="fill"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="progress-txt">
              {progress.done}/{progress.total}
            </span>
          </div>
        )}

        {items.length > 0 && (
          <div className="dfoot">
            {items.length > 1 && (
              <div className="pager">
                <button
                  className="btn ghost sm"
                  disabled={activeIdx === 0 || busy}
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  aria-label="Önceki"
                  type="button"
                >
                  ‹
                </button>
                <span className="pager-txt">
                  {activeIdx + 1} / {items.length}
                </span>
                <button
                  className="btn ghost sm"
                  disabled={activeIdx >= items.length - 1 || busy}
                  onClick={() => setActiveIdx((i) => Math.min(items.length - 1, i + 1))}
                  aria-label="Sonraki"
                  type="button"
                >
                  ›
                </button>
              </div>
            )}
            <button
              className="btn primary"
              onClick={uploadAll}
              disabled={busy || pendingCount === 0}
              type="button"
            >
              {busy
                ? "Yükleniyor..."
                : pendingCount === 0
                ? "Tümü yüklendi"
                : pendingCount > 1
                ? `${pendingCount} anıyı yükle`
                : "Anıyı kaydet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
