import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useAlbum } from "../context/AlbumContext";
import { MAPBOX_TOKEN } from "../lib/config";
import type { Memory } from "../types";

mapboxgl.accessToken = MAPBOX_TOKEN;

const prefersDark =
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
const STYLE = prefersDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";

export default function EditMemoryDialog({
  memory,
  onClose,
}: {
  memory: Memory;
  onClose: () => void;
}) {
  const { updateMemory } = useAlbum();

  const [place, setPlace] = useState(memory.place || "");
  const [caption, setCaption] = useState(memory.caption || "");
  const [date, setDate] = useState(memory.taken_at.slice(0, 10));
  const [pos, setPos] = useState<{ lat: number; lon: number }>({
    lat: memory.lat,
    lon: memory.lon,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const miniMap = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapEl.current || miniMap.current) return;
    const start: [number, number] = [pos.lon, pos.lat];
    const m = new mapboxgl.Map({
      container: mapEl.current,
      style: STYLE,
      center: start,
      zoom: 11,
    });
    miniMap.current = m;
    const mk = new mapboxgl.Marker({ draggable: true, color: "#c9702f" })
      .setLngLat(start)
      .addTo(m);
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
  }, []);

  const save = async () => {
    if (!date) {
      setErr("Tarih girin.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await updateMemory(memory, {
      place: place || null,
      caption: caption || null,
      lat: pos.lat,
      lon: pos.lon,
      taken_at: new Date(date).toISOString(),
    });
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    onClose();
  };

  return (
    <div className="scrim" onClick={(e) => !busy && e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
        <div className="dhead">
          <h2>Anıyı düzenle</h2>
          <button className="close dark" onClick={onClose} disabled={busy} aria-label="Kapat">
            ×
          </button>
        </div>

        <div className="dbody">
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
              <span className="badge ok">📍 Konumu haritadan güncelleyebilirsin</span>
            </div>
            <div ref={mapEl} className="minimap" />
            <div className="coord small">
              {pos.lat.toFixed(4)}° K, {pos.lon.toFixed(4)}° D
            </div>
          </div>
        </div>

        {err && (
          <div className="banner error" style={{ margin: "0 18px" }}>
            {err}
          </div>
        )}

        <div className="dfoot">
          <button className="btn ghost" onClick={onClose} disabled={busy} type="button">
            Vazgeç
          </button>
          <button className="btn primary" onClick={save} disabled={busy} type="button">
            {busy ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
