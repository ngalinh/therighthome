"use client";
import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * Date input that displays the value as DD/MM/YYYY regardless of browser
 * locale. Uses a native <input type="date"> underneath (so the platform date
 * picker still opens on tap), but hides the native text via transparent
 * color and overlays a custom DD/MM/YYYY label on top.
 */
const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "date", value, ...props }, ref) => {
    const display = formatDdMmYyyy(value);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={type}
          value={value ?? ""}
          className={cn(
            "pr-10 [&::-webkit-date-and-time-value]:text-transparent [&::-webkit-datetime-edit]:text-transparent",
            className,
          )}
          style={{ color: "transparent", caretColor: "transparent" }}
          {...props}
        />
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
          style={{ color: display ? "var(--text)" : "var(--text-3)" }}
        >
          {display || "DD/MM/YYYY"}
        </span>
        <Calendar
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: "var(--text-3)" }}
        />
      </div>
    );
  },
);
DateInput.displayName = "DateInput";

function formatDdMmYyyy(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

export { DateInput };
