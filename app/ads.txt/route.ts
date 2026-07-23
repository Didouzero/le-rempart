export function GET() {
  const body = "google.com, pub-4084740211919633, DIRECT, f08c47fec0942fa0\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
