import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import { keyValueStorage } from "../services/keyValueStorage";

type User = {
  id: string;
  name: string;
  role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "STAFF" | "GUEST";
  tenantId: string;
  email?: string | null;
  phone?: string | null;
  rollNumber?: string | null;
  isActive?: boolean;
  isApproved?: boolean;
};

type PendingRegistration = {
  tenantId: string;
  name: string;
  phone: string;
  password: string;
  rollNumber?: string;
};

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isHydrated: boolean;
  pendingRegistration: PendingRegistration | null;
  setPendingRegistration: (value: PendingRegistration | null) => void;
  setSessionUser: (nextUser: User) => Promise<void>;
  login: (tenantId: string, phone: string, password: string) => Promise<void>;
  registerAfterOtp: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);

  const sanitizeUser = useCallback((raw: Partial<User>): User => {
    if (!raw.id || !raw.name || !raw.role || !raw.tenantId) {
      throw new Error("Invalid user session");
    }
    return {
      id: raw.id,
      name: raw.name,
      role: raw.role,
      tenantId: raw.tenantId,
      email: raw.email ?? null,
      phone: raw.phone ?? null,
      rollNumber: raw.rollNumber ?? null,
      isActive: raw.isActive,
      isApproved: raw.isApproved
    };
  }, []);

  const persistSession = useCallback(async (nextUser: User, accessToken: string, refreshToken: string) => {
    await Promise.all([
      keyValueStorage.set("session:user", JSON.stringify(nextUser)),
      keyValueStorage.set("session:accessToken", accessToken),
      keyValueStorage.set("session:refreshToken", refreshToken)
    ]);
  }, []);

  const clearSession = useCallback(async () => {
    await Promise.all([
      keyValueStorage.remove("session:user"),
      keyValueStorage.remove("session:accessToken"),
      keyValueStorage.remove("session:refreshToken")
    ]);
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [savedUser, savedToken] = await Promise.all([
          keyValueStorage.get("session:user"),
          keyValueStorage.get("session:accessToken")
        ]);
        if (savedUser && savedToken) {
          setUser(sanitizeUser(JSON.parse(savedUser) as Partial<User>));
          setAccessToken(savedToken);
        }
      } finally {
        setIsHydrated(true);
      }
    };
    hydrate().catch(() => setIsHydrated(true));
  }, []);

  const setSessionUser = useCallback(async (nextUser: User) => {
    const sanitized = sanitizeUser(nextUser);
    setUser(sanitized);
    await keyValueStorage.set("session:user", JSON.stringify(sanitized));
  }, [sanitizeUser]);

  const login = useCallback(async (tenantId: string, phone: string, password: string) => {
    const response = await authService.login({ tenantId, phone, password });
    const nextUser = sanitizeUser(response.data.user);
    setUser(nextUser);
    setAccessToken(response.data.accessToken);
    await persistSession(nextUser, response.data.accessToken, response.data.refreshToken);
  }, [persistSession, sanitizeUser]);

  const registerAfterOtp = useCallback(async (code: string) => {
    if (!pendingRegistration) {
      throw new Error("Registration session missing");
    }

    await authService.verifyOtp(pendingRegistration.tenantId, pendingRegistration.phone, code);
    const response = await authService.registerStudent(pendingRegistration);
    const nextUser = sanitizeUser(response.data.user);
    setUser(nextUser);
    setAccessToken(response.data.accessToken);
    setPendingRegistration(null);
    await persistSession(nextUser, response.data.accessToken, response.data.refreshToken);
  }, [pendingRegistration, persistSession, sanitizeUser]);

  const logout = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    setPendingRegistration(null);
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isHydrated,
      pendingRegistration,
      setPendingRegistration,
      setSessionUser,
      login,
      registerAfterOtp,
      logout
    }),
    [user, accessToken, isHydrated, pendingRegistration, setSessionUser, login, registerAfterOtp, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
};
