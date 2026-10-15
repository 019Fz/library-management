// Landing page for logged-out visitors (the GuestRoute sends logged-in users to /books).
import { APP_NAME } from "../config/app.js";
import { usePageTitle } from "../lib/usePageTitle.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Icon from "../components/ui/Icon.jsx";

const FEATURES = [
  {
    icon: "book",
    title: "Track your books",
    text: "Add, edit and remove books with their title, author, genre and price.",
  },
  {
    icon: "tag",
    title: "Organise your way",
    text: "Group books by genre and mark each one as to-read, reading or completed.",
  },
  {
    icon: "chat",
    title: "Ask the assistant",
    text: "Ask questions about your library in plain English and get the answer as a table.",
  },
];

export default function Home() {
  usePageTitle();

  return (
    <main>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Your personal library, organised.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          {APP_NAME} keeps track of every book you own, what you are reading now and what comes next.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button to="/register">Get started</Button>
          <Button to="/login" variant="outlined">
            Log in
          </Button>
        </div>
      </section>

      <section aria-label="Features" className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-ink">
              <Icon name={feature.icon} className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ink">{feature.title}</h2>
            <p className="mt-1 text-muted">{feature.text}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
