import { get } from 'svelte/store';
import { isMaximized } from '$lib/stores';

let clonedArtwork = null;

export function handleMaximize(artworkId) {
	const isCurrentlyMaximized = get(isMaximized);

	if (!isCurrentlyMaximized) {
		let artworkElement = document.querySelector(`[data-artwork-id='${artworkId}']`);

		if (artworkElement) {
			animateToFullscreen(artworkElement);
		} else {
			console.error('Artwork element not found');
		}
	} else {
		closeFullscreen();
	}

	isMaximized.set(!isCurrentlyMaximized);
}

function animateToFullscreen(artworkElement) {
	clonedArtwork = artworkElement.cloneNode(true);
	let rect = artworkElement.getBoundingClientRect();

	clonedArtwork.classList.add('maximized');

	// Style the clone to overlay exactly on top of the original
	Object.assign(clonedArtwork.style, {
		position: 'fixed',
		top: rect.top + 'px',
		left: rect.left + 'px',
		width: rect.width + 'px',
		height: rect.height + 'px',
		margin: '0',
		maxWidth: '100vw',
		maxHeight: '100vh',
		transform: 'none',
		transition: 'all 0.125s ease-in-out',
		zIndex: 1001
	});

	document.body.appendChild(clonedArtwork);
	clonedArtwork.querySelector('.close').addEventListener('click', closeFullscreen);

	setTimeout(() => {
		Object.assign(clonedArtwork.style, {
			top: '0',
			left: '0',
			width: '100%',
			height: '100%',
			transform: 'scale(1)'
		});
	}, 100); // Delay to allow the browser to render the cloned element first
}

export function closeFullscreen() {
	if (clonedArtwork) {
		clonedArtwork.remove();
		clonedArtwork = null;
		isMaximized.set(false); // or null, depending on your state management logic
	} else {
		console.error('No maximized artwork to close.');
	}
}
