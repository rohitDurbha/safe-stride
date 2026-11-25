import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, ArrowRight, Loader2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerUser, loginUser } from '@/api/auth';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await registerUser(email.trim(), password, name.trim(), contactName.trim(), contactEmail.trim());
      } else {
        await loginUser(email.trim(), password);
      }
      navigate('/home');
    } catch (err) {
      const message = errorMessage(err);
      if (message === 'Failed to fetch') {
        setError('Cannot reach SafeStride right now. Check your connection and try again.');
      } else if (message.includes('already exists')) {
        setError('That email already has an account. Sign in instead.');
        setMode('signin');
      } else if (mode === 'signin') {
        setError('That email and password do not match an account.');
      } else {
        setError(message || 'Could not create your account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 pt-safe">
      <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      <div className="relative w-full max-w-[400px] animate-blur-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background shadow-lg">
            <Navigation className="h-6 w-6" />
          </span>
          <h1 className="text-[28px] font-semibold tracking-tight">SafeStride</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Walk Oakland the safer way.</p>
        </div>

        <div className="surface-solid rounded-[28px] p-5 sm:p-6">
          <div className="relative mb-6 grid grid-cols-2 rounded-full bg-muted p-1" role="tablist">
            <span
              aria-hidden
              className={cn(
                'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-card shadow-sm transition-transform duration-300 ease-spring',
                mode === 'signup' && 'translate-x-full',
              )}
            />
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  'relative z-10 h-10 rounded-full text-[14px] font-medium transition-colors',
                  mode === m ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl bg-foreground px-4 py-3 text-[13px] text-background animate-blur-in">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Your name" htmlFor="name">
                <Input id="name" autoComplete="name" placeholder="Alex Rivera" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>

            {mode === 'signup' && (
              <fieldset className="space-y-4 rounded-2xl border border-border/70 p-4 animate-blur-in">
                <legend className="px-1 text-[13px] font-medium">Emergency contact</legend>
                <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">
                  They get an email when you file a report, and a note now saying they were added.
                </p>
                <Field label="Name" htmlFor="contactName">
                  <Input id="contactName" placeholder="Sam Lee" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
                </Field>
                <Field label="Email" htmlFor="contactEmail">
                  <Input id="contactEmail" type="email" placeholder="sam@example.com" value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)} required />
                </Field>
              </fieldset>
            )}

            <Button type="submit" size="lg" className="group w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : null}
              {isLoading
                ? (mode === 'signup' ? 'Creating your account' : 'Signing in')
                : (mode === 'signup' ? 'Create account' : 'Sign in')}
              {!isLoading && <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />}
            </Button>
          </form>
        </div>

        <Link
          to="/home"
          className="mx-auto mt-6 block w-fit rounded-full px-4 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Continue to the map without an account
        </Link>
      </div>
    </main>
  );
};

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block px-1 text-[13px] font-medium">{label}</label>
    {children}
  </div>
);

export default Login;
