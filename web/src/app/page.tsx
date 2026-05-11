import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, Shield, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { userId } = auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <h1 className="bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          Patient RiskCalc
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-400">
          Turn free-text notes into structured fields and a triage-style risk readout. Try it without signing in.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="rounded-2xl px-8 shadow-lg shadow-sky-500/15">
            <Link href="/dashboard">
              <UserCircle2 className="h-4 w-4" />
              Continue as guest
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="rounded-2xl px-8">
            <Link href="/sign-in">Sign in to save cases</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Guest workspace starts empty; load sample cases from the dashboard if needed. Sign in to persist with Clerk
          and Turso.
        </p>
        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Shield className="h-3.5 w-3.5 text-emerald-400/80" />
          For evaluation only — not for real patients or clinical decisions
        </p>
      </div>
    </main>
  );
}
