import { Component } from "react";

/**
 * Catches render/lifecycle errors anywhere below it.
 *
 * Without this, React unmounts the whole tree when any component throws — the
 * visitor gets a completely blank page and the only trace is a console error.
 * That is the failure this exists to stop being invisible: a broken ticker or a
 * bad slide should cost the section, not the site.
 *
 * The fallback deliberately does NOT auto-reload. If the error is deterministic
 * (a bad prop, a null field from the API) an automatic reload just loops, which
 * looks identical to the blank page from the outside and burns the origin.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the real stack in the console — this is what makes a report
    // actionable instead of "the page went white".
    console.error("[landing] render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          padding: "24px",
          textAlign: "center",
          background: "hsl(20 15% 9%)",
          color: "hsl(40 30% 90%)",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 700 }}>
          Something went wrong on this page.
        </div>
        <div style={{ fontSize: "14px", opacity: 0.7, maxWidth: "42ch" }}>
          Your account and funds are unaffected — this is a display error on the
          website only.
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: "6px",
            padding: "10px 22px",
            borderRadius: "999px",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "14px",
            background: "hsl(32 55% 65%)",
            color: "hsl(20 15% 9%)",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
