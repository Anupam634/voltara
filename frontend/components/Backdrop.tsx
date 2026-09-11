/**
 * The page ground: three drifting aurora blobs, a fading circuit grid, a
 * vignette and a whisper of film grain. Fixed behind everything, purely
 * decorative, and driven entirely by the theme variables so it recolours
 * with the toggle.
 */
export function Backdrop() {
  return (
    <div className="v-backdrop" aria-hidden>
      <div className="v-backdrop__blob v-backdrop__blob--1" />
      <div className="v-backdrop__blob v-backdrop__blob--2" />
      <div className="v-backdrop__blob v-backdrop__blob--3" />
      <div className="v-backdrop__grid" />
      <div className="v-backdrop__vignette" />
      <div className="v-backdrop__noise" />
    </div>
  );
}
