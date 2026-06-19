import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  LayoutAnimation,
  Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const supportSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(50, "Subject is too long"),
  message: z.string().min(10, "Message must be at least 10 characters").max(500, "Message is too long")
});

type SupportFormData = z.infer<typeof supportSchema>;

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
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupportFormData>({
    resolver: zodResolver(supportSchema),
    defaultValues: { subject: "", message: "" }
  });

  const onSubmit = async (data: SupportFormData) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    Alert.alert(
      "Ticket Submitted",
      "Thank you for contacting support! Your message has been received and our team will look into it.",
      [{ text: "OK", onPress: () => reset() }]
    );
  };

  const toggleAccordion = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 48 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topNavTitle}>Help & Support</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>How can we help you?</Text>
          <Text style={styles.heroSub}>
            Whether you have a question about your order, pricing, or anything else, our team is ready to answer all your questions.
          </Text>
        </View>
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Send a Message</Text>
          <Text style={styles.contactSub}>We usually respond within 15 minutes.</Text>
          
          <View style={{ gap: moderateScale(16), marginTop: verticalScale(16) }}>
            <View>
              <Text style={styles.fieldLabel}>Subject</Text>
              <Controller
                control={control}
                name="subject"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[
                    styles.inputContainer, 
                    focusedField === 'subject' && { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(37, 99, 235, 0.05)' : '#EFF6FF' },
                    errors.subject && styles.inputError
                  ]}>
                    <Ionicons name="help-circle-outline" size={20} color={focusedField === 'subject' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Missing Item in Order"
                      placeholderTextColor={colors.textMuted}
                      onFocus={() => setFocusedField('subject')}
                      onBlur={() => { setFocusedField(null); onBlur(); }}
                      onChangeText={onChange}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.subject && <Text style={styles.errorText}>{errors.subject.message}</Text>}
            </View>

            <View>
              <Text style={styles.fieldLabel}>Message</Text>
              <Controller
                control={control}
                name="message"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[
                    styles.inputContainer,
                    styles.textAreaContainer,
                    focusedField === 'message' && { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(37, 99, 235, 0.05)' : '#EFF6FF' },
                    errors.message && styles.inputError
                  ]}>
                    <Ionicons name="document-text-outline" size={20} color={focusedField === 'message' ? colors.primary : colors.textMuted} style={[styles.inputIcon, { marginTop: 12 }]} />
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Describe your issue..."
                      placeholderTextColor={colors.textMuted}
                      onFocus={() => setFocusedField('message')}
                      onBlur={() => { setFocusedField(null); onBlur(); }}
                      onChangeText={onChange}
                      value={value}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                )}
              />
              {errors.message && <Text style={styles.errorText}>{errors.message.message}</Text>}
            </View>

            <Pressable 
              onPress={handleSubmit(onSubmit)} 
              style={({ pressed }) => [
                styles.submitBtn, 
                isSubmitting && styles.submitBtnDisabled,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
              ]}
              disabled={isSubmitting}
            >
              <Ionicons name="paper-plane-outline" size={18} color="white" />
              <Text style={styles.submitBtnText}>
                {isSubmitting ? "Sending..." : "Submit Ticket"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqContainer}>
            {faqs.map((faq, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <View key={idx} style={styles.faqCard}>
                  <Pressable 
                    style={[styles.faqHeader, isExpanded && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.08)' : '#F8FAFC' }]} 
                    onPress={() => toggleAccordion(idx)}
                  >
                    <Text style={[styles.faqQuestion, isExpanded && { color: colors.primary }]}>{faq.question}</Text>
                    <View style={[styles.faqIconWrap, isExpanded && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={18} 
                        color={isExpanded ? colors.primary : colors.textSecondary} 
                      />
                    </View>
                  </Pressable>
                  {isExpanded && (
                    <View style={[styles.faqBody, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.08)' : '#F8FAFC' }]}>
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

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
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
    gap: moderateScale(32)
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: verticalScale(16),
    paddingHorizontal: moderateScale(16)
  },
  heroIconWrap: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF',
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(16)
  },
  heroTitle: {
    color: colors.text,
    fontSize: fontScale(26),
    fontWeight: "900",
    textAlign: "center",
    marginBottom: verticalScale(8)
  },
  heroSub: {
    color: colors.textSecondary,
    fontSize: fontScale(15),
    textAlign: "center",
    lineHeight: 22
  },
  contactCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(24),
    padding: moderateScale(24),
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(20),
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  contactTitle: {
    fontSize: fontScale(22),
    fontWeight: "900",
    color: colors.text
  },
  contactSub: {
    color: colors.textSecondary,
    fontSize: fontScale(14),
    marginTop: verticalScale(4),
    lineHeight: 20
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: verticalScale(8),
    fontSize: fontScale(14)
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: moderateScale(14),
    overflow: "hidden"
  },
  textAreaContainer: {
    alignItems: "flex-start"
  },
  inputIcon: {
    paddingLeft: moderateScale(14),
    paddingRight: moderateScale(10)
  },
  input: {
    flex: 1,
    paddingVertical: moderateScale(14),
    paddingRight: moderateScale(16),
    color: colors.text,
    fontSize: fontScale(15)
  },
  textArea: {
    minHeight: moderateScale(120),
    paddingTop: moderateScale(14),
    paddingLeft: 0
  },
  inputError: {
    borderColor: "#EF4444"
  },
  errorText: {
    color: "#EF4444",
    fontSize: fontScale(12),
    marginTop: verticalScale(6),
    fontWeight: "600"
  },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(12),
    gap: moderateScale(8),
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    color: "white",
    fontWeight: "800",
    fontSize: fontScale(16)
  },
  section: {
    gap: moderateScale(16)
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  faqContainer: {
    gap: moderateScale(12)
  },
  faqCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    flex: 1,
    marginRight: moderateScale(16)
  },
  faqIconWrap: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  faqBody: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(16),
    paddingTop: moderateScale(4)
  },
  faqAnswer: {
    fontSize: fontScale(14),
    color: colors.textSecondary,
    lineHeight: 22
  }
});
