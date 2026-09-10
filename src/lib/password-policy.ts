export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 512;

export type PasswordValidationMode = "activation" | "recovery-reset" | "change";

export type PasswordInputErrors = Partial<
  Record<"password" | "confirmation" | "currentPassword", string>
>;

type PasswordInput = {
  password: string;
  confirmation: string;
  currentPassword?: string;
  mode: PasswordValidationMode;
};

export function validatePasswordInput({
  password,
  confirmation,
  currentPassword = "",
  mode,
}: PasswordInput): PasswordInputErrors {
  const errors: PasswordInputErrors = {};

  if (!password) {
    errors.password = "Enter a new password.";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  } else if (/^\d+$/.test(password)) {
    errors.password = "Use more than numbers only.";
  }

  if (!confirmation) {
    errors.confirmation = "Confirm your new password.";
  } else if (confirmation.length > PASSWORD_MAX_LENGTH) {
    errors.confirmation = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  } else if (password && password !== confirmation) {
    errors.confirmation = "The passwords do not match.";
  }

  if (mode === "change") {
    if (!currentPassword) {
      errors.currentPassword = "Enter your current password.";
    } else if (currentPassword.length > PASSWORD_MAX_LENGTH) {
      errors.currentPassword = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
    }

    if (currentPassword && password && currentPassword === password) {
      errors.password = "Choose a password different from your current password.";
    }
  }

  return errors;
}
