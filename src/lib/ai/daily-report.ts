import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const analysisSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(900),
  observations: z.array(z.string().trim().min(1).max(240)).max(4),
  recommendations: z.array(z.string().trim().min(1).max(240)).max(5),
  tomorrowPriorities: z.array(z.string().trim().min(1).max(180)).max(5),
});

const responseJsonSchema = {
  type: "OBJECT",
  properties: {
    executiveSummary: { type: "STRING" },
    observations: { type: "ARRAY", items: { type: "STRING" } },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
    tomorrowPriorities: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["executiveSummary", "observations", "recommendations", "tomorrowPriorities"],
};

export type DailyReportEvidence = {
  reportDate: string;
  metrics: {
    planned: number;
    completed: number;
    completionRate: number | null;
    focusSeconds: number;
    estimatedMinutes: number;
    trackedMinutes: number;
    priorReportCount: number;
    priorAverageCompletionRate: number | null;
    priorAverageFocusSeconds: number | null;
  };
  tasks: Array<{
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    estimateMinutes: number;
  }>;
  sessions: Array<{
    taskTitle: string;
    durationSeconds: number;
    sessionType: string;
  }>;
  journal: string;
};

export type DailyReportAnalysis = z.infer<typeof analysisSchema>;

export async function analyzeDailyReport(evidence: DailyReportEvidence) {
  const apiKey =
    process.env.GEMINI_API_KEY_DAILY_REPORT ||
    process.env.GEMINI_API_KEY_DEFAULT;

  if (!apiKey) {
    return {
      analysis: null,
      issue: "Gemini is not configured; deterministic report metrics are available.",
      model: null,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const model = process.env.GEMINI_MODEL_DAILY_REPORT || "gemini-2.5-flash";
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: [
      "Interpret only the supplied stored-record evidence. Do not invent activity, infer that missing records mean inactivity, or recalculate metrics. Keep recommendations practical, kind, and specific. Return only the requested JSON.",
      JSON.stringify(evidence),
    ].join("\n\n"),
    config: {
      maxOutputTokens: 1100,
      responseJsonSchema,
      responseMimeType: "application/json",
      temperature: 0.2,
      httpOptions: {
        timeout: 20_000,
        retryOptions: {
          attempts: 2,
          expBase: 2,
          initialDelay: 0.5,
          jitter: 0.2,
          maxDelay: 2,
        },
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty daily-report response.");
  }

  const parsedJson: unknown = JSON.parse(text);
  const parsed = analysisSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Gemini returned a daily-report response with an invalid shape.");
  }

  return {
    analysis: parsed.data,
    issue: null,
    model: response.modelVersion ?? model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? null,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
  };
}
