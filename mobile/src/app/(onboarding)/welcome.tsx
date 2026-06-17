import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, SlideInDown, withRepeat, withTiming, withSequence, useSharedValue, Easing } from "react-native-reanimated";
import { useContext, useEffect } from "react";
import { OnboardingContext } from "../_layout";

const { width } = Dimensions.get('window');

const BRAND_COLOR = "#080d2b"; // Navy Blue from logo

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeOnboarding } = useContext(OnboardingContext);

  // Floating animations for illustration elements
  const floatY1 = useSharedValue(0);
  const floatY2 = useSharedValue(0);
  const floatY3 = useSharedValue(0);

  useEffect(() => {
    const floatConfig = { duration: 2500, easing: Easing.inOut(Easing.ease) };
    floatY1.value = withRepeat(withSequence(withTiming(-10, floatConfig), withTiming(0, floatConfig)), -1, true);
    floatY2.value = withRepeat(withSequence(withTiming(12, { ...floatConfig, duration: 2800 }), withTiming(0, { ...floatConfig, duration: 2800 })), -1, true);
    floatY3.value = withRepeat(withSequence(withTiming(-15, { ...floatConfig, duration: 2200 }), withTiming(0, { ...floatConfig, duration: 2200 })), -1, true);
  }, []);

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleNext = () => {
    router.push("/(onboarding)/ordering");
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="school-outline" size={24} color={BRAND_COLOR} />
          <Text style={styles.headerTitle}>Canteen Management</Text>
        </View>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.6}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.mainContent}>
        {/* Illustration */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.illustrationContainer}>
          <View style={styles.centerCircle}>
            <Image 
              source={require("../../assets/images/canteen_logo_final.png")} 
              style={styles.centerImage}
              resizeMode="cover"
            />
          </View>
          
          <Animated.View style={[styles.floatingBadge, styles.badgeTopLeft, { transform: [{ translateY: floatY1 }] }]}>
            <View style={[styles.iconBox, { backgroundColor: BRAND_COLOR }]}>
              <Ionicons name="restaurant" size={28} color="#fff" />
            </View>
          </Animated.View>

          <Animated.View style={[styles.floatingBadge, styles.badgeTopRight, { transform: [{ translateY: floatY2 }] }]}>
            <View style={[styles.iconBox, { backgroundColor: '#e2722b' }]}>
              <Text style={{ fontSize: 32 }}>🥗</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.floatingBadge, styles.badgeBottomLeft, { transform: [{ translateY: floatY3 }] }]}>
            <View style={[styles.iconBox, { backgroundColor: '#9e1c2e' }]}>
              <Text style={{ fontSize: 32 }}>🍕</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.floatingBadge, styles.badgeBottomRight, { transform: [{ translateY: floatY1 }] }]}>
            <View style={[styles.iconBox, { backgroundColor: '#1b1b1b' }]}>
              <Text style={{ fontSize: 32 }}>🍔</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Text */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.textContent}>
          <Text style={styles.title}>A World of Cuisines</Text>
          <Text style={styles.subtitle}>
            From quick snacks to hearty meals, explore diverse campus flavors at your fingertips.
          </Text>
        </Animated.View>

        {/* Pagination */}
        <Animated.View entering={FadeIn.delay(700)} style={styles.progressIndicators}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View entering={SlideInDown.delay(900).springify()} style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={22} color="#ffffff" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 60,
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLOR,
    letterSpacing: -0.5,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8e8e93',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 100,
    zIndex: 10,
  },
  illustrationContainer: {
    position: 'relative',
    width: width * 0.8,
    height: width * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  centerCircle: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: width * 0.275,
    backgroundColor: '#e6e8eb',
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerImage: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.275,
  },
  floatingBadge: {
    position: 'absolute',
    padding: 6,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeTopLeft: {
    top: '15%',
    left: '5%',
  },
  badgeTopRight: {
    top: '5%',
    right: '5%',
    transform: [{ rotate: '5deg' }],
  },
  badgeBottomLeft: {
    bottom: '10%',
    left: '0%',
    transform: [{ rotate: '-10deg' }],
  },
  badgeBottomRight: {
    bottom: '20%',
    right: '0%',
    transform: [{ rotate: '8deg' }],
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 16,
    width: '100%',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1c1c1e',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    color: '#6e6e73',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
    marginTop: 4,
  },
  progressIndicators: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 40,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: '#d1d1d6',
  },
  activeDot: {
    width: 24,
    backgroundColor: BRAND_COLOR,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 24,
    right: 24,
    zIndex: 20,
  },
  nextButton: {
    width: '100%',
    height: 56,
    backgroundColor: BRAND_COLOR,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    gap: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
