import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  loginBlockReason: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginBlockReason, setLoginBlockReason] = useState<string | null>(null);

  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*, companies!inner(status, name)')
      .eq('user_id', uid)
      .maybeSingle();
    const p = data as (Profile & { companies?: { status: string; name: string } }) | null;
    if (p && p.companies) {
      if (p.companies.status === 'inactive' || p.companies.status === 'suspended') {
        setProfile(null);
        await supabase.auth.signOut();
        setLoginBlockReason(`A empresa ${p.companies.name} está ${p.companies.status === 'inactive' ? 'inativa' : 'suspensa'}. Entre em contato com a SOW Consultoria.`);
        return;
      }
    }
    if (p) {
      setLoginBlockReason(null);
      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('user_id', uid);
    }
    setProfile(p as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        (async () => {
          await loadProfile(sess.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      const { error: insertError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
        email,
        role: 'responsible',
      });
      if (insertError) {
        return { error: `Conta criada, mas houve um erro ao salvar o perfil: ${insertError.message}` };
      }
      await loadProfile(data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, loginBlockReason, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
