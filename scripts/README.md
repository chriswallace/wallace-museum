# Pinata Cleanup Scripts

This directory contains scripts to help manage and clean up files on your Pinata account using the Pinata API v3.

## Scripts

### `cleanup-pinata-pins.js`

An ES modules script that deletes all Pinata files with names starting with "Artwork CID". This script uses the latest Pinata API v3 endpoints.

## Prerequisites

1. **Node.js** (version 14 or higher)
2. **Environment Variables**: You need to set up your Pinata JWT token
3. **Dependencies**: The scripts use `dotenv` and `node-fetch` packages

## Setup

1. Make sure you have the required environment variable set in your `.env` file:

   ```bash
   PINATA_JWT=your_pinata_jwt_token_here
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install dotenv node-fetch
   ```

## Usage

```bash
node scripts/cleanup-pinata-pins.js
```

## What the Script Does

1. **Fetches all files** from your Pinata account using API v3
2. **Filters files** that have names starting with "Artwork CID"
3. **Shows you a list** of files that will be deleted
4. **Asks for confirmation** before proceeding
5. **Deletes the files** one by one with rate limiting
6. **Provides a summary** of the operation

## Safety Features

- ✅ **Confirmation prompt**: The script asks for confirmation before deleting anything
- ✅ **Preview mode**: Shows you exactly what will be deleted before proceeding
- ✅ **Rate limiting**: Waits 100ms between API calls to avoid hitting rate limits
- ✅ **Error handling**: Continues processing even if individual deletions fail
- ✅ **Detailed logging**: Shows progress and results for each operation

## Example Output

```
🧹 Pinata File Cleanup Script
🎯 Target: Files with names starting with "Artwork CID"

📋 Fetching all files from Pinata...
   Fetched 150 files
✅ Total files fetched: 150

🔍 Found 5 files to delete:
   1. Artwork CID: QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx (QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx)
   2. Artwork CID: QmYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYy (QmYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYy)
   ...

⚠️  Are you sure you want to delete 5 files? (y/N): y

🗑️  Starting deletion...
   Deleting 1/5: Artwork CID: QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
   ✅ Deleted: Artwork CID: QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx (QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx)
   ...

📊 Deletion Summary:
   ✅ Successfully deleted: 5
   ❌ Failed to delete: 0
   📋 Total processed: 5

🎉 All files successfully deleted!
```

## Why Clean Up "Artwork CID" Files?

The "Artwork CID" naming pattern was used in earlier versions of the pinning system or for test files. The current system uses more descriptive names like `"[Artwork Title] - [CID]"`. This script helps clean up the old naming pattern to keep your Pinata account organized.

## Troubleshooting

### "PINATA_JWT environment variable is required"

Make sure you have set the `PINATA_JWT` variable in your `.env` file.

### "Pinata API error: 401 Unauthorized"

Your Pinata JWT token may be invalid or expired. Check your token in the Pinata dashboard.

### "Failed to delete" errors

Some files might fail to delete due to temporary API issues. The script will continue with other files and show a summary at the end.

### Module import errors

If you get ES module errors, make sure your Node.js version supports ES modules (Node.js 14+) and that your project is configured correctly.

## Security Notes

- The script only deletes files with names starting with "Artwork CID"
- It will never delete files with other naming patterns
- Always review the list of files before confirming deletion
- The script includes confirmation prompts to prevent accidental deletions
