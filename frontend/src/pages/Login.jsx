// Login form. On success the GuestRoute sends the user to /books.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { getApiError } from "../api/client.js";
import { isValidEmail } from "../lib/validation.js";
import FormField from "../components/FormField.jsx";
import ErrorBox from "../components/ErrorBox.jsx";

export default function Login() {
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
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-800">Log in</h1>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <ErrorBox message={error?.message} details={error?.details} />
          <FormField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <FormField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-md bg-indigo-600 px-4 py-2 text-base font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          No account yet?{" "}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
