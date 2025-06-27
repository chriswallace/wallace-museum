# Scripts Documentation

## Artwork Dimensions Update Script

The `update-artwork-dimensions.ts` script scans all artworks in the database, analyzes their media files to extract dimensions, and updates the database with the captured dimensions.

### Features

- **Comprehensive Media Analysis**: Supports PNG, JPEG, GIF, WebP image formats
- **Fallback Detection**: Uses Sharp library when available, falls back to manual parsing
- **Smart URL Prioritization**: Checks imageUrl first, then animationUrl (excluding generators), then thumbnailUrl
- **IPFS Support**: Automatically converts IPFS URLs to HTTP gateway URLs
- **Robust Error Handling**: Continues processing even if individual artworks fail
- **Progress Tracking**: Shows real-time progress and detailed logging
- **Skip Existing**: Automatically skips artworks that already have valid dimensions
- **Comprehensive Reporting**: Generates detailed reports with success/error statistics
- **Report Persistence**: Saves JSON reports to `reports/` directory

### Usage

#### Run the script:

```bash
npm run update-dimensions
```

#### Or run directly with ts-node:

```bash
npx ts-node scripts/update-artwork-dimensions.ts
```

### What the Script Does

1. **Fetches all artworks** from the database
2. **Checks existing dimensions** - skips artworks that already have valid dimensions
3. **Prioritizes media URLs** in this order:
   - `imageUrl` (highest priority)
   - `animationUrl` (but skips Art Blocks generators)
   - `thumbnailUrl` (lowest priority)
4. **Downloads media files** with retry logic and error handling
5. **Extracts dimensions** using:
   - Sharp library (preferred method)
   - Manual parsing for PNG, JPEG, GIF, WebP formats
6. **Updates database** with extracted dimensions
7. **Generates comprehensive report** with:
   - Total processing statistics
   - Success/error/skipped counts
   - Detailed results for each artwork
   - Processing duration
   - Success rate percentage

### Output

The script provides:

- **Real-time console output** showing progress and status for each artwork
- **Final summary report** displayed in the console
- **JSON report file** saved to `reports/artwork-dimensions-report-[timestamp].json`

### Report Structure

The JSON report includes:

```json
{
	"totalArtworks": 150,
	"processed": 150,
	"successful": 120,
	"errors": 10,
	"skipped": 20,
	"startTime": "2024-01-01T12:00:00.000Z",
	"endTime": "2024-01-01T12:30:00.000Z",
	"duration": "30m 0s",
	"results": [
		{
			"id": 1,
			"title": "Artwork Title",
			"status": "success",
			"message": "Successfully updated dimensions to 1920x1080",
			"dimensions": { "width": 1920, "height": 1080 },
			"mediaUrl": "https://example.com/image.png"
		}
	]
}
```

### Error Handling

The script handles various error scenarios:

- **Network failures**: Retries with exponential backoff
- **Invalid URLs**: Skips and reports errors
- **Unsupported formats**: Gracefully skips with appropriate messages
- **Missing media**: Reports artworks without suitable media URLs
- **Database errors**: Continues processing other artworks

### Performance Considerations

- **Rate limiting**: 500ms delay between requests to avoid overwhelming external services
- **Memory efficient**: Processes artworks one at a time
- **Retry logic**: 3 retries with 2-second delays for network requests
- **Selective processing**: Skips artworks that already have dimensions

### Dependencies

- `@prisma/client` - Database access
- `file-type` - MIME type detection
- `sharp` (optional) - Image processing and dimension extraction
- Custom utilities from the project's media helpers

### Troubleshooting

If you encounter issues:

1. **Check database connection**: Ensure `DATABASE_URL` is properly configured
2. **Verify network access**: Script needs internet access to fetch media files
3. **Install Sharp**: For best results, ensure Sharp is properly installed
4. **Check permissions**: Ensure write permissions for the `reports/` directory
5. **Review error logs**: Check the detailed error messages in the console output

### Example Console Output

```
🎨 Starting Artwork Dimensions Update Script
==================================================
Fetching artworks from database...
Found 150 artworks to process

Progress: 1/150 (1%)

Processing artwork 1: "Genesis #1"
  Using imageUrl: https://example.com/image.png
  Fetching media from: https://example.com/image.png
  Downloaded 2.34MB
  ✓ Extracted dimensions: 1920x1080
  ✓ Updated database with dimensions: 1920x1080

Progress: 2/150 (1%)

Processing artwork 2: "Abstract Composition"
  ✓ Skipped - already has dimensions: 1024x1024

...

================================================================================
ARTWORK DIMENSIONS UPDATE REPORT
================================================================================
Start Time: 2024-01-01T12:00:00.000Z
End Time: 2024-01-01T12:30:00.000Z
Duration: 30m 0s
Total Artworks: 150
Processed: 150
Successful Updates: 120
Errors: 10
Skipped: 20
Success Rate: 80%
```
