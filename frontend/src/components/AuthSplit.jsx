// Two-column shell for Login and Register: the form on one side, a dark panel on the other.
// panelSide "right" (Login): on mobile a brand strip sits ABOVE the form.
// panelSide "left" (Register): on mobile the form comes first and the brand strip sits BELOW it.
import { Link } from "react-router-dom";
import Logo from "./ui/Logo.jsx";
import Button from "./ui/Button.jsx";

// question + action make the sentence, e.g. "New here? Create an account."
export default function AuthSplit({ panelSide = "right", question, action, buttonLabel, to, children }) {
  const panelOnLeft = panelSide === "left";

  const brandStrip = (
    <div className="flex justify-center bg-sidebar px-4 py-4 lg:hidden">
      <Logo variant="light" />
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-card lg:grid lg:grid-cols-2">
      {!panelOnLeft && brandStrip}

      <section className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 hidden lg:block">
            <Logo />
          </div>
          {children}

          {/* On mobile the dark panel is hidden, so the switch link goes under the form */}
          <p className="mt-6 text-sm text-muted lg:hidden">
            {question}{" "}
            <Link to={to} className="rounded font-semibold text-ink underline focus-ring">
              {action}
            </Link>
          </p>
        </div>
      </section>

      {panelOnLeft && brandStrip}

      {/* Desktop panel with a large rounded edge on the side facing the form */}
      <aside
        className={`focus-on-dark hidden flex-col items-center justify-center gap-6 bg-sidebar px-12 text-center text-on-sidebar lg:flex ${
          panelOnLeft ? "rounded-r-panel lg:order-first" : "rounded-l-panel"
        }`}
      >
        <Logo variant="light" size="lg" />
        <p className="text-on-sidebar-muted">
          {question} {action}.
        </p>
        <Button to={to} variant="outlined" inverted>
          {buttonLabel}
        </Button>
      </aside>
    </div>
  );
}
