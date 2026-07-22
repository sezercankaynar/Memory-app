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

export default function UploadDialog({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const { album } = useAlbum();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [mediaType, setMediaType] = useState<MediaType>("photo");
  const [place, setPlace] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("");
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [hasExifLoc, setHasExifLoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const miniMap = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // dosya seçilince EXIF oku
  const onPick = async (f: File) => {
    setErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMediaType(f.type.startsWith("video/") ? "video" : "photo");
    const meta = await extractMeta(f);
    if (meta.takenAt) setDate(meta.takenAt.slice(0, 10));
    if (typeof meta.lat === "number" && typeof meta.lon === "number") {
      setPos({ lat: meta.lat, lon: meta.lon });
      setHasExifLoc(true);
    } else {
      setHasExifLoc(false);
    }
  };

  // mini konum haritası
  useEffect(() => {
    if (!file || !mapEl.current || miniMap.current) return;
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
    marker.current = mk;
    if (pos) setPos(pos);
    mk.on("dragend", () => {
      const ll = mk.getLngLat();
      setPos({ lat: ll.lat, lon: ll.lng });
    });
    m.on("click", (e) => {
      mk.setLngLat(e.lngLat);
      setPos({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });
    return () => {
      m.remove();
      miniMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const submit = async () => {
    if (!file || !session || !album) return;
    if (!pos) {
      setErr("Lütfen haritadan konum seçin.");
      return;
    }
    if (!date) {
      setErr("Lütfen tarih girin.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);

      const ins = await supabase.from("memories").insert({
        album_id: album.id,
        user_id: session.user.id,
        place: place || null,
        lat: pos.lat,
        lon: pos.lon,
        taken_at: new Date(date).toISOString(),
        media_url: pub.publicUrl,
        media_type: mediaType,
        caption: caption || null,
      });
      if (ins.error) throw ins.error;
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
        <div className="dhead">
          <h2>Anı ekle</h2>
          <button className="close dark" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {!file ? (
          <label className="dropzone">
            <input
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
            <div className="dz-inner">
              <div className="dz-icon">📷</div>
              <div>Fotoğraf veya video seç</div>
              <div className="muted">Konum ve tarih EXIF'ten otomatik okunur</div>
            </div>
          </label>
        ) : (
          <div className="dbody">
            <div className="dpreview">
              {mediaType === "video" ? (
                <video src={preview} controls className="cover" />
              ) : (
                <img src={preview} alt="" className="cover" />
              )}
            </div>

            <div className="dfields">
              <label>
                Yer adı
                <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="İstanbul · Boğaz" />
              </label>
              <label>
                Tarih
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                Not
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="O anı hatırla..."
                  rows={2}
                />
              </label>

              <div className="locrow">
                {hasExifLoc ? (
                  <span className="badge ok">📍 Konum fotoğraftan okundu — gerekiyorsa haritadan düzeltin</span>
                ) : (
                  <span className="badge warn">📍 Konum bulunamadı — haritadan seçin</span>
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

        {err && <div className="banner error">{err}</div>}

        {file && (
          <div className="dfoot">
            <button className="btn ghost" onClick={() => setFile(null)} disabled={busy}>
              Değiştir
            </button>
            <button className="btn primary" onClick={submit} disabled={busy}>
              {busy ? "Yükleniyor..." : "Anıyı kaydet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
