import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

import { login as apiLogin, setAuthToken, signup as apiSignup, googleAuth as apiGoogleAuth, setOnUnauthorized } from "../api/client";
import { AuthResponse, LoginData, SignupData, GoogleAuthData, User } from "../types";

const AUTH_TOKEN_KEY = "auth_token";
const USER_DATA_KEY = "user_data";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (data: SignupData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  loginWithGoogle: (data: GoogleAuthData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const [token, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY),
      ]);

      if (token && userData) {
        setAuthToken(token);
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error("Failed to load stored auth:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAuthResponse(response: AuthResponse) {
    setAuthToken(response.token);
    setUser(response.user);

    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user)),
      ]);
    } catch (error) {
      console.error("Failed to persist auth data:", error);
    }
  }

  async function signup(data: SignupData): Promise<void> {
    const response = await apiSignup(data);
    await handleAuthResponse(response);
  }

  async function login(data: LoginData): Promise<void> {
    const response = await apiLogin(data);
    await handleAuthResponse(response);
  }

  async function loginWithGoogle(data: GoogleAuthData): Promise<void> {
    const response = await apiGoogleAuth(data);
    await handleAuthResponse(response);
  }

  const logout = useCallback(async (): Promise<void> => {
    setAuthToken(null);
    setUser(null);

    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY),
    ]);
  }, []);

  useEffect(() => {
    setOnUnauthorized(logout);
    return () => {
      setOnUnauthorized(null);
    };
  }, [logout]);

  async function updateUser(updatedUser: User): Promise<void> {
    setUser(updatedUser);
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Failed to persist updated user data:", error);
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signup,
    login,
    loginWithGoogle,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
