import { useRouter } from "next/router";

export default function QrLanding() {
  const { query } = useRouter();
  return <main style={{ padding: 24 }}>QR Table: {String(query.tableId ?? "")}</main>;
}
