export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || "";
export const isMapboxConfigured = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk."));

/** Türkiye'yi merkezleyen başlangıç görünümü */
export const INITIAL_VIEW = { center: [35.2, 39.0] as [number, number], zoom: 4.6 };
