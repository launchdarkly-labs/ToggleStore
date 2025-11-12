"use client"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#191919",
          color: "#FFFFFF",
          fontFamily: "system-ui, sans-serif",
          padding: "20px"
        }}>
          <div style={{
            textAlign: "center",
            maxWidth: "500px"
          }}>
            <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>Something went wrong!</h1>
            <p style={{ color: "#A7A9AC", marginBottom: "24px" }}>
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#7084FF",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

