import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
// Mock console methods first, as they might be called during import
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// NO LONGER NEEDED for utility tests:
// vi.doMock('$app/environment', ...);
// vi.doMock('$env/dynamic/private', ...);
// vi.mock('imagekit', ...);
// vi.mock('ffmpeg-static', ...);
// vi.mock('@ffprobe-installer/ffprobe', ...);
// vi.mock('fluent-ffmpeg', ...);

// Import functions from the NEW utility file
import {
  createHashForString,
  extensionFromMimeType,
  generateFileName,
  generateTags,
  removeQueryString,
  convertIpfsToHttpsUrl,
} from './mediaUtils'; // <-- Import from mediaUtils.ts

describe('mediaUtils.ts - Utilities', () => {
  beforeEach(() => {
    // Reset console mocks if needed (e.g., check call counts)
    vi.clearAllMocks();
  });

  // --- Tests for exported utility functions --- 

  describe('createHashForString', () => {
     it('should return empty string for null/undefined input and warn', () => {
       expect(createHashForString(null)).toBe('');
       expect(createHashForString(undefined)).toBe('');
       expect(console.warn).toHaveBeenCalledWith('createHashForString called with undefined or null string.');
     });

     it('should generate a consistent SHA256 hash', () => {
       const input = 'test string';
       const expectedHash = 'd5579c46dfcc7f18207013e65b44e4cb4e2c2298f4ac457ba8f82743f31e930b';
       expect(createHashForString(input)).toBe(expectedHash);
       const input2 = 'another test';
       const expectedHash2 = '64320dd12e5c2caeac673b91454dac750c08ba333639d129671c2f58cb5d0ad1';
       expect(createHashForString(input2)).toBe(expectedHash2);
     });
  });

  describe('extensionFromMimeType', () => {
    it('should return correct extensions for known MIME types', () => {
      expect(extensionFromMimeType('image/jpeg')).toBe('.jpg');
      expect(extensionFromMimeType('image/png')).toBe('.png');
      expect(extensionFromMimeType('image/gif')).toBe('.gif');
      expect(extensionFromMimeType('video/mp4')).toBe('.mp4');
    });

    it('should return empty string and error for unknown MIME types', () => {
      expect(extensionFromMimeType('application/json')).toBe('');
      expect(console.error).toHaveBeenCalledWith('Unsupported MIME type for extension: application/json');
      expect(extensionFromMimeType('text/html')).toBe('');
      expect(console.error).toHaveBeenCalledWith('Unsupported MIME type for extension: text/html');
    });
  });

  describe('generateFileName', () => {
     it('should generate filename with correct extension', () => {
       expect(generateFileName('My Image', 'image/jpeg')).toBe('My_Image.jpg');
       expect(generateFileName('Test Video', 'video/mp4')).toBe('Test_Video.mp4');
     });

     it('should sanitize filename characters', () => {
       // Expect spaces replaced by _ and other special chars removed
       expect(generateFileName('My $pecial !mage*', 'image/png')).toBe('My_pecial_mage.png');
       // Expect path separators and question marks removed
       expect(generateFileName('a/b\\c?d', 'image/gif')).toBe('abcd.gif');
     });

     it('should handle empty name input and warn', () => {
       // Regex matches 'untitled' followed by the extension
       expect(generateFileName('', 'image/png')).toMatch(/^untitled\.png$/);
       expect(console.warn).toHaveBeenCalledWith('generateFileName called with empty name, using "untitled".');
     });

      it('should handle unsupported mime type and warn', () => {
        // Regex matches sanitized name, underscore, timestamp
        expect(generateFileName('Bad Type', 'application/pdf')).toMatch(/^Bad_Type_\d+$/);
        expect(console.warn).toHaveBeenCalledWith('Could not determine extension for mimeType: application/pdf. Using default.');
      });
  });

  describe('generateTags', () => {
    it('should generate tags with contract and token ID', () => {
      const fileName = 'MyImage.jpg';
      const contract = '0x123';
      const tokenId = 456;
      const fileHash = createHashForString(fileName);
      const expectedTags = `contractAddr:${contract},tokenID:${tokenId},fileHash:${fileHash}`;
      expect(generateTags(fileName, contract, tokenId)).toBe(expectedTags);
    });

    it('should generate tags with only file hash if contract/token missing', () => {
      const fileName = 'Another Image.png';
      const fileHash = createHashForString(fileName);
      const expectedTags = `fileHash:${fileHash}`;
      expect(generateTags(fileName)).toBe(expectedTags);
      expect(generateTags(fileName, '0x123')).toBe(expectedTags); // Token ID missing
      expect(generateTags(fileName, undefined, 456)).toBe(expectedTags); // Contract missing
    });

     it('should handle empty filename', () => {
       // fileHash will be empty string
       expect(generateTags('', '0x123', 456)).toBe('contractAddr:0x123,tokenID:456');
       expect(generateTags('')).toBe('');
     });
  });

   describe('removeQueryString', () => {
     it('should return empty string for null or undefined', () => {
       expect(removeQueryString(null)).toBe('');
       expect(removeQueryString(undefined)).toBe('');
     });

     it('should remove query string from valid URLs', () => {
       expect(removeQueryString('https://example.com/path?key=value&other=123')).toBe('https://example.com/path');
       expect(removeQueryString('http://test.com/?a=b')).toBe('http://test.com/');
     });

     it('should return original URL if no query string exists', () => {
       expect(removeQueryString('https://example.com/path')).toBe('https://example.com/path');
       expect(removeQueryString('http://test.com')).toBe('http://test.com');
     });

     it('should return original string and log error for invalid URLs', () => {
       const invalidUrl = 'not a valid url';
       expect(removeQueryString(invalidUrl)).toBe(invalidUrl);
       expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid URL'), expect.any(String));
     });
   });

  describe('convertIpfsToHttpsUrl', () => {
    it('should return empty string for null or undefined input', () => {
      expect(convertIpfsToHttpsUrl(null)).toBe('');
      expect(convertIpfsToHttpsUrl(undefined)).toBe('');
      expect(console.warn).toHaveBeenCalledWith('convertIpfsToHttpsUrl: Input is null or undefined.');
    });

    it('should return original URL if it is already an HTTP/HTTPS URL', () => {
      expect(convertIpfsToHttpsUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
      expect(convertIpfsToHttpsUrl('http://test.com/video.mp4')).toBe('http://test.com/video.mp4');
    });

    it('should return only hash/path for ipfs:// URI', () => {
      const ipfsHash = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const ipfsUri = `ipfs://${ipfsHash}`;
      expect(convertIpfsToHttpsUrl(ipfsUri)).toBe(ipfsHash);
    });

    it('should return original path if input is /ipfs/ path', () => {
       const ipfsPath = '/ipfs/bafybeidagy6fzcdi7wnhrw74de6rks7epb24nrpxhxcbrbuilfdtmnx6eq/image.png';
       expect(convertIpfsToHttpsUrl(ipfsPath)).toBe(ipfsPath);
    });

     it('should return only hash/path for ipfs:// URI with path', () => {
       const ipfsHashPath = 'bafybeihk566znq4nj3w7ddj2qomfls3nqnrojovwcagxjxfh6a44n4tx5i/metadata.json';
       const ipfsUri = `ipfs://${ipfsHashPath}`;
       expect(convertIpfsToHttpsUrl(ipfsUri)).toBe(ipfsHashPath);
     });

     it('should return original string if it does not seem like HTTP/IPFS', () => {
       expect(convertIpfsToHttpsUrl('some random string')).toBe('some random string');
       expect(convertIpfsToHttpsUrl('data:image/png;base64,...')).toBe('data:image/png;base64,...');
     });

     it('should handle non-string input gracefully and warn', () => {
       expect(convertIpfsToHttpsUrl(123 as any)).toBe(123);
       expect(console.warn).toHaveBeenCalledWith('convertIpfsToHttpsUrl: Input is not a string: 123');
     });
  });

}); 