<script lang="ts">
	import ArtistAvatar from '$lib/components/ArtistAvatar.svelte';
	import ArtistNameWithAvatar from '$lib/components/ArtistNameWithAvatar.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';
	import ArtistTableCell from '$lib/components/ArtistTableCell.svelte';

	// Sample artist data
	const sampleArtists = [
		{
			id: 1,
			name: 'Alice Johnson',
			avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
			websiteUrl: 'https://alicejohnson.art'
		},
		{
			id: 2,
			name: 'Bob Smith',
			avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
			websiteUrl: 'https://bobsmith.com'
		},
		{
			id: 3,
			name: 'Carol Williams',
			avatarUrl: null,
			websiteUrl: null
		},
		{
			id: 4,
			name: 'David Brown',
			avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
			websiteUrl: 'https://davidbrown.studio'
		},
		{
			id: 5,
			name: 'Eva Martinez',
			avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
			websiteUrl: null
		}
	];
</script>

<svelte:head>
	<title>Artist Components Demo | Wallace Museum Admin</title>
</svelte:head>

<div class="max-w-6xl mx-auto p-6 space-y-12">
	<h1 class="mb-8">Artist Components Demo</h1>

	<!-- ArtistAvatar Component -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold">ArtistAvatar Component</h2>
		<p class="text-gray-600 dark:text-gray-400">Different sizes of artist avatars with fallback support.</p>
		
		<div class="flex items-center gap-4 flex-wrap">
			<div class="text-center">
				<ArtistAvatar artist={sampleArtists[0]} size="xs" />
				<p class="text-xs mt-1">xs (16px)</p>
			</div>
			<div class="text-center">
				<ArtistAvatar artist={sampleArtists[0]} size="sm" />
				<p class="text-xs mt-1">sm (20px)</p>
			</div>
			<div class="text-center">
				<ArtistAvatar artist={sampleArtists[0]} size="md" />
				<p class="text-xs mt-1">md (32px)</p>
			</div>
			<div class="text-center">
				<ArtistAvatar artist={sampleArtists[0]} size="lg" />
				<p class="text-xs mt-1">lg (48px)</p>
			</div>
			<div class="text-center">
				<ArtistAvatar artist={sampleArtists[0]} size="xl" />
				<p class="text-xs mt-1">xl (64px)</p>
			</div>
		</div>

		<div class="flex items-center gap-4">
			<div class="text-center">
				<ArtistAvatar artist={sampleArtists[2]} size="lg" />
				<p class="text-xs mt-1">No avatar (fallback)</p>
			</div>
		</div>

		<!-- NEW: Test section for placeholder avatars -->
		<div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
			<h3 class="text-lg font-semibold mb-4">🔧 New Placeholder Avatar System</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Testing the new local SVG-based placeholder avatars (no external service dependency)
			</p>
			<div class="flex items-center gap-4 flex-wrap">
				{#each ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eva Martinez', 'Frank Wilson', 'Grace Lee', 'Henry Davis'] as testName}
					<div class="text-center">
						<ArtistAvatar artist={{ name: testName, avatarUrl: null }} size="lg" />
						<p class="text-xs mt-1">{testName}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ArtistNameWithAvatar Component -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold">ArtistNameWithAvatar Component</h2>
		<p class="text-gray-600 dark:text-gray-400">Artist name with avatar, supporting links, prefixes, and popover functionality.</p>
		
		<div class="space-y-3">
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Basic display:</p>
				<ArtistNameWithAvatar artist={sampleArtists[0]} />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">With website link:</p>
				<ArtistNameWithAvatar artist={sampleArtists[0]} linkToWebsite={true} />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">With prefix:</p>
				<ArtistNameWithAvatar artist={sampleArtists[0]} prefix="by" />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Without avatar:</p>
				<ArtistNameWithAvatar artist={sampleArtists[0]} showAvatar={false} />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Large size:</p>
				<ArtistNameWithAvatar artist={sampleArtists[0]} size="lg" />
			</div>

			<div class="p-3 border rounded-sm bg-blue-50 dark:bg-blue-900/20">
				<p class="text-sm text-gray-500 mb-2">🆕 With popover (click artist name):</p>
				<ArtistNameWithAvatar 
					artist={{
						...sampleArtists[0],
						bio: "Alice is a contemporary digital artist exploring the intersection of technology and human emotion through generative art and interactive installations.",
						twitterHandle: "alicejohnson_art",
						instagramHandle: "alice.creates"
					}} 
					showPopover={true} 
					prefix="by"
				/>
			</div>
		</div>
	</section>

	<!-- ArtistList Component -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold">ArtistList Component</h2>
		<p class="text-gray-600 dark:text-gray-400">Multiple artists in different layouts.</p>
		
		<div class="space-y-4">
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Horizontal layout:</p>
				<ArtistList artists={sampleArtists.slice(0, 3)} layout="horizontal" />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Badges layout:</p>
				<ArtistList artists={sampleArtists.slice(0, 3)} layout="badges" />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Vertical layout:</p>
				<ArtistList artists={sampleArtists.slice(0, 3)} layout="vertical" />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">With website links:</p>
				<ArtistList artists={sampleArtists.slice(0, 3)} layout="badges" linkToWebsite={true} />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Max display (2 of 5):</p>
				<ArtistList artists={sampleArtists} layout="badges" maxDisplay={2} />
			</div>
			
			<div class="p-3 border rounded-sm">
				<p class="text-sm text-gray-500 mb-2">Without avatars:</p>
				<ArtistList artists={sampleArtists.slice(0, 3)} layout="horizontal" showAvatars={false} />
			</div>
		</div>
	</section>

	<!-- ArtistTableCell Component -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold">ArtistTableCell Component</h2>
		<p class="text-gray-600 dark:text-gray-400">Specialized component for table cells.</p>
		
		<div class="border rounded-sm overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-50 dark:bg-gray-800">
					<tr>
						<th class="px-4 py-2 text-left">Artwork</th>
						<th class="px-4 py-2 text-left">Artists</th>
						<th class="px-4 py-2 text-left">Collection</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-t">
						<td class="px-4 py-2">Sample Artwork 1</td>
						<td class="px-4 py-2">
							<ArtistTableCell artists={sampleArtists.slice(0, 2)} />
						</td>
						<td class="px-4 py-2">Digital Collection</td>
					</tr>
					<tr class="border-t">
						<td class="px-4 py-2">Sample Artwork 2</td>
						<td class="px-4 py-2">
							<ArtistTableCell artists={sampleArtists.slice(2, 5)} maxDisplay={2} />
						</td>
						<td class="px-4 py-2">Contemporary Art</td>
					</tr>
					<tr class="border-t">
						<td class="px-4 py-2">Sample Artwork 3</td>
						<td class="px-4 py-2">
							<ArtistTableCell artists={null} />
						</td>
						<td class="px-4 py-2">Unknown Collection</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Usage Examples -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold">Usage Examples</h2>
		<p class="text-gray-600 dark:text-gray-400">Code examples for implementing these components.</p>
		
		<div class="space-y-4">
			<div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-sm">
				<h3 class="font-semibold mb-2">Basic Artist Avatar:</h3>
				<code class="text-sm">
					&lt;ArtistAvatar artist=&#123;&#123;name: "Artist Name", avatarUrl: "url"&#125;&#125; size="md" /&gt;
				</code>
			</div>
			
			<div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-sm">
				<h3 class="font-semibold mb-2">Artist Name with Avatar and Link:</h3>
				<code class="text-sm">
					&lt;ArtistNameWithAvatar artist=&#123;&#123;...&#125;&#125; linkToWebsite=&#123;true&#125; prefix="by" /&gt;
				</code>
			</div>
			
			<div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-sm">
				<h3 class="font-semibold mb-2">Artist List in Badges Layout:</h3>
				<code class="text-sm">
					&lt;ArtistList artists=&#123;artistsArray&#125; layout="badges" maxDisplay=&#123;3&#125; /&gt;
				</code>
			</div>
			
			<div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-sm">
				<h3 class="font-semibold mb-2">Table Cell with Artists:</h3>
				<code class="text-sm">
					&lt;ArtistTableCell artists=&#123;artistsArray&#125; linkToArtist=&#123;true&#125; /&gt;
				</code>
			</div>
		</div>
	</section>
</div> 