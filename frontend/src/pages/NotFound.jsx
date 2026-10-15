// Shown for any URL that matches no route.
import { usePageTitle } from "../lib/usePageTitle.js";
import Card from "../components/ui/Card.jsx";
import Logo from "../components/ui/Logo.jsx";
import Button from "../components/ui/Button.jsx";

export default function NotFound() {
  usePageTitle("Page not found");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-muted">The page you are looking for does not exist.</p>
        <div className="mt-6">
          <Button to="/">Back to home</Button>
        </div>
      </Card>
    </main>
  );
}
