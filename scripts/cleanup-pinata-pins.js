#!/usr/bin/env node

/**
 * Script to delete all Pinata files with names starting with "Artwork CID"
 * Uses correct Pinata API v3 endpoints for public files
 *
 * Usage:
 *   node scripts/cleanup-pinata-pins.js
 *
 * Environment variables required:
 *   PINATA_JWT - Your Pinata JWT token
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
config();

const PINATA_JWT = process.env.PINATA_JWT;

if (!PINATA_JWT) {
	console.error('❌ Error: PINATA_JWT environment variable is required');
	process.exit(1);
}

/**
 * Get all files from Pinata using the v3 API
 */
async function getAllFiles() {
	const files = [];
	let pageToken = null;
	const limit = 1000; // Maximum allowed by Pinata

	console.log('📋 Fetching all files from Pinata...');

	while (true) {
		try {
			let url = `https://api.pinata.cloud/v3/files/public?limit=${limit}`;
			if (pageToken) {
				url += `&pageToken=${pageToken}`;
			}

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${PINATA_JWT}`
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Pinata API error: ${response.status} ${response.statusText} - ${errorText}`
				);
			}

			const data = await response.json();
			const fetchedFiles = data.data?.files || [];
			files.push(...fetchedFiles);

			console.log(`   Fetched ${fetchedFiles.length} files`);

			// If we got fewer files than the limit or no next page token, we've reached the end
			if (fetchedFiles.length < limit || !data.data?.next_page_token) {
				break;
			}

			pageToken = data.data.next_page_token;
		} catch (error) {
			console.error('❌ Error fetching files:', error.message);
			throw error;
		}
	}

	console.log(`✅ Total files fetched: ${files.length}`);
	return files;
}

/**
 * Delete files individually using the correct v3 API endpoint
 */
async function deleteFilesIndividually(fileIds, fileNames) {
	let successCount = 0;
	let failCount = 0;

	console.log(`   🔄 Deleting ${fileIds.length} files individually using correct API...`);

	for (let i = 0; i < fileIds.length; i++) {
		try {
			const response = await fetch(`https://api.pinata.cloud/v3/files/public/${fileIds[i]}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${PINATA_JWT}`
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Failed to delete file: ${response.status} ${response.statusText} - ${errorText}`
				);
			}

			console.log(`   ✅ Deleted: ${fileNames[i]} (${fileIds[i]})`);
			successCount++;
		} catch (individualError) {
			console.error(
				`   ❌ Failed to delete ${fileNames[i]} (${fileIds[i]}):`,
				individualError.message
			);
			failCount++;
		}

		// Rate limiting: wait 100ms between individual requests
		if (i < fileIds.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	return { success: successCount, failed: failCount };
}

/**
 * Main function
 */
async function main() {
	try {
		console.log('🧹 Pinata File Cleanup Script (API v3 - Public Files)');
		console.log('�� Target: Files with names starting with "Artwork CID"');
		console.log('');

		// Get all files
		const allFiles = await getAllFiles();

		// Filter files that start with "Artwork CID"
		const filesToDelete = allFiles.filter((file) => {
			const name = file.name || '';
			return name.startsWith('Artwork CID');
		});

		console.log('');
		console.log(`🔍 Found ${filesToDelete.length} files to delete:`);

		if (filesToDelete.length === 0) {
			console.log('✅ No files found with names starting with "Artwork CID"');
			return;
		}

		// Show what will be deleted (limit to first 10 for readability)
		const displayLimit = Math.min(filesToDelete.length, 10);
		filesToDelete.slice(0, displayLimit).forEach((file, index) => {
			console.log(`   ${index + 1}. ${file.name || 'Unnamed'} (${file.cid})`);
		});

		if (filesToDelete.length > displayLimit) {
			console.log(`   ... and ${filesToDelete.length - displayLimit} more files`);
		}

		console.log('');

		// Confirm deletion
		const readline = await import('readline');
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		const answer = await new Promise((resolve) => {
			rl.question(
				`⚠️  Are you sure you want to delete ${filesToDelete.length} files? (y/N): `,
				resolve
			);
		});

		rl.close();

		if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
			console.log('❌ Deletion cancelled');
			return;
		}

		console.log('');
		console.log('🗑️  Starting deletion with correct API endpoints...');

		// Process in batches of 100 for rate limiting
		const batchSize = 100;
		let totalSuccessCount = 0;
		let totalFailCount = 0;

		for (let i = 0; i < filesToDelete.length; i += batchSize) {
			const batch = filesToDelete.slice(i, i + batchSize);
			const fileIds = batch.map((file) => file.id);
			const fileNames = batch.map((file) => file.name || 'Unnamed');

			console.log(
				`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filesToDelete.length / batchSize)} (${batch.length} files)`
			);

			const result = await deleteFilesIndividually(fileIds, fileNames);
			totalSuccessCount += result.success;
			totalFailCount += result.failed;

			// Rate limiting: wait 200ms between batches
			if (i + batchSize < filesToDelete.length) {
				await new Promise((resolve) => setTimeout(resolve, 200));
			}
		}

		console.log('');
		console.log('📊 Deletion Summary:');
		console.log(`   ✅ Successfully deleted: ${totalSuccessCount}`);
		console.log(`   ❌ Failed to delete: ${totalFailCount}`);
		console.log(`   📋 Total processed: ${filesToDelete.length}`);

		if (totalFailCount > 0) {
			console.log('');
			console.log('⚠️  Some files failed to delete. Check the error messages above.');
			process.exit(1);
		} else {
			console.log('');
			console.log('🎉 All files successfully deleted!');
		}
	} catch (error) {
		console.error('❌ Script failed:', error.message);
		process.exit(1);
	}
}

// Run the script
main().catch((error) => {
	console.error('❌ Unexpected error:', error);
	process.exit(1);
});
