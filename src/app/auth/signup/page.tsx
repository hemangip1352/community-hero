'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupInput } from '@/lib/validation/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupInput) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            role: data.role,
          },
        },
      });

      if (authError) throw authError;

      // If the email requires confirmation, tell the user
      if (authData.user && !authData.session) {
        setSuccessMsg(
          'Account created! Please check your email to confirm your account, then log in.',
        );
        return;
      }

      if (authData.user) {
        // Upsert the user profile — ignore failures (RLS may block direct insert)
        await supabase.from('users').upsert(
          {
            id: authData.user.id,
            email: data.email,
            full_name: data.full_name ?? '',
            role: data.role ?? 'citizen',
            contribution_score: 0,
            rank: 'Citizen',
          },
          { onConflict: 'id', ignoreDuplicates: false },
        );

        router.push('/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      // Surface friendly messages for common Supabase errors
      if (
        message.toLowerCase().includes('email rate limit') ||
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('over_email_send_rate_limit') ||
        message.toLowerCase().includes('too many requests')
      ) {
        setError(
          'Supabase email rate limit reached. To fix this: go to your Supabase dashboard → Authentication → Providers → Email → disable "Confirm email". Then try signing up again.',
        );
      } else if (message.toLowerCase().includes('user already registered')) {
        setError('An account with this email already exists. Please log in instead.');
      } else if (message.toLowerCase().includes('password')) {
        setError('Password must be at least 6 characters.');

      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl">Join Community Hero</CardTitle>
            <CardDescription>Create your account and start making a difference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Full Name</label>
                <input
                  {...register('full_name')}
                  placeholder="Your name"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 outline-none"
                />
                {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Password</label>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 outline-none"
                />
                {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Role</label>
                <select
                  {...register('role')}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
                >
                  <option value="citizen">Citizen</option>
                  <option value="verifier">Community Verifier</option>
                  <option value="officer">Department Officer</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-2 rounded">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="bg-green-900/20 border border-green-700 text-green-200 px-4 py-2 rounded">
                  {successMsg}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </Button>
            </form>

            <p className="text-center text-slate-400 text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
