export type MediaType = "photo" | "video";

export interface Profile {
  id: string;
  display_name: string;
  color: string; // hex, harita/iğne rengi
}

export interface Album {
  id: string;
  name: string;
  created_by: string;
}

export interface Memory {
  id: string;
  album_id: string;
  user_id: string;
  place: string | null;
  lat: number;
  lon: number;
  taken_at: string; // ISO tarih
  media_url: string;
  media_type: MediaType;
  caption: string | null;
  created_at: string;
  // istemci tarafında doldurulur
  author?: Profile;
}
