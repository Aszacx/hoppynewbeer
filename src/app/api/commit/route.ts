import { NextResponse } from "next/server";
import { Octokit } from "octokit";

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

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const LOG_FILE_PATH = "COMMITS.md";

const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;

// Helper para parsear líneas del markdown
const parseLine = (line: string) => {
  // Formato: - **hash** [tap] alias: "message" _(date)_
  const regex = /^- \*\*([a-zA-Z0-9]+)\*\* \[([^\]]+)\] ([^:]+): "([^"]+)" _\(([^)]+)\)_/;
  const match = line.match(regex);
  if (!match) return null;
  return {
    hash: match[1],
    tap: match[2],
    alias: match[3],
    message: match[4],
    createdAt: match[5],
    status: "approved", // Asumimos approved si está en el archivo
    bubbleX: Math.random() * 80 + 10,
    bubbleDelay: Math.random() * 3,
  };
};

export async function GET() {
  if (!octokit || !GITHUB_OWNER || !GITHUB_REPO) {
    return NextResponse.json([]);
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
    });

    if ("content" in data && typeof data.content === "string") {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const lines = content.split("\n").filter((l) => l.startsWith("- **"));
      const commits = lines
        .map(parseLine)
        .filter((c) => c !== null)
        .reverse();

      return NextResponse.json(commits);
    }
  } catch (error: unknown) {
    console.error("Error fetching commits:", error);
    return NextResponse.json([]);
  }

  return NextResponse.json([]);
}

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
  const message = rawMessage.slice(0, 140);
  const createdAt = new Date().toISOString();

  let hash = crypto.randomUUID().replace(/-/g, "").slice(0, 7);
  let status = "pending"; // Por defecto pending si falla git

  if (octokit && GITHUB_OWNER && GITHUB_REPO) {
    try {
      let fileSha: string | undefined;
      let content = "";

      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: LOG_FILE_PATH,
        });

        if ("content" in data && "sha" in data) {
          content = Buffer.from(data.content, "base64").toString("utf-8");
          fileSha = data.sha;
        }
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status !== 404) {
          throw err;
        }
        content = "# Last Commit Log\n\nRegistro de commits cerveceros.\n\n";
      }

      // Al guardar, lo marcamos como "approved" implícitamente al estar en el archivo
      const logEntry = `- **${hash}** [${tap}] ${alias}: "${message}" _(${createdAt})_\n`;
      const newContent = content + logEntry;

      const commitResult = await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: LOG_FILE_PATH,
        message: `feat(log): nuevo brindis de ${alias}`,
        content: Buffer.from(newContent).toString("base64"),
        sha: fileSha,
        committer: { name: "Last Commit Bot", email: "bot@azulmalta.com" },
        author: { name: alias, email: "guest@azulmalta.com" },
      });

      if (commitResult.data.commit.sha) {
        hash = commitResult.data.commit.sha.slice(0, 7);
        status = "approved"; // Si se guardó en GitHub, está aprobado
      }
    } catch (error) {
      console.error("Error committing to GitHub:", error);
    }
  }

  const caption = `🍺 ${tap} // ${alias}: ${message}`;

  return NextResponse.json({
    hash,
    message,
    alias,
    tap,
    caption,
    createdAt,
    status,
  });
}
