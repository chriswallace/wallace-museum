# Tezos Thumbnail Fix Implementation

## Problem

When indexing Tezos NFTs, many tokens return a generic circle image as their thumbnail URL with the IPFS hash:
`ipfs://QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc`

This results in poor user experience as many NFTs display the same generic thumbnail instead of a proper preview of the artwork.

## Solution

The implementation detects this specific IPFS hash and handles it by:

1. **Detecting the generic thumbnail**: When the thumbnail URL matches the known generic circle IPFS hash, the system recognizes it as invalid.

2. **Using display/artifact image as fallback**: Instead of using the generic thumbnail, the system falls back to using the `display_uri` or `artifact_uri` as the thumbnail source.

3. **Frontend optimization**: The thumbnail URL points to the full image, but the frontend can use image optimization services (like Pinata's image transformation or the Wallace Museum IPFS service) to generate properly sized thumbnails on-the-fly.

## Implementation Details

### Files Modified:

1. **`src/lib/minimal-transformers.ts`** (lines 288-350)

   - Added detection for the generic circle IPFS hash in `transformTezosToken()`
   - Falls back to `display_uri` or `artifact_uri` when generic thumbnail is detected
   - Logs when this fallback occurs for debugging

2. **`src/lib/indexing/unified-indexer.ts`** (lines 430-444)

   - Added the same generic thumbnail detection in the unified indexer
   - Ensures thumbnails are properly set during the import process

3. **`src/lib/adminOperations.ts`** (lines 838-852)
   - Updated `saveArtwork()` to detect and handle generic thumbnails
   - Uses the main image URL as fallback when generic thumbnail is detected

### Key Constants:

```typescript
const GENERIC_CIRCLE_IPFS = 'ipfs://QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc';
```

### Logic Flow:

1. Check if `thumbnail_uri` equals the generic circle IPFS hash
2. If yes, clear the thumbnail URL and use fallback logic
3. Prefer `display_uri` over `artifact_uri` for thumbnails
4. Log the action for monitoring and debugging

## Benefits

1. **Better Visual Experience**: Users see actual artwork thumbnails instead of generic circles
2. **Automatic Handling**: No manual intervention required during indexing
3. **Preserves Original Data**: The fix is applied at the transformation layer, not the raw data storage
4. **Future-Proof**: If Tezos/objkt fixes this issue upstream, our code will automatically use the corrected thumbnails

## Frontend Considerations

The frontend should use image optimization services to transform the full-size images into appropriate thumbnails:

```javascript
// Example using the Wallace Museum IPFS service
import { buildOptimizedImageUrl } from '$lib/imageOptimization';

const thumbnailUrl = buildOptimizedImageUrl(artwork.thumbnailUrl, {
	width: 300,
	height: 300,
	fit: 'cover',
	format: 'webp',
	quality: 80
});
```

## Monitoring

The implementation includes console logging to track when generic thumbnails are detected and replaced:

- `[transformTezosToken] Detected generic circle thumbnail for token {tokenId}, will generate from display/artifact image`
- `[UnifiedIndexer] Detected generic circle thumbnail for {contractAddress}:{tokenId}, using display/artifact image instead`
- `[saveArtwork] Detected generic circle thumbnail for {contractAddress}:{tokenId}, using display/artifact image instead`

These logs can be used to monitor the frequency of this issue and verify the fix is working correctly.
