import { NextResponse } from "next/server";
import {
  authCookie,
  checkPassword,
  createSessionToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    if (!body.password || !checkPassword(body.password)) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(authCookie.name, token, authCookie.options);
    return response;
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
