import { useAuth } from "./context/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import Login from "./pages/Login";
import Home from "./pages/Home";
import SetupNotice from "./components/SetupNotice";

export default function App() {
  const { session, loading } = useAuth();

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }
  return session ? <Home /> : <Login />;
}
