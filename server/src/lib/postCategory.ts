export const POST_CATEGORIES = ['General', 'Sport', 'Health', 'Business', 'World', 'Politics', 'Lifestyle', 'Science', 'Climate'] as const

// Conservative multilingual fallback. User choice always takes precedence.
const patterns: Record<string, RegExp> = {
  Sport: /\b(football|soccer|basketball|tennis|olympic|sports?|sepak bola|olahraga)\b|足球|籃球|體育|体育/i,
  Health: /\b(health|hospital|vaccine|disease|medical|kesehatan|rumah sakit|vaksin)\b|健康|醫院|医院|疫苗/i,
  Business: /\b(economy|inflation|stocks?|business|finance|ekonomi|bisnis|saham)\b|經濟|经济|財經|财经|股市/i,
  Politics: /\b(election|parliament|government|president|politics|pemilu|politik|pemerintah)\b|政治|選舉|选举|政府/i,
  Science: /\b(science|research|technology|artificial intelligence|sains|teknologi|penelitian)\b|科學|科学|科技|人工智慧/i,
  Climate: /\b(climate|emissions|warming|carbon|iklim|emisi|pemanasan)\b|氣候|气候|暖化|碳排/i,
  Lifestyle: /\b(lifestyle|fashion|travel|cooking|music|film|wisata|kuliner)\b|旅遊|旅游|娛樂|娱乐|時尚/i,
  World: /\b(international|diplomacy|global|war|dunia|internasional|perang)\b|國際|国际|戰爭|战争/i,
}
export function inferPostCategory(content: string, attached?: string): string {
  const matches = Object.entries(patterns).filter(([,pattern]) => pattern.test(content))
  if (matches.length === 1) return matches[0][0]
  return POST_CATEGORIES.includes(attached as any) ? attached! : 'General'
}
