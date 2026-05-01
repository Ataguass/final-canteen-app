import Constants from "expo-constants";

const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const explicitSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

const hostFromExpo =
  Constants.expoConfig?.hostUri?.split(":")[0] ??
  ((Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra?.expoGo?.debuggerHost?.split(
    ":"
  )[0] ??
    "") ??
  ((Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost?.split(":")[0] ?? "");

const inferredSocketUrl = hostFromExpo ? `http://${hostFromExpo}:4000` : "http://localhost:4000";
const inferredApiBaseUrl = `${inferredSocketUrl}/api`;

const apiBaseUrl = explicitApiUrl || inferredApiBaseUrl;
const socketUrl = explicitSocketUrl || explicitApiUrl?.replace(/\/api$/, "") || inferredSocketUrl;

export const config = {
  apiBaseUrl,
  socketUrl
};
