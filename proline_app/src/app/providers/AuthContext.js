import React, { createContext, useState, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../constants';
import { registerAuthFailureHandler } from '../../services/api/authedFetch';
import { toMessage } from '../../utils/errorMessage';
import logger from '../../utils/logger';

export const AuthContext = createContext();

// Auth requests carry this header so the backend returns the tokens
// (access_token + refresh_token + refresh_expires_at) in the JSON body.
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'X-Token-Delivery': 'json',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When a token refresh definitively fails (refresh token invalid/expired),
    // authedFetch clears SecureStore and calls this — dropping in-memory state
    // sends the user back to the login screen (RootNavigator keys off `user`).
    registerAuthFailureHandler(() => {
      setToken(null);
      setUser(null);
    });
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      // One-time cleanup: older builds persisted the plaintext password for
      // silent re-login. Auth now uses rotating refresh tokens — purge any
      // leftover credentials (cheap unconditional delete).
      await SecureStore.deleteItemAsync('savedEmail').catch(() => {});
      await SecureStore.deleteItemAsync('savedPassword').catch(() => {});

      const storedToken = await SecureStore.getItemAsync('token');
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      logger.error('Error loading auth:', error);
    }
    setLoading(false);
  };

  // Persist a successful auth response: access token, rotated refresh token
  // and the user record. Never stores credentials.
  const persistSession = async (data, userInfo) => {
    await SecureStore.setItemAsync('token', data.access_token);
    if (data.refresh_token) {
      await SecureStore.setItemAsync('refreshToken', data.refresh_token);
    }
    await SecureStore.setItemAsync('user', JSON.stringify(userInfo));
  };

  const login = async (email, password, totpCode = null) => {
    try {
      // Normalise email so login always matches how the account was registered
      // (the backend stores it lower-cased; a stray capital broke login).
      email = (email || '').trim().toLowerCase();
      const body = { email, password };
      if (totpCode) body.totp_code = totpCode;
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Backend may signal 2FA via 200 OK with a flag OR via 401 + code.
      if (data?.twofa_required || data?.['2fa_required'] || data?.code === 'twofa_required') {
        return { success: false, twoFactorRequired: true, message: toMessage(data?.detail ?? data?.message, 'Two-factor authentication required') };
      }

      if (response.ok && data.access_token) {
        // TrustEdge backend returns access_token, user_id, role, expires_at
        const userInfo = {
          id: data.user_id,
          email: email,
          role: data.role,
          expires_at: data.expires_at
        };

        await persistSession(data, userInfo);
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      } else {
        return { success: false, message: toMessage(data.detail ?? data.message, 'Login failed') };
      }
    } catch (error) {
      logger.error('Login error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  // One-tap demo sign-in (matches the web "Try Demo"). Hits /auth/demo-login
  // which provisions/returns a demo account + token, no email/password needed.
  const demoLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/demo-login`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.access_token) {
        const userInfo = {
          id: data.user_id,
          email: data.email || '',
          role: data.role,
          expires_at: data.expires_at,
          is_demo: true,
        };
        await persistSession(data, userInfo);
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      }
      return { success: false, message: toMessage(data?.detail ?? data?.message, 'Demo login failed') };
    } catch (error) {
      logger.error('Demo login error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const signup = async (userData) => {
    try {
      // Normalise email the same way as login so the two always agree.
      const email = (userData?.email || '').trim().toLowerCase();
      const payload = { ...userData, email };
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        // TrustEdge backend returns access_token, user_id, role, expires_at
        const userInfo = {
          id: data.user_id,
          email,
          role: data.role,
          expires_at: data.expires_at
        };

        await persistSession(data, userInfo);
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      } else {
        return { success: false, message: toMessage(data.detail ?? data.message, 'Signup failed') };
      }
    } catch (error) {
      logger.error('Signup error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  // --- OTP-based signup (register -> verify-email) ---
  //
  // These used to post to /auth/register/start, /register/verify and
  // /register/resend, none of which exist — all three 404 in production, so
  // signup could never complete. The real flow is: POST /auth/register creates
  // the account with email_verified=false and emails a 6-digit code, then
  // POST /auth/verify-email confirms it AND logs the user in.

  const registerStart = async (userData) => {
    try {
      const email = (userData?.email || '').trim().toLowerCase();
      // Send exactly the fields RegisterRequest declares. Pydantic drops extras
      // silently, so passing e.g. a `full_name` the backend has never had would
      // just disguise the real contract.
      const payload = {
        email,
        password: userData?.password,
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        ...(userData?.phone ? { phone: userData.phone } : {}),
        ...(userData?.country ? { country: userData.country } : {}),
        ...(userData?.referral_code ? { referral_code: userData.referral_code } : {}),
      };
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        // 201 { verification_required: true, email }
        return { success: true, message: 'Verification code sent' };
      }
      return { success: false, message: toMessage(data?.detail ?? data?.message, 'Could not start signup') };
    } catch (error) {
      logger.error('register error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const registerVerify = async (email, otp, password) => {
    try {
      const e = (email || '').trim().toLowerCase();
      // The backend field is `code` (4–6 chars), not `otp`.
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ email: e, code: String(otp || '').trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.access_token) {
        const userInfo = { id: data.user_id, email: e, role: data.role, expires_at: data.expires_at };
        await persistSession(data, userInfo);
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      }

      if (response.ok) {
        // Account verified but no token returned — log in with the credentials.
        if (password) return await login(e, password);
        return { success: true, needLogin: true };
      }

      return { success: false, message: toMessage(data?.detail ?? data?.message, 'Verification failed') };
    } catch (error) {
      logger.error('register/verify error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const registerResend = async (email) => {
    try {
      const e = (email || '').trim().toLowerCase();
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ email: e }),
      });
      const data = await response.json().catch(() => ({}));
      return {
        success: response.ok,
        message: toMessage(data?.detail ?? data?.message, response.ok ? 'Code resent' : 'Could not resend code'),
      };
    } catch (error) {
      logger.error('register/resend error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
      setToken(null);
      setUser(null);
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const updateUser = async (updatedUser) => {
    try {
      await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      logger.error('Update user error:', error);
    }
  };

  // Memoized on state only: every auth method above is state-free (reads
  // nothing but setters/constants — verified), so re-capturing identities on
  // state change is safe, and consumers stop re-rendering on unrelated
  // provider renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      demoLogin,
      signup,
      registerStart,
      registerVerify,
      registerResend,
      logout,
      updateUser,
    }),
    [user, token, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
