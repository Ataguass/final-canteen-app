import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  LayoutAnimation
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

const faqs = [
  {
    question: "How do I cancel my order?",
    answer: "You can cancel your order within 2 minutes of placing it from the Orders screen. After the canteen starts preparing it, cancellation is no longer possible."
  },
  {
    question: "Can I pay using cash?",
    answer: "No, currently the canteen only accepts pre-paid online orders via UPI or Campus Wallet to ensure faster checkout lines."
  },
  {
    question: "What happens if my food is missing?",
    answer: "Please reach out to the canteen staff directly at the counter with your Order ID, or use the 'Contact Administration' button below to report an issue."
  }
];

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 48 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.topNavTitle}>Help & Support</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="headset" size={24} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Need immediate help?</Text>
              <Text style={styles.contactSub}>Reach out to the canteen administration for order issues.</Text>
            </View>
          </View>
          <Pressable style={styles.contactBtn} android_ripple={{ color: "#EA580C" }}>
            <Ionicons name="call" size={18} color="white" />
            <Text style={styles.contactBtnText}>Call Administration</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqContainer}>
            {faqs.map((faq, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <View key={idx} style={styles.faqCard}>
                  <Pressable 
                    style={styles.faqHeader} 
                    onPress={() => toggleAccordion(idx)}
                  >
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#64748B" 
                    />
                  </Pressable>
                  {isExpanded && (
                    <View style={styles.faqBody}>
                      <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  topNavTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: "#0F172A"
  },
  content: {
    padding: moderateScale(16),
    paddingBottom: verticalScale(40),
    gap: moderateScale(32)
  },
  contactCard: {
    backgroundColor: "#0F172A",
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    gap: moderateScale(16),
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(16),
    shadowOffset: { width: 0, height: 6 },
    elevation: 5
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16)
  },
  contactIconWrap: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center"
  },
  contactTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: "white"
  },
  contactSub: {
    color: "#94A3B8",
    fontSize: fontScale(13),
    marginTop: verticalScale(4),
    lineHeight: 18
  },
  contactBtn: {
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12)
  },
  contactBtnText: {
    color: "white",
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  section: {
    gap: moderateScale(16)
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: "#0F172A"
  },
  faqContainer: {
    gap: moderateScale(12)
  },
  faqCard: {
    backgroundColor: "white",
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: moderateScale(16)
  },
  faqQuestion: {
    fontSize: fontScale(15),
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    marginRight: moderateScale(16)
  },
  faqBody: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(16),
    paddingTop: 0
  },
  faqAnswer: {
    fontSize: fontScale(14),
    color: "#475569",
    lineHeight: 22
  }
});
