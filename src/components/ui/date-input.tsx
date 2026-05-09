"use client";
import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * Date input that always shows a Lucide calendar icon inside the input box on
 * the right. The native ::-webkit-calendar-picker-indicator is hidden via CSS
 * (opacity: 0) but still receives clicks, so tapping anywhere on the input —
 * including the icon area — opens the picker on every platform.
 */
const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "date", ...props }, ref) => (
    <div className="relative">
      <Input
        ref={ref}
        type={type}
        className={cn("pr-10", className)}
        {...props}
      />
      <Calendar
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4"
        style={{ color: "var(--text-3)" }}
      />
    </div>
  ),
);
DateInput.displayName = "DateInput";

export { DateInput };
