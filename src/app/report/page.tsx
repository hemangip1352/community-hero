'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reportIssueSchema, ReportIssueInput } from '@/lib/validation/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Mic, MicOff, MapPin, Check, Sparkles, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'location' | 'form' | 'review';

export default function ReportIssuePage() {
  const router = useRouter();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [aiStructured, setAiStructured] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('location');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReportIssueInput>({
    resolver: zodResolver(reportIssueSchema),
    defaultValues: { urgency: 'medium', category: 'Other' },
  });

  // Check authentication on mount — redirect to login if not signed in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
      }
    };
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect location on mount
  useEffect(() => {
    if (navigator.geolocation && !location) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocation({ lat: latitude, lng: longitude });
          setValue('latitude', latitude);
          setValue('longitude', longitude);
        },
        () => {
          // Fallback to a default location if denied
          setValue('latitude', 28.6139);
          setValue('longitude', 77.2090);
          setLocation({ lat: 28.6139, lng: 77.2090 });
        },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File upload preview ───────────────────────────────────────────────────
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setMediaPreview(result);
      const match = result.match(/^data:(image\/[^;]+);base64,(.*)$/);
      if (match) {
        setValue('mime_type', match[1]);
        setValue('image_base64', match[2]);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Voice → Gemini structuring ────────────────────────────────────────────
  const startListening = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome.');
      return;
    }

    setIsListening(true);
    setAiStructured(false);

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setIsListening(false);
      if (!transcript.trim()) return;

      // Put raw transcript in description immediately (instant feedback)
      setValue('description', transcript);

      // Call Gemini to structure the transcript into all fields
      setIsStructuring(true);
      try {
        const res = await fetch('/api/voice/structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        if (res.ok) {
          const { data, gemini_used } = await res.json();
          if (data) {
            setValue('title',       data.title);
            setValue('description', data.description);
            setValue('category',    data.category as any);
            setValue('urgency',     data.urgency as any);
            setAiStructured(gemini_used);
          }
        }
      } catch (err) {
        console.error('[Report] Voice structure failed:', err);
        // transcript is already in description — user can fill rest manually
      } finally {
        setIsStructuring(false);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend  = () => setIsListening(false);
    recognition.start();
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const onSubmit = async (data: ReportIssueInput) => {
    try {
      setUploading(true);
      setSubmitError(null);
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit issue');
      }

      const { data: issue } = await res.json();
      router.push(`/issue/${issue.id}`);
    } catch (error: any) {
      console.error('[Report] Error:', error);
      setSubmitError(error.message ?? 'Submission failed');
    } finally {
      setUploading(false);
    }
  };

  // Watch fields for review step
  const title       = watch('title');
  const description = watch('description');
  const category    = watch('category');
  const urgency     = watch('urgency');

  // ── Step indicator ────────────────────────────────────────────────────────
  const steps: Step[] = ['location', 'form', 'review'];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold text-white mb-2">Report an Issue</h1>
          <p className="text-slate-400">Help your community by reporting a civic problem. Our AI will analyse and route it automatically.</p>
        </motion.div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${
                i < stepIndex ? 'bg-green-500' : i === stepIndex ? 'bg-blue-500' : 'bg-slate-700'
              }`} />
              <p className={`text-xs mt-1.5 capitalize ${i === stepIndex ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>
                {s === 'review' ? 'Review & Submit' : s}
              </p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: LOCATION ─────────────────────────────────────────────── */}
          {step === 'location' && (
            <motion.div key="location" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Confirm Your Location</CardTitle>
                  <CardDescription>Your issue will be mapped to this GPS position for accurate routing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className={`rounded-xl p-6 text-center border transition-colors ${location ? 'border-green-700 bg-green-900/10' : 'border-slate-600 bg-slate-700/50'}`}>
                    <motion.div
                      animate={location ? { scale: [1, 1.2, 1] } : { scale: [1, 1.05, 1] }}
                      transition={{ repeat: location ? 0 : Infinity, duration: 2 }}
                    >
                      <MapPin className={`w-12 h-12 mx-auto mb-3 ${location ? 'text-green-400' : 'text-blue-400'}`} />
                    </motion.div>
                    {location ? (
                      <div>
                        <p className="text-green-300 font-semibold mb-1">Location Detected ✓</p>
                        <p className="text-sm text-slate-300 font-mono">
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-slate-300 font-medium mb-1">Detecting your location…</p>
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-2" />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => setStep('form')}
                    disabled={!location}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Continue to Issue Details →
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── STEP 2: FORM ──────────────────────────────────────────────────── */}
          {step === 'form' && (
            <motion.form
              key="form"
              onSubmit={handleSubmit(() => setStep('review'))}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="space-y-5"
            >
              {/* Voice Input Card */}
              <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-800/50">
                <CardContent className="pt-5 pb-5">
                  <p className="text-white font-semibold mb-1 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-400" /> Voice Report
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    Speak your issue — Gemini AI will automatically fill in the title, category, urgency, and description.
                  </p>

                  <Button
                    type="button"
                    onClick={startListening}
                    disabled={isListening || isStructuring}
                    className={`w-full gap-2 transition-all ${
                      isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' :
                      isStructuring ? 'bg-purple-700' :
                      'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isListening ? (
                      <><MicOff className="w-4 h-4" /> Listening… Speak now</>
                    ) : isStructuring ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Gemini is structuring your report…</>
                    ) : (
                      <><Mic className="w-4 h-4" /> Start Voice Report</>
                    )}
                  </Button>

                  {/* AI structured banner */}
                  <AnimatePresence>
                    {aiStructured && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-3 bg-green-900/30 border border-green-800/50 rounded-lg flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <p className="text-green-300 text-xs font-medium">Gemini AI structured your voice report — all fields have been filled in automatically!</p>
                        <button type="button" onClick={() => setAiStructured(false)} className="ml-auto text-green-600 hover:text-green-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Issue Details */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Issue Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Title <span className="text-red-400">*</span></label>
                    <input
                      {...register('title')}
                      placeholder="e.g. Deep pothole on Main Street near bus stop"
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    />
                    {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
                  </div>

                  {/* Category + Urgency row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Category</label>
                      <select
                        {...register('category')}
                        className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none transition"
                      >
                        {['Pothole', 'Garbage', 'Water Leakage', 'Streetlight Failure', 'Drainage Problem', 'Road Damage', 'Other'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Urgency</label>
                      <select
                        {...register('urgency')}
                        className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none transition"
                      >
                        <option value="low">🟢 Low</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="high">🟠 High</option>
                        <option value="critical">🔴 Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Description <span className="text-red-400">*</span></label>
                    <textarea
                      {...register('description')}
                      placeholder="Describe the issue in detail. Include location landmarks, how long it has existed, and any safety concerns."
                      rows={5}
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition resize-none"
                    />
                    {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Media Upload */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Add Photo (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-900/5 transition-all group"
                  >
                    <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-white font-medium">Click to upload</p>
                    <p className="text-slate-400 text-sm mt-1">Image or video of the issue (max 10MB)</p>
                  </button>
                  <input ref={fileInputRef} type="file" onChange={handleMediaUpload} accept="image/*,video/*" className="hidden" />
                  {mediaPreview && (
                    <div className="relative mt-3">
                      <img src={mediaPreview} alt="Preview" className="w-full rounded-xl max-h-52 object-cover" />
                      <button
                        type="button"
                        onClick={() => setMediaPreview(null)}
                        className="absolute top-2 right-2 w-7 h-7 bg-slate-900/80 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="button" onClick={() => setStep('location')} variant="outline" className="border-slate-600 hover:bg-slate-700 text-white">
                  ← Back
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Review & Submit →
                </Button>
              </div>
            </motion.form>
          )}

          {/* ── STEP 3: REVIEW ────────────────────────────────────────────────── */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Review Your Report</CardTitle>
                  <CardDescription>Confirm the details before submitting. Our AI will analyse your report automatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="bg-slate-700/50 rounded-xl p-5 space-y-4">
                    {[
                      { label: 'Title',       value: title },
                      { label: 'Category',    value: category },
                      { label: 'Urgency',     value: urgency?.charAt(0).toUpperCase() + urgency?.slice(1) },
                      { label: 'Description', value: description },
                      { label: 'Location',    value: location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Not set' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-white text-sm">{value}</p>
                      </div>
                    ))}
                    {mediaPreview && (
                      <div>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Photo</p>
                        <img src={mediaPreview} alt="Issue" className="w-full rounded-lg max-h-36 object-cover" />
                      </div>
                    )}
                  </div>

                  {/* AI pipeline info */}
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/40 rounded-xl p-4">
                    <div className="flex gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-medium text-sm">4-Stage AI Pipeline Ready</p>
                        <p className="text-blue-300 text-xs mt-1">
                          Triage → Verify → Resolve → Productivity — your issue will be classified, verified, assigned to a department, and tracked automatically.
                        </p>
                      </div>
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-300 text-sm">
                      ⚠️ {submitError}
                    </div>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                    <Button type="submit" disabled={uploading} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Submitting & Running AI…</>
                      ) : (
                        'Submit Report'
                      )}
                    </Button>
                    <Button type="button" onClick={() => setStep('form')} variant="outline" className="w-full border-slate-600 hover:bg-slate-700 text-white">
                      ← Back to Edit
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
