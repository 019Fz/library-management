// Placeholder for the books page (replaced in Part B).
import { useAuth } from "../context/useAuth.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import Card from "../components/ui/Card.jsx";

export default function Books() {
  usePageTitle("Books");
  const { user } = useAuth();

  return (
    <Card>
      <h1 className="text-2xl font-bold text-ink">Welcome, {user.name}</h1>
      <p className="mt-2 text-muted">Your role: {user.role}</p>
    </Card>
  );
}
