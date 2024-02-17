<script>
	export let progress = 0; // Progress in percentage
</script>

<div class="progress-container">
	<div class="progress-bar" style="width: {progress}%;"></div>
</div>

<style>
	.progress-container {
		width: 100%;
		background-color: #e0e0e0;
		border-radius: 4px;
		margin-bottom: 15px;
	}
	.progress-bar {
		height: 20px;
		background-color: #76a9fa;
		border-radius: 4px;
		transition: width 0.4s ease;
	}
</style>
