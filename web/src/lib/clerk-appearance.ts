import { dark } from "@clerk/themes";
import type { Appearance } from "@clerk/types";

/** Matches app dark shell (`globals.css`) so auth cards aren’t washed out or mismatched. */
export const clerkAppearance: Appearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#38bdf8",
    colorBackground: "#0b1018",
    colorInputBackground: "#121722",
    colorInputText: "#f1f5f9",
    colorText: "#f1f5f9",
    colorTextSecondary: "#94a3b8",
    colorNeutral: "#64748b",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    colorWarning: "#fbbf24",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    card: "!bg-[rgba(15,16,24,0.97)] border border-white/[0.08] shadow-2xl shadow-black/50 backdrop-blur-xl",
    headerTitle: "!text-slate-50",
    headerSubtitle: "!text-slate-400",
    socialButtonsBlockButton:
      "!border-white/10 !bg-white/[0.04] hover:!bg-white/[0.08] !text-slate-100",
    socialButtonsBlockButtonText: "!text-slate-100",
    dividerLine: "!bg-white/10",
    dividerText: "!text-slate-500",
    formFieldLabel: "!text-slate-300",
    formFieldInput:
      "!border-white/10 !bg-[#0d121a] !text-slate-50 placeholder:!text-slate-500 focus:!ring-2 focus:!ring-sky-500/40 focus:!border-sky-500/50",
    formFieldInputShowPasswordButton: "!text-slate-400",
    identityPreviewText: "!text-slate-200",
    identityPreviewEditButton: "!text-sky-400 hover:!text-sky-300",
    footerActionLink: "!text-sky-400 hover:!text-sky-300",
    footerActionText: "!text-slate-400",
    formButtonPrimary:
      "!bg-gradient-to-r !from-sky-500 !to-indigo-600 hover:!from-sky-400 hover:!to-indigo-500 !text-white !shadow-lg !shadow-sky-500/15",
    footer: "!bg-transparent",
    alertText: "!text-slate-200",
    formFieldErrorText: "!text-red-300",
    otpCodeFieldInput: "!border-white/10 !bg-[#0d121a] !text-slate-50",
  },
};
