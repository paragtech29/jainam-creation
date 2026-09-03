/**
 * The red asterisk on a required field's label.
 *
 * aria-hidden because the input itself carries `required`/`aria-required`,
 * which is what a screen reader announces. Without hiding it, the asterisk
 * would be read out as "star" on top of that.
 */
export function Req() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}
