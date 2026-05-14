import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // Design system colors (raw hex via CSS vars)
        coral: {
          DEFAULT: "var(--accent-coral)",
          hover: "var(--accent-coral-hover)",
          soft: "var(--accent-soft)",
          "soft-2": "var(--accent-soft-2)",
          ink: "var(--accent-ink)",
          tint: "var(--accent-tint)",
        },
        cream: {
          DEFAULT: "var(--bg)",
          2: "var(--bg-2)",
          surface: "var(--surface-2)",
          deep: "var(--surface-3)",
        },
        sage: {
          DEFAULT: "var(--sage)",
          soft: "var(--sage-soft)",
          ink: "var(--sage-ink)",
        },
        sun: {
          DEFAULT: "var(--sun)",
          soft: "var(--sun-soft)",
          ink: "var(--sun-ink)",
        },
        plum: {
          DEFAULT: "var(--plum)",
          soft: "var(--plum-soft)",
          ink: "var(--plum-ink)",
        },
        ink: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          hover: "var(--sidebar-hover)",
          border: "var(--sidebar-border)",
          fg: "var(--text-on-sidebar)",
          "fg-2": "var(--text-on-sidebar-2)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Be Vietnam Pro", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Cormorant Garamond", "Iowan Old Style", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        lg: "var(--r-lg)",
        md: "var(--r-md)",
        sm: "var(--r-sm)",
        xl: "var(--r-xl)",
      },
      backgroundImage: {
        "gradient-chdv": "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6), transparent 50%), linear-gradient(135deg, #f2d8d0 0%, #d68d72 50%, #c96442 100%)",
        "gradient-vp": "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.45), transparent 50%), linear-gradient(135deg, #f4e7d0 0%, #b88a5c 50%, #4d2f1e 100%)",
        "gradient-brand": "linear-gradient(135deg, #c96442 0%, #d17b5e 50%, #d5866c 100%)",
        "gradient-success": "linear-gradient(135deg, #4f8a5c 0%, #6ba978 100%)",
        "gradient-warning": "linear-gradient(135deg, #e9b22e 0%, #d6921c 100%)",
        "gradient-danger": "linear-gradient(135deg, #d17b5e 0%, #e25640 100%)",
        "gradient-warm": "linear-gradient(135deg, #f9ece8 0%, #f2d8d0 50%, #e7b9aa 100%)",
        "gradient-mint": "linear-gradient(135deg, #e3efd9 0%, #c8dfb6 100%)",
        "gradient-jewel-1": "linear-gradient(135deg, #c96442 0%, #b55a3b 100%)",
        "gradient-jewel-2": "linear-gradient(135deg, #4f8a5c 0%, #2d5736 100%)",
        "gradient-jewel-3": "linear-gradient(135deg, #e9b22e 0%, #7c5d10 100%)",
        "gradient-jewel-4": "linear-gradient(135deg, #7b4f9a 0%, #4a2868 100%)",
      },
      boxShadow: {
        "design-sm": "0 1px 2px rgba(40, 22, 5, 0.04)",
        "design-md": "0 8px 24px -12px rgba(120, 60, 30, 0.18)",
        "design-lg": "0 24px 60px -28px rgba(120, 50, 22, 0.32)",
        "design-pop": "0 18px 40px -16px rgba(201, 100, 66, 0.35)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(.7)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        glint: {
          "0%": { backgroundPosition: "-200% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        shimmer: {
          "0%, 100%": { opacity: ".5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        rise: "rise 0.5s cubic-bezier(.22,.8,.18,1) both",
        pop: "pop 0.45s cubic-bezier(.34,1.56,.64,1) both",
        float: "float 3s cubic-bezier(.22,.8,.18,1) infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        glint: "glint 4s cubic-bezier(.22,.8,.18,1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
