"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Check, CircleCheck, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const highlights = [
  {
    id: 1,
    feature: "Used by top design teams worldwide",
  },
  {
    id: 2,
    feature: "Seamless integration with design tools",
  },
  {
    id: 3,
    feature: "Real-time collaboration features",
  },
];

const plans = [
  {
    name: "Creator",
    features: [
      { feature: "Up to 3 design projects" },
      { feature: "Basic collaboration tools" },
      { feature: "5GB cloud storage" },
      { feature: "Community forum support" },
    ],
    price: "$15",
    href: "#",
    isRecommended: false,
  },
  {
    name: "Team",
    features: [
      { feature: "Unlimited design projects" },
      { feature: "Advanced collaboration suite" },
      { feature: "50GB cloud storage" },
      { feature: "Priority email support" },
    ],
    price: "$49",
    href: "#",
    isRecommended: true,
  },
  {
    name: "Agency",
    features: [
      { feature: "Unlimited projects and team members" },
      { feature: "Client portal access" },
      { feature: "250GB cloud storage" },
      { feature: "White-labeling options" },
      { feature: "Dedicated account manager" },
    ],
    price: "$99",
    href: "#",
    isRecommended: false,
  },
];

export default function WorkspacePage() {
  const [selected, setSelected] = useState(plans[0]);
  const router = useRouter();

  return (
    <div className="relative min-h-screen w-full text-white bg-black/95 p-10 flex items-center justify-center">
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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]" />
      </div>

      <button
        onClick={() => router.push("/")}
        className="fixed top-6 right-6 z-50 w-10 h-10 liquid-glass rounded-full flex items-center justify-center hover:scale-105 transition-transform"
      >
        <X className="w-5 h-5 text-white/80" />
      </button>

      <div className="relative z-10 w-full max-w-7xl mx-auto my-12 bg-black/60 border border-white/10 rounded-[2rem] p-8 sm:p-12 backdrop-blur-md">
        <form className="sm:mx-auto sm:max-w-7xl">
          <h3 className="text-2xl font-semibold text-white">
            Create new design workspace
          </h3>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12 mt-6">
            <div className="lg:col-span-7">
              <div className="space-y-4 md:space-y-6">
                <div className="md:flex md:items-center md:space-x-4">
                  <div className="md:w-1/4">
                    <Label htmlFor="organization" className="font-medium text-white/80">
                      Organization
                    </Label>
                    <Select defaultValue="1">
                      <SelectTrigger
                        id="organization"
                        name="organization"
                        className="mt-2 w-full bg-white/5 border-white/10 text-white"
                      >
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10 text-white">
                        <SelectItem value="1">Acme, Inc.</SelectItem>
                        <SelectItem value="2">Hero Labs</SelectItem>
                        <SelectItem value="3">Rose Holding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4 md:mt-0 md:w-3/4">
                    <Label htmlFor="workspace" className="font-medium text-white/80">
                      Workspace name
                    </Label>
                    <Input id="workspace" name="workspace" className="mt-2 bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="region" className="font-medium text-white/80">
                    Region
                  </Label>
                  <Select defaultValue="iad1">
                    <SelectTrigger id="region" name="region" className="mt-2 bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="fra1">
                        eu-central-1 (Frankfurt, Germany)
                      </SelectItem>
                      <SelectItem value="iad1">
                        us-east-1 (Washington, D.C., USA)
                      </SelectItem>
                      <SelectItem value="lhr1">
                        eu-west-2 (London, United Kingdom)
                      </SelectItem>
                      <SelectItem value="sfo1">
                        us-west-1 (San Francisco, USA)
                      </SelectItem>
                      <SelectItem value="sin1">
                        ap-southeast-1 (Singapore)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-sm text-white/60">
                    For best performance, choose a region closest to your
                    operations
                  </p>
                </div>
              </div>
              <h4 className="mt-14 font-medium text-white">
                Plan type<span className="text-red-500">*</span>
              </h4>
              <RadioGroup
                value={selected.name}
                onValueChange={(value) =>
                  setSelected(
                    plans.find((plan) => plan.name === value) || plans[0]
                  )
                }
                className="mt-4 space-y-4"
              >
                {plans.map((plan) => (
                  <label
                    key={plan.name}
                    htmlFor={plan.name}
                    className={cn(
                      "relative block cursor-pointer rounded-md border bg-white/5 transition",
                      selected.name === plan.name
                        ? "border-[#00ff66]/30 ring-2 ring-[#00ff66]/20"
                        : "border-white/10"
                    )}
                  >
                    <div className="flex items-start space-x-4 px-6 py-4">
                      <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                        <RadioGroupItem value={plan.name} id={plan.name} className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black" />
                      </div>
                      <div className="w-full">
                        <p className="leading-6">
                          <span className="font-semibold text-white">
                            {plan.name}
                          </span>
                          {plan.isRecommended && (
                            <Badge variant="secondary" className="ml-2 bg-[#00ff66]/10 text-[#00ff66] border-transparent">
                              recommended
                            </Badge>
                          )}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {plan.features.map((feature, index) => (
                            <li
                              key={index}
                              className="flex items-center gap-2 text-sm text-white/70"
                            >
                              <Check
                                className="h-4 w-4 text-white/40"
                                aria-hidden={true}
                              />
                              {feature.feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-b-md border-t border-white/10 bg-white/5 px-6 py-3">
                      <a
                        href={plan.href}
                        className="inline-flex items-center gap-1 text-sm text-[#00ff66] hover:underline hover:underline-offset-4"
                      >
                        Learn more
                        <ExternalLink className="h-4 w-4" aria-hidden={true} />
                      </a>
                      <div>
                        <span className="text-lg font-semibold text-white">
                          {plan.price}
                        </span>
                        <span className="text-sm text-white/60">/mo</span>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="lg:col-span-5">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-6">
                  <h4 className="text-sm font-semibold text-white">
                    Choose the right plan for your design team
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Our flexible plans are designed to scale with your team&apos;s
                    needs. All plans include core design collaboration features
                    with varying levels of storage and support.
                  </p>
                  <ul className="mt-4 space-y-1">
                    {highlights.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center space-x-2 py-1.5 text-white/80"
                      >
                        <CircleCheck className="h-5 w-5 text-[#00ff66]" />
                        <span className="truncate text-sm">{item.feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#"
                    className="mt-4 inline-flex items-center gap-1 text-sm text-[#00ff66] hover:underline"
                  >
                    Learn more
                    <ExternalLink className="h-4 w-4" aria-hidden={true} />
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
          <Separator className="my-10 bg-white/10" />
          <div className="flex items-center justify-end space-x-4">
            <Button type="button" variant="ghost" onClick={() => router.push("/")} className="text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button type="submit" className="bg-[#00ff66] text-black hover:bg-[#00ff66]/90 rounded-md px-6">Update</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
