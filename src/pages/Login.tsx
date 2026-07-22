import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    const res =
      mode === "in"
        ? await signIn(email, password)
        : await signUp(email, password, name || email.split("@")[0]);
    setBusy(false);
    if (res.error) setErr(res.error);
    else if (mode === "up") setInfo("Kayıt alındı. E-postanızı doğrulayıp giriş yapın.");
  };

  return (
    <div className="center-screen auth-bg">
      <form className="card auth" onSubmit={submit}>
        <div className="logo">
          Rota<span>·</span>mız
        </div>
        <p className="tagline">İkinizin ortak anı haritası</p>

        {mode === "up" && (
          <label>
            Görünen ad
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sezer" />
          </label>
        )}
        <label>
          E-posta
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
          />
        </label>
        <label>
          Parola
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {err && <div className="banner error">{err}</div>}
        {info && <div className="banner info">{info}</div>}

        <button className="btn primary" disabled={busy}>
          {busy ? "..." : mode === "in" ? "Giriş yap" : "Kayıt ol"}
        </button>

        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setErr(null);
            setInfo(null);
          }}
        >
          {mode === "in" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </form>
    </div>
  );
}
