import {
  clampScore,
  clampWeight,
  decisionMatrixSchema,
  sanitizeMatrix,
  type DecisionMatrix,
} from "@/lib/decision-matrix";
import {
  codexOriginator,
  type CodexSession,
} from "@/lib/codex-oauth";

const DEFAULT_CODEX_RESPONSES_ENDPOINT =
  "https://chatgpt.com/backend-api/codex/responses";
const DEFAULT_CODEX_RESPONSES_MODEL = "gpt-5.4-mini";

type CodexResponsesResult = {
  matrix: DecisionMatrix;
  model: string;
};

type StreamReadState = {
  deltaText: string;
  finalText: string | null;
  errorMessage: string | null;
};

function configuredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function codexResponsesEndpoint() {
  return configuredEnv("CODEX_RESPONSES_ENDPOINT") ?? DEFAULT_CODEX_RESPONSES_ENDPOINT;
}

function codexResponsesModel() {
  return configuredEnv("CODEX_RESPONSES_MODEL") ?? DEFAULT_CODEX_RESPONSES_MODEL;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractText(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return null;

  const outputText = record.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const output = record.output;
  if (!Array.isArray(output)) return null;

  const chunks = output.flatMap((item) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) return [];
    const content = itemRecord.content;
    if (!Array.isArray(content)) return [];

    return content.flatMap((contentItem) => {
      const contentRecord = asRecord(contentItem);
      if (!contentRecord) return [];
      const text = contentRecord.text;
      if (typeof text === "string") return [text];
      const textRecord = asRecord(text);
      if (textRecord) {
        const value = textRecord.value;
        return typeof value === "string" ? [value] : [];
      }
      return [];
    });
  });

  const extracted = chunks.join("\n").trim();
  return extracted || null;
}

function fencedCodeBlocks(text: string) {
  const lines = text.split(/\r?\n/);
  const payloads: string[] = [];
  let payloadLines: string[] = [];
  let isInsideFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!isInsideFence) {
      if (trimmed.startsWith("```")) {
        isInsideFence = true;
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      payloads.push(payloadLines.join("\n").trim());
      payloadLines = [];
      isInsideFence = false;
      continue;
    }

    payloadLines.push(line);
  }

  if (isInsideFence) {
    payloads.push(payloadLines.join("\n").trim());
  }

  return payloads;
}

function jsonObjectIn(text: string) {
  let searchStart = 0;
  while (searchStart < text.length) {
    const start = text.indexOf("{", searchStart);
    if (start < 0) return null;

    let depth = 0;
    let isInsideString = false;
    let isEscaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (isInsideString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (character === "\\") {
          isEscaped = true;
        } else if (character === "\"") {
          isInsideString = false;
        }
      } else if (character === "\"") {
        isInsideString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              return candidate;
            }
          } catch {
            break;
          }
        }
      }
    }

    searchStart = start + 1;
  }

  return null;
}

function extractJSONObject(text: string) {
  const trimmed = text.trim();
  for (const fenced of fencedCodeBlocks(trimmed)) {
    const extracted = jsonObjectIn(fenced);
    if (extracted) return extracted;
  }

  return jsonObjectIn(trimmed) ?? trimmed;
}

function limitString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const wordBoundary = trimmed.slice(0, maxLength).replace(/\s+\S*$/u, "").trim();
  return wordBoundary.length > 12 ? wordBoundary : trimmed.slice(0, maxLength);
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numberValue)) return fallback;

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function normalizeMatrixCandidate(candidate: unknown): unknown {
  const matrix = asRecord(candidate);
  if (!matrix) return candidate;

  return {
    ...matrix,
    title: limitString(matrix.title, 90),
    shortContext: limitString(matrix.shortContext, 260),
    criteria: Array.isArray(matrix.criteria)
      ? matrix.criteria.map((criterion) => {
          const record = asRecord(criterion);
          if (!record) return criterion;

          return {
            ...record,
            id: limitString(record.id, 40),
            name: limitString(record.name, 48),
            description: limitString(record.description, 180),
            weight: clampWeight(boundedInteger(record.weight, 0, 100, 25)),
            gateMinimum: clampScore(boundedInteger(record.gateMinimum, 0, 100, 0)),
          };
        })
      : matrix.criteria,
    options: Array.isArray(matrix.options)
      ? matrix.options.map((option) => {
          const record = asRecord(option);
          if (!record) return option;

          return {
            ...record,
            id: limitString(record.id, 40),
            name: limitString(record.name, 64),
            description: limitString(record.description, 220),
            notes: limitString(record.notes, 220),
            scores: Array.isArray(record.scores)
              ? record.scores.map((score) => {
                  const scoreRecord = asRecord(score);
                  if (!scoreRecord) return score;

                  return {
                    ...scoreRecord,
                    criterionId: limitString(scoreRecord.criterionId, 40),
                    score: clampScore(boundedInteger(scoreRecord.score, 0, 100, 0)),
                    rationale: limitString(scoreRecord.rationale, 180),
                  };
                })
              : record.scores,
          };
        })
      : matrix.options,
    assumptions: Array.isArray(matrix.assumptions)
      ? matrix.assumptions.map((item) => limitString(item, 160))
      : matrix.assumptions,
    recommendation: limitString(matrix.recommendation, 320),
    watchouts: Array.isArray(matrix.watchouts)
      ? matrix.watchouts.map((item) => limitString(item, 160))
      : matrix.watchouts,
  };
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function textFromDelta(delta: unknown) {
  if (typeof delta === "string") return delta;

  const record = asRecord(delta);
  if (!record) return null;

  return (
    stringField(record, "text") ??
    stringField(record, "value") ??
    stringField(record, "output_text") ??
    extractText(record)
  );
}

function errorMessageFrom(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return null;

  const directMessage = stringField(record, "message");
  if (directMessage) return directMessage;

  const error = asRecord(record.error);
  if (!error) return null;

  return (
    stringField(error, "message") ??
    stringField(error, "detail") ??
    stringField(error, "type")
  );
}

function captureStreamPayload(
  state: StreamReadState,
  payload: unknown,
  eventType: string | null,
) {
  const record = asRecord(payload);
  if (!record) return;

  const type = stringField(record, "type") ?? eventType ?? "";
  const message = errorMessageFrom(payload);
  if (message && (type.includes("error") || type.includes("failed"))) {
    state.errorMessage = message;
  }

  const delta = textFromDelta(record.delta);
  if (delta && (type.endsWith(".delta") || type.includes("output_text"))) {
    state.deltaText += delta;
  }

  const responseText = extractText(record.response);
  if (responseText) {
    state.finalText = responseText;
  }

  const directText = extractText(record);
  if (directText && (type.endsWith(".done") || type.includes("completed"))) {
    state.finalText = directText;
  }
}

function parseSseEvent(rawEvent: string) {
  const lines = rawEvent.split("\n");
  const eventType =
    lines
      .map((line) => line.trim())
      .find((line) => line.startsWith("event:"))
      ?.slice("event:".length)
      .trim() ?? null;
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
    .trim();

  return data ? { data, eventType } : null;
}

async function readCodexStream(response: Response) {
  if (!response.body) {
    throw new Error("Codex Responses returned an empty stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state: StreamReadState = {
    deltaText: "",
    finalText: null,
    errorMessage: null,
  };
  let buffer = "";

  const consumeBufferedEvents = () => {
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");

    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const parsed = parseSseEvent(rawEvent);
      if (parsed && parsed.data !== "[DONE]") {
        try {
          captureStreamPayload(
            state,
            JSON.parse(parsed.data) as unknown,
            parsed.eventType,
          );
        } catch {
          if (parsed.eventType?.includes("text")) {
            state.deltaText += parsed.data;
          }
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    consumeBufferedEvents();
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    buffer += "\n\n";
    consumeBufferedEvents();
  }

  if (state.errorMessage) {
    throw new Error(`Codex stream failed: ${state.errorMessage}`);
  }

  const text = (state.deltaText || state.finalText || "").trim();
  if (!text) {
    throw new Error("Codex Responses returned no readable text.");
  }

  return text;
}

function matrixInstructions(systemPrompt: string) {
  return `${systemPrompt}

Return only valid JSON. Do not wrap it in Markdown. The JSON object must match this TypeScript shape:
{
  "title": string,
  "shortContext": string,
  "criteria": [{"id": string, "name": string, "description": string, "weight": integer, "kind": "benefit" | "cost" | "risk" | "effort" | "evidence", "hardGate": boolean, "gateMinimum": integer}],
  "options": [{"id": string, "name": string, "description": string, "scores": [{"criterionId": string, "score": integer, "rationale": string}], "notes": string}],
  "assumptions": string[],
  "recommendation": string,
  "watchouts": string[]
}

Use the number of options and criteria the decision actually needs: 2-12 options and 3-10 criteria. Include all distinct user-named options unless invalid or duplicated.
Weights are integer percentages across criteria and must sum to 100.
Scores are independent integer performance ratings from 0 to 100 for each option against each criterion. Do not make scores across options sum to 100.
gateMinimum is an integer score threshold from 0 to 100; use 0 when hardGate is false. Keep descriptions, notes, assumptions, watchouts, and rationales terse.
Length limits are strict: title <=90 chars, criterion ids <=40, criterion names <=48, option ids <=40, option names <=64, score rationales <=100, assumptions/watchouts <=120.
Every option must include exactly one score for every criterion id.`;
}

export async function generateMatrixWithCodex(
  session: CodexSession,
  prompt: string,
  systemPrompt: string,
): Promise<CodexResponsesResult> {
  const model = codexResponsesModel();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${session.accessToken}`,
    "Accept": "text/event-stream",
    "Content-Type": "application/json",
    "OpenAI-Beta": "responses=experimental",
    "originator": codexOriginator(),
  };

  if (session.profile.accountId) {
    headers["chatgpt-account-id"] = session.profile.accountId;
  }

  const response = await fetch(codexResponsesEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      instructions: matrixInstructions(systemPrompt),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        verbosity: "low",
      },
      reasoning: {
        effort: "low",
        summary: "auto",
      },
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Codex Responses failed with ${response.status}: ${responseText}`);
  }

  const text = await readCodexStream(response);
  const json = extractJSONObject(text);
  const parsed = decisionMatrixSchema.parse(
    normalizeMatrixCandidate(JSON.parse(json)),
  );

  return {
    matrix: sanitizeMatrix(parsed),
    model,
  };
}
