import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserMe } from '@/lib/api/auth';

interface AuthState {
  token: string | null;
  user: UserMe | null;
  setSession: (token: string, user: UserMe) => void;
  setUser: (user: UserMe) => void;
  clear: () => void;
}

const TOKEN_KEY = process.env.NEXT_PUBLIC_JWT_TOKEN_KEY || 'pasalo_token';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, token);
        }
        set({ token, user });
      },
      setUser: (user) => set({ user }),
      clear: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
        }
        set({ token: null, user: null });
      },
    }),
    {
      name: 'pasalo-auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as Storage))),
    },
  ),
);
