# Scripts

This directory contains utility scripts for managing the Wallace Collection database.

## Update Mint Dates Script

The `update-mint-dates.js` script allows you to update mint dates for all artworks while preserving manual overrides to other fields like `description`, `imageUrl`, and `thumbnailUrl`.

### How it works

1. **Fetches all artworks** that have a `contractAddress` and `tokenId`
2. **Calls external APIs** (OpenSea for Ethereum, TezTok for Tezos) to get fresh NFT data
3. **Extracts only the mint date** from the fresh data
4. **Updates only the `mintDate` field** in the database, leaving all other fields untouched
5. **Skips artworks** where the mint date hasn't changed or where no mint date is available

### Usage

#### Preview changes (recommended first step)

```bash
npm run update-mint-dates:dry-run
```

#### Actually update the mint dates

```bash
npm run update-mint-dates
```

#### Process in smaller batches (useful for large collections)

```bash
npm run update-mint-dates:small-batch
```

#### Custom batch size

```bash
node scripts/update-mint-dates.js --batch-size=50
```

### What gets preserved

The script **ONLY** updates the `mintDate` field. All other fields are preserved, including:

- ✅ `title` - Your manual titles are preserved
- ✅ `description` - Your manual descriptions are preserved
- ✅ `imageUrl` - Your manual image URLs are preserved
- ✅ `thumbnailUrl` - Your manual thumbnail URLs are preserved
- ✅ `animationUrl` - Your manual animation URLs are preserved
- ✅ `attributes` - Your manual attributes are preserved
- ✅ All other fields remain untouched

### What gets updated

- 🔄 `mintDate` - Only this field gets updated with fresh data from external APIs

### Safety features

- **Dry run mode**: Preview all changes before applying them
- **Batch processing**: Processes artworks in batches to avoid overwhelming APIs
- **Rate limiting**: Includes delays between API calls to respect rate limits
- **Error handling**: Continues processing even if some artworks fail
- **Detailed logging**: Shows exactly what's happening for each artwork
- **Graceful shutdown**: Can be interrupted safely with Ctrl+C

### Example output

```
🚀 Starting mint date update script
📊 Batch size: 100
🔍 Dry run: YES
🌐 API URL: http://localhost:5173

📋 Fetching all artwork IDs...
✅ Found 1,234 artworks with contract address and token ID

📦 Processing 1,234 artworks in 13 batches
🔍 DRY RUN MODE - No changes will be made

🔄 Processing batch 1/13 (100 artworks)
✅ Batch 1 completed:
   📈 Updated: 87
   ⏭️  Skipped: 13
   ❌ Failed: 0

🎉 Mint date update completed!
📊 Final Results:
   📈 Total artworks: 1,234
   ✅ Updated: 1,089
   ⏭️  Skipped: 145
   ❌ Failed: 0
```

### Requirements

- Your SvelteKit app must be running (the script calls your API endpoints)
- OpenSea API key must be configured in your environment
- Database must be accessible

### Troubleshooting

**Script fails with "API request failed"**

- Make sure your SvelteKit app is running on the correct port
- Check that your OpenSea API key is properly configured

**Many artworks are skipped**

- This is normal - artworks are skipped if they already have the correct mint date or if the external API doesn't provide mint date information

**Some artworks fail**

- This is normal for NFTs that no longer exist or have API issues
- The script will continue processing other artworks
