import { create } from "zustand";
import { authService } from "../services/authService";
import { keyValueStorage } from "../services/keyValueStorage";
import { User } from "../types/user";

type PendingRegistration = {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  rollNumber?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isHydrated: boolean;
  pendingRegistration: PendingRegistration | null;
  confirmationResult: any;

  setPendingRegistration: (value: PendingRegistration | null) => void;
  setConfirmationResult: (value: any) => void;
  setSessionUser: (nextUser: User) => Promise<void>;
  login: (phone: string, rollNumber: string | undefined, password: string, isAdminLogin?: boolean) => Promise<void>;
  registerAfterOtp: (firebaseIdToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

const sanitizeUser = (raw: Partial<User>): User => {
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
};

const persistSession = async (nextUser: User, accessToken: string, refreshToken: string) => {
  await Promise.all([
    keyValueStorage.set("session:user", JSON.stringify(nextUser)),
    keyValueStorage.set("session:accessToken", accessToken),
    keyValueStorage.set("session:refreshToken", refreshToken)
  ]);
};

const clearSession = async () => {
  await Promise.all([
    keyValueStorage.remove("session:user"),
    keyValueStorage.remove("session:accessToken"),
    keyValueStorage.remove("session:refreshToken")
  ]);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isHydrated: false,
  pendingRegistration: null,
  confirmationResult: null,

  setPendingRegistration: (value) => set({ pendingRegistration: value }),
  setConfirmationResult: (value) => set({ confirmationResult: value }),

  setSessionUser: async (nextUser: User) => {
    const sanitized = sanitizeUser(nextUser);
    set({ user: sanitized });
    await keyValueStorage.set("session:user", JSON.stringify(sanitized));
  },

  login: async (phone: string, rollNumber: string | undefined, password: string, isAdminLogin?: boolean) => {
    const response = await authService.login({ phone, rollNumber, password, isAdminLogin });
    const nextUser = sanitizeUser(response.data.user);
    set({ user: nextUser, accessToken: response.data.accessToken });
    await persistSession(nextUser, response.data.accessToken, response.data.refreshToken);
  },

  registerAfterOtp: async (firebaseIdToken: string) => {
    const { pendingRegistration } = get();
    if (!pendingRegistration) {
      throw new Error("Registration session missing");
    }

    const payload = {
      ...pendingRegistration,
      firebaseIdToken
    };

    const response = await authService.registerStudent(payload);
    const nextUser = sanitizeUser(response.data.user);
    set({
      user: nextUser,
      accessToken: response.data.accessToken,
      pendingRegistration: null,
      confirmationResult: null,
    });
    await persistSession(nextUser, response.data.accessToken, response.data.refreshToken);
  },

  logout: async () => {
    set({
      user: null,
      accessToken: null,
      pendingRegistration: null,
    });
    await clearSession();
  },

  hydrate: async () => {
    try {
      const [savedUser, savedToken] = await Promise.all([
        keyValueStorage.get("session:user"),
        keyValueStorage.get("session:accessToken")
      ]);
      if (savedUser && savedToken) {
        set({
          user: sanitizeUser(JSON.parse(savedUser) as Partial<User>),
          accessToken: savedToken,
        });
      }
    } finally {
      set({ isHydrated: true });
    }
  }
}));

// Hydrate should be called inside a useEffect in the root layout to prevent native module deadlocks on startup.
