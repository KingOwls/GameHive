export const reviewGameId = (id: unknown): id is string =>
  typeof id === 'string' && (/^rawg:[0-9]+$/.test(id) || /^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
export function validateReviewRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request');
  const v = value as Record<string, unknown>;
  if (!reviewGameId(v.gameId) || !['create','update','withdraw','republish'].includes(String(v.action))) throw new Error('Invalid request');
  if (v.action !== 'create' && (!Number.isInteger(v.version) || Number(v.version) < 1 || Number(v.version)>2147483647)) throw new Error('Invalid version');
  if (v.action === 'create' || v.action === 'update') {
    if (!v.input || typeof v.input !== 'object' || Array.isArray(v.input)) throw new Error('Invalid input');
    const input = v.input as Record<string, unknown>;
    if (typeof input.rating !== 'number' || !Number.isFinite(input.rating) || input.rating<0 || input.rating>10) throw new Error('Invalid rating');
    for (const [field,min,max] of [['title',3,120],['bodyPublic',20,10000],['bodySpoiler',0,20000]] as const) {
      const text = input[field];
      if (typeof text!=='string' || [...text.replace(/\s+/gu,' ').trim()].length<min || [...text].length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new Error('Invalid text');
    }
    for (const key of ['pros','cons']) {
      const points=input[key] ?? [];
      if (!Array.isArray(points) || points.length>5 || points.some(p=>typeof p!=='string' || !p.trim() || [...p].length>200)) throw new Error('Invalid points');
    }
  }
  return v;
}
