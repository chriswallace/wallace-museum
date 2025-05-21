// Art Blocks contract addresses
export const ART_BLOCKS_CONTRACTS = {
	LEGACY: '0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a',
	ENGINE: '0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270',
	PRESENTS: '0x99a9B7c1116f9ceEB1652de04d5969CcE509B069',
	PRESENTS_FLEX: '0x0E6A21cF97D6A9d9D8F794D26dFB3E3BAA49f3AC'
};

// Helper function to check if a contract is an Art Blocks contract
export function isArtBlocksContract(contractAddress: string): boolean {
	if (!contractAddress) return false;
	const normalizedAddress = contractAddress.toLowerCase();
	return Object.values(ART_BLOCKS_CONTRACTS)
		.map((addr) => addr.toLowerCase())
		.includes(normalizedAddress);
}

// Helper function to get Art Blocks contract alias
export function getArtBlocksContractAlias(contractAddress: string): string | null {
	if (!contractAddress) return null;
	const normalizedAddress = contractAddress.toLowerCase();

	for (const [key, value] of Object.entries(ART_BLOCKS_CONTRACTS)) {
		if (value.toLowerCase() === normalizedAddress) {
			return key === 'ENGINE' ? 'art blocks' : `art blocks ${key.toLowerCase()}`;
		}
	}
	return null;
}
