import { NextResponse } from "next/server";

const beerStyles = [
  "ipa",
  "stout",
  "porter",
  "lager",
  "pils",
  "tripel",
  "weiss",
  "neipa",
  "saison",
];

const randomHash = () => crypto.randomUUID().replace(/-/g, "").slice(0, 7);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Payload inválido. Envía un JSON con mensaje." },
      { status: 400 },
    );
  }

  const rawMessage = String(body.message ?? "").trim();
  if (!rawMessage) {
    return NextResponse.json(
      { error: "El mensaje del commit es requerido." },
      { status: 400 },
    );
  }

  const alias = String(body.alias ?? "anónimo").trim() || "anónimo";
  const beer = String(body.beer ?? "").trim().toLowerCase();
  const tap = beerStyles.includes(beer) ? beer : "craft";

  const hash = randomHash();
  const message = rawMessage.slice(0, 140);
  const createdAt = new Date().toISOString();
  const caption = `🍺 ${tap} // ${alias}: ${message}`;

  return NextResponse.json({
    hash,
    message,
    alias,
    tap,
    caption,
    createdAt,
  });
}

