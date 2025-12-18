import { NextResponse } from "next/server";
import { Octokit } from "octokit";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const LOG_FILE_PATH = "COMMITS.md";

const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Payload inválido." },
      { status: 400 },
    );
  }

  const { hash, secret } = body;

  if (!hash || !secret) {
    return NextResponse.json(
      { error: "Hash y secret requeridos." },
      { status: 400 },
    );
  }

  if (secret !== ADMIN_SECRET) {
    return NextResponse.json(
      { error: "Secret inválido." },
      { status: 403 },
    );
  }

  if (!octokit || !GITHUB_OWNER || !GITHUB_REPO) {
    return NextResponse.json(
      { error: "GitHub no configurado." },
      { status: 500 },
    );
  }

  try {
    // 1. Leer archivo actual
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
    });

    if (!("content" in data) || typeof data.content !== "string") {
      throw new Error("No se pudo leer COMMITS.md");
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const fileSha = data.sha;

    // 2. Buscar y reemplazar la línea pendiente
    // Buscamos: - **hash** [tap] (pending) alias: "msg" _(date)_
    // Reemplazamos por: - **hash** [tap] alias: "msg" _(date)_
    
    // Regex robusto: busca la línea exacta con hash y (pending)
    // Ej: - **abc1234** [craft] (pending) alias: "msg" _(date)_
    const lineRegex = new RegExp(
      String.raw`^- \*\*${hash}\*\* \[([^\]]+)\] \(pending\) (.+)$`,
      "m",
    );
    const match = content.match(lineRegex);

    if (!match) {
      console.log("Debug: No match found for hash", hash);
      return NextResponse.json(
        { error: "Commit no encontrado o ya aprobado." },
        { status: 404 },
      );
    }

    // match[0] es la línea completa original
    // match[1] es el tap (ej: "craft")
    // match[2] es el resto (alias: "msg" _(date)_)
    
    // Reconstruimos la línea SIN "(pending) "
    const approvedLine = `- **${hash}** [${match[1]}] ${match[2]}`;
    
    // Reemplazamos solo la primera ocurrencia de esa línea exacta
    const newContent = content.replace(match[0], approvedLine);

    // 3. Escribir cambios
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
      message: `chore(log): approve commit ${hash}`,
      content: Buffer.from(newContent).toString("base64"),
      sha: fileSha,
      committer: { name: "Last Commit Bot", email: "bot@azulmalta.com" },
    });

    return NextResponse.json({ success: true, hash });
  } catch (error) {
    console.error("Error approving commit:", error);
    return NextResponse.json(
      { error: "Error interno al aprobar." },
      { status: 500 },
    );
  }
}

