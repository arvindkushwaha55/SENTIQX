import { Component, type ReactNode } from "react";

// Last-resort guard: if any view throws while rendering, show a calm,
// honest fallback instead of a blank window. History and settings live
// outside the UI (SQLite + app files), so a reload loses nothing.
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Visible in the dev console only; nothing is sent anywhere.
    console.error("SENTIQX interface error:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          height: "100%",
          padding: 24,
          textAlign: "center",
          color: "var(--text)",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 600 }}>
          Something went wrong in the interface.
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 420 }}>
          Interface me kuch gadbad ho gayi. Your history and settings are
          stored separately and are safe — reloading fixes this.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 6,
            padding: "8px 18px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--orange)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
