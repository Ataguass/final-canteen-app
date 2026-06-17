import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, SlideInDown, withRepeat, withTiming, withSequence, useAnimatedStyle, useSharedValue, Easing } from "react-native-reanimated";
import { useEffect, useContext } from "react";
import { OnboardingContext } from "../_layout";

const { width } = Dimensions.get('window');
const BRAND_COLOR = "#080d2b"; // Navy Blue from logo

export default function OrderingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useContext(OnboardingContext);
  
  const floatingY = useSharedValue(0);

  useEffect(() => {
    floatingY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const floatingStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: floatingY.value }]
    };
  });

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleNext = () => {
    router.push("/(onboarding)/tracking");
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
          <Animated.View style={[styles.phoneFrame, floatingStyle]}>
            <View style={styles.phoneScreen}>
              <View style={styles.phoneContent}>
                <View style={styles.boltBox}>
                  <Image 
                    source={require("../../assets/images/canteen_logo_final.png")} 
                    style={styles.logoInsidePhone}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.skeletonLines}>
                  <View style={[styles.skeletonLine, { width: '85%' }]} />
                  <View style={[styles.skeletonLine, { width: '55%' }]} />
                </View>
                <View style={styles.mockButton}>
                  <View style={styles.mockButtonInner} />
                </View>
              </View>
              <View style={styles.phoneTabBar}>
                <Ionicons name="home-outline" size={22} color={BRAND_COLOR} />
                <Ionicons name="search-outline" size={22} color="#8e8e93" />
                <Ionicons name="cart-outline" size={22} color="#8e8e93" />
              </View>
            </View>
          </Animated.View>
          
          <View style={styles.decorativeCircleBlur} />
          <View style={styles.decorativeCircleOutline} />
        </Animated.View>

        {/* Text */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.textContent}>
          <Text style={styles.title}>Order in Seconds</Text>
          <Text style={styles.subtitle}>
            Save your favorites and reorder with a single tap for ultimate convenience.
          </Text>
        </Animated.View>

        {/* Pagination */}
        <Animated.View entering={FadeIn.delay(700)} style={styles.progressIndicators}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
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
    width: '100%',
    aspectRatio: 4/5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  phoneFrame: {
    width: 220,
    height: 450,
    backgroundColor: '#2e3132',
    borderRadius: 40,
    padding: 6,
    borderWidth: 6,
    borderColor: '#3a3d3e',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    zIndex: 20,
  },
  phoneScreen: {
    backgroundColor: '#ffffff',
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  phoneContent: {
    padding: 20,
    gap: 16,
    paddingTop: 32,
  },
  boltBox: {
    width: '100%',
    height: 140,
    backgroundColor: 'transparent',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoInsidePhone: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  skeletonLines: {
    gap: 12,
    marginBottom: 16,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#e6e8eb',
    borderRadius: 8,
  },
  mockButton: {
    padding: 14,
    backgroundColor: BRAND_COLOR,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mockButtonInner: {
    height: 6,
    width: 48,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
  },
  phoneTabBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f5',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
  },
  decorativeCircleBlur: {
    position: 'absolute',
    width: 280,
    height: 280,
    backgroundColor: 'rgba(8, 13, 43, 0.04)',
    borderRadius: 140,
    zIndex: 10,
  },
  decorativeCircleOutline: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderWidth: 1,
    borderColor: 'rgba(8, 13, 43, 0.05)',
    borderRadius: 170,
    zIndex: 10,
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
