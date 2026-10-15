// Placeholder for pages that are not built yet (Dashboard and Users).
import { usePageTitle } from "../lib/usePageTitle.js";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function ComingSoon({ title }) {
  usePageTitle(title);

  return (
    <>
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <Card className="mt-4">
        <EmptyState icon="clock" title="Coming soon" text="This page is not built yet." />
      </Card>
    </>
  );
}
