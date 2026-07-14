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

const LoginScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
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

  // Check if user is already logged in
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const userData = await SecureStore.getItemAsync("user");
      if (userData) {
        navigation.replace("MainTrading");
      }
    } catch (e) {
      console.error("Error checking auth:", e);
    }
    setCheckingAuth(false);
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      console.log("Attempting login to:", `${AUTH_URL}/login`);
      console.log("Form data:", { email: formData.email, password: "***" });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await parseJsonSafe(response);
      console.log("Login response status:", response.status);

      if (!response.ok) {
        throw new Error(getApiError(data) || "Login failed");
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

      // Navigate to MainTrading screen
      navigation.replace("MainTrading");
    } catch (error) {
      console.error("Login error:", error);
      let errorMsg = error.message;
      if (error.name === "AbortError") {
        errorMsg =
          "Connection timeout. Please check your network and ensure you are on the same WiFi as the server.";
      } else if (error.message === "Network request failed") {
        errorMsg =
          "Cannot connect to server. Please ensure:\n1. Phone is on same WiFi as server\n2. Backend is running on port 5001";
      }
      Alert.alert("Login Error", `${errorMsg}\n\nServer: ${AUTH_URL}`);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

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
          <TouchableOpacity
            style={styles.tab}
            onPress={() => navigation.navigate("Signup")}
          >
            <Text style={styles.tabText}>Sign up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, styles.activeTab]}>
            <Text style={styles.activeTabText}>Sign in</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue trading</Text>

        {/* Email Input */}
        <View style={styles.inputContainer}>
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
            onChangeText={(text) => setFormData({ ...formData, email: text })}
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

        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={() => navigation.navigate("ForgotPassword")}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          style={loading && styles.buttonDisabled}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#15803d", "#16a34a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
            <Text style={styles.signupLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
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
    minHeight: height,
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotText: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
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
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  signupText: {
    color: "#666",
    fontSize: 15,
  },
  signupLink: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default LoginScreen;
