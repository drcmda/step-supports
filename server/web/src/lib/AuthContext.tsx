import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchMe, type User, type License } from "./auth";

interface AuthContextValue {
  user: User | null;
  license: License | null;
  freeRemaining: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  license: null,
  freeRemaining: 0,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [freeRemaining, setFreeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const state = await fetchMe();
    setUser(state.user);
    setLicense(state.license);
    setFreeRemaining(state.freeRemaining);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, license, freeRemaining, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
