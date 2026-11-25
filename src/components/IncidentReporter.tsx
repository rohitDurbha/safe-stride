
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MapPin, Square } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { readStoredUser } from "@/lib/storedUser";
import { apiUrl, jsonHeaders, readToken } from "@/lib/api";

// The browser speech API is not in the TypeScript DOM library yet, so these
// cover only the parts this component touches.
interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const IncidentReporter = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [userData] = useState(() => readStoredUser());
  
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "Location Error",
            description: "Unable to get your location. Please enable location services.",
            variant: "destructive"
          });
        }
      );
    } else {
      toast({
        title: "Browser Error",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive"
      });
    }
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  const startRecording = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Please use Google Chrome or a supported browser.",
        variant: "destructive"
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0][0].transcript;
      console.log("Transcribed:", transcript);
      submitReport(transcript);
    };

    recognition.onerror = (event: Event) => {
      console.error("Speech recognition error:", event);
      toast({
        title: "Speech Recognition Failed",
        description: "Please try again.",
        variant: "destructive"
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    toast({ title: "Recording started", description: "Click stop once done." });
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      toast({ title: "Recording stopped", description: "Processing your report..." });
    }
  };

  const submitReport = async (transcript: string) => {
    if (!location) {
      getCurrentLocation();
      return;
    }

    const token = readToken();
    if (!token) {
      toast({
        title: "Please log in",
        description: "Log in so your report can alert your emergency contact.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // The backend alerts the emergency contact saved on this account.
      const res = await fetch(apiUrl("/report_audio"), {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({
          transcript,
          lat: location.lat,
          lon: location.lng
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: "Report Submitted",
          description: data.contact_notified
            ? "Thank you for reporting. Your emergency contact has been emailed."
            : "Thank you for reporting. Your report was logged successfully."
        });
      } else {
        toast({
          title: "Submission Error",
          description: data.error || "An error occurred. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Submit Error:", error);
      toast({
        title: "Network Error",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 shadow-lg bg-background">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Report an Incident</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {location ? (
              <span className="text-sm text-muted-foreground">Location detected</span>
            ) : (
              <span className="text-sm text-destructive">Detecting location...</span>
            )}
          </div>

          {userData && userData.emergency_contact?.email ? (
            <div className="text-center text-xs text-muted-foreground">
              Emergency contact: {userData.emergency_contact.email}
            </div>
          ) : (
            <div className="text-center text-xs text-destructive">
              No emergency contact found. Please update your profile.
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {!isRecording ? (
              <Button
                size="lg"
                className="w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2"
                onClick={startRecording}
                disabled={isSubmitting || !location}
              >
                <Mic className="h-12 w-12" />
                <span className="text-sm">Start Recording</span>
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-48 h-48 bg-destructive text-white rounded-full flex flex-col items-center justify-center gap-2"
                onClick={stopRecording}
              >
                <Square className="h-12 w-12" />
                <span className="text-sm">Stop Recording</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default IncidentReporter;
