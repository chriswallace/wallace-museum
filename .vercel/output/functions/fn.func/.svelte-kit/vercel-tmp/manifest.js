export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["collection copy/chunk0.html","collection copy/chunk0.json","collection copy/chunk1.html","collection copy/chunk1.json","collection copy/chunk10.html","collection copy/chunk2.html","collection copy/chunk2.json","collection copy/chunk3.html","collection copy/chunk3.json","collection copy/chunk4.html","collection copy/chunk4.json","collection copy/chunk5.html","collection copy/chunk5.json","collection copy/chunk6.html","collection copy/chunk6.json","collection copy/chunk7.html","collection copy/chunk7.json","collection copy/chunk8.html","collection copy/chunk9.html","favicon.png"]),
	mimeTypes: {".html":"text/html",".json":"application/json",".png":"image/png"},
	_: {
		client: {"start":"_app/immutable/entry/start.db8b6f0b.js","app":"_app/immutable/entry/app.0b22a521.js","imports":["_app/immutable/entry/start.db8b6f0b.js","_app/immutable/chunks/scheduler.e108d1fd.js","_app/immutable/chunks/singletons.fdb17e01.js","_app/immutable/entry/app.0b22a521.js","_app/immutable/chunks/scheduler.e108d1fd.js","_app/immutable/chunks/index.bad58c3a.js"],"stylesheets":[],"fonts":[]},
		nodes: [
			__memo(() => import('../output/server/nodes/0.js')),
			__memo(() => import('../output/server/nodes/1.js')),
			__memo(() => import('../output/server/nodes/2.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
}
})();
