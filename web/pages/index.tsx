import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f4f7fb",
        color: "#0f172a",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(440px, 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: 28,
          background: "#ffffff",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
          padding: 32,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>
          Opening dashboard
        </p>
        <h1 style={{ margin: "10px 0 12px", fontSize: 32 }}>Canteen Admin Web</h1>
        <p style={{ margin: "0 0 24px", color: "#64748b", lineHeight: 1.6 }}>
          Redirecting you to the admin panel.
        </p>
        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            justifyContent: "center",
            borderRadius: 16,
            background: "#0f172a",
            color: "#ffffff",
            padding: "13px 20px",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          Open Admin
        </Link>
      </section>
    </main>
  );
}
