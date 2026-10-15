// Gray pulsing block shown while content loads. Set its size with className (e.g. "h-6 w-40").
export default function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-field bg-line motion-reduce:animate-none ${className}`} />;
}
