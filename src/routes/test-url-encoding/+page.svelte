<script>
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

	// Test case: URL with encoded query parameters in the filename
	const testUrl = 'https://ipfs.io/ipfs/QmU6Yfc8PvXWAkuyVmkirJQEWtanxYyazH7eFQqGAH1Tpb/%3Ffxhash=oonjf7vkMagMiveBjZ5LPxU5AwRCa4gTcwwFPNq2oQ2M97mz6u8&fxiteration=42&fxminter=tz1iLY9Yc23u1aJq9eBM6QYsu5XzV4nGptEq';

	// Test case: IPFS URI with encoded characters
	const testIpfsUri = 'ipfs://QmU6Yfc8PvXWAkuyVmkirJQEWtanxYyazH7eFQqGAH1Tpb/%3Ffxhash=oonjf7vkMagMiveBjZ5LPxU5AwRCa4gTcwwFPNq2oQ2M97mz6u8&fxiteration=42&fxminter=tz1iLY9Yc23u1aJq9eBM6QYsu5XzV4nGptEq';

	// Test case: Raw CID with path containing encoded characters
	const testRawCid = 'QmU6Yfc8PvXWAkuyVmkirJQEWtanxYyazH7eFQqGAH1Tpb/%3Ffxhash=oonjf7vkMagMiveBjZ5LPxU5AwRCa4gTcwwFPNq2oQ2M97mz6u8&fxiteration=42&fxminter=tz1iLY9Yc23u1aJq9eBM6QYsu5XzV4nGptEq';

	$: convertedUrl = ipfsToHttpUrl(testUrl);
	$: convertedIpfsUri = ipfsToHttpUrl(testIpfsUri);
	$: convertedRawCid = ipfsToHttpUrl(testRawCid);
</script>

<svelte:head>
	<title>URL Encoding Test | Wallace Museum</title>
</svelte:head>

<div class="container mx-auto p-8">
	<h1 class="text-2xl font-bold mb-6">URL Encoding Test</h1>
	
	<div class="space-y-6">
		<div class="bg-gray-100 p-4 rounded">
			<h2 class="font-semibold mb-2">Test Case 1: IPFS Gateway URL</h2>
			<p class="text-sm text-gray-600 mb-2">Original:</p>
			<code class="block bg-white p-2 rounded text-xs break-all">{testUrl}</code>
			<p class="text-sm text-gray-600 mb-2 mt-2">Converted:</p>
			<code class="block bg-white p-2 rounded text-xs break-all">{convertedUrl}</code>
		</div>

		<div class="bg-gray-100 p-4 rounded">
			<h2 class="font-semibold mb-2">Test Case 2: IPFS URI</h2>
			<p class="text-sm text-gray-600 mb-2">Original:</p>
			<code class="block bg-white p-2 rounded text-xs break-all">{testIpfsUri}</code>
			<p class="text-sm text-gray-600 mb-2 mt-2">Converted:</p>
			<code class="block bg-white p-2 rounded text-xs break-all">{convertedIpfsUri}</code>
		</div>

		<div class="bg-gray-100 p-4 rounded">
			<h2 class="font-semibold mb-2">Test Case 3: Raw CID with Path</h2>
			<p class="text-sm text-gray-600 mb-2">Original:</p>
			<code class="block bg-white p-2 rounded text-xs break-all">{testRawCid}</code>
			<p class="text-sm text-gray-600 mb-2 mt-2">Converted:</p>
			<code class="block bg-white p-2 rounded text-xs break-all">{convertedRawCid}</code>
		</div>

		<div class="bg-green-100 p-4 rounded">
			<h2 class="font-semibold mb-2">Expected Behavior</h2>
			<p class="text-sm">The converted URLs should:</p>
			<ul class="text-sm list-disc list-inside mt-2">
				<li>Use the Wallace Museum IPFS microservice endpoint</li>
				<li>Preserve the %3F encoding in the path (not convert to ?)</li>
				<li>Have the pinataGatewayToken as a proper query parameter at the end</li>
				<li>Not have malformed query parameters</li>
			</ul>
		</div>

		<div class="bg-blue-100 p-4 rounded">
			<h2 class="font-semibold mb-2">Test the URL</h2>
			<p class="text-sm mb-2">Click to test if the converted URL works:</p>
			<a href={convertedUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">
				Test Converted URL
			</a>
		</div>
	</div>
</div> 