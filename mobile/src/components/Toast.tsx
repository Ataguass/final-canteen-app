import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from "react";
import { Animated, StyleSheet, Text, View, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info";

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const insets = useSafeAreaInsets();
  
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string, toastType: ToastType = "info") => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    }, 2500);
  }, [opacity, translateY]);

  const getIconName = () => {
    switch (type) {
      case "success": return "checkmark-circle";
      case "error": return "alert-circle";
      default: return "information-circle";
    }
  };

  const getColors = () => {
    switch (type) {
      case "success": return { bg: "#0F172A", text: "white", icon: "#10B981" };
      case "error": return { bg: "#FEF2F2", text: "#DC2626", icon: "#DC2626", border: "#FECACA" };
      default: return { bg: "#0F172A", text: "white", icon: "#3B82F6" };
    }
  };

  const colors = getColors();

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              top: Math.max(insets.top + 10, 20),
              transform: [{ translateY }],
              opacity,
              backgroundColor: colors.bg,
              borderColor: colors.border || colors.bg,
            },
          ]}
        >
          <Ionicons name={getIconName()} size={24} color={colors.icon} />
          <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    zIndex: 9999,
  },
  message: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
});
