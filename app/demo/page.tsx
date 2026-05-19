"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function DemoPage() {
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
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      </div>

      <button
        onClick={() => router.push("/")}
        className="fixed top-6 right-6 z-50 w-10 h-10 liquid-glass rounded-full flex items-center justify-center hover:scale-105 transition-transform"
      >
        <X className="w-5 h-5 text-white/80" />
      </button>

      <div className="relative z-10 w-full max-w-5xl mx-auto my-12 bg-black/60 border border-white/10 rounded-[2rem] p-8 sm:p-12 backdrop-blur-md">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              <h2 className="font-semibold text-white">
                Personal information
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/60">
                Provide your basic contact details.
              </p>
            </div>
            <div className="sm:max-w-3xl md:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <div className="col-span-full sm:col-span-3">
                  <Label
                    htmlFor="first-name"
                    className="text-sm font-medium text-white/80"
                  >
                    First name
                  </Label>
                  <Input
                    type="text"
                    id="first-name"
                    name="first-name"
                    autoComplete="given-name"
                    placeholder="Emma"
                    className="mt-2 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label
                    htmlFor="last-name"
                    className="text-sm font-medium text-white/80"
                  >
                    Last name
                  </Label>
                  <Input
                    type="text"
                    id="last-name"
                    name="last-name"
                    autoComplete="family-name"
                    placeholder="Crown"
                    className="mt-2 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="col-span-full">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-white/80"
                  >
                    Email
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    autoComplete="email"
                    placeholder="emma@company.com"
                    className="mt-2 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label
                    htmlFor="birthyear"
                    className="text-sm font-medium text-white/80"
                  >
                    Birth year
                  </Label>
                  <Input
                    type="number"
                    id="birthyear"
                    name="year"
                    placeholder="1990"
                    className="mt-2 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label
                    htmlFor="role"
                    className="text-sm font-medium text-white/40"
                  >
                    Role
                  </Label>
                  <Input
                    type="text"
                    id="role"
                    name="role"
                    placeholder="Senior Manager"
                    disabled
                    className="mt-2 bg-white/5 border-white/5 text-white/50 cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs text-white/40">
                    Roles can only be changed by system admin.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Separator className="my-8 bg-white/10" />
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              <h2 className="font-semibold text-white">
                Workspace settings
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/60">
                Setup your environment variables and access level.
              </p>
            </div>
            <div className="sm:max-w-3xl md:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <div className="col-span-full sm:col-span-3">
                  <Label
                    htmlFor="workspace-name"
                    className="text-sm font-medium text-white/80"
                  >
                    Workspace name
                  </Label>
                  <Input
                    type="text"
                    id="workspace-name"
                    name="workspace-name"
                    placeholder="Test workspace"
                    className="mt-2 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label
                    htmlFor="visibility"
                    className="text-sm font-medium text-white/80"
                  >
                    Visibility
                  </Label>
                  <Select name="visibility" defaultValue="private">
                    <SelectTrigger id="visibility" className="mt-2 bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-full">
                  <Label
                    htmlFor="workspace-description"
                    className="text-sm font-medium text-white/80"
                  >
                    Workspace description
                  </Label>
                  <Textarea
                    id="workspace-description"
                    name="workspace-description"
                    className="mt-2 bg-white/5 border-white/10 text-white"
                    rows={4}
                  />
                  <p className="mt-2 text-xs text-white/40">
                    Note: description provided will not be displayed externally.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Separator className="my-8 bg-white/10" />
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              <h2 className="font-semibold text-white">
                Notification settings
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/60">
                Choose what updates are dispatched.
              </p>
            </div>
            <div className="sm:max-w-3xl md:col-span-2">
              <fieldset>
                <legend className="text-sm font-medium text-white/80">
                  Team
                </legend>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  Configure the types of team alerts you want to receive.
                </p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-x-3 py-1">
                    <Checkbox
                      id="team-requests"
                      name="team-requests"
                      defaultChecked
                      className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black"
                    />
                    <Label
                      htmlFor="team-requests"
                      className="text-sm font-medium text-white/80"
                    >
                      Team join requests
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-3 py-1">
                    <Checkbox
                      id="team-activity-digest"
                      name="team-activity-digest"
                      className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black"
                    />
                    <Label
                      htmlFor="team-activity-digest"
                      className="text-sm font-medium text-white/80"
                    >
                      Weekly team activity digest
                    </Label>
                  </div>
                </div>
              </fieldset>
              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-white/80">
                  Usage
                </legend>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  Configure the types of usage alerts you want to receive.
                </p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-x-3 py-1">
                    <Checkbox id="api-requests" name="api-requests" className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black" />
                    <Label
                      htmlFor="api-requests"
                      className="text-sm font-medium text-white/80"
                    >
                      API requests
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-3 py-1">
                    <Checkbox
                      id="workspace-execution"
                      name="workspace-execution"
                      className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black"
                    />
                    <Label
                      htmlFor="workspace-execution"
                      className="text-sm font-medium text-white/80"
                    >
                      Workspace loading times
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-3 py-1">
                    <Checkbox
                      id="query-caching"
                      name="query-caching"
                      defaultChecked
                      className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black"
                    />
                    <Label
                      htmlFor="query-caching"
                      className="text-sm font-medium text-white/80"
                    >
                      Query caching
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-3 py-1">
                    <Checkbox id="storage" name="storage" defaultChecked className="border-white/20 data-[state=checked]:bg-[#00ff66] data-[state=checked]:text-black" />
                    <Label
                      htmlFor="storage"
                      className="text-sm font-medium text-white/80"
                    >
                      Storage
                    </Label>
                  </div>
                </div>
              </fieldset>
            </div>
          </div>
          <Separator className="my-8 bg-white/10" />
          <div className="flex items-center justify-end space-x-4">
            <Button type="button" variant="outline" className="whitespace-nowrap bg-transparent text-white border-white/15 hover:bg-white/5 rounded-md" onClick={() => router.push("/")}>
              Go back
            </Button>
            <Button type="submit" className="whitespace-nowrap bg-[#00ff66] text-black hover:bg-[#00ff66]/90 rounded-md">
              Save settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
