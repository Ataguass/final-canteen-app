import { Text, View } from "react-native";

type Props = {
  isConnected: boolean;
};

export const ConnectionBadge = ({ isConnected }: Props) => {
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: isConnected ? "#10B981" : "#EF4444",
        borderWidth: 2,
        borderColor: "white",
        shadowColor: isConnected ? "#10B981" : "#EF4444",
        shadowOpacity: 0.4,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2
      }}
    />
  );
};
