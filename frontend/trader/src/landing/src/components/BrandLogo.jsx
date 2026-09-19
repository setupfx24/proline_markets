import { BRAND } from "@/lib/forexData";

// Renders both inks and lets CSS show the one that contrasts with the active
// theme (see .brand-logo-* in index.css). Doing it in CSS rather than reading
// data-theme in JS means the right logo is painted on the first frame — no
// flash of the invisible one — and it follows a theme switch without a
// re-render.
export function BrandLogo({ className = "" }) {
  return (
    <>
      <img
        src={BRAND.logo}
        alt={BRAND.name}
        className={`brand-logo-on-dark ${className}`}
      />
      <img
        src={BRAND.logoOnLight}
        alt=""
        aria-hidden="true"
        className={`brand-logo-on-light ${className}`}
      />
    </>
  );
}
