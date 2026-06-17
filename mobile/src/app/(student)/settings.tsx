import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { colors, isDark, toggleTheme } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [notifications, setNotifications] = useState(true);

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 48 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topNavTitle}>Settings</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>

            
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="moon" size={20} color={colors.text} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Dark Mode</Text>
                  <Text style={styles.rowSubtitle}>App appearance</Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.card}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(234, 88, 12, 0.2)" : "#FFF7ED" }]}>
                  <Ionicons name="notifications" size={20} color={isDark ? "#FDBA74" : "#EA580C"} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Push Notifications</Text>
                  <Text style={styles.rowSubtitle}>Order status & updates</Text>
                </View>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.border, true: "#FF6B35" }}
                thumbColor={colors.card}
              />
            </View>
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={[styles.card, { borderColor: isDark ? "rgba(220, 38, 38, 0.4)" : "#FECACA" }]}>
            <Pressable style={styles.actionRow} android_ripple={{ color: isDark ? "rgba(220, 38, 38, 0.2)" : "#FEF2F2" }}>
              <Text style={styles.dangerText}>Delete Account</Text>
              <Ionicons name="trash-outline" size={20} color={isDark ? "#F87171" : "#DC2626"} />
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(10)
  },
  backBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  topNavTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  content: {
    padding: moderateScale(16),
    paddingBottom: verticalScale(40),
    gap: moderateScale(24)
  },
  section: {
    gap: moderateScale(12)
  },
  sectionTitle: {
    fontSize: fontScale(14),
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: moderateScale(4)
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: "hidden"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: moderateScale(16)
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(12)
  },
  iconWrap: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(10),
    alignItems: "center",
    justifyContent: "center"
  },
  rowTitle: {
    fontSize: fontScale(15),
    fontWeight: "700",
    color: colors.text
  },
  rowSubtitle: {
    fontSize: fontScale(12),
    color: colors.textSecondary,
    marginTop: verticalScale(2)
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceAlt,
    marginLeft: moderateScale(64)
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: moderateScale(16)
  },
  actionText: {
    fontSize: fontScale(15),
    fontWeight: "700",
    color: colors.text
  },
  dangerText: {
    fontSize: fontScale(15),
    fontWeight: "700",
    color: isDark ? "#F87171" : "#DC2626"
  }
});
