import { create } from "zustand";
import { keyValueStorage } from "../services/keyValueStorage";
import { useAuthStore } from "./useAuthStore";

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

type CartState = {
  items: CartLine[];
  isHydratedCart: boolean;
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNote: (menuItemId: string, note: string) => void;
  removeItem: (menuItemId: string) => void;
  clearCart: () => void;
  hydrate: () => Promise<void>;
};

const getCartStorageKey = () => {
  const user = useAuthStore.getState().user;
  return user ? `cart:${user.tenantId}:${user.id}` : "cart:guest";
};

const persistCart = async (items: CartLine[]) => {
  try {
    await keyValueStorage.set(getCartStorageKey(), JSON.stringify(items));
  } catch (e) {
    // Ignore persistence errors
  }
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isHydratedCart: false,

  addItem: (item: Omit<CartLine, "quantity">, quantity = 1) => {
    const { items } = get();
    let newItems: CartLine[];
    const existing = items.find((line) => line.menuItemId === item.menuItemId);
    
    if (!existing) {
      newItems = [...items, { ...item, quantity }];
    } else {
      newItems = items.map((line) =>
        line.menuItemId === item.menuItemId
          ? { ...line, quantity: line.quantity + quantity, note: item.note ?? line.note }
          : line
      );
    }
    
    set({ items: newItems });
    persistCart(newItems);
  },

  updateQuantity: (menuItemId: string, quantity: number) => {
    const { items } = get();
    let newItems: CartLine[];

    if (quantity <= 0) {
      newItems = items.filter((line) => line.menuItemId !== menuItemId);
    } else {
      newItems = items.map((line) => (line.menuItemId === menuItemId ? { ...line, quantity } : line));
    }
    
    set({ items: newItems });
    persistCart(newItems);
  },

  updateNote: (menuItemId: string, note: string) => {
    const { items } = get();
    const newItems = items.map((line) => (line.menuItemId === menuItemId ? { ...line, note } : line));
    set({ items: newItems });
    persistCart(newItems);
  },

  removeItem: (menuItemId: string) => {
    const { items } = get();
    const newItems = items.filter((line) => line.menuItemId !== menuItemId);
    set({ items: newItems });
    persistCart(newItems);
  },

  clearCart: () => {
    set({ items: [] });
    persistCart([]);
  },

  hydrate: async () => {
    try {
      const raw = await keyValueStorage.get(getCartStorageKey());
      if (raw) {
        set({ items: JSON.parse(raw) as CartLine[] });
      } else {
        set({ items: [] });
      }
    } catch {
      set({ items: [] });
    } finally {
      set({ isHydratedCart: true });
    }
  }
}));

// We need to re-hydrate cart when auth state changes (e.g., login/logout)
useAuthStore.subscribe((state, prevState) => {
  if (state.user?.id !== prevState.user?.id || state.isHydrated !== prevState.isHydrated) {
    if (state.isHydrated) {
      useCartStore.getState().hydrate();
    }
  }
});
