import prisma from '$lib/prisma';
import type { WalletAddress } from '$lib/types/wallet';

export const SETTINGS_KEYS = {
	WALLET_ADDRESSES: 'wallet_addresses'
};

// Re-export the type for backward compatibility
export type { WalletAddress };

interface SettingsRecord {
	key: string;
	value: any;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * Get wallet addresses from settings
 */
export async function getWalletAddresses(): Promise<WalletAddress[]> {
	try {
		const setting = (await prisma.settings.findUnique({
			where: { key: SETTINGS_KEYS.WALLET_ADDRESSES }
		})) as SettingsRecord | null;

		if (!setting) {
			return [];
		}

		// Ensure we always return an array
		let value = setting.value;
		
		// If value is a string, try to parse it as JSON
		if (typeof value === 'string') {
			try {
				value = JSON.parse(value);
			} catch (parseError) {
				console.error('Error parsing wallet addresses JSON:', parseError);
				return [];
			}
		}
		
		// Ensure the value is an array
		if (!Array.isArray(value)) {
			console.error('Wallet addresses value is not an array:', value);
			return [];
		}

		return value as WalletAddress[];
	} catch (error) {
		console.error('Error getting wallet addresses:', error);
		return [];
	}
}

/**
 * Add a wallet address to settings
 */
export async function addWalletAddress(
	address: string,
	blockchain: string,
	alias?: string
): Promise<WalletAddress[]> {
	try {
		const existingAddresses = await getWalletAddresses();

		// Check if address already exists for this blockchain
		const addressExists = existingAddresses.some(
			(addr) =>
				addr.address.toLowerCase() === address.toLowerCase() && addr.blockchain === blockchain
		);

		if (addressExists) {
			// If the address exists, just update the alias if provided
			if (alias) {
				return updateWalletAddress(address, blockchain, { alias });
			}
			return existingAddresses;
		}

		// Create new wallet address entry
		const newAddress: WalletAddress = {
			address,
			blockchain,
			alias,
			createdAt: new Date().toISOString()
		};

		const updatedAddresses = [...existingAddresses, newAddress];

		// Create or update settings record
		await prisma.settings.upsert({
			where: { key: SETTINGS_KEYS.WALLET_ADDRESSES },
			update: { value: JSON.stringify(updatedAddresses) },
			create: {
				key: SETTINGS_KEYS.WALLET_ADDRESSES,
				value: JSON.stringify(updatedAddresses)
			}
		});

		return updatedAddresses;
	} catch (error) {
		console.error('Error adding wallet address:', error);
		return await getWalletAddresses();
	}
}

/**
 * Remove a wallet address from settings
 */
export async function removeWalletAddress(
	address: string,
	blockchain: string
): Promise<WalletAddress[]> {
	try {
		const existingAddresses = await getWalletAddresses();

		const updatedAddresses = existingAddresses.filter(
			(addr) =>
				!(addr.address.toLowerCase() === address.toLowerCase() && addr.blockchain === blockchain)
		);

		await prisma.settings.update({
			where: { key: SETTINGS_KEYS.WALLET_ADDRESSES },
			data: { value: JSON.stringify(updatedAddresses) }
		});

		return updatedAddresses;
	} catch (error) {
		console.error('Error removing wallet address:', error);
		return await getWalletAddresses();
	}
}

/**
 * Update a wallet address alias
 */
export async function updateWalletAddress(
	address: string,
	blockchain: string,
	updates: { alias?: string }
): Promise<WalletAddress[]> {
	try {
		const existingAddresses = await getWalletAddresses();

		const updatedAddresses = existingAddresses.map((addr) => {
			if (addr.address.toLowerCase() === address.toLowerCase() && addr.blockchain === blockchain) {
				return { ...addr, ...updates };
			}
			return addr;
		});

		await prisma.settings.update({
			where: { key: SETTINGS_KEYS.WALLET_ADDRESSES },
			data: { value: JSON.stringify(updatedAddresses) }
		});

		return updatedAddresses;
	} catch (error) {
		console.error('Error updating wallet address:', error);
		return await getWalletAddresses();
	}
}
