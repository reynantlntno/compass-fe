"use client";

import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = Omit<ComponentProps<typeof Input>, "type">;

export function PasswordField({ className, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="auth-password-field">
      <Input
        {...props}
        className={className}
        type={isVisible ? "text" : "password"}
      />
      <Button
        aria-controls={props.id}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        className="auth-password-field__toggle"
        onClick={() => setIsVisible((current) => !current)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {isVisible ? (
          <EyeOff aria-hidden="true" />
        ) : (
          <Eye aria-hidden="true" />
        )}
      </Button>
    </span>
  );
}
