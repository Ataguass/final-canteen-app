import { Text, View } from "react-native";

type Props = {
  isConnected: boolean;
};

export const ConnectionBadge = ({ isConnected }: Props) => {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: isConnected ? "#065F46" : "#991B1B",
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10
      }}
    >
      <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>
        {isConnected ? "Online" : "Offline"}
      </Text>
    </View>
  );
};
