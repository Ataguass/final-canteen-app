import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    NetInfo.fetch().then((state) => {
      setIsConnected(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return () => subscription();
  }, []);

  return { isConnected };
};
