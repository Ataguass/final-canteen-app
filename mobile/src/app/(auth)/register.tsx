import auth from "@react-native-firebase/auth";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/authService";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

const BRAND_COLOR = "#080d2b";

type Tenant = { id: string; name: string; slug: string; logo?: string | null };

export default function RegisterScreen() {
  const router = useRouter();
  const { setPendingRegistration, setConfirmationResult } = useAuth();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showTenantModal, setShowTenantModal] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await authService.listTenants();
        if (response.data) setTenants(response.data);
      } catch (error) {
        console.error("Failed to fetch schools:", error);
      }
    };
    fetchTenants();
  }, []);

  const onRegister = async () => {
    if (!selectedTenant || !name || !email || !phone || !rollNumber || !password) {
      Alert.alert("Missing Fields", "Please fill in all fields and select a school.");
      return;
    }

    try {
      setLoading(true);
      // Trigger Firebase Phone Authentication
      // Ensure phone number starts with country code (e.g., +91 for India)
      let formattedPhone = phone.replace(/\s+/g, "");
      if (!formattedPhone.startsWith("+")) {
        // Default to +91 if no country code provided, but you can adjust this logic based on target region
        formattedPhone = `+91${formattedPhone}`; 
      }

      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirmationResult(confirmation);
      
      setPendingRegistration({
        tenantId: selectedTenant.id,
        name: name.trim(),
        email: email.trim(),
        phone: formattedPhone,
        password,
        rollNumber: rollNumber.trim()
      });

      router.push("/(auth)/otp");
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1c1c1e" />
            </Pressable>
            <View style={styles.logoContainer}>
              <Ionicons name="person-add" size={32} color="#ffffff" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join your campus canteen network.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
            
            {/* School Selector */}
            <Pressable style={styles.inputContainer} onPress={() => setShowTenantModal(true)}>
              <Ionicons name="business-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <Text style={[styles.inputText, !selectedTenant && { color: "#8e8e93" }]}>
                {selectedTenant ? selectedTenant.name : "Select your School"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8e8e93" />
            </Pressable>

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                placeholder="Full Name"
                placeholderTextColor="#8e8e93"
                value={name}
                onChangeText={setName}
                style={styles.input}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                placeholder="Email Address"
                placeholderTextColor="#8e8e93"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                placeholder="Phone Number"
                placeholderTextColor="#8e8e93"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            {/* Roll Number Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="id-card-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                placeholder="Roll Number"
                placeholderTextColor="#8e8e93"
                value={rollNumber}
                onChangeText={setRollNumber}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor="#8e8e93"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#8e8e93" />
              </Pressable>
            </View>

            <Pressable
              onPress={onRegister}
              style={({ pressed }) => [
                styles.registerButton,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.6 }
              ]}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? "Please wait..." : "Continue"}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.loginLink}>Sign in</Text>
              </Pressable>
            </Link>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* School Selection Modal */}
      <Modal visible={showTenantModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select School</Text>
              <Pressable onPress={() => setShowTenantModal(false)} style={styles.closeModalButton}>
                <Ionicons name="close" size={24} color="#1c1c1e" />
              </Pressable>
            </View>
            <FlatList
              data={tenants}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.tenantOption, selectedTenant?.id === item.id && styles.tenantOptionSelected]}
                  onPress={() => {
                    setSelectedTenant(item);
                    setShowTenantModal(false);
                  }}
                >
                  <Ionicons 
                    name="school" 
                    size={24} 
                    color={selectedTenant?.id === item.id ? BRAND_COLOR : "#8e8e93"} 
                    style={{ marginRight: 16 }}
                  />
                  <Text style={[styles.tenantOptionText, selectedTenant?.id === item.id && styles.tenantOptionTextSelected]}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No schools found.</Text>
              }
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
  },
  logoContainer: {
    width: 64,
    height: 64,
    backgroundColor: BRAND_COLOR,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1c1c1e',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
    height: '100%',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
  },
  eyeIcon: {
    padding: 8,
  },
  registerButton: {
    backgroundColor: BRAND_COLOR,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    elevation: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#8e8e93',
    fontSize: 15,
  },
  loginLink: {
    color: BRAND_COLOR,
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  closeModalButton: {
    padding: 4,
  },
  tenantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f5',
  },
  tenantOptionSelected: {
    backgroundColor: 'rgba(8, 13, 43, 0.04)',
    borderRadius: 12,
  },
  tenantOptionText: {
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  tenantOptionTextSelected: {
    color: BRAND_COLOR,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8e8e93',
    padding: 24,
  }
});
