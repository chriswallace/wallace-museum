export let imgObserver;

// Function to initialize observers
export function initializeObservers() {
    if (typeof window === "undefined") {
        return; // Exit if running in a server-side context
    }

    imgObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    replaceImageWithVideo(img); // Call your new function
                    setSrcSetAndSizes(img); // Call your function to set srcset and sizes
                    observer.unobserve(img); // Stop observing this image
                }
            });
        },
        { rootMargin: '0px 0px 200px 0px' }
    );
}

export const replaceImageWithVideo = (img) => {
    if (window) {
        const videoURL = img.getAttribute('data-video');
        if (videoURL) {
            const video = document.createElement('video');
            video.src = videoURL;
            video.style.objectFit = 'cover'; // maintain the aspect ratio
            video.setAttribute('playsinline', ''); // ensure the video plays inline
            video.setAttribute('muted', ''); // ensure the video plays inline
            video.playbackRate = 1.0; // attempt to ensure 60fps
            video.addEventListener('ended', () => video.pause()); // pause on the last frame
            const imageWrapper = img.closest('.image-wrapper');
            if (imageWrapper) {
                img.replaceWith(video); // replace the img element with the video element

                // Listen for the end of the transition on the .image-wrapper, then play the video
                imageWrapper.addEventListener('transitionend', () => {
                    video.play(); // play the video once the transition ends
                });
            }
        }
    }
}

// Function to set srcset and sizes
export const setSrcSetAndSizes = (img) => {
    if (window) {
        const renderedWidth = img.clientWidth;
        const base_url = "https://ik.imagekit.io/UltraDAO/wallace_collection/";
        const img_name = img.src.split("/").pop().split("?")[0];

        const max_width = img.getAttribute("data-max-width");

        if (max_width && max_width <= renderedWidth) {
            img.src = `${base_url}${img_name}?tr=q-70`;
        } else {
            let size_1x = renderedWidth,
                size_2x = renderedWidth * 2,
                size_3x = renderedWidth * 3,
                size_4x = renderedWidth * 4;

            if (max_width) {
                size_1x = Math.min(max_width, size_1x);
                size_2x = Math.min(max_width, size_2x);
                size_3x = Math.min(max_width, size_3x);
                size_4x = Math.min(max_width, size_4x);
            }

            const srcsetStr = `${base_url}${img_name}?tr=w-${size_1x},q-70 1x,
                            ${base_url}${img_name}?tr=w-${size_2x},q-70 2x,
                            ${base_url}${img_name}?tr=w-${size_3x},q-70 3x`;

            // This should reflect your actual layout rules in your CSS
            const sizesStr = `(max-width: 400px) ${size_1x}px,
                        (max-width: 800px) ${size_2x}px,
                        (max-width: 1200px) ${size_3x}px,
                        ${size_4x}px`;

            img.src = `${base_url}${img_name}?tr=w-${size_1x},q-70`;
            img.srcset = srcsetStr;
            img.sizes = sizesStr;
        }
        img.classList.add("loaded");
    };
}