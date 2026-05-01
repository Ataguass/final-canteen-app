import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const normalizeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, "_");

const supportsSecureStore = async () => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export const keyValueStorage = {
  async get(key: string): Promise<string | null> {
    const safeKey = normalizeKey(key);
    if (await supportsSecureStore()) {
      return SecureStore.getItemAsync(safeKey);
    }
    return AsyncStorage.getItem(safeKey);
  },

  async set(key: string, value: string): Promise<void> {
    const safeKey = normalizeKey(key);
    if (await supportsSecureStore()) {
      await SecureStore.setItemAsync(safeKey, value);
      return;
    }
    await AsyncStorage.setItem(safeKey, value);
  },

  async remove(key: string): Promise<void> {
    const safeKey = normalizeKey(key);
    if (await supportsSecureStore()) {
      await SecureStore.deleteItemAsync(safeKey);
      return;
    }
    await AsyncStorage.removeItem(safeKey);
  }
};
