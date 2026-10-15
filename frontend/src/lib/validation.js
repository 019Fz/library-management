// Simple client-side checks shared by the login and register forms.
// The backend validates again, so these only give faster feedback.
export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}
