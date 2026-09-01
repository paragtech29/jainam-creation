// Four deliberately distinct hues — the brand itself is teal-green, so
// Completed must never collapse into the brand colour or the four states
// stop being tellable apart at a glance in a long list. Do NOT "harmonise"
// these with the brand palette.
//
// Classes are written as complete literal strings (never
// `bg-status-${key}-bg` interpolation) because Tailwind's compiler only
// emits CSS for class names it can see statically in source.
const STATUS_CLASSES: Record<"PENDING" | "IN_PROGRESS" | "COMPLETED", string> = {
  PENDING: "bg-status-pending-bg text-status-pending",
  IN_PROGRESS: "bg-status-progress-bg text-status-progress",
  COMPLETED: "bg-status-completed-bg text-status-completed",
};

const STATUS_LABELS: Record<"PENDING" | "IN_PROGRESS" | "COMPLETED", string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const BILLED_CLASSES = "bg-status-billed-bg text-status-billed";

const PILL_SHELL = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function StatusBadge({
  status,
  isBilled,
}: {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  isBilled: boolean;
}) {
  // Billed supersedes the status visually — once money is in, that is the
  // only thing the owner is scanning for.
  if (isBilled) {
    return <span className={`${PILL_SHELL} ${BILLED_CLASSES}`}>Billed</span>;
  }

  return (
    <span className={`${PILL_SHELL} ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
  );
}
