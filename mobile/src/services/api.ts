import { config } from "../constants/config";
import { keyValueStorage } from "./keyValueStorage";

type RequestOptions = {
  token?: string;
  tenantId?: string;
  tenantSlug?: string;
  method?: string;
  body?: unknown;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const runRequest = async (token?: string) => {
    try {
      return await fetch(`${config.apiBaseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.tenantId ? { "x-tenant-id": options.tenantId } : {}),
          ...(options.tenantSlug ? { "x-tenant-slug": options.tenantSlug } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch {
      throw new Error(
        `Network request failed. API base is ${config.apiBaseUrl}. Check backend server and phone/PC network.`
      );
    }
  };

  const initialToken = options.token
    ? (await keyValueStorage.get("session:accessToken")) ?? options.token
    : undefined;
  let response = await runRequest(initialToken);

  const isAuthPath = path.startsWith("/auth/");
  if (response.status === 401 && !isAuthPath) {
    const refreshToken = await keyValueStorage.get("session:refreshToken");
    if (refreshToken) {
      const refreshResponse = await fetch(`${config.apiBaseUrl}/auth/refresh-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        },
        body: JSON.stringify({ refreshToken })
      });
      const refreshJson = await refreshResponse.json().catch(() => ({}));

      if (refreshResponse.ok) {
        const nextAccessToken =
          (refreshJson as { data?: { accessToken?: string } }).data?.accessToken ?? "";
        if (nextAccessToken) {
          await keyValueStorage.set("session:accessToken", nextAccessToken);
          response = await runRequest(nextAccessToken);
        }
      } else {
        await Promise.all([
          keyValueStorage.remove("session:user"),
          keyValueStorage.remove("session:accessToken"),
          keyValueStorage.remove("session:refreshToken")
        ]);
      }
    }
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((json as { message?: string }).message ?? "Request failed");
  }

  return json as T;
};
