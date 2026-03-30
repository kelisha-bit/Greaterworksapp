import React, { useState } from 'react';
import { useAuth } from '../App';
import { LogIn, Church, UserPlus, Mail, Lock, User } from 'lucide-react';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password, displayName);
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-neutral-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-full mb-4 text-primary-600">
            <Church size={32} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-1">Greater Works City Church</h1>
          <p className="text-neutral-500">Ghana Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <User size={16} /> Full Name
              </label>
              <input
                required
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Mail size={16} /> Email Address
            </label>
            <input
              required
              type="email"
              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              placeholder="admin@church.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Lock size={16} /> Password
            </label>
            <input
              required
              type="password"
              className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error === 'Invalid login credentials' 
                ? 'Invalid email or password. If you don\'t have an account, please Sign Up first.' 
                : error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all transform active:scale-95 shadow-lg shadow-primary-100 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <>
                {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
          {!isSignUp && (
            <button
              onClick={() => {
                const email = prompt('Please enter your email to reset password:');
                if (email) {
                  alert('Password reset link sent to ' + email + '. (Note: This is a demo, please check your email if configured)');
                }
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600 font-medium"
            >
              Forgot Password?
            </button>
          )}
        </div>
        
        <p className="mt-8 text-xs text-neutral-400 text-center">
          Authorized personnel only. Access is monitored.
        </p>
      </div>
    </div>
  );
}
