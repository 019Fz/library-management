// Catches errors thrown while a page renders, so one failing page does not blank the whole app.
// (Error boundaries must be class components.) The sidebar and top bar stay on screen.
import { Component } from "react";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import EmptyState from "./ui/EmptyState.jsx";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <Card>
        <EmptyState
          icon="alert"
          title="Something went wrong"
          text="This page could not be shown. You can go back to your books or reload the page."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button to="/books">Go to my books</Button>
              <Button variant="outlined" onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </div>
          }
        />
      </Card>
    );
  }
}
