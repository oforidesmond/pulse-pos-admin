'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const username = sessionStorage.getItem('pendingPasswordResetUsername');
    const currentPassword = sessionStorage.getItem('pendingPasswordResetCurrentPassword');

    if (!username || !currentPassword) {
      router.replace('/login');
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('New password and confirmation are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (typeof window === 'undefined') {
      setError('Unable to reset password.');
      return;
    }

    const username = sessionStorage.getItem('pendingPasswordResetUsername');
    const currentPassword = sessionStorage.getItem('pendingPasswordResetCurrentPassword');

    if (!username || !currentPassword) {
      setError('Reset session expired. Please login again.');
      router.replace('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to set password.');
      }

      sessionStorage.removeItem('pendingPasswordResetUsername');
      sessionStorage.removeItem('pendingPasswordResetCurrentPassword');

      router.replace('/login');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to set password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl">S</span>
          </div>
          <h1 className="text-gray-900 mb-2">Set a new password</h1>
          <p className="text-gray-600">You must change your password before continuing.</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter a new password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your new password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
