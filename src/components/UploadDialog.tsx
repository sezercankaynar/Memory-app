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
  status: Status;
  error?: string;
};

/**
 * Toplu mod: tüm medyalara aynı yer / tarih / not / konum uygulanır.
 * İlk EXIF konumu / tarihi ortak alanları otomatik doldurur.
 */
export default function UploadDialog({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const { album } = useAlbum();

  const [items, setItems] = useState<Item[]>([]);

  // ortak alanlar
  const [place, setPlace] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("");
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [locSource, setLocSource] = useState<"none" | "exif" | "manual">("none");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const miniMap = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const addFiles = async (fs: FileList | File[]) => {
    setGlobalErr(null);
    const arr = Array.from(fs);
    if (!arr.length) return;
    const built: Item[] = arr.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      mediaType: (f.type.startsWith("video/") ? "video" : "photo") as MediaType,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...built]);

    // İlk sefer için EXIF'ten ortak alanları önerelim
    const shouldSeed = date === "" || pos === null;
    if (!shouldSeed) return;
    for (const f of arr) {
      try {
        const meta = await extractMeta(f);
        if (date === "" && meta.takenAt) setDate(meta.takenAt.slice(0, 10));
        if (
          pos === null &&
          typeof meta.lat === "number" &&
          typeof meta.lon === "number"
        ) {
          setPos({ lat: meta.lat, lon: meta.lon });
          setLocSource("exif");
        }
        if (date !== "" && pos !== null) break;
      } catch {
        // yoksay
      }
    }
  };

  const removeAt = (idx: number) => {
    setItems((arr) => {
      const it = arr[idx];
      if (it) URL.revokeObjectURL(it.preview);
      return arr.filter((_, i) => i !== idx);
    });
  };

  // Mini harita — items varken görünür
  useEffect(() => {
    if (items.length === 0 || !mapEl.current || miniMap.current) return;
    const start: [number, number] = pos ? [pos.lon, pos.lat] : INITIAL_VIEW.center;
    const m = new mapboxgl.Map({
      container: mapEl.current,
      style: STYLE,
      center: start,
      zoom: pos ? 11 : INITIAL_VIEW.zoom,
    });
    miniMap.current = m;
    const mk = new mapboxgl.Marker({ draggable: true, color: "#c9702f" })
      .setLngLat(start)
      .addTo(m);
    markerRef.current = mk;
    mk.on("dragend", () => {
      const ll = mk.getLngLat();
      setPos({ lat: ll.lat, lon: ll.lng });
      setLocSource("manual");
    });
    m.on("click", (e) => {
      mk.setLngLat(e.lngLat);
      setPos({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      setLocSource("manual");
    });
    return () => {
      m.remove();
      miniMap.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0]);

  // pos değişince marker'ı güncelle (EXIF seed sonrası)
  useEffect(() => {
    if (!miniMap.current || !markerRef.current || !pos) return;
    markerRef.current.setLngLat([pos.lon, pos.lat]);
    miniMap.current.easeTo({ center: [pos.lon, pos.lat], zoom: 11, duration: 400 });
  }, [pos]);

  const uploadAll = async () => {
    if (!session || !album) return;
    if (items.length === 0) {
      setGlobalErr("En az bir medya seçin.");
      return;
    }
    if (!pos) {
      setGlobalErr("Konum seçin (haritaya dokunun).");
      return;
    }
    if (!date) {
      setGlobalErr("Tarih girin.");
      return;
    }
    setBusy(true);
    setGlobalErr(null);

    const pending = items
      .map((it, i) => ({ it, i }))
      .filter((x) => x.it.status !== "done");
    const takenAt = new Date(date).toISOString();
    let done = 0;

    for (const { it, i } of pending) {
      setProgress({ done, total: pending.length });
      setItems((arr) => arr.map((x, k) => (k === i ? { ...x, status: "uploading", error: undefined } : x)));
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
          place: place || null,
          lat: pos.lat,
          lon: pos.lon,
          taken_at: takenAt,
          media_url: pub.publicUrl,
          media_type: it.mediaType,
          caption: caption || null,
        });
        if (ins.error) throw ins.error;
        setItems((arr) => arr.map((x, k) => (k === i ? { ...x, status: "done" } : x)));
        done++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Yükleme başarısız.";
        setItems((arr) => arr.map((x, k) => (k === i ? { ...x, status: "error", error: msg } : x)));
      }
    }

    setProgress({ done, total: pending.length });
    setBusy(false);
    if (done === pending.length) setTimeout(onClose, 400);
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
              ? "1 anı"
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
                Birden fazla seçebilirsin · Hepsi aynı yer, tarih ve nota kaydedilir
              </div>
            </div>
          </label>
        ) : (
          <div className="dbody">
            <div className="thumbstrip">
              {items.map((it, i) => (
                <div
                  key={i}
                  className={
                    "thumb" +
                    (it.status === "done" ? " done" : "") +
                    (it.status === "error" ? " err" : "")
                  }
                  title={it.file.name}
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
                  {it.status !== "done" && !busy && (
                    <button
                      type="button"
                      className="thumb-x"
                      onClick={() => removeAt(i)}
                      aria-label="Kaldır"
                    >
                      ×
                    </button>
                  )}
                </div>
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

            <div className="dfields">
              <label>
                Yer adı
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="İstanbul · Boğaz"
                  disabled={busy}
                />
              </label>
              <label>
                Tarih
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Not
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="O anı hatırla..."
                  rows={2}
                  disabled={busy}
                />
              </label>

              <div className="locrow">
                {locSource === "exif" ? (
                  <span className="badge ok">
                    📍 İlk fotoğrafın EXIF konumu kullanıldı — gerekiyorsa haritadan düzeltin
                  </span>
                ) : locSource === "manual" ? (
                  <span className="badge ok">📍 Konum haritadan seçildi</span>
                ) : (
                  <span className="badge warn">📍 Haritaya dokunarak ortak konumu seçin</span>
                )}
              </div>
              <div ref={mapEl} className="minimap" />
              {pos && (
                <div className="coord small">
                  {pos.lat.toFixed(4)}° K, {pos.lon.toFixed(4)}° D
                </div>
              )}
            </div>
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
                ? `${pendingCount} anıyı kaydet`
                : "Anıyı kaydet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
