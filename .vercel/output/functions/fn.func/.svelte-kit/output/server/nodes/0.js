

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.0099dade.js","_app/immutable/chunks/scheduler.e108d1fd.js","_app/immutable/chunks/index.bad58c3a.js"];
export const stylesheets = ["_app/immutable/assets/0.f83cc90b.css"];
export const fonts = [];
