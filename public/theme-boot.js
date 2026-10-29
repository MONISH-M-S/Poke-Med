// Runs before the body paints so the first render already has the right theme.
// Kept as a real file rather than an inline <script> so the app never injects
// HTML strings — the security suite bans that pattern, and for good reason.
//
// Light is the unconditional default. Dark is only ever reached by an explicit
// choice that we then remember — never by the OS preference.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("pokemed-theme") === "dark" ? "dark" : "light";
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
