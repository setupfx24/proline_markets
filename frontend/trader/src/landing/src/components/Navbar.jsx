import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "motion/react";
import { ArrowUpRight, Menu, X, Download, Monitor } from "lucide-react";

// Android APK served as a static file from the trader frontend's public/ dir.
const APK_DOWNLOAD_HREF = "/proline_apk.apk";
// Desktop terminal installers — same convention as the APK above: drop the
// built files into frontend/trader/public/ and they are served from the root.
//
// hari_deskterminal builds them under VERSIONED names
// (ProlineMarketsTerminal-Setup-1.0.2.exe, ProlineMarketsTerminal-1.0.2-universal.dmg).
// Publish them under a stable name instead — otherwise every version bump
// silently 404s this link until someone remembers to edit the site too.
//
// No macOS constant yet on purpose: that build is unpublished and its row below
// is inert. When it ships, add "/ProlineMarketsTerminal.dmg" and drop the
// `soon` flag rather than pointing the link at a file that is not there.
const DESKTOP_WINDOWS_HREF = "/ProlineMarketsTerminal-Setup.exe";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS, HEADER_BUTTONS, BRAND } from "@/lib/forexData";

function isExternal(href) {
  return typeof href === "string" && /^https?:\/\//.test(href);
}

function NavLinkOrAnchor({ href, children, className, onClick }) {
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function DesktopItem({ item, pathname }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const active =
    pathname === item.href ||
    (item.children && item.children.some((c) => c.href === pathname));

  if (!item.children) {
    return (
      <NavLinkOrAnchor
        href={item.href}
        className={`relative px-3.5 py-2 text-sm transition-colors font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full ${
          active ? "text-foreground" : "text-foreground/75 hover:text-foreground"
        }`}
      >
        {item.label}
        {active && (
          <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-1 rounded-full bg-primary" />
        )}
      </NavLinkOrAnchor>
    );
  }

  const handleParentClick = () => {
    if (!item.href) {
      setOpen((o) => !o);
      return;
    }
    if (isExternal(item.href)) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    } else {
      navigate(item.href);
    }
    setOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={handleParentClick}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`relative flex items-center px-3.5 py-2 text-sm font-body rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          active ? "text-foreground" : "text-foreground/75 hover:text-foreground"
        }`}
      >
        {item.label}
        {active && (
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-1 rounded-full bg-primary"
          />
        )}
      </button>

      {/* Invisible bridge so cursor can move from trigger to menu without leaving */}
      {open && (
        <div className="absolute left-0 right-0 top-full h-2" aria-hidden />
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 -translate-x-1/2 top-full pt-2 min-w-[260px] z-[60]"
          >
            <div
              role="menu"
              className="rounded-2xl p-2 flex flex-col gap-0.5 shadow-2xl border border-border bg-popover text-popover-foreground"
            >
              {item.children.map((c) => {
                const childActive = pathname === c.href;
                return (
                  <NavLinkOrAnchor
                    key={c.href}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    className={`px-3 py-2.5 text-sm font-body rounded-lg transition-colors cursor-pointer ${
                      childActive
                        ? "bg-primary/15 text-foreground"
                        : "text-foreground/80 hover:text-foreground hover:bg-white/[0.08]"
                    }`}
                  >
                    {c.label}
                  </NavLinkOrAnchor>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// lucide dropped brand marks, so the two OS logos are inline paths.
function WindowsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function AppleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.476-4.494 2.59-4.559-1.423-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

// Round accent button in the header that drops the two desktop-terminal builds.
// Hover opens it like the nav menus; click also toggles so touch/keyboard users
// are not locked out of a hover-only control.
function DesktopTerminalMenu() {
  const [open, setOpen] = useState(false);

  // The macOS build is not published yet, so its row is inert rather than a
  // link — a download that 404s reads as a broken site, "Coming soon" does not.
  const items = [
    { href: DESKTOP_WINDOWS_HREF, label: "Download for Windows", Icon: WindowsIcon },
    { href: null,                 label: "Download for macOS",   Icon: AppleIcon, soon: true },
  ];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Download the desktop terminal"
        title="Desktop terminal"
        className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Monitor className="size-4" />
      </button>

      {/* Invisible bridge so the cursor can cross the gap into the menu */}
      {open && <div className="absolute right-0 top-full h-2 w-full" aria-hidden />}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full pt-2 min-w-[260px] z-[60]"
          >
            <div
              role="menu"
              className="rounded-2xl p-2 shadow-2xl border border-border bg-popover text-popover-foreground"
            >
              <div className="px-3 pt-1.5 pb-2 text-[11px] font-body uppercase tracking-[0.14em] text-popover-foreground/50">
                Desktop Terminal
              </div>
              {items.map(({ href, label, Icon, soon }) =>
                soon ? (
                  <div
                    key={label}
                    aria-disabled="true"
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-body rounded-lg text-popover-foreground/40 cursor-default"
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                    <span className="ml-auto text-[10px] uppercase tracking-[0.12em] rounded-full px-2 py-0.5 bg-white/[0.08] text-popover-foreground/55">
                      Soon
                    </span>
                  </div>
                ) : (
                  <a
                    key={label}
                    href={href}
                    download
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-body rounded-lg transition-colors cursor-pointer text-popover-foreground/80 hover:text-popover-foreground hover:bg-white/[0.08]"
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </a>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);
  const { scrollY } = useScroll();
  const { pathname } = useLocation();

  useMotionValueEvent(scrollY, "change", (v) => {
    setScrolled(v > 40);
  });

  return (
    <>
      <motion.header
        data-scrolled={scrolled}
        className={`fixed left-1/2 -translate-x-1/2 z-50 w-[min(1280px,calc(100vw-32px))] transition-[top] duration-500 ${
          scrolled ? "top-2" : "top-4"
        }`}
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <nav
          style={{ overflow: "visible" }}
          className={`liquid-glass rounded-full px-2 py-2 flex items-center justify-between gap-3 transition-[backdrop-filter] ${
            scrolled ? "[backdrop-filter:blur(28px)]" : ""
          }`}
        >
          <Link to="/" className="flex items-center pl-3 group" aria-label={BRAND.name}>
            <img
              src={BRAND.logo}
              alt={BRAND.name}
              className="h-9 md:h-10 w-auto object-contain"
            />
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <DesktopItem key={item.label} item={item} pathname={pathname} />
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <DesktopTerminalMenu />
            <a
              href={APK_DOWNLOAD_HREF}
              download
              aria-label="Download Android app (APK)"
              title="Download Android app (APK)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-body text-foreground/80 hover:text-foreground rounded-full transition-colors whitespace-nowrap"
            >
              <Download className="size-4" />
              APK
            </a>
            <NavLinkOrAnchor
              href={HEADER_BUTTONS.helpCenter.href}
              className="px-3 py-1.5 text-xs font-body text-foreground/80 hover:text-foreground rounded-full transition-colors whitespace-nowrap"
            >
              {HEADER_BUTTONS.helpCenter.label}
            </NavLinkOrAnchor>
            <Button variant="heroGlass" className="rounded-full px-3 py-1.5 text-xs h-auto" asChild>
              <a href={HEADER_BUTTONS.clientPortal.href}>
                {HEADER_BUTTONS.clientPortal.label}
              </a>
            </Button>
            <Button variant="heroSolid" className="rounded-full px-3 py-1.5 text-xs h-auto" asChild>
              <a href={HEADER_BUTTONS.openAccount.href}>
                {HEADER_BUTTONS.openAccount.label}
                <ArrowUpRight className="ml-1 size-3.5" />
              </a>
            </Button>
          </div>

          <div className="lg:hidden flex items-center gap-2 mr-2">
            <button
              type="button"
              aria-label="Open menu"
              className="size-9 rounded-full liquid-glass-strong flex items-center justify-center text-foreground"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-[60] liquid-glass-strong [backdrop-filter:blur(40px)] overflow-y-auto"
          >
            <div className="absolute top-4 right-4">
              <button
                type="button"
                aria-label="Close menu"
                className="size-10 rounded-full liquid-glass flex items-center justify-center text-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6 py-24">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center gap-1"
                >
                  <NavLinkOrAnchor
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-1 block"
                  >
                    {item.label}
                  </NavLinkOrAnchor>
                  {item.children && (
                    <div className="flex flex-col items-center gap-1">
                      {item.children.map((c) => (
                        <NavLinkOrAnchor
                          key={c.href}
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className="font-body text-sm text-foreground/65 hover:text-foreground"
                        >
                          {c.label}
                        </NavLinkOrAnchor>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              <div className="flex flex-col gap-2 mt-6 w-full max-w-xs">
                <Button variant="heroGlass" asChild className="w-full">
                  <a href={APK_DOWNLOAD_HREF} download onClick={() => setOpen(false)}>
                    <Download className="mr-1 size-4" />
                    Download APK
                  </a>
                </Button>
                <Button variant="heroGlass" asChild className="w-full">
                  <a href={DESKTOP_WINDOWS_HREF} download onClick={() => setOpen(false)}>
                    <WindowsIcon className="mr-1 size-4" />
                    Terminal for Windows
                  </a>
                </Button>
                <div className="w-full flex items-center justify-center gap-2 rounded-md border border-border/60 px-4 py-2 text-sm text-foreground/40">
                  <AppleIcon className="size-4" />
                  Terminal for macOS
                  <span className="text-[10px] uppercase tracking-[0.12em] rounded-full px-2 py-0.5 bg-white/[0.08] text-foreground/55">
                    Soon
                  </span>
                </div>
                <Button variant="heroGlass" asChild className="w-full">
                  <a href={HEADER_BUTTONS.clientPortal.href} onClick={() => setOpen(false)}>
                    {HEADER_BUTTONS.clientPortal.label}
                  </a>
                </Button>
                <Button variant="hero" asChild className="w-full">
                  <a href={HEADER_BUTTONS.openAccount.href} onClick={() => setOpen(false)}>
                    {HEADER_BUTTONS.openAccount.label}
                    <ArrowUpRight className="ml-1 size-4" />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
