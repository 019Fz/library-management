// White rounded surface that holds content.
export default function Card({ as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag className={`rounded-card border border-line bg-card p-6 shadow-sm ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
