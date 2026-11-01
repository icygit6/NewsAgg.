// Mirrors scraper/core/config.py MODELS. Pipeline inventory, NOT a claim that
// every model ran successfully on every article (language-specific fallbacks apply).
export const NLP_MODELS = [
  { id: 'cardiffnlp/twitter-xlm-roberta-base-sentiment', role: 'Multilingual sentiment' },
  { id: 'ProsusAI/finbert', role: 'English finance sentiment' },
  { id: 'MoritzLaurer/mDeBERTa-v3-base-mnli-xnli', role: 'Topic classification' },
  { id: 'Davlan/xlm-roberta-base-ner-hrl', role: 'Names, organisations and places' },
  { id: 'BAAI/bge-m3', role: 'Semantic search and extractive summary' },
  { id: 'unitary/toxic-bert', role: 'English toxicity detection' },
]

/** Services outside the scoring pipeline: reader-facing translation and the article chat.
 * Listed separately so the pipeline count above stays a count of analysis models. */
export function serviceModels(chat: { primary: string; fallback: string }, translation: string) {
  return [
    { id: translation, role: 'Translation (Gemini, Lingva fallback)' },
    { id: chat.primary, role: 'AI article chat (Groq)' },
    { id: chat.fallback, role: 'AI article chat, fallback (Groq)' },
  ]
}
