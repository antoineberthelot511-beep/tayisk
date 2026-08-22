import { NextResponse, type NextRequest } from "next/server";
import { createStatement } from "@/lib/create";
import { getFeed } from "@/lib/feed";
import { langFromAcceptLanguage } from "@/lib/i18n";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const deviceId = params.get("device") ?? "";
  const limit = Number(params.get("limit") ?? 10);

  const statements = await getFeed(deviceId, Number.isFinite(limit) ? limit : 10);

  return NextResponse.json(
    { statements },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let body: { text?: string; keyword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body.text !== "string") {
    return NextResponse.json({ error: "text requis" }, { status: 400 });
  }

  const result = await createStatement({
    text: body.text,
    keyword: body.keyword,
    viewerLang: langFromAcceptLanguage(request.headers.get("accept-language")),
  });

  if (!result.ok) {
    const status = result.reason === "unavailable" ? 503 : 400;
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status },
    );
  }

  return NextResponse.json(result, { status: 201 });
}
