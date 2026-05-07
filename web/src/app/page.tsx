import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, Activity, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { userId } = auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-sky-300/90">
          <Activity className="h-3.5 w-3.5" />
          Clinician workflow demo
        </div>
        <h1 className="bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          Patient RiskCalc
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-400">
          Prioritize <span className="text-slate-200">assigned patient cases</span> from unstructured{" "}
          <span className="text-slate-200">clinical notes</span>. Explainable{" "}
          <span className="text-slate-200">risk scores</span> for your care queue — scoped per clinician.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="rounded-2xl px-8">
            <Link href="/sign-in">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="rounded-2xl px-8">
            <Link href="/sign-up">Create account</Link>
          </Button>
        </div>
        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Shield className="h-3.5 w-3.5 text-emerald-400/80" />
          Mock clinical data only · Cases never shared across users
        </p>
      </div>
    </main>
  );
}
