import { hasOpenAIResponsesKey } from "@/lib/codex-responses";
import { isLoopbackUrl } from "@/lib/codex-oauth";

export type GenerationProvider = "codex" | "openai";
export type GenerationMode = GenerationProvider | "auto";

export type GenerationStatus = {
  mode: GenerationMode;
  provider: GenerationProvider;
  signInRequired: boolean;
  available: boolean;
  message: string | null;
};

type RequestLike = {
  url: string;
  headers: Headers;
};

function configuredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requestAppOrigin(request: RequestLike) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? requestUrl.protocol.replace(/:$/u, "");

  return host ? `${proto}://${host}` : requestUrl.origin;
}

export function matrixGenerationMode(): GenerationMode {
  const mode = configuredEnv("CLEARWEIGHT_AI_PROVIDER")?.toLowerCase();

  if (mode === "codex" || mode === "openai" || mode === "auto") {
    return mode;
  }

  return "auto";
}

export function matrixGenerationProviderFor(appOrigin: string): GenerationProvider {
  const mode = matrixGenerationMode();
  if (mode === "codex" || mode === "openai") return mode;

  return isLoopbackUrl(appOrigin) ? "codex" : "openai";
}

export function matrixGenerationStatusFor(
  appOrigin: string,
  codexSignInAvailable: boolean,
): GenerationStatus {
  const mode = matrixGenerationMode();
  const provider = matrixGenerationProviderFor(appOrigin);

  if (provider === "openai") {
    const available = hasOpenAIResponsesKey();
    return {
      mode,
      provider,
      signInRequired: false,
      available,
      message: available
        ? null
        : "OpenAI API key is not configured for this deployment. Set OPENAI_API_KEY or switch CLEARWEIGHT_AI_PROVIDER to codex.",
    };
  }

  return {
    mode,
    provider,
    signInRequired: true,
    available: codexSignInAvailable,
    message: codexSignInAvailable
      ? null
      : "Codex sign-in is not available for this host and redirect configuration.",
  };
}
