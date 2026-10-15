// Shows a form error message and, if there are any, a list of detail messages.
export default function ErrorBox({ message, details = [] }) {
  if (!message) return null;

  return (
    <div role="alert" className="rounded-field border border-danger bg-danger-soft p-3 text-sm text-danger">
      <p className="font-medium">{message}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
