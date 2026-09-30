import { fetchPreviewTranslations, type ApiLang, type PreviewTranslation } from './translateService';

type Job = { id: string; lang: ApiLang; resolve: (translation: PreviewTranslation) => void; reject: (error: Error) => void };
const pending: Job[] = [];
let active = 0;
let scheduled = false;
function drain() {
  scheduled = false;
  while (active < 2 && pending.length) {
    const lang = pending[0].lang;
    const jobs: Job[] = [];
    for (let i = 0; i < pending.length && jobs.length < 20;) {
      if (pending[i].lang === lang) jobs.push(...pending.splice(i, 1));
      else i++;
    }
    active++;
    fetchPreviewTranslations(jobs.map(job => job.id), lang).then(rows => {
      for (const job of jobs) {
        const result = rows[job.id];
        if (result?.provider !== 'none' && result?.title) job.resolve(result);
        else job.reject(new Error('title_translation_unavailable'));
      }
    }).catch(() => jobs.forEach(job => job.reject(new Error('title_translation_unavailable'))))
      .finally(() => { active--; drain(); });
  }
}

/** Collect titles from feed, hero and rails into bounded batches. Never sends bodies. */
export function queueTitleTranslation(id: string, lang: ApiLang): Promise<PreviewTranslation> {
  return new Promise((resolve, reject) => {
    pending.push({ id, lang, resolve, reject });
    if (!scheduled) { scheduled = true; setTimeout(drain, 30); }
  });
}
