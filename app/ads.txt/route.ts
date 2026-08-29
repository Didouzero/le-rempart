/**
 * ads.txt AdSense — servi en text/plain sans passer par le HTML Next.
 * Contenu : compte Google AdSense Le Rempart.
 */
const ADS_TXT = `google.com, pub-4084740211919633, DIRECT, f08c47fec0942fa0
`;

export function GET() {
  return new Response(ADS_TXT, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
