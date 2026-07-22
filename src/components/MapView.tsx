import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { GeoJSONSource, MapMouseEvent } from "mapbox-gl";
import type { Memory } from "../types";
import { MAPBOX_TOKEN, INITIAL_VIEW } from "../lib/config";

mapboxgl.accessToken = MAPBOX_TOKEN;

const prefersDark =
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
const STYLE = prefersDark
  ? "mapbox://styles/mapbox/dark-v11"
  : "mapbox://styles/mapbox/light-v11";

type FC = GeoJSON.FeatureCollection<GeoJSON.Point>;

function toGeoJSON(memories: Memory[]): FC {
  return {
    type: "FeatureCollection",
    features: memories.map((m) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: {
        id: m.id,
        color: m.author?.color || "#c9702f",
        thumb: m.media_type === "photo" ? m.media_url : "",
        video: m.media_type === "video" ? 1 : 0,
      },
    })),
  };
}

export default function MapView({
  memories,
  onOpen,
}: {
  memories: Memory[];
  onOpen: (items: Memory[], index: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Record<string, mapboxgl.Marker>>({});
  const byId = useRef<Map<string, Memory>>(new Map());
  const memRef = useRef<Memory[]>(memories);
  memRef.current = memories;

  // kurulum (bir kez)
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      attributionControl: true,
    });
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    m.on("load", () => {
      m.addSource("memories", {
        type: "geojson",
        data: toGeoJSON(memRef.current),
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 15,
      });
      // görünmez yardımcı katmanlar (querySourceFeatures için gereklidir)
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "memories",
        filter: ["has", "point_count"],
        paint: { "circle-radius": 1, "circle-opacity": 0 },
      });
      m.addLayer({
        id: "points",
        type: "circle",
        source: "memories",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 1, "circle-opacity": 0 },
      });
      m.on("render", updateMarkers);
      updateMarkers();
    });

    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // veri değişince kaynağı güncelle
  useEffect(() => {
    byId.current = new Map(memories.map((x) => [x.id, x]));
    const src = map.current?.getSource("memories") as GeoJSONSource | undefined;
    if (src) src.setData(toGeoJSON(memories));
  }, [memories]);

  // HTML işaretçilerini (thumbnail iğne + küme rozeti) senkronla
  function updateMarkers() {
    const m = map.current;
    if (!m || !m.isSourceLoaded("memories")) return;
    const src = m.getSource("memories") as GeoJSONSource;
    const features = m.querySourceFeatures("memories");
    const seen = new Set<string>();

    for (const f of features) {
      const p = f.properties as Record<string, unknown>;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];

      if (p.cluster) {
        const key = "c" + p.cluster_id;
        seen.add(key);
        if (!markers.current[key]) {
          const el = document.createElement("button");
          el.className = "map-cluster";
          el.innerHTML = `<span class="n"></span><span class="lbl">foto</span>`;
          el.addEventListener("click", () => {
            src.getClusterLeaves(p.cluster_id as number, Infinity, 0, (err, leaves) => {
              if (err || !leaves) return;
              const items = leaves
                .map((l) => byId.current.get((l.properties as { id: string }).id))
                .filter(Boolean) as Memory[];
              items.sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1));
              if (items.length) onOpen(items, 0);
            });
          });
          markers.current[key] = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(m);
        }
        const count = p.point_count as number;
        const el = markers.current[key].getElement();
        el.querySelector(".n")!.textContent = count >= 9 ? "9+" : String(count);
        el.classList.toggle("big", count >= 9);
        markers.current[key].setLngLat(coords);
      } else {
        const id = p.id as string;
        const key = "p" + id;
        seen.add(key);
        if (!markers.current[key]) {
          const el = document.createElement("button");
          el.className = "map-pin";
          el.style.setProperty("--c", (p.color as string) || "#c9702f");
          if (p.thumb) el.style.backgroundImage = `url("${p.thumb as string}")`;
          if (p.video) el.classList.add("is-video");
          el.addEventListener("click", () => {
            const mem = byId.current.get(id);
            if (mem) onOpen([mem], 0);
          });
          markers.current[key] = new mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat(coords)
            .addTo(m);
        }
        markers.current[key].setLngLat(coords);
      }
    }

    // görünmeyen işaretçileri kaldır
    for (const key of Object.keys(markers.current)) {
      if (!seen.has(key)) {
        markers.current[key].remove();
        delete markers.current[key];
      }
    }
  }

  // yakınlaştırmak için kümeye tıklama alternatifi (çift tık davranışı)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const onClusterDbl = (e: MapMouseEvent) => {
      const feats = m.queryRenderedFeatures(e.point, { layers: ["clusters"] });
      if (!feats.length) return;
      const cid = feats[0].properties?.cluster_id;
      const src = m.getSource("memories") as GeoJSONSource;
      src.getClusterExpansionZoom(cid, (err, zoom) => {
        if (err || zoom == null) return;
        m.easeTo({ center: (feats[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
    };
    m.on("dblclick", "clusters", onClusterDbl);
    return () => {
      m.off("dblclick", "clusters", onClusterDbl);
    };
  }, []);

  return <div ref={container} className="map-root" />;
}
