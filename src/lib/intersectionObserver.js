// src/lib/intersectionObserver.js
export function intersectionObserver(node, { onEnter, onLeave }) {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					onEnter && onEnter();
				} else {
					onLeave && onLeave();
				}
			});
		},
		{
			threshold: 0.4
		}
	);

	observer.observe(node);

	return {
		destroy() {
			observer.unobserve(node);
		}
	};
}
