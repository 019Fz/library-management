// Login form. On success the GuestRoute sends the user to /books.
import { useState } from "react";
import { useAuth } from "../context/useAuth.js";
import { getApiError } from "../api/client.js";
import { isValidEmail } from "../lib/validation.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import AuthSplit from "../components/AuthSplit.jsx";
import FormField from "../components/ui/FormField.jsx";
import ErrorBox from "../components/ui/ErrorBox.jsx";
import Button from "../components/ui/Button.jsx";

export default function Login() {
  usePageTitle("Log in");
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null); // { message, details }
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    // Quick checks before calling the server
    const problems = [];
    if (!isValidEmail(email.trim())) problems.push("Enter a valid email address.");
    if (!password) problems.push("Enter your password.");
    if (problems.length > 0) {
      setError({ message: "Please fix the following:", details: problems });
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getApiError(err)); // e.g. "Invalid email or password"
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplit panelSide="right" question="New here?" action="Create an account" buttonLabel="Register" to="/register">
      <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
      <p className="mt-2 text-muted">Log in to manage your books.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <ErrorBox message={error?.message} details={error?.details} />
        <FormField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          revealable
        />
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </AuthSplit>
  );
}
