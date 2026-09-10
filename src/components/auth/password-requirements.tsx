import { Check, Circle } from "lucide-react";
import type { ReactNode } from "react";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordValidationMode,
} from "@/lib/password-policy";
import { cn } from "@/lib/utils";

type RequirementState = "pending" | "pass" | "fail";

type PasswordRequirementsProps = {
  id: string;
  password: string;
  confirmation?: string;
  currentPassword?: string;
  mode: PasswordValidationMode;
  disabled?: boolean;
  className?: string;
};

function stateFor(value: boolean, hasInput: boolean): RequirementState {
  if (!hasInput) return "pending";
  return value ? "pass" : "fail";
}

function Requirement({
  children,
  state,
}: {
  children: ReactNode;
  state: RequirementState;
}) {
  return (
    <li className="auth-password-requirements__item" data-state={state}>
      <span aria-hidden="true" className="auth-password-requirements__marker">
        {state === "pass" ? <Check /> : <Circle />}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function PasswordRequirements({
  className,
  confirmation,
  currentPassword,
  disabled = false,
  id,
  mode,
  password,
}: PasswordRequirementsProps) {
  const hasPassword = password.length > 0;
  const hasConfirmation = Boolean(confirmation);
  const hasCurrentPassword = Boolean(currentPassword);

  return (
    <div
      aria-disabled={disabled || undefined}
      className={cn("auth-password-requirements", className)}
      id={id}
    >
      <p className="auth-password-requirements__title">Password requirements</p>
      <ul className="auth-password-requirements__list">
        <Requirement
          state={stateFor(password.length >= PASSWORD_MIN_LENGTH, hasPassword)}
        >
          At least {PASSWORD_MIN_LENGTH} characters
        </Requirement>
        <Requirement
          state={stateFor(password.length <= PASSWORD_MAX_LENGTH, hasPassword)}
        >
          {PASSWORD_MAX_LENGTH} characters or fewer
        </Requirement>
        <Requirement
          state={stateFor(!/^\d+$/.test(password), hasPassword)}
        >
          Not only numbers
        </Requirement>
        {confirmation !== undefined ? (
          <Requirement
            state={stateFor(
              Boolean(password) && password === confirmation,
              hasConfirmation,
            )}
          >
            Matches confirmation
          </Requirement>
        ) : null}
        {mode === "change" ? (
          <Requirement
            state={stateFor(
              Boolean(password) && Boolean(currentPassword) && password !== currentPassword,
              hasPassword && hasCurrentPassword,
            )}
          >
            Different from your current password
          </Requirement>
        ) : null}
      </ul>
      <p className="auth-password-requirements__guidance">
        Avoid common passwords or details from your account. Use a password you do not use elsewhere.
      </p>
    </div>
  );
}
