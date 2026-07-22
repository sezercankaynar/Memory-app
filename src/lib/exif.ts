import exifr from "exifr";

export interface ExtractedMeta {
  lat?: number;
  lon?: number;
  takenAt?: string; // ISO
}

/**
 * Bir fotoğraf dosyasından GPS konumu ve çekim tarihini okur.
 * Video ve konumsuz fotoğraflar için alanlar boş döner; kullanıcı
 * haritadan elle seçer.
 */
export async function extractMeta(file: File): Promise<ExtractedMeta> {
  const out: ExtractedMeta = {};
  try {
    if (file.type.startsWith("image/")) {
      const data = await exifr.parse(file, {
        gps: true,
        pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate"],
      });
      if (data) {
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          out.lat = data.latitude;
          out.lon = data.longitude;
        }
        const d: Date | undefined = data.DateTimeOriginal || data.CreateDate;
        if (d instanceof Date && !isNaN(d.getTime())) out.takenAt = d.toISOString();
      }
    }
  } catch {
    // EXIF yoksa sessizce geç — kullanıcı elle girer
  }
  // Son çare: dosyanın değiştirilme tarihi
  if (!out.takenAt && file.lastModified) {
    out.takenAt = new Date(file.lastModified).toISOString();
  }
  return out;
}
