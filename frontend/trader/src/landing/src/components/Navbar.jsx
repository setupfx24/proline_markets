import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
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
