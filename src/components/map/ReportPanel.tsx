import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, LogIn, MapPin, Mic, Square, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { apiUrl, jsonHeaders, readToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { LatLon } from '@/lib/mapSetup';
import type { StoredUser } from '@/lib/storedUser';

// The browser speech API is not in the TypeScript DOM library yet, so these
// cover only the parts this panel touches.
interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type Phase = 'idle' | 'recording' | 'sending' | 'sent';

function speechRecognition(): SpeechRecognitionConstructor | undefined {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export const ReportHeader = ({ onBack }: { onBack: () => void }) => (
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="-ml-2.5">
      <ArrowLeft className="h-5 w-5" />
    </Button>
    <div>
      <p className="text-[19px] font-semibold tracking-tight">Report an incident</p>
      <p className="text-[13px] text-muted-foreground">Describe what happened out loud</p>
    </div>
  </div>
);

interface ReportBodyProps {
  user: StoredUser | null;
  /** Where the map is centred, used when the device will not share its position. */
  fallbackLocation: LatLon;
}

export const ReportBody = ({ user, fallbackLocation }: ReportBodyProps) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [gps, setGps] = useState<LatLon | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [signedIn] = useState(() => !!readToken());

  useEffect(() => {
    if (!navigator.geolocation) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (active) setGps([pos.coords.latitude, pos.coords.longitude]); },
      () => { if (active) setGpsDenied(true); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
    return () => {
      active = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const location = gps ?? fallbackLocation;
  const contact = user?.emergency_contact?.email;

  const submit = async (text: string) => {
    const token = readToken();
    if (!token) return;
    setPhase('sending');
    try {
      const res = await fetch(apiUrl('/report_audio'), {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ transcript: text, lat: location[0], lon: location[1] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The report could not be sent.');
      setPhase('sent');
      toast({
        title: 'Report sent',
        description: data.contact_notified ? 'Your emergency contact has been emailed.' : 'Thank you. It now counts toward nearby routes.',
      });
    } catch (err) {
      setPhase('idle');
      toast({
        variant: 'destructive',
        title: 'Report not sent',
        description: err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Check your connection and try again.',
      });
    }
  };

  const start = () => {
    const Recognition = speechRecognition();
    if (!Recognition) {
      toast({ variant: 'destructive', title: 'Voice input unavailable', description: 'Try Chrome, Edge or Safari.' });
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      submit(text);
    };
    recognition.onerror = () => {
      setPhase('idle');
      toast({ variant: 'destructive', title: 'Could not hear that', description: 'Please try again.' });
    };
    recognition.onend = () => setPhase((p) => (p === 'recording' ? 'idle' : p));
    recognitionRef.current = recognition;
    setTranscript('');
    setPhase('recording');
    recognition.start();
  };

  const stop = () => recognitionRef.current?.stop();

  if (!signedIn) {
    return (
      <div className="space-y-4 py-2 text-center">
        <p className="text-[14px] text-muted-foreground">Sign in so a report can alert your emergency contact.</p>
        <Button asChild size="lg" className="w-full">
          <Link to="/login"><LogIn /> Sign in</Link>
        </Button>
      </div>
    );
  }

  const recording = phase === 'recording';

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 pt-2">
        <div className="relative grid h-36 w-36 place-items-center">
          {recording && (
            <>
              <span className="absolute inset-0 rounded-full bg-foreground/20 animate-ripple" />
              <span className="absolute inset-0 rounded-full bg-foreground/20 animate-ripple [animation-delay:0.6s]" />
            </>
          )}
          <button
            type="button"
            onClick={recording ? stop : start}
            disabled={phase === 'sending'}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            className={cn(
              'press relative grid h-28 w-28 place-items-center rounded-full bg-foreground text-background shadow-xl transition-[transform,box-shadow] duration-300 disabled:opacity-60',
              recording && 'scale-105',
            )}
          >
            {phase === 'sending' ? <Loader2 className="h-9 w-9 animate-spin" />
              : phase === 'sent' ? <Check className="h-10 w-10" />
              : recording ? <Square className="h-8 w-8 fill-current" />
              : <Mic className="h-10 w-10" />}
          </button>
        </div>
        <p className={cn('text-[14px] font-medium', recording && 'shimmer-text')}>
          {phase === 'recording' ? 'Listening' : phase === 'sending' ? 'Sending your report' : phase === 'sent' ? 'Report sent' : 'Tap to start speaking'}
        </p>
        {transcript && (
          <p className="max-w-sm rounded-2xl bg-muted px-4 py-3 text-center text-[14px] italic animate-fade-up">“{transcript}”</p>
        )}
      </div>

      <ul className="divide-y divide-border/70 rounded-2xl border border-border/70">
        <InfoRow icon={<MapPin />} title={gps ? 'Using your current location' : gpsDenied ? 'Using the map location' : 'Finding your location'}
          text={`${location[0].toFixed(4)}, ${location[1].toFixed(4)}`} />
        <InfoRow icon={<UserRound />} title={contact ? 'Emergency contact' : 'No emergency contact yet'}
          text={contact ?? 'Add one in your profile so reports can alert them.'}
          action={!contact ? <Link to="/profile" className="text-[13px] font-medium underline underline-offset-4">Add</Link> : undefined} />
      </ul>
    </div>
  );
};

const InfoRow = ({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) => (
  <li className="flex items-center gap-4 px-4 py-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[14px] font-medium">{title}</span>
      <span className="block truncate text-[13px] text-muted-foreground">{text}</span>
    </span>
    {action}
  </li>
);
