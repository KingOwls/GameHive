export const reviewGameId = (id: unknown): id is string =>
  typeof id === 'string' && (/^rawg:[0-9]+$/.test(id) || /^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
export function validateReviewRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request');
  const v = value as Record<string, unknown>;
  if (!reviewGameId(v.gameId) || !['create','update','convert','withdraw','republish'].includes(String(v.action))) throw new Error('Invalid request');
  if (v.action !== 'create' && (!Number.isInteger(v.version) || Number(v.version) < 1 || Number(v.version)>2147483647)) throw new Error('Invalid version');
  if (v.action === 'create' || v.action === 'update' || v.action === 'convert') {
    if (!v.input || typeof v.input !== 'object' || Array.isArray(v.input)) throw new Error('Invalid input');
    const input = v.input as Record<string, unknown>;
    if (input.critical !== undefined) validateCritical(input.critical);
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

export const criterionKeys = ['gameplay','narrative','art','sound','performance','accessibility','content','value'] as const;
export function validateCritical(value: unknown) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid critical details');
 const v=value as Record<string,unknown>;
 const criteria=v.criteria as Record<string,{score:unknown;explanation:unknown}>;
 const text=(x:unknown,min:number,max:number)=>typeof x==='string' && [...x.replace(/\s+/gu,' ').trim()].length>=min && [...x].length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(x);
 if(!criteria || typeof criteria!=='object' || Object.keys(criteria).length!==8 || criterionKeys.some(k=>!criteria[k] || typeof criteria[k].score!=='number' || !Number.isFinite(criteria[k].score) || Number(criteria[k].score)<0 || Number(criteria[k].score)>10 || !/^\d+(?:\.\d{1,2})?$/.test(String(criteria[k].score)) || !text(criteria[k].explanation,10,1000))) throw Error('Invalid criteria');
 if(!text(v.platform,1,100) || typeof v.hoursPlayed!=='number' || !Number.isFinite(v.hoursPlayed) || v.hoursPlayed<0 || v.hoursPlayed>10000 || typeof v.completed!=='boolean' || typeof v.copyProvided!=='boolean' || !text(v.scoreReason,20,2000) || !Array.isArray(v.answers) || v.answers.length>12 || v.answers.some(a=>!a || typeof a.questionId!=='string' || !/^[0-9a-f-]{36}$/i.test(a.questionId) || !text(a.answer,1,1000))) throw Error('Invalid critical context');
}
