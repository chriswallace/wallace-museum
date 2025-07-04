// Type definitions for indexing and import workflow

// Data source types
export type DataSource = 'opensea' | 'teztok' | 'alchemy' | 'moralis' | 'manual' | 'objkt';
export type Blockchain =
	| 'ethereum'
	| 'base'
	| 'shape'
	| 'polygon'
	| 'tezos'
	| 'unknown';
export type ImportStatus =
	| 'pending'
	| 'processing'
	| 'normalized'
	| 'referenced'
	| 'imported'
	| 'failed'
	| 'skipped';

// OpenSea API response types
export interface OpenSeaNFT {
	identifier: string;
	collection: string;
	contract: string;
	token_standard: string;
	name: string;
	description: string;
	image_url: string;
	display_image_url?: string;
	display_animation_url?: string;
	metadata_url: string;
	opensea_url: string;
	updated_at: string;
	is_disabled: boolean;
	is_nsfw: boolean;
	animation_url?: string;
	is_suspicious: boolean;
	creator: string;
	traits: Array<{
		trait_type: string;
		display_type?: string;
		max_value?: number;
		value: string | number;
	}>;
	owners: Array<{
		address: string;
		quantity: number;
	}>;
	rarity?: any;
	// Additional fields for enhanced mapping
	artifact_uri?: string;
	display_uri?: string;
	external_url?: string;
	supply?: number;
	mint_date?: string;
	symbol?: string;
	floor_price?: number;
	volume_traded?: number;
	// Enhanced creator metadata
	creator_username?: string;
	creator_profile_url?: string;
	creator_avatar_url?: string;
	creator_is_verified?: boolean;
	creator_bio?: string;
	creator_social_links?: any;
	creator_ens_name?: string;
	creator_display_name?: string;
	creator_profile_data?: any;
	// Enhanced collection metadata
	collection_slug?: string;
	collection_name?: string;
	collection_description?: string;
	collection_chain_identifier?: string;
	collection_contract_addresses?: any;
	collection_fees?: any;
	collection_safelist_status?: string;
	collection_website_url?: string;
	collection_discord_url?: string;
	collection_telegram_url?: string;
	collection_medium_url?: string;
	collection_project_url?: string;
	collection_image_url?: string;
	collection_banner_image_url?: string;
	collection_last_synced_at?: string;
	collection_parent_contract?: string;
	collection_is_generative_art?: boolean;
	collection_is_shared_contract?: boolean;
	collection_project_number?: number;
	collection_curator_address?: string;
	collection_creator?: string;
	collection_originating_creator_address?: string;
	collection_total_supply?: number;
	collection_current_supply?: number;
	collection_mint_start_date?: string;
	collection_mint_end_date?: string;
	collection_floor_price?: number;
	collection_volume_traded?: number;
	collection_external_collection_id?: string;
	collection_art_blocks_project_id?: number;
	collection_fxhash_project_id?: number;
	tags?: string[];
	features?: Record<string, any>;
	collectionId?: number;
}

// Tezos/TezTok API response types
export interface TezosToken {
	token_id: string;
	name?: string; // Name field from OBJKT API
	metadata: string;
	mime: string;
	supply: number;
	symbol: string;
	timestamp: string;
	dimensions: {
		display?: {
			mime: string;
			size: number;
			dimensions: { width: number; height: number };
		};
		artifact?: {
			mime: string;
			size: number;
			dimensions: { width: number; height: number };
		};
		thumbnail?: {
			mime: string;
			size: number;
			dimensions: { width: number; height: number };
		};
	};
	thumbnail_uri: string;
	artifact_uri: string;
	display_uri: string;
	tags?: Array<{
		// Restored original definition
		tag: {
			name: string;
		};
	}>;
	creators?: Array<{
		// Added from rawResponse structure
		creator_address: string;
		holder: {
			alias?: string;
			logo?: string;
			description?: string;
			website?: string;
			[key: string]: any;
		};
	}>;
	fa: {
		contract: string;
		creator?: {
			address: string;
			description?: string;
			alias?: string;
		};
		creator_address?: string;
		description: string;
		name?: string; // Added for collection fallback
		path?: string; // Added for collection slug fallback
		website?: string; // Added for collection website fallback
	};
	external_url?: string;
	is_disabled?: boolean;
	is_nsfw?: boolean;
	is_suspicious?: boolean;
	rarity?: any;
	owners?: Array<{ address: string; quantity: number }>;
	mint_date?: string;
	token_standard?: string;
	attributes?: Array<{
		name?: string; // Added to handle alternative attribute structure
		trait_type: string;
		value: string | number;
		display_type?: string;
	}>;
	creator_username?: string;
	creator_profile_url?: string;
	creator_avatar_url?: string;
	creator_is_verified?: boolean;
	creator_bio?: string;
	creator_social_links?: any;
	creator_ens_name?: string;
	creator_display_name?: string;
	creator_profile_data?: any;
	collection_slug?: string;
	collection_name?: string;
	collection_description?: string;
	collection_chain_identifier?: string;
	collection_contract_addresses?: any;
	collection_fees?: any;
	collection_safelist_status?: string;
	collection_website_url?: string;
	collection_discord_url?: string;
	collection_telegram_url?: string;
	collection_medium_url?: string;
	collection_project_url?: string;
	collection_image_url?: string;
	collection_banner_image_url?: string;
	collection_last_synced_at?: string;
	collection_parent_contract?: string;
	collection_is_generative_art?: boolean;
	collection_is_shared_contract?: boolean;
	collection_project_number?: number;
	collection_curator_address?: string;
	collection_creator?: string;
	collection_originating_creator_address?: string;
	collection_total_supply?: number;
	collection_current_supply?: number;
	collection_mint_start_date?: string;
	collection_mint_end_date?: string;
	collection_floor_price?: number;
	collection_volume_traded?: number;
	collection_external_collection_id?: string;
	collection_art_blocks_project_id?: number;
	collection_fxhash_project_id?: number;
}

// Normalized data structure for import
export interface NormalizedNFTData {
	title: string;
	contractAddress: string;
	tokenId: string;
	description?: string;
	mintDate?: Date | string;
	imageUrl?: string;
	thumbnailUrl?: string;
	animationUrl?: string;
	artifactUri?: string;
	displayUri?: string;
	externalUrl?: string;
	isDisabled?: boolean;
	isNsfw?: boolean;
	isSuspicious?: boolean;
	rarity?: any;
	owners?: Array<{ address: string; quantity: number }>;
	supply?: number;
	floorPrice?: number;
	volumeTraded?: number;
	thumbnailUri?: string;
	mime?: string;
	dimensions?: { width: number; height: number };
	blockchain?: Blockchain;
	symbol?: string;
	tokenStandard?: string;
	metadataUrl?: string;
	attributes?: Array<{
		trait_type: string;
		value: string | number;
		display_type?: string;
	}>;
	tags?: string[];
	features?: Record<string, any>;
	collectionId?: number;
	creatorAddresses?: string[];

	creator?: {
		address?: string;
		username?: string;
		profileUrl?: string;
		avatarUrl?: string;
		isVerified?: boolean;
		bio?: string;
		socialLinks?: any;
		ensName?: string;
		displayName?: string;
		profileData?: any;
	};

	collection?: {
		slug?: string;
		title?: string;
		description?: string;
		chainIdentifier?: string;
		contractAddresses?: any;
		fees?: any;
		safelistStatus?: string;
		websiteUrl?: string;
		discordUrl?: string;
		telegramUrl?: string;
		mediumUrl?: string;
		projectUrl?: string;
		imageUrl?: string;
		bannerImageUrl?: string;
		lastSyncedAt?: string;
		parentContract?: string;
		isGenerativeArt?: boolean;
		isSharedContract?: boolean;
		projectNumber?: number;
		curatorAddress?: string;
		collectionCreator?: string;
		originatingCreatorAddress?: string;
		totalSupply?: number;
		currentSupply?: number;
		mintStartDate?: string;
		mintEndDate?: string;
		floorPrice?: number;
		volumeTraded?: number;
		externalCollectionId?: string;
		artBlocksProjectId?: number;
		fxhashProjectId?: number;
	};
	platform?: DataSource | string; // Allow string for flexibility, but DataSource is preferred

	// Legacy fields - removed from schema but kept for backward compatibility
	creatorAddress?: string;
}

// Import result tracking
export interface ImportResult {
	success: boolean;
	artworkId?: number;
	artistId?: number;
	collectionId?: number;
	errors?: string[];
	warnings?: string[];
	createdRecords: {
		artwork?: boolean;
		artist?: boolean;
		collection?: boolean;
		artistArtwork?: boolean;
		artistCollection?: boolean;
	};
}

// Transformation functions interface
export interface IndexingTransformer {
	transformOpenSeaData(nft: OpenSeaNFT): Promise<NormalizedNFTData>;
	transformTezosData(token: TezosToken): NormalizedNFTData;
	validateNormalizedData(data: NormalizedNFTData): { valid: boolean; errors: string[] };
}

// Import workflow interface
export interface ImportWorkflow {
	// Stage 1: Index raw data
	indexRawData(
		data: OpenSeaNFT | TezosToken,
		source: DataSource,
		blockchain: Blockchain
	): Promise<{ indexId: number; nftUid: string }>;

	// Stage 2: Normalize and validate
	normalizeIndexedData(indexId: number): Promise<{ success: boolean; errors?: string[] }>;

	// Stage 3: Resolve external references
	resolveReferences(indexId: number): Promise<{
		artistResolved: boolean;
		collectionResolved: boolean;
		errors?: string[];
	}>;

	// Stage 4: Import to final models
	importToFinalModels(indexId: number): Promise<ImportResult>;

	// Utility: Process import queue
	processImportQueue(status?: ImportStatus, limit?: number): Promise<ImportResult[]>;
}

// Creator resolution types
export interface CreatorResolutionStrategy {
	resolveByENS(address: string): Promise<{ name?: string; avatar?: string }>;
	resolveBySocial(address: string): Promise<{ name?: string; platforms?: Record<string, string> }>;
	resolveByProfile(address: string): Promise<{ name?: string; bio?: string; website?: string }>;
}

// Collection resolution types
export interface CollectionResolutionStrategy {
	resolveBySlug(
		slug: string,
		source: DataSource
	): Promise<{ collectionId?: number; created?: boolean }>;
	resolveByContract(
		contractAddress: string,
		blockchain: Blockchain
	): Promise<{ collectionId?: number }>;
}

// Generic raw data type for dynamic sources
