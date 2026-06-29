/**
 * Gemini Client Factory
 *
 * Provides shared, lazily-initialised model instances for use across all
 * agent nodes. Using the official @google/generative-ai SDK.
 *
 * - Flash model  → fast triage / classification tasks
 * - Pro model    → deep reasoning / resolution planning tasks
 *
 * Both functions return `null` when GOOGLE_AI_API_KEY is absent, which
 * lets every caller fall back to rule-based logic without crashing.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  if (!_client) _client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  return _client;
}

/** Gemini 2.0 Flash — optimised for speed (triage, classification, reminders) */
export function getFlashModel(): GenerativeModel | null {
  return getClient()?.getGenerativeModel({ model: 'gemini-2.0-flash' }) ?? null;
}

/** Gemini 1.5 Pro Latest — optimised for reasoning (resolution planning, escalation summaries) */
export function getProModel(): GenerativeModel | null {
  return getClient()?.getGenerativeModel({ model: 'gemini-1.5-pro-latest' }) ?? null;
}
