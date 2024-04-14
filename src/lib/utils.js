export function getCoverImages(artworks, defaultImage, maxImages = 4) {
    // Create an array of image URLs or default images if the artwork doesn't exist
    return Array.from({ length: maxImages }, (_, index) =>
        artworks[index]?.image || defaultImage
    );
}