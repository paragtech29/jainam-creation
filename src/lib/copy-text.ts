// Copying to the clipboard, including from a plain-http address.
//
// navigator.clipboard only exists in a SECURE CONTEXT — https, or localhost.
// The owner opens this app two ways: the Vercel URL on his phone (https, so
// the modern API works) and a LAN address like http://192.168.1.5:3000 from
// the laptop, where `navigator.clipboard` is undefined. The same trap the
// description rows hit with crypto.randomUUID.
//
// So: try the real API, fall back to the old execCommand dance. The fallback
// is deprecated but it is the only thing that works over plain http, and a
// copy button that silently does nothing on half his devices is worse than a
// deprecation.
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or the page is not focused — fall through.
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    // Off-screen rather than hidden: a display:none or visibility:hidden
    // element cannot be selected, so the copy would silently produce nothing.
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "-1000px";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
