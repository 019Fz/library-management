// Registration form. On success the GuestRoute sends the user to /books.
import { useState } from "react";
import { useAuth } from "../context/useAuth.js";
import { getApiError } from "../api/client.js";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "../lib/validation.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import AuthSplit from "../components/AuthSplit.jsx";
import FormField from "../components/ui/FormField.jsx";
import ErrorBox from "../components/ui/ErrorBox.jsx";
import Button from "../components/ui/Button.jsx";

export default function Register() {
  usePageTitle("Register");
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null); // { message, details }
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    // Quick checks before calling the server
    const problems = [];
    if (!name.trim()) problems.push("Enter your name.");
    if (!isValidEmail(email.trim())) problems.push("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      problems.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (problems.length > 0) {
      setError({ message: "Please fix the following:", details: problems });
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(getApiError(err)); // e.g. "Email is already registered"
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplit panelSide="left" question="Already have an account?" action="Log in" buttonLabel="Log in" to="/login">
      <h1 className="text-3xl font-bold text-ink">Create your account</h1>
      <p className="mt-2 text-muted">Start tracking your reading in a minute.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <ErrorBox message={error?.message} details={error?.details} />
        <FormField id="name" label="Name" value={name} onChange={setName} autoComplete="name" />
        <FormField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <FormField
          id="password"
          label={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          maxLength={72}
          revealable
        />
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? "Creating account..." : "Register"}
        </Button>
      </form>
    </AuthSplit>
  );
}
