import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserMe } from '@/lib/api/auth';

const TOKEN_KEY = process.env.NEXT_PUBLIC_JWT_TOKEN_KEY || 'pasalo_token';
const REFRESH_KEY = 'pasalo_refresh_token';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserMe | null;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setSession: (token: string, user: UserMe, refreshToken?: string) => void;
  setUser: (user: UserMe) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setSession: (token, user, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, token);
          if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
        }
        set({ token, user, ...(refreshToken ? { refreshToken } : {}) });
      },
      setUser: (user) => set({ user }),
      clear: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_KEY);
        }
        set({ token: null, refreshToken: null, user: null });
      },
    }),
    {
      name: 'pasalo-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({} as Storage),
      ),
      // _hasHydrated is runtime-only — never persist it
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export { TOKEN_KEY, REFRESH_KEY };
