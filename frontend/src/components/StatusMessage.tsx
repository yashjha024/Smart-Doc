type StatusMessageProps = {
  kind: "info" | "success" | "error";
  children: string;
};

export function StatusMessage({ kind, children }: StatusMessageProps) {
  return <div className={`status-message ${kind}`}>{children}</div>;
}
