

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.9a80a3db.js","_app/immutable/chunks/scheduler.e108d1fd.js","_app/immutable/chunks/index.bad58c3a.js"];
export const stylesheets = ["_app/immutable/assets/2.65f182c0.css"];
export const fonts = [];
