import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCoverImages, placeholderAvatar, findAttribute, isVideo, isImage } from './utils';

// Mock Response class for fetch
class MockResponse {
  headers: Map<string, string>;
  constructor(headers = {}) {
    this.headers = new Map(Object.entries(headers));
  }
  get(header: string) {
    return this.headers.get(header);
  }
}

describe('utils.ts', () => {
  // Tests for getCoverImages
  describe('getCoverImages', () => {
    const defaultImage = 'default.jpg';
    const artworks = [
      { image_url: 'img1.jpg' },
      { image_url: 'img2.jpg' },
      { image_url: 'img3.jpg' },
      { image_url: 'img4.jpg' },
      { image_url: 'img5.jpg' }
    ];

    it('should return the correct number of images (default max)', () => {
      const images = getCoverImages(artworks, defaultImage);
      expect(images).toHaveLength(4);
      expect(images).toEqual(['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg']);
    });

    it('should return the specified number of images', () => {
      const images = getCoverImages(artworks, defaultImage, 2);
      expect(images).toHaveLength(2);
      expect(images).toEqual(['img1.jpg', 'img2.jpg']);
    });

    it('should use default image if artwork is missing', () => {
      const fewArtworks = [ { image_url: 'img1.jpg' }];
      const images = getCoverImages(fewArtworks, defaultImage, 3);
      expect(images).toHaveLength(3);
      expect(images).toEqual(['img1.jpg', defaultImage, defaultImage]);
    });

     it('should use default image if artwork image_url is missing', () => {
      const artworksWithMissingUrl = [ { image_url: 'img1.jpg' }, {}, { image_url: 'img3.jpg' } ];
      const images = getCoverImages(artworksWithMissingUrl, defaultImage, 3);
      expect(images).toHaveLength(3);
      expect(images).toEqual(['img1.jpg', defaultImage, 'img3.jpg']);
    });

    it('should handle empty artworks array', () => {
      const images = getCoverImages([], defaultImage, 4);
      expect(images).toHaveLength(4);
      expect(images).toEqual([defaultImage, defaultImage, defaultImage, defaultImage]);
    });
  });

  // Tests for placeholderAvatar
  describe('placeholderAvatar', () => {
    it('should generate correct URL for single name', () => {
      expect(placeholderAvatar('Test')).toBe('https://avatar.iran.liara.run/username?username=Test&length=1');
    });

    it('should generate correct URL for name with spaces', () => {
      expect(placeholderAvatar('Test User')).toBe('https://avatar.iran.liara.run/username?username=TestUser&length=1');
    });

     it('should handle leading/trailing spaces', () => {
      expect(placeholderAvatar('  Test User  ')).toBe('https://avatar.iran.liara.run/username?username=TestUser&length=1');
    });
  });

  // Tests for findAttribute
  describe('findAttribute', () => {
    const attributes = [
      { trait_type: 'Color', value: 'Red' },
      { trait_type: 'Size', value: 'Large' },
      { trait_type: 'Material', value: 'Cotton' }
    ];

    it('should find an existing attribute', () => {
      expect(findAttribute(attributes, 'Size')).toBe('Large');
    });

    it('should return null if attribute does not exist', () => {
      expect(findAttribute(attributes, 'Shape')).toBeNull();
    });

    it('should return null for empty attributes array', () => {
      expect(findAttribute([], 'Color')).toBeNull();
    });

    it('should return null for null or undefined attributes input', () => {
      expect(findAttribute(null, 'Color')).toBeNull();
      expect(findAttribute(undefined, 'Color')).toBeNull();
    });

     it('should handle attributes with non-string values', () => {
       const complexAttributes = [
         { trait_type: 'Count', value: 10 },
         { trait_type: 'Enabled', value: true },
       ];
      expect(findAttribute(complexAttributes, 'Count')).toBe(10);
      expect(findAttribute(complexAttributes, 'Enabled')).toBe(true);
    });
  });

  // Tests for isVideo and isImage
  describe('isVideo / isImage', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      // Assign mock to global fetch before each test
      vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
      // Restore original fetch after each test
      vi.unstubAllGlobals();
      mockFetch.mockReset(); // Reset call history
    });

    // isVideo tests
    it('isVideo should return true for video content type', async () => {
      mockFetch.mockResolvedValue(new MockResponse({ 'Content-Type': 'video/mp4' }));
      await expect(isVideo('test.mp4')).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('test.mp4', { method: 'HEAD' });
    });

    it('isVideo should return false for non-video content type', async () => {
      mockFetch.mockResolvedValue(new MockResponse({ 'Content-Type': 'image/jpeg' }));
      await expect(isVideo('test.jpg')).resolves.toBe(false);
    });

    it('isVideo should return false if Content-Type header is missing', async () => {
      mockFetch.mockResolvedValue(new MockResponse()); // No headers
      await expect(isVideo('test.unknown')).resolves.toBe(false);
    });

    it('isVideo should return false if fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      await expect(isVideo('test.error')).resolves.toBe(false);
    });

     it('isVideo should return false for undefined URL without fetching', async () => {
       // Note: The original function handles undefined BEFORE fetch
       await expect(isVideo(undefined as any)).resolves.toBe(false);
       expect(mockFetch).not.toHaveBeenCalled();
     });

    // isImage tests
    it('isImage should return true for image content type', async () => {
      mockFetch.mockResolvedValue(new MockResponse({ 'Content-Type': 'image/png' }));
      await expect(isImage('test.png')).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('test.png', { method: 'HEAD' });
    });

    it('isImage should return false for non-image content type', async () => {
      mockFetch.mockResolvedValue(new MockResponse({ 'Content-Type': 'video/quicktime' }));
      await expect(isImage('test.mov')).resolves.toBe(false);
    });

    it('isImage should return false if Content-Type header is missing', async () => {
      mockFetch.mockResolvedValue(new MockResponse()); // No headers
      await expect(isImage('test.unknown')).resolves.toBe(false);
    });

    it('isImage should return false if fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      await expect(isImage('test.error')).resolves.toBe(false);
    });

     it('isImage should return false for undefined URL when fetch fails', async () => {
      // Unlike isVideo, isImage doesn't check undefined first, fetch will be called
       mockFetch.mockRejectedValue(new TypeError('Failed to fetch')); // Simulate fetch error for undefined URL
       await expect(isImage(undefined as any)).resolves.toBe(false);
       expect(mockFetch).toHaveBeenCalledWith(undefined as any, { method: 'HEAD' });
     });

  });
}); 