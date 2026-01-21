import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background)",
      padding: "2rem",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: "600px",
      }}>
        <h1 style={{
          fontSize: "6rem",
          fontWeight: 700,
          margin: 0,
          background: "var(--primary-gradient)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
        }}>
          404
        </h1>
        
        <h2 style={{
          fontSize: "2rem",
          fontWeight: 600,
          marginTop: "1rem",
          marginBottom: "0.5rem",
          color: "var(--foreground)",
        }}>
          Page Not Found
        </h2>
        
        <p style={{
          fontSize: "1.125rem",
          color: "var(--text-muted)",
          marginBottom: "2rem",
          lineHeight: 1.6,
        }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.75rem 2rem",
            background: "var(--primary-gradient)",
            color: "white",
            textDecoration: "none",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "1rem",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 4px 12px rgba(255, 107, 157, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(255, 107, 157, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 107, 157, 0.3)";
          }}
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
