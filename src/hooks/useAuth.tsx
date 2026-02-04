import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Type definitions from database
type AppRole = Database['public']['Enums']['app_role'];

interface Company {
  id: string;
  name: string;
  code: string | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: AppRole;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  company: Company | null;
  roles: AppRole[];
  isLoading: boolean;
  needsCompanySelection: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  selectCompanyForAdmin: (company: Company) => void;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for admin's selected company
const ADMIN_COMPANY_KEY = 'admin_selected_company';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsCompanySelection, setNeedsCompanySelection] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile and roles fetch with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setCompany(null);
          setRoles([]);
          setNeedsCompanySelection(false);
          // Clear admin company selection on logout
          sessionStorage.removeItem(ADMIN_COMPANY_KEY);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile - role is stored in user_profiles table
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData as UserProfile);
        // Set roles from profile - role is stored directly in user_profiles
        setRoles([profileData.role as AppRole]);

        // Check if user is ADMIN
        if (profileData.role === 'ADMIN') {
          // Try to restore previously selected company from session storage
          const savedCompany = sessionStorage.getItem(ADMIN_COMPANY_KEY);
          if (savedCompany) {
            try {
              const parsedCompany = JSON.parse(savedCompany) as Company;
              setCompany(parsedCompany);
              setNeedsCompanySelection(false);
            } catch {
              // Invalid saved data, need to select company
              setNeedsCompanySelection(true);
              setCompany(null);
            }
          } else {
            // Admin needs to select a company
            setNeedsCompanySelection(true);
            setCompany(null);
          }
        } else {
          // Non-admin users: fetch company if company_id exists
          setNeedsCompanySelection(false);
          if (profileData.company_id) {
            const { data: companyData } = await supabase
              .from('companies')
              .select('id, name, code')
              .eq('id', profileData.company_id)
              .maybeSingle();
            
            if (companyData) {
              setCompany(companyData as Company);
            }
          } else {
            setCompany(null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

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
    setProfile(null);
    setCompany(null);
    setRoles([]);
    setNeedsCompanySelection(false);
    sessionStorage.removeItem(ADMIN_COMPANY_KEY);
  };

  const selectCompanyForAdmin = (selectedCompany: Company) => {
    setCompany(selectedCompany);
    setNeedsCompanySelection(false);
    // Save to session storage for persistence during session
    sessionStorage.setItem(ADMIN_COMPANY_KEY, JSON.stringify(selectedCompany));
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  
  const isAdmin = () => roles.includes('ADMIN');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        company,
        roles,
        isLoading,
        needsCompanySelection,
        signIn,
        signUp,
        signOut,
        selectCompanyForAdmin,
        hasRole,
        isAdmin,
      }}
    >
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
