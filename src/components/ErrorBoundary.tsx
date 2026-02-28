import React from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("React ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0d0d1a",
            color: "#e0e0ff",
            fontFamily: "monospace",
            padding: "2rem",
            gap: "1rem",
          }}
        >
          <h2 style={{ color: "#ff6b6b", fontSize: "1.25rem" }}>
            ⚠️ Algo deu errado
          </h2>
          <pre
            style={{
              background: "#1a1a2e",
              border: "1px solid #444",
              borderRadius: "8px",
              padding: "1rem",
              maxWidth: "90vw",
              overflow: "auto",
              fontSize: "0.75rem",
              color: "#ffa07a",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.href = "/";
            }}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
