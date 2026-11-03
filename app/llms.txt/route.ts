import { llmsText } from "@/lib/llms-text";

export function GET() {
  return new Response(llmsText(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}
