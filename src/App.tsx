import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import { UserProfile, OperationType } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { Tithes } from './components/Tithes';
import { Attendance } from './components/Attendance';
import { Finances } from './components/Finances';
import { Reports } from './components/Reports';
import { Events } from './components/Events';
import { Login } from './components/Login';
import { Staff } from './components/Staff';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster, toast } from 'sonner';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  let errorMessage: string;
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Handle Supabase error objects which often have a 'message' property
    errorMessage = (error as any).message || (error as any).error_description || JSON.stringify(error);
  } else {
    errorMessage = String(error);
  }

  const errInfo = {
    error: errorMessage,
    operationType,
    path,
    code: (error as any)?.code
  };
  
  console.error('Database Error: ', JSON.stringify(errInfo));
  
  // Provide a more user-friendly message for common errors
  const code = (error as any)?.code;
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') {
    const msg = `CRITICAL DATABASE ERROR: The table or column "${path}" is missing from your Supabase database. 
    
To fix this, please:
1. Open your Supabase Dashboard.
2. Go to the SQL Editor.
3. Copy and run the contents of the "supabase_schema.sql" file from this project.
4. Refresh this page.`;
    console.error(msg);
    toast.error(msg, { duration: 10000 });
    throw new Error(msg);
  }

  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (id: string, email: string, displayName?: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const role = email === 'danielelon32@gmail.com' ? 'admin' : 'staff';
        const newProfile: UserProfile = {
          id: id,
          email: email,
          display_name: displayName || email.split('@')[0],
          role: role,
          created_at: new Date().toISOString(),
        };
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: id,
            email: email,
            display_name: newProfile.display_name,
            role: role,
            created_at: newProfile.created_at
          }]);

        if (insertError) throw insertError;
        setUser(newProfile);
      } else if (error) {
        throw error;
      } else {
        setUser({
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          role: profile.role,
          created_at: profile.created_at
        });
      }
    } catch (error) {
      handleDatabaseError(error, OperationType.GET, 'profiles');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Login failed:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      
      if (data.user) {
        await fetchProfile(data.user.id, email, displayName);
      }
      
      return { error: null };
    } catch (error) {
      console.error('Signup failed:', error);
      return { error };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <AuthContext.Provider value={{ user, loading, signIn, signUp, logout }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route
              path="/"
              element={user ? <Layout /> : <Navigate to="/login" />}
            >
              <Route index element={<Dashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="tithes" element={<Tithes />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="finances" element={<Finances />} />
              <Route path="events" element={<Events />} />
              <Route path="staff" element={<Staff />} />
              <Route path="reports" element={<Reports />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
