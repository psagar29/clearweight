import { NextRequest } from "next/server";
import { z } from "zod";

import { generateMatrixWithCodex } from "@/lib/codex-responses";
import {
  CODEX_SESSION_COOKIE,
  clearCodexSessionCookieHeader,
  codexSessionCookieHeader,
  resolveCodexSession,
} from "@/lib/codex-oauth";

export const runtime = "nodejs";

const generateRequestSchema = z.object({
  prompt: z.string().min(8).max(4000),
});

const SYSTEM_PROMPT = `You turn messy, uncertain decisions into editable weighted decision matrices.

Return a practical starting matrix, not a final verdict.
Choose the number of options and criteria from the user's decision, not a fixed template.
If the user names options, include all distinct user-named options unless one is clearly invalid or duplicated.
Use 2-12 realistic options and 3-10 criteria; prefer fewer only when the decision is genuinely simple.
Criteria must be specific, non-overlapping, and written so a higher score is always better.
Use hardGate=true only for genuinely mandatory constraints.
Weights must be integer percentages that sum exactly to 100 across criteria.
For each criterion, option scores must be independent integer performance ratings from 0 to 100. Do not force scores across options to sum to 100.
For a binary decision like chicken versus fish, both options can score high on the same criterion if both are good, or both can score low if both are weak.
Use the full 0-100 range when the evidence supports it, but avoid fake precision.
Mention assumptions and watchouts plainly. Keep the output compact.`;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsedBody = generateRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      {
        error: "Give me at least a sentence about the decision.",
      },
      { status: 400 },
    );
  }

  const prompt = parsedBody.data.prompt;
  const codexSessionId = request.cookies.get(CODEX_SESSION_COOKIE)?.value;
  const codexSession = await resolveCodexSession(codexSessionId);

  if (!codexSession || !codexSessionId) {
    const response = Response.json({
      error: "Sign in with Codex to generate a matrix.",
    }, { status: 401 });
    if (codexSessionId) {
      response.headers.append("Set-Cookie", clearCodexSessionCookieHeader());
    }
    return response;
  }

  try {
    const result = await generateMatrixWithCodex(
      codexSession,
      prompt,
      SYSTEM_PROMPT,
    );

    const response = Response.json({
      matrix: result.matrix,
      source: "codex",
      model: result.model,
      accountId: codexSession.profile.accountId,
    });
    response.headers.append(
      "Set-Cookie",
      codexSessionCookieHeader(codexSessionId, codexSession),
    );
    return response;
  } catch (error) {
    console.error(
      "Codex matrix generation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    const response = Response.json(
      {
        error: "Codex generation failed. No fallback provider is configured.",
      },
      { status: 502 },
    );
    response.headers.append(
      "Set-Cookie",
      codexSessionCookieHeader(codexSessionId, codexSession),
    );
    return response;
  }
}
