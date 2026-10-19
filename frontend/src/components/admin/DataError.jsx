// Shows a failed request. A 403 means "not allowed" (never a redirect to /login, only a 401 does that);
// anything else (including a network error) shows the message and a Try again button.
//   error   = { message, details, status } from useList
//   onRetry = called by the button
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import ErrorBox from "../ui/ErrorBox.jsx";
import EmptyState from "../ui/EmptyState.jsx";

export default function DataError({ error, onRetry }) {
  if (error.status === 403) {
    return (
      <Card>
        <EmptyState
          icon="shield"
          title="You do not have access"
          text="Your account is not allowed to see this page. If you think this is a mistake, ask an administrator."
          action={<Button to="/books">Go to my books</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <ErrorBox message={error.message} details={error.details} />
      <Button variant="outlined" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
