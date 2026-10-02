'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  imageUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  workspaceId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signIn: (token: string, user: User, workspaceId?: string) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  workspaceId: null,
  isLoaded: false,
  isSignedIn: false,
  getToken: async () => null,
  signIn: () => {},
  updateUser: () => {},
  signOut: () => {},
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const router = useRouter();

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedToken = localStorage.getItem('serp_scout_token');
      const storedUser = localStorage.getItem('serp_scout_user');
      const storedWs = localStorage.getItem('serp_scout_workspace_id');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        if (storedWs) setWorkspaceId(storedWs);

        // Reveal the app immediately: cached credentials are trusted up-front so
        // pages can start their data loads without waiting on a network round-trip.
        // Tokens are valid for 30d; the verification below reconciles in the
        // background and clears state if the token has since been revoked.
        setIsLoaded(true);

        // Verify token in background
        fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data?.user) {
              const u = {
                ...data.data.user,
                imageUrl: data.data.user.avatarUrl || data.data.user.imageUrl || null,
              };
              setUser(u);
              if (data.data.workspaceId) {
                setWorkspaceId(data.data.workspaceId);
                localStorage.setItem('serp_scout_workspace_id', data.data.workspaceId);
              }
              localStorage.setItem('serp_scout_user', JSON.stringify(u));
            } else {
              // Token invalid
              localStorage.removeItem('serp_scout_token');
              localStorage.removeItem('serp_scout_user');
              localStorage.removeItem('serp_scout_workspace_id');
              setToken(null);
              setUser(null);
            }
          })
          .catch(() => {
            // Network error: keep existing offline state
          })
          .finally(() => {
            setIsLoaded(true);
          });
        return;
      }
    } catch (e) {
      console.warn('Auth initialization error:', e);
    }
    setIsLoaded(true);
  }, []);

  const getToken = useCallback(async () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('serp_scout_token') || token;
    }
    return token;
  }, [token]);

  const signIn = useCallback((newToken: string, newUser: User, newWorkspaceId?: string) => {
    const normalizedUser = {
      ...newUser,
      imageUrl: newUser.avatarUrl || newUser.imageUrl || null,
    };
    setToken(newToken);
    setUser(normalizedUser);
    if (newWorkspaceId) setWorkspaceId(newWorkspaceId);

    if (typeof window !== 'undefined') {
      localStorage.setItem('serp_scout_token', newToken);
      localStorage.setItem('serp_scout_user', JSON.stringify(normalizedUser));
      if (newWorkspaceId) {
        localStorage.setItem('serp_scout_workspace_id', newWorkspaceId);
      }
    }
  }, []);

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged = {
        ...prev,
        ...updatedFields,
        imageUrl: updatedFields.avatarUrl !== undefined ? (updatedFields.avatarUrl || null) : (updatedFields.imageUrl || prev.imageUrl),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('serp_scout_user', JSON.stringify(merged));
      }
      return merged;
    });
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setWorkspaceId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('serp_scout_token');
      localStorage.removeItem('serp_scout_user');
      localStorage.removeItem('serp_scout_workspace_id');
      localStorage.removeItem('serp_scout_cached_businesses');
      localStorage.removeItem('serp_scout_active_biz_id');
    }
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaceId,
        isLoaded,
        isSignedIn: !!token && !!user,
        getToken,
        signIn,
        updateUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const { user, token, workspaceId, isLoaded, isSignedIn, getToken, signIn, updateUser, signOut } = useContext(AuthContext);
  return {
    userId: user?.id || null,
    sessionId: token || null,
    token,
    workspaceId,
    isLoaded,
    isSignedIn,
    getToken,
    signIn,
    updateUser,
    signOut,
  };
}

export function useUser() {
  const { user, isLoaded, isSignedIn, updateUser } = useContext(AuthContext);
  return {
    user,
    isLoaded,
    isSignedIn,
    updateUser,
  };
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useContext(AuthContext);
  if (!isLoaded || !isSignedIn) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useContext(AuthContext);
  if (!isLoaded || isSignedIn) return null;
  return <>{children}</>;
}
