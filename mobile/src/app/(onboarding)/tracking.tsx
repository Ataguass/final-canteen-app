import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, SlideInDown } from "react-native-reanimated";
import { useContext } from "react";
import { OnboardingContext } from "../_layout";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const { width } = Dimensions.get('window');
const BRAND_COLOR = "#080d2b"; // Navy Blue from logo

export default function TrackingScreen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { completeOnboarding } = useContext(OnboardingContext);

  const handleFinish = async () => {
    await completeOnboarding();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="school-outline" size={24} color={isDark ? colors.text : BRAND_COLOR} />
          <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>Canteen Management</Text>
        </View>
        <TouchableOpacity onPress={handleFinish} activeOpacity={0.6}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.mainContent}>
        {/* Illustration */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.illustrationContainer}>
          <View style={styles.logoCard}>
            <Image 
              source={require("../../assets/images/canteen_logo_final.png")} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.textContent}>
          <Text style={styles.title}>
            Manage Your <Text style={[styles.titleHighlight, isDark && { color: colors.text }]}>Canteen Life</Text>
          </Text>
          <Text style={styles.subtitle}>
            Streamline your food journey and stay organized with ease.
          </Text>
        </Animated.View>

        {/* Pagination */}
        <Animated.View entering={FadeIn.delay(700)} style={styles.progressIndicators}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View entering={SlideInDown.delay(900).springify()} style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleFinish} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={22} color="#ffffff" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(24),
    height: moderateScale(60),
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  headerTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    color: BRAND_COLOR,
    letterSpacing: -0.5,
  },
  skipText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: colors.textMuted,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(24),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(100),
    zIndex: 10,
  },
  illustrationContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(40),
  },
  logoCard: {
    width: width * 0.65,
    height: width * 0.65,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(48),
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    gap: moderateScale(16),
    width: '100%',
  },
  title: {
    fontSize: fontScale(34),
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -1,
  },
  titleHighlight: {
    color: BRAND_COLOR,
  },
  subtitle: {
    fontSize: fontScale(17),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: moderateScale(320),
    marginTop: verticalScale(4),
  },
  progressIndicators: {
    flexDirection: 'row',
    gap: moderateScale(10),
    marginTop: verticalScale(40),
  },
  dot: {
    height: moderateScale(8),
    width: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: colors.border,
  },
  activeDot: {
    width: moderateScale(24),
    backgroundColor: BRAND_COLOR,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: moderateScale(24),
    right: moderateScale(24),
    zIndex: 20,
  },
  nextButton: {
    width: '100%',
    height: moderateScale(56),
    backgroundColor: BRAND_COLOR,
    borderRadius: moderateScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(16),
    gap: moderateScale(8),
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: fontScale(18),
    fontWeight: '700',
  },
});
