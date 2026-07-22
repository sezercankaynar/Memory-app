import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type { Album, Memory, Profile } from "../types";

interface AlbumValue {
  album: Album | null;
  members: Profile[];
  memories: Memory[];
  loading: boolean;
  createAlbum: (name: string) => Promise<{ error?: string }>;
  joinAlbum: (code: string) => Promise<{ error?: string }>;
  reload: () => Promise<void>;
}

const AlbumCtx = createContext<AlbumValue | null>(null);

export function AlbumProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembersAndMemories = useCallback(async (albumId: string) => {
    const { data: memberRows } = await supabase
      .from("album_members")
      .select("user_id, profiles(*)")
      .eq("album_id", albumId);
    const profs = (memberRows || [])
      .map((r: { profiles: Profile | Profile[] | null }) =>
        Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
      )
      .filter(Boolean) as Profile[];
    setMembers(profs);

    const { data: memRows } = await supabase
      .from("memories")
      .select("*")
      .eq("album_id", albumId)
      .order("taken_at", { ascending: true });
    const byId = new Map(profs.map((p) => [p.id, p]));
    setMemories(
      (memRows || []).map((m: Memory) => ({ ...m, author: byId.get(m.user_id) })),
    );
  }, []);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data: membership } = await supabase
      .from("album_members")
      .select("album_id, albums(*)")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    const alb = membership
      ? ((Array.isArray(membership.albums) ? membership.albums[0] : membership.albums) as Album)
      : null;
    setAlbum(alb);
    if (alb) await loadMembersAndMemories(alb.id);
    setLoading(false);
  }, [session, loadMembersAndMemories]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Canlı güncelleme: partner yeni anı eklerse anında görünür
  useEffect(() => {
    if (!album) return;
    const channel = supabase
      .channel("memories-" + album.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memories", filter: `album_id=eq.${album.id}` },
        () => loadMembersAndMemories(album.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [album, loadMembersAndMemories]);

  const createAlbum: AlbumValue["createAlbum"] = async (name) => {
    if (!session) return { error: "Oturum yok" };
    const { data, error } = await supabase
      .from("albums")
      .insert({ name: name || "Rotamız", created_by: session.user.id })
      .select()
      .single();
    if (error) return { error: error.message };
    const { error: mErr } = await supabase
      .from("album_members")
      .insert({ album_id: data.id, user_id: session.user.id });
    if (mErr) return { error: mErr.message };
    await reload();
    return {};
  };

  const joinAlbum: AlbumValue["joinAlbum"] = async (code) => {
    if (!session) return { error: "Oturum yok" };
    const { error } = await supabase
      .from("album_members")
      .insert({ album_id: code.trim(), user_id: session.user.id });
    if (error) return { error: "Katılınamadı. Kodu kontrol edin: " + error.message };
    await reload();
    return {};
  };

  return (
    <AlbumCtx.Provider
      value={{ album, members, memories, loading, createAlbum, joinAlbum, reload }}
    >
      {children}
    </AlbumCtx.Provider>
  );
}

export function useAlbum() {
  const ctx = useContext(AlbumCtx);
  if (!ctx) throw new Error("useAlbum must be used within AlbumProvider");
  return ctx;
}
