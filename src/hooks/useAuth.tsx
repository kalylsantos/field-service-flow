import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  secrets: Record<string, string>;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role as UserRole | null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  };

  const fetchSecrets = async () => {
    try {
      const { data, error } = await supabase
        .from('app_secrets' as any)
        .select('name, value');

      if (error) {
        console.error('Error fetching app secrets:', error);
        return {};
      }

      const secretsMap: Record<string, string> = {};
      data?.forEach((s: any) => {
        secretsMap[s.name] = s.value;
      });
      return secretsMap;
    } catch (error) {
      console.error('Error fetching app secrets:', error);
      return {};
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const [role, fetchedSecrets] = await Promise.all([
              fetchUserRole(session.user.id),
              fetchSecrets()
            ]);
            setUserRole(role);
            setSecrets(fetchedSecrets);
          } catch (err) {
            console.error('Error during post-auth fetch:', err);
          } finally {
            setLoading(false);
          }
        } else {
          setUserRole(null);
          setSecrets({});
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const [role, fetchedSecrets] = await Promise.all([
            fetchUserRole(session.user.id),
            fetchSecrets()
          ]);
          setUserRole(role);
          setSecrets(fetchedSecrets);
        } catch (err) {
          console.error('Error during initial session fetch:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, secrets, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
