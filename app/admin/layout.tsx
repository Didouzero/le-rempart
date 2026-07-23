export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-paper">{children}</div>;
}
