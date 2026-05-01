import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { keyValueStorage } from "../services/keyValueStorage";

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNote: (menuItemId: string, note: string) => void;
  removeItem: (menuItemId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user, isHydrated } = useAuth();
  const [items, setItems] = useState<CartLine[]>([]);
  const [isHydratedCart, setIsHydratedCart] = useState(false);

  const cartStorageKey = useMemo(
    () => (user ? `cart:${user.tenantId}:${user.id}` : "cart:guest"),
    [user?.tenantId, user?.id]
  );

  useEffect(() => {
    const hydrate = async () => {
      if (!isHydrated) return;
      try {
        const raw = await keyValueStorage.get(cartStorageKey);
        if (raw) {
          setItems(JSON.parse(raw) as CartLine[]);
        } else {
          setItems([]);
        }
      } finally {
        setIsHydratedCart(true);
      }
    };
    hydrate().catch(() => {
      setItems([]);
      setIsHydratedCart(true);
    });
  }, [cartStorageKey, isHydrated]);

  useEffect(() => {
    if (!isHydratedCart) return;
    keyValueStorage.set(cartStorageKey, JSON.stringify(items)).catch(() => undefined);
  }, [items, cartStorageKey, isHydratedCart]);

  const addItem = (item: Omit<CartLine, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((line) => line.menuItemId === item.menuItemId);
      if (!existing) {
        return [...prev, { ...item, quantity }];
      }
      return prev.map((line) =>
        line.menuItemId === item.menuItemId
          ? { ...line, quantity: line.quantity + quantity, note: item.note ?? line.note }
          : line
      );
    });
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((line) => line.menuItemId !== menuItemId));
      return;
    }
    setItems((prev) =>
      prev.map((line) => (line.menuItemId === menuItemId ? { ...line, quantity } : line))
    );
  };

  const updateNote = (menuItemId: string, note: string) => {
    setItems((prev) => prev.map((line) => (line.menuItemId === menuItemId ? { ...line, note } : line)));
  };

  const removeItem = (menuItemId: string) => {
    setItems((prev) => prev.filter((line) => line.menuItemId !== menuItemId));
  };

  const clearCart = () => setItems([]);

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const value = useMemo(
    () => ({ items, itemCount, subtotal, addItem, updateQuantity, updateNote, removeItem, clearCart }),
    [items, itemCount, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextValue => {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used within CartProvider");
  }
  return value;
};
