import { imgObserver, initializeObservers } from "./lazyLoader";

function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

export function setupImages(img, index) {
    if (typeof window === 'undefined') return;

    if (img.getAttribute("data-processed") === "true") {
        return;
    }

    imgObserver.observe(img); // Now safe to use imgObserver

    // Create a wrapper div around the image
    const wrapperDiv = document.createElement("div");
    wrapperDiv.classList.add("image-wrapper");
    img.parentNode.insertBefore(wrapperDiv, img);
    wrapperDiv.appendChild(img);

    const maximizeIcon = document.createElement("div");
    maximizeIcon.classList.add("maximize-icon");

    // Check if img alt attribute is not empty before adding caption
    if (isMobile() && img.alt.trim().length) {
        const caption = document.createElement("caption");
        caption.innerHTML = img.alt;
        wrapperDiv.appendChild(caption);
    }

    img.setAttribute("data-processed", "true");
}