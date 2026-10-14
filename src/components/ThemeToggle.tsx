"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Laptop },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-11 w-full animate-pulse rounded-xl bg-[var(--color-surface-2)]" />;
  }

  return (
    <SegmentedControl
      shape="rounded"
      aria-label="Tema"
      value={(theme ?? "system") as (typeof OPTIONS)[number]["value"]}
      onChange={setTheme}
      buttonClassName="text-xs"
      options={OPTIONS.map(({ value, label, icon: Icon }) => ({
        value,
        label: (
          <>
            <Icon size={14} />
            {label}
          </>
        ),
      }))}
    />
  );
}
