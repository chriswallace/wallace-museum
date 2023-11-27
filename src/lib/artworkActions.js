import { get } from 'svelte/store';
import { isMaximized } from '$lib/stores';

let clonedArtwork = null;

export function handleMaximize(artworkDetails) {
    const isCurrentlyMaximized = get(isMaximized);

    if (!isCurrentlyMaximized && artworkDetails) {
        // Assuming artworkDetails has an id property
        let artworkId = artworkDetails.id;

        // Find the artwork element in the DOM
        // This assumes your artwork elements have a data attribute like 'data-artwork-id'
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

    // Style the clone to overlay exactly on top of the original
    Object.assign(clonedArtwork.style, {
        position: 'fixed',
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        transform: 'none',
        backgroundColor: 'rgba(0,0,0,0)',
        transition: 'all 0.125s ease-in-out',
        zIndex: 1001 // Higher than the maximized z-index
    });

    document.body.appendChild(clonedArtwork);

    // Animate the clone to full screen
    setTimeout(() => {
        Object.assign(clonedArtwork.style, {
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,1)',
            transform: 'scale(1)'
        });
    }, 100); // Delay to allow the browser to render the cloned element first
}

export function closeFullscreen() {
    clonedArtwork.remove();
    clonedArtwork = null;
    isMaximized.set(undefined);
}