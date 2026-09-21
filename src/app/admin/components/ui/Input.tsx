import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export default function Input({ className, label, error, helper, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        className={cn(
          "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm",
          "outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
          "disabled:bg-slate-100 disabled:text-slate-500",
          "dark:bg-slate-900 dark:border-slate-600 dark:text-white",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...props}
      />
      {(error || helper) && (
        <p className={cn("text-xs", error ? "text-red-500" : "text-slate-400")}>
          {error ?? helper}
        </p>
      )}
    </div>
  );
}
