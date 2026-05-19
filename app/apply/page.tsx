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
        className="fixed top-6 right-6 z-50 w-10 h-10 liquid-glass rounded-full flex items-center justify-center hover:scale-105 transition-transform"
      >
        <X className="w-5 h-5 text-white/80" />
      </button>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl mx-auto my-12">
        <div className="liquid-glass-strong rounded-[2.5rem] p-8 sm:p-12 border border-white/10 shadow-2xl overflow-hidden relative min-h-[580px] flex flex-col justify-between">
          
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
                <div className="space-y-6 text-center pt-4">
                  <div className="w-16 h-16 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                    <Terminal className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight font-serif italic text-white">
                    MISSION BRIEFING
                  </h2>
                  <p className="text-red-400/90 font-mono text-sm leading-relaxed max-w-lg mx-auto bg-red-950/20 border border-red-950/30 p-6 rounded-2xl">
                    "WARNING: We do not read resumes. We do not care about your degree or your corporate title. We only care about what you ship. Fill this out only if you are ready for a 30-day, bare-metal sprint with mandatory midnight deployments."
                  </p>
                  <p className="text-white/60 text-sm max-w-md mx-auto">
                    This form functions as a compiler. It will filter for actual builders.
                  </p>
                </div>

                <div className="flex justify-center pt-8">
                  <Button
                    onClick={nextStep}
                    className="bg-[#00ff66] text-black hover:bg-[#00ff66]/90 rounded-full px-8 py-6 font-bold text-base shadow-[0_0_30px_rgba(0,255,102,0.2)] hover:scale-105 transition-transform"
                  >
                    I AM READY TO SPRINT <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
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
                    <h2 className="text-2xl font-bold tracking-tight text-white font-serif">Section 1: The Core Identifiers</h2>
                    <p className="text-sm text-white/50 mt-1">Keep it bare-bones. Who are you and where do you live on the internet?</p>
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
                  <Button onClick={prevStep} variant="ghost" className="text-white/60 hover:text-white rounded-full">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button onClick={nextStep} className="bg-white text-black hover:bg-white/90 rounded-full px-6">
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
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
                    <h2 className="text-2xl font-bold tracking-tight text-white font-serif">Section 2: The Proof of Work</h2>
                    <p className="text-sm text-red-400/80 font-mono mt-1">This is where 90% of applicants drop off. Prove your work.</p>
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
                  <Button onClick={prevStep} variant="ghost" className="text-white/60 hover:text-white rounded-full">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button onClick={nextStep} className="bg-white text-black hover:bg-white/90 rounded-full px-6">
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
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
                    <h2 className="text-2xl font-bold tracking-tight text-white font-serif">Section 3: The Current Context</h2>
                    <p className="text-sm text-white/50 mt-1">We need to know if what you are building fits the thesis of the house.</p>
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
                  <Button onClick={prevStep} variant="ghost" className="text-white/60 hover:text-white rounded-full">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button onClick={nextStep} className="bg-white text-black hover:bg-white/90 rounded-full px-6">
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
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
                    <h2 className="text-2xl font-bold tracking-tight text-white font-serif">Section 4: The Logistics</h2>
                    <p className="text-sm text-white/50 mt-1">Confirm you can actually execute on the 30-day physical sprint.</p>
                  </div>
                  <Separator className="bg-white/10" />

                  <div className="space-y-4">
                    <Label className="text-white/80 text-base">
                      Cohort Zero is a physical sprint in Bengaluru (HSR Layout / Koramangala area). What is your status?
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
                  <Button onClick={prevStep} variant="ghost" className="text-white/60 hover:text-white rounded-full">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-[#00ff66] text-black hover:bg-[#00ff66]/90 rounded-full px-8 font-bold shadow-[0_0_25px_rgba(0,255,102,0.25)] hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Transmitting...
                      </>
                    ) : (
                      <>
                        Submit Application <ArrowRight className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </Button>
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
                <div className="w-20 h-20 bg-[#00ff66]/20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,255,102,0.2)]">
                  <CheckCircle2 className="w-10 h-10 text-[#00ff66]" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">TRANSMISSION COMPLETE</h2>
                <p className="text-white/60 text-base max-w-md mx-auto">
                  Your profile, proof of work, and thesis alignments have been written to our context. We will review your build status and contact you via WhatsApp shortly.
                </p>
                <Button
                  onClick={() => router.push("/")}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/10 px-8 py-2 mt-4"
                >
                  Return to Matrix
                </Button>
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
