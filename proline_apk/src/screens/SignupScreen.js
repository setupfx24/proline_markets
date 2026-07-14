import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "../config";
import { getApiError, parseJsonSafe, fetchUserProfile } from "../utils/authApi";

const { width, height } = Dimensions.get("window");
const AUTH_URL = `${API_URL}/auth`;

const SignupScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });

  // Logo entrance animation
  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [logoAnim]);

  // Check if OTP is required on mount
  useEffect(() => {
    const checkOtpSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/otp-settings`);
        const contentType = res.headers.get("content-type") || "";
        // Guard against non-JSON responses (e.g. HTML error/landing pages)
        if (!res.ok || !contentType.includes("application/json")) {
          return; // keep default: OTP not required
        }
        const data = await res.json();
        if (data.success) {
          setOtpRequired(data.otpEnabled);
        }
      } catch (error) {
        // Network/parse issue — fall back silently to OTP-not-required
        console.log("OTP settings unavailable, defaulting to disabled");
      }
    };
    checkOtpSettings();
  }, []);

  // Send OTP
  const handleSendOtp = async () => {
    if (!formData.email || !formData.firstName) {
      Alert.alert("Error", "Please enter your name and email first");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.otpRequired) {
          setOtpStep(true);
          Alert.alert(
            "OTP Sent",
            "Please check your email for the verification code",
          );
        } else {
          setOtpVerified(true);
        }
      } else {
        Alert.alert("Error", data.message || "Failed to send OTP");
      }
    } catch (error) {
      Alert.alert("Error", "Error sending OTP");
    }
    setSendingOtp(false);
  };

  // Verify OTP and auto-create account
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, otp }),
      });
      const data = await res.json();

      if (data.success) {
        // OTP verified - now automatically create the account
        setOtpVerified(true);
        setOtpStep(false);

        // Auto-create account after email verification
        setLoading(true);
        try {
          const signupRes = await fetch(`${AUTH_URL}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...formData,
              otpVerified: true,
            }),
          });
          const signupData = await signupRes.json();

          if (!signupRes.ok) {
            throw new Error(signupData.message || "Signup failed");
          }

          // Account created successfully - redirect to login
          Alert.alert(
            "Account Created!",
            "Your account has been created successfully. Please login to continue.",
            [{ text: "OK", onPress: () => navigation.replace("Login") }],
          );
        } catch (signupError) {
          Alert.alert("Error", signupError.message);
        } finally {
          setLoading(false);
        }
      } else {
        Alert.alert("Error", data.message || "Invalid OTP");
      }
    } catch (error) {
      Alert.alert("Error", "Error verifying OTP");
    }
    setVerifyingOtp(false);
  };

  const handleSignup = async () => {
    if (!formData.firstName || !formData.email || !formData.password) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    // If OTP is required and not verified, send OTP first
    if (otpRequired && !otpVerified) {
      await handleSendOtp();
      return;
    }

    setLoading(true);
    try {
      // Split the single "Full name" field into first/last (backend requires
      // both, min 1 char). If only one word is entered, reuse it as last name.
      const nameParts = formData.firstName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

      // Build payload: phone is optional, so only send it when provided
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        first_name: firstName,
        last_name: lastName,
      };
      if (formData.phone && formData.phone.trim()) {
        payload.phone = formData.phone.trim();
      }

      const response = await fetch(`${AUTH_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(getApiError(data) || "Signup failed");
      }

      // Backend returns { access_token, user_id, ... }; store token, then
      // load the full profile from /auth/me for the app's screens.
      const token = data.access_token || data.token;
      if (token) {
        await SecureStore.setItemAsync("token", token);
      }
      const user = await fetchUserProfile(token);
      if (user) {
        await SecureStore.setItemAsync("user", JSON.stringify(user));
      }

      navigation.replace("MainTrading");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: logoAnim, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, styles.activeTab]}>
            <Text style={styles.activeTabText}>Sign up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.tabText}>Sign in</Text>
          </TouchableOpacity>
        </View>

        {otpStep ? (
          <>
            {/* OTP Verification Screen */}
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {formData.email}
            </Text>

            {/* OTP Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="keypad-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
              />
            </View>

            {/* Verify OTP Button */}
            <TouchableOpacity
              style={verifyingOtp && styles.buttonDisabled}
              onPress={handleVerifyOtp}
              disabled={verifyingOtp}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#15803d", "#16a34a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                {verifyingOtp ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.buttonText}>Verify OTP</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend OTP */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleSendOtp}
              disabled={sendingOtp}
            >
              {sendingOtp ? (
                <ActivityIndicator color="#22c55e" size="small" />
              ) : (
                <Text style={styles.resendText}>Resend OTP</Text>
              )}
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setOtpStep(false)}
            >
              <Ionicons name="arrow-back" size={20} color="#22c55e" />
              <Text style={styles.backButtonText}>Back to signup</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Signup Form */}
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Start your trading journey today
            </Text>

            {/* Email Verified Badge */}
            {otpVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.verifiedText}>Email verified</Text>
              </View>
            )}

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#666"
                value={formData.firstName}
                onChangeText={(text) =>
                  setFormData({ ...formData, firstName: text })
                }
              />
            </View>

            {/* Email Input */}
            <View
              style={[
                styles.inputContainer,
                otpVerified && styles.inputDisabled,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) =>
                  setFormData({ ...formData, email: text })
                }
                editable={!otpVerified}
              />
              {otpVerified && (
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              )}
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="call-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone: text })
                }
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                value={formData.password}
                onChangeText={(text) =>
                  setFormData({ ...formData, password: text })
                }
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {/* Signup Button */}
            <TouchableOpacity
              style={(loading || sendingOtp) && styles.buttonDisabled}
              onPress={handleSignup}
              disabled={loading || sendingOtp}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#15803d", "#16a34a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                {loading || sendingOtp ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.buttonText}>
                    {otpRequired && !otpVerified ? "Send OTP" : "Create account"}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Terms */}
            <Text style={styles.terms}>
              By creating an account, you agree to our{" "}
              <Text style={styles.termsLink}>Terms of Service</Text>
            </Text>

            {/* Sign In Link */}
            <View style={styles.signinContainer}>
              <Text style={styles.signinText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.signinLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 60,
    height: 60,
    backgroundColor: "#22c55e",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  logoText: {
    color: "#000",
    fontSize: 24,
    fontWeight: "bold",
  },
  brandName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#000000",
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#22c55e",
  },
  tabText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "bold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 32,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#000000",
  },
  dividerText: {
    color: "#666",
    fontSize: 13,
    marginHorizontal: 16,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  terms: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 20,
  },
  termsLink: {
    color: "#22c55e",
  },
  signinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  signinText: {
    color: "#666",
    fontSize: 15,
  },
  signinLink: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 20,
    padding: 12,
  },
  resendText: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 12,
    gap: 8,
  },
  backButtonText: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "500",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98120",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  verifiedText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
  inputDisabled: {
    opacity: 0.7,
  },
});

export default SignupScreen;
