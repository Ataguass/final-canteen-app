import { create } from "zustand";
import { keyValueStorage } from "../services/keyValueStorage";
import { useAuthStore } from "./useAuthStore";

type FavoritesState = {
  favorites: string[];
  isHydrated: boolean;
  addFavorite: (menuItemId: string) => void;
  removeFavorite: (menuItemId: string) => void;
  isFavorite: (menuItemId: string) => boolean;
  hydrate: () => Promise<void>;
};

const getFavoritesStorageKey = () => {
  const user = useAuthStore.getState().user;
  return user ? `favorites:${user.tenantId}:${user.id}` : "favorites:guest";
};

const persistFavorites = async (favorites: string[]) => {
  try {
    await keyValueStorage.set(getFavoritesStorageKey(), JSON.stringify(favorites));
  } catch (e) {
    // Ignore persistence errors
  }
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  isHydrated: false,

  addFavorite: (menuItemId: string) => {
    const { favorites } = get();
    if (!favorites.includes(menuItemId)) {
      const newFavorites = [...favorites, menuItemId];
      set({ favorites: newFavorites });
      persistFavorites(newFavorites);
    }
  },

  removeFavorite: (menuItemId: string) => {
    const { favorites } = get();
    const newFavorites = favorites.filter((id) => id !== menuItemId);
    set({ favorites: newFavorites });
    persistFavorites(newFavorites);
  },

  isFavorite: (menuItemId: string) => {
    return get().favorites.includes(menuItemId);
  },

  hydrate: async () => {
    try {
      const raw = await keyValueStorage.get(getFavoritesStorageKey());
      if (raw) {
        set({ favorites: JSON.parse(raw) as string[] });
      } else {
        set({ favorites: [] });
      }
    } catch {
      set({ favorites: [] });
    } finally {
      set({ isHydrated: true });
    }
  }
}));

// Hydrate on auth state changes
useAuthStore.subscribe((state, prevState) => {
  if (state.user?.id !== prevState.user?.id || state.isHydrated !== prevState.isHydrated) {
    if (state.isHydrated) {
      useFavoritesStore.getState().hydrate();
    }
  }
});
