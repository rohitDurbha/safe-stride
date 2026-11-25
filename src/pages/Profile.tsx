import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Check, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/api/auth';
import { readToken } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { clearSession, displayName, initials } from '@/lib/session';
import { readStoredUser } from '@/lib/storedUser';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => readStoredUser());
  const [email, setEmail] = useState(user?.email || '');
  const [contactName, setContactName] = useState(user?.emergency_contact?.name || '');
  const [contactEmail, setContactEmail] = useState(user?.emergency_contact?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!readToken()) navigate('/login', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);
    try {
      const updated = await updateUserProfile(user, email.trim(), contactName.trim(), contactEmail.trim());
      setUser(updated);
      setSaved(true);
      toast({ title: 'Profile saved', description: 'Reports will alert your emergency contact.' });
    } catch (error) {
      const message = errorMessage(error, 'Failed to update profile');
      toast({
        variant: 'destructive',
        title: 'Not saved',
        description: message === 'Failed to fetch' ? 'Cannot reach SafeStride right now.' : message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background pt-safe">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/95 md:bg-background/80 md:backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-2 px-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to the map">
            <Link to="/home"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-[17px] font-semibold">Profile</h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pb-16 pt-8 animate-fade-up">
        <div className="mb-8 flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-foreground text-[20px] font-semibold text-background">
            {initials(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[20px] font-semibold tracking-tight">{displayName(user) || 'Your account'}</p>
            <p className="truncate text-[14px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Section title="Account">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }} required />
            </Field>
          </Section>

          <Section title="Emergency contact" note="This person gets an email with your location and what you said whenever you file a report.">
            <Field label="Name" htmlFor="contactName">
              <Input id="contactName" value={contactName} onChange={(e) => { setContactName(e.target.value); setSaved(false); }} required />
            </Field>
            <Field label="Email" htmlFor="contactEmail">
              <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => { setContactEmail(e.target.value); setSaved(false); }} required />
            </Field>
          </Section>

          <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
            {isSaving ? 'Saving' : saved ? 'Saved' : 'Save changes'}
          </Button>
        </form>

        <Button
          variant="ghost"
          size="lg"
          className="mt-3 w-full text-muted-foreground"
          onClick={() => { clearSession(); navigate('/login'); }}
        >
          <LogOut /> Sign out
        </Button>
      </div>
    </main>
  );
};

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="space-y-4 rounded-[24px] border border-border/70 p-5">
    <div>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {note && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{note}</p>}
    </div>
    {children}
  </section>
);

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block px-1 text-[13px] font-medium">{label}</label>
    {children}
  </div>
);

export default Profile;
