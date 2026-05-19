"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Sparkles, X, Terminal, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRouter } from "next/navigation";

export default function ApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
    twitter: "",
    github: "",
    deploymentLink: "",
    architectureCheck: "",
    currentBuild: "",
    frictionPoint: "",
    locationStatus: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRadioChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      locationStatus: value,
    }));
  };

  const nextStep = () => {
    setError("");
    if (step === 1) {
      if (!formData.name || !formData.email) {
        setError("Name and Email are required.");
        return;
      }
    }
    if (step === 2) {
      if (!formData.deploymentLink || !formData.architectureCheck) {
        setError("Both proof of work fields are required.");
        return;
      }
    }
    if (step === 3) {
      if (!formData.currentBuild || !formData.frictionPoint) {
        setError("Both context fields are required.");
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const prevStep = () => {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.locationStatus) {
      setError("Please select your location status.");
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setStep(5); // Success step
    } catch (err: any) {
      setError(err.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white font-sans selection:bg-[#00ff66]/30 flex items-center justify-center p-4">
      {/* Background Video */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      </div>

      {/* Close Button */}
      <button
        onClick={() => router.push("/")}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 w-9 h-9 sm:w-10 sm:h-10 liquid-glass rounded-full flex items-center justify-center hover:scale-105 transition-transform"
      >
        <X className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white/80" />
      </button>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl mx-auto my-4 sm:my-8 md:my-12 px-2 sm:px-0">
        <div className="liquid-glass-strong rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-10 md:p-12 border border-white/10 shadow-2xl overflow-hidden relative min-h-[500px] sm:min-h-[580px] flex flex-col justify-between">
          
          {/* Progress Indicator */}
          {step > 0 && step < 5 && (
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
              <motion.div
                className="h-full bg-[#00ff66]"
                initial={{ width: "0%" }}
                animate={{ width: `${((step - 1) / 3) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 0: Briefing / Warning */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 flex flex-col justify-between flex-grow"
              >
                <div className="space-y-6 text-center pt-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#00ff66]/10 border border-[#00ff66]/20 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_30px_rgba(0,255,102,0.1)]">
                    <Terminal className="w-7 h-7 sm:w-8 sm:h-8 text-[#00ff66]" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif italic text-white">
                    MISSION BRIEFING
                  </h2>
                  <p className="text-white/80 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                    Context Window HQ is a high-density physical hacker house in Bengaluru gathering elite AI engineering talent to build, deploy, and scale.
                  </p>
                  <p className="text-red-400/90 font-mono text-xs sm:text-sm leading-relaxed max-w-lg mx-auto bg-red-950/20 border border-red-950/30 p-4 sm:p-6 rounded-2xl">
                    "WARNING: We do not read resumes. We do not care about your degree or your corporate title. We only care about what you ship. Fill this out only if you are ready for a 30-day, bare-metal sprint with mandatory midnight deployments."
                  </p>
                  <p className="text-white/50 text-[11px] sm:text-sm max-w-md mx-auto">
                    This form functions as a compiler. It will filter for actual builders.
                  </p>
                </div>

                <div className="flex justify-center pt-8">
                  <button
                    type="button"
                    onClick={nextStep}
                    className="relative group overflow-hidden w-full sm:w-auto px-8 py-4 liquid-glass border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full font-semibold text-base shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:shadow-[0_0_25px_rgba(255,255,255,0.05)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
                  >
                    <div className="relative overflow-hidden h-6 w-full">
                      <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-6 group-hover:translate-y-0">
                        {/* Hover State: Green text, white arrow */}
                        <span className="h-6 flex items-center justify-center text-[#00ff66] gap-2">
                          I AM READY TO SPRINT <ArrowRight className="w-5 h-5 text-white" />
                        </span>
                        {/* Default State: White text, green arrow */}
                        <span className="h-6 flex items-center justify-center text-white/90 gap-2">
                          I AM READY TO SPRINT <ArrowRight className="w-5 h-5 text-[#00ff66]" />
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 1: Core Identifiers */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-grow flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif">Section 1: The Core Identifiers</h2>
                    <p className="text-xs sm:text-sm text-white/50 mt-1">Keep it bare-bones. Who are you and where do you live on the internet?</p>
                  </div>
                  <Separator className="bg-white/10" />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/80">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Emma Crown"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-white/80">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="emma@company.com"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp" className="text-white/80">WhatsApp Number</Label>
                        <Input
                          id="whatsapp"
                          name="whatsapp"
                          value={formData.whatsapp}
                          onChange={handleInputChange}
                          placeholder="+91 XXXXX XXXXX"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="twitter" className="text-white/80">X / Twitter Handle</Label>
                        <Input
                          id="twitter"
                          name="twitter"
                          value={formData.twitter}
                          onChange={handleInputChange}
                          placeholder="x.com/username"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="github" className="text-white/80">GitHub Profile</Label>
                        <Input
                          id="github"
                          name="github"
                          value={formData.github}
                          onChange={handleInputChange}
                          placeholder="github.com/username"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-950/30">{error}</div>}

                <div className="flex justify-between pt-6 mt-auto">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-2.5 text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="relative group overflow-hidden px-6 py-2.5 liquid-glass border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full font-semibold text-sm shadow-[0_0_10px_rgba(255,255,255,0.01)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
                  >
                    <div className="relative overflow-hidden h-5">
                      <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-5 group-hover:translate-y-0">
                        {/* Hover State: Green text, white arrow */}
                        <span className="h-5 flex items-center justify-center text-[#00ff66] gap-1.5">
                          Continue <ArrowRight className="w-4 h-4 text-white" />
                        </span>
                        {/* Default State: White text, green arrow */}
                        <span className="h-5 flex items-center justify-center text-white/90 gap-1.5">
                          Continue <ArrowRight className="w-4 h-4 text-[#00ff66]" />
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Proof of Work */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-grow flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif">Section 2: The Proof of Work</h2>
                    <p className="text-xs sm:text-sm text-red-400/80 font-mono mt-1">This is where 90% of applicants drop off. Prove your work.</p>
                  </div>
                  <Separator className="bg-white/10" />

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="deploymentLink" className="text-white/80 flex items-center gap-1.5">
                        The Deployment Link <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="deploymentLink"
                        name="deploymentLink"
                        value={formData.deploymentLink}
                        onChange={handleInputChange}
                        placeholder="Live URL, open-source PR, or repo link"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                      />
                      <p className="text-[11px] text-white/40">
                        Drop the link to the most technically complex thing you shipped in the last 60 days.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="architectureCheck" className="text-white/80">
                        The Architecture Check <span className="text-red-400">*</span>
                      </Label>
                      <Textarea
                        id="architectureCheck"
                        name="architectureCheck"
                        value={formData.architectureCheck}
                        onChange={handleInputChange}
                        placeholder="Explain the road block and the hack..."
                        rows={4}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 resize-none"
                      />
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        What is the hardest technical roadblock you hit while building that, and how did you hack your way past it?
                      </p>
                    </div>
                  </div>
                </div>

                {error && <div className="text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-950/30">{error}</div>}

                <div className="flex justify-between pt-6 mt-auto">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-2.5 text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="relative group overflow-hidden px-6 py-2.5 liquid-glass border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full font-semibold text-sm shadow-[0_0_10px_rgba(255,255,255,0.01)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
                  >
                    <div className="relative overflow-hidden h-5">
                      <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-5 group-hover:translate-y-0">
                        {/* Hover State: Green text, white arrow */}
                        <span className="h-5 flex items-center justify-center text-[#00ff66] gap-1.5">
                          Continue <ArrowRight className="w-4 h-4 text-white" />
                        </span>
                        {/* Default State: White text, green arrow */}
                        <span className="h-5 flex items-center justify-center text-white/90 gap-1.5">
                          Continue <ArrowRight className="w-4 h-4 text-[#00ff66]" />
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Current Context */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-grow flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif">Section 3: The Current Context</h2>
                    <p className="text-xs sm:text-sm text-white/50 mt-1">We need to know if what you are building fits the thesis of the house.</p>
                  </div>
                  <Separator className="bg-white/10" />

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="currentBuild" className="text-white/80">
                        The Current Build <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="currentBuild"
                        name="currentBuild"
                        value={formData.currentBuild}
                        onChange={handleInputChange}
                        placeholder="e.g., Enterprise AI brain, multi-agent frameworks, local deployment rigs"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                      />
                      <p className="text-[11px] text-white/40">
                        What are you currently orchestrating?
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="frictionPoint" className="text-white/80">
                        The Friction Point <span className="text-red-400">*</span>
                      </Label>
                      <Textarea
                        id="frictionPoint"
                        name="frictionPoint"
                        value={formData.frictionPoint}
                        onChange={handleInputChange}
                        placeholder="We eliminate bottlenecks. What's yours?"
                        rows={4}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 resize-none"
                      />
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        Why do you need Context Window HQ right now? What is the specific friction you need us to eliminate?
                      </p>
                    </div>
                  </div>
                </div>

                {error && <div className="text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-950/30">{error}</div>}

                <div className="flex justify-between pt-6 mt-auto">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-2.5 text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="relative group overflow-hidden px-6 py-2.5 liquid-glass border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full font-semibold text-sm shadow-[0_0_10px_rgba(255,255,255,0.01)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
                  >
                    <div className="relative overflow-hidden h-5">
                      <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-5 group-hover:translate-y-0">
                        {/* Hover State: Green text, white arrow */}
                        <span className="h-5 flex items-center justify-center text-[#00ff66] gap-1.5">
                          Continue <ArrowRight className="w-4 h-4 text-white" />
                        </span>
                        {/* Default State: White text, green arrow */}
                        <span className="h-5 flex items-center justify-center text-white/90 gap-1.5">
                          Continue <ArrowRight className="w-4 h-4 text-[#00ff66]" />
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Logistics */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-grow flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif">Section 4: The Logistics</h2>
                    <p className="text-xs sm:text-sm text-white/50 mt-1">Confirm you can check into the physical hacker house in Bengaluru.</p>
                  </div>
                  <Separator className="bg-white/10" />

                  <div className="space-y-4">
                    <Label className="text-white/80 text-sm sm:text-base leading-relaxed block">
                      Cohort Zero is a 30-day residency at our physical hacker house in Bengaluru. What is your status?
                    </Label>

                    <RadioGroup
                      value={formData.locationStatus}
                      onValueChange={handleRadioChange}
                      className="space-y-3 mt-4"
                    >
                      <label
                        htmlFor="blr-already"
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                          formData.locationStatus === "blr-already"
                            ? "bg-[#00ff66]/5 border-[#00ff66]/30 ring-1 ring-[#00ff66]/20"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <RadioGroupItem value="blr-already" id="blr-already" className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black mt-1" />
                        <span className="text-sm text-white/90">I am already in BLR.</span>
                      </label>

                      <label
                        htmlFor="blr-relocate"
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                          formData.locationStatus === "blr-relocate"
                            ? "bg-[#00ff66]/5 border-[#00ff66]/30 ring-1 ring-[#00ff66]/20"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <RadioGroupItem value="blr-relocate" id="blr-relocate" className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black mt-1" />
                        <span className="text-sm text-white/90">I can relocate to BLR immediately for the 30-day sprint.</span>
                      </label>

                      <label
                        htmlFor="blr-cannot"
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                          formData.locationStatus === "blr-cannot"
                            ? "bg-[#00ff66]/5 border-[#00ff66]/30 ring-1 ring-[#00ff66]/20"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <RadioGroupItem value="blr-cannot" id="blr-cannot" className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black mt-1" />
                        <span className="text-sm text-white/90">I cannot make it to BLR right now.</span>
                      </label>
                    </RadioGroup>
                  </div>
                </div>

                {error && <div className="text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-950/30">{error}</div>}

                <div className="flex justify-between pt-6 mt-auto">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-2.5 text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="relative group overflow-hidden px-8 py-3.5 liquid-glass border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full font-bold text-sm shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:shadow-[0_0_25px_rgba(255,255,255,0.05)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center min-w-[180px]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-1.5 text-white/95">
                        <Loader2 className="w-4 h-4 animate-spin text-[#00ff66]" /> Transmitting...
                      </span>
                    ) : (
                      <div className="relative overflow-hidden h-5 w-full">
                        <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-5 group-hover:translate-y-0">
                          {/* Hover State: Green text, white arrow */}
                          <span className="h-5 flex items-center justify-center text-[#00ff66] gap-1.5">
                            Submit Application <ArrowRight className="w-4 h-4 text-white" />
                          </span>
                          {/* Default State: White text, green arrow */}
                          <span className="h-5 flex items-center justify-center text-white/90 gap-1.5">
                            Submit Application <ArrowRight className="w-4 h-4 text-[#00ff66]" />
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Success Screen */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center py-12 space-y-6"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-24 h-24 bg-[#00ff66]/5 rounded-full flex items-center justify-center border border-[#00ff66]/20 shadow-[0_0_50px_rgba(0,255,102,0.1)] relative"
                >
                  {/* Subtle pulsing background glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#00ff66]/10 -z-10"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.6, 0.2, 0.6],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 60 60"
                    fill="none"
                    className="w-12 h-12 text-[#00ff66]"
                  >
                    {/* Animated Outer Circle */}
                    <motion.circle
                      cx="30"
                      cy="30"
                      r="26"
                      stroke="#00ff66"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    {/* Animated Checkmark Path */}
                    <motion.path
                      d="M18 30 L26 38 L42 22"
                      stroke="#00ff66"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                    />
                  </svg>
                </motion.div>
                <h2 className="text-3xl font-bold tracking-tight">TRANSMISSION COMPLETE</h2>
                <p className="text-white/60 text-base max-w-md mx-auto">
                  Your profile, proof of work, and thesis alignments have been written to our context. We will review your build status for a residency spot at the hacker house and contact you via WhatsApp shortly.
                </p>
                 <button
                   onClick={() => router.push("/")}
                   className="relative group overflow-hidden px-8 py-2.5 liquid-glass border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-full font-semibold text-sm shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center mt-4"
                 >
                   <div className="relative overflow-hidden h-5">
                     <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-5 group-hover:translate-y-0">
                       {/* Hover State: Green text */}
                       <span className="h-5 flex items-center justify-center text-[#00ff66]">
                         Return to Matrix
                       </span>
                       {/* Default State: White text */}
                       <span className="h-5 flex items-center justify-center text-white/90">
                         Return to Matrix
                       </span>
                     </div>
                   </div>
                 </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mt-6 text-white/40 text-xs font-mono">
          CONTEXT WINDOW HQ // BARE-METAL COHORT ZERO APPLICATION
        </div>
      </div>
    </main>
  );
}
