<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Player {
		id: number;
		name: string;
		color: string;
	}

	type GameState = 'setup' | 'handoff' | 'showing' | 'gameEnd';
	type ImageMode = 'local' | 'word';

	let gameState = $state<GameState>('setup');
	let players = $state<Player[]>([]);
	let currentRound = $state(0);
	let currentPlayerIndex = $state(0);
	let currentImage = $state<string | null>(null);
	let scores = $state<Record<number, number>>({});
	let imageMode = $state<ImageMode>('local');
	let wordInput = $state('');
	let availableImages = $state<string[]>([]);
	let usedImages = $state<string[]>([]);

	const playerColors = [
		'bg-red-400',
		'bg-blue-400',
		'bg-green-400',
		'bg-yellow-400',
		'bg-purple-400',
		'bg-pink-400',
		'bg-orange-400',
		'bg-teal-400'
	];

	onMount(async () => {
		await loadLocalImages();
	});

	async function loadLocalImages() {
		try {
			const response = await fetch('/api/images');
			if (response.ok) {
				availableImages = await response.json();
			} else {
				availableImages = [];
			}
		} catch (error) {
			console.error('Piltide laadimine ebaõnnestus:', error);
			availableImages = [];
		}
	}

	function addPlayer() {
		const playerName = prompt('Sisesta mängija nimi:');
		if (playerName && playerName.trim()) {
			const newPlayer: Player = {
				id: Date.now(),
				name: playerName.trim(),
				color: playerColors[players.length % playerColors.length]
			};
			players.push(newPlayer);
			scores[newPlayer.id] = 0;
		}
	}

	function removePlayer(playerId: number) {
		players = players.filter((p) => p.id !== playerId);
		delete scores[playerId];
	}

	function startGame() {
		if (players.length < 2) {
			alert('Vaja on vähemalt 2 mängijat!');
			return;
		}
		if (imageMode === 'local' && availableImages.length === 0) {
			alert('Palun lisa pilte kausta /static/images või vali sõna otsing!');
			return;
		}
		gameState = 'handoff';
		currentPlayerIndex = 0;
		usedImages = [];
	}

	function showImage() {
		if (imageMode === 'local' && availableImages.length > 0) {
			// Get unused images
			const unused = availableImages.filter((img) => !usedImages.includes(img));

			// If all images used, reset
			if (unused.length === 0) {
				usedImages = [];
				currentImage = availableImages[Math.floor(Math.random() * availableImages.length)];
			} else {
				currentImage = unused[Math.floor(Math.random() * unused.length)];
			}

			if (currentImage) {
				usedImages.push(currentImage);
			}
		} else if (imageMode === 'word' && wordInput.trim()) {
			currentImage = `https://source.unsplash.com/800x600/?${encodeURIComponent(wordInput.trim())}`;
		}

		currentRound++;
		gameState = 'showing';
	}

	function playerGuessed(guesserId: number) {
		scores[guesserId]++;
		scores = { ...scores };
		nextPlayer();
	}

	function nobodyGuessed() {
		nextPlayer();
	}

	function nextPlayer() {
		currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
		gameState = 'handoff';
	}

	function endGame() {
		gameState = 'gameEnd';
	}

	function resetGame() {
		gameState = 'setup';
		currentRound = 0;
		currentPlayerIndex = 0;
		scores = Object.fromEntries(players.map((p) => [p.id, 0]));
		usedImages = [];
	}

	$effect(() => {
		// Cleanup effect - no mutations here
		return () => {};
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 p-4">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mt-4 mb-8 text-center">
			<h1 class="mb-2 text-6xl font-bold text-white drop-shadow-lg">🎭🎨🎭🎨 Pildi alias</h1>
			<p class="text-2xl text-white drop-shadow">Kirjelda pilti ilma ütlemata otse, mis pildil!</p>
		</div>

		{#if gameState === 'setup'}
			<!-- Setup Screen -->
			<div class="rounded-3xl bg-white p-8 shadow-2xl">
				<h2 class="mb-6 text-center text-4xl font-bold text-purple-600">Lisa mängijad</h2>

				<div class="mb-8">
					{#each players as player (player.id)}
						<div
							class="flex items-center justify-between {player.color} mb-3 rounded-xl p-4 text-white shadow-lg"
						>
							<span class="text-2xl font-bold">{player.name}</span>
							<button
								onclick={() => removePlayer(player.id)}
								class="rounded-lg bg-red-600 px-4 py-2 font-bold hover:bg-red-700"
							>
								Eemalda
							</button>
						</div>
					{/each}
				</div>

				<button
					onclick={addPlayer}
					class="mb-4 w-full transform rounded-xl bg-green-500 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600"
				>
					➕ Lisa mängija
				</button>

				{#if players.length >= 2}
					<div class="mt-6 border-t-4 border-purple-200 pt-6">
						<h3 class="mb-4 text-2xl font-bold text-purple-600">Vali piltide allikas:</h3>

						<div class="mb-4 flex gap-4">
							<button
								onclick={() => (imageMode = 'local')}
								class="flex-1 rounded-xl py-3 text-lg font-bold {imageMode === 'local'
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 text-gray-700'}"
							>
								📁 Kohalikud pildid
							</button>
							<button
								onclick={() => (imageMode = 'word')}
								class="flex-1 rounded-xl py-3 text-lg font-bold {imageMode === 'word'
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 text-gray-700'}"
							>
								🔍 Otsi sõna järgi
							</button>
						</div>

						{#if imageMode === 'word'}
							<input
								type="text"
								bind:value={wordInput}
								placeholder="Sisesta sõna (nt 'elevant', 'auto', 'lill')"
								class="mb-4 w-full rounded-xl border-4 border-purple-300 p-4 text-xl"
							/>
						{/if}

						{#if imageMode === 'local' && availableImages.length === 0}
							<div class="mb-4 rounded-xl border-4 border-yellow-400 bg-yellow-100 p-4">
								<p class="font-bold text-yellow-800">⚠️ Pilte ei leitud!</p>
								<p class="text-yellow-700">
									Lisa .png pilte kausta /static/images või kasuta sõna otsingut.
								</p>
							</div>
						{/if}

						<button
							onclick={startGame}
							class="w-full transform rounded-xl bg-purple-600 py-5 text-3xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-purple-700"
						>
							🚀 Alusta mängu!
						</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if gameState === 'handoff'}
			<!-- Hand Off Screen -->
			<div class="rounded-3xl bg-white p-8 text-center shadow-2xl">
				<h2 class="mb-8 text-5xl font-bold text-purple-600">Järka seletaja</h2>
				<div
					class="{players[currentPlayerIndex]
						.color} mb-8 scale-105 transform rounded-2xl p-8 text-white shadow-2xl"
				>
					<p class="text-7xl font-bold">{players[currentPlayerIndex].name}</p>
				</div>

				{#if currentRound > 0}
					<!-- Show scores during game -->
					<div class="mb-8">
						<h3 class="mb-4 text-2xl font-bold text-gray-700">Seis:</h3>
						<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
							{#each [...players].sort((a, b) => scores[b.id] - scores[a.id]) as player (player.id)}
								<div class="{player.color} rounded-xl p-4 text-white shadow-lg">
									<p class="text-lg font-bold">{player.name}</p>
									<p class="text-3xl font-bold">{scores[player.id]} 🏆</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<button
					onclick={showImage}
					class="mb-4 w-full transform rounded-xl bg-green-500 py-6 text-3xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600"
				>
					Olen {players[currentPlayerIndex].name}. Näita pilti!
				</button>

				{#if currentRound > 0}
					<button
						onclick={endGame}
						class="w-full transform rounded-xl bg-red-500 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-red-600"
					>
						Lõpeta mäng
					</button>
				{/if}
			</div>
		{/if}

		{#if gameState === 'showing'}
			<!-- Showing Image Screen -->
			<div class="rounded-3xl bg-white p-8 shadow-2xl">
				<div class="mb-6 text-center">
					<h2 class="text-3xl font-bold text-purple-600">Voor {currentRound}</h2>
					<p class="mt-2 text-2xl text-gray-700">
						<span
							class="font-bold {players[currentPlayerIndex]
								.color} rounded-full px-4 py-2 text-white"
						>
							{players[currentPlayerIndex].name}
						</span>
						seletab!
					</p>
				</div>

				<!-- Image -->
				<div class="mb-8 rounded-2xl bg-gray-100 p-4">
					{#if currentImage}
						<img
							src={currentImage}
							alt="Pilt"
							class="max-h-96 w-full rounded-xl object-contain shadow-lg"
						/>
					{/if}
				</div>

				<div class="mb-8 rounded-xl border-4 border-yellow-400 bg-yellow-100 p-4">
					<p class="text-center text-lg font-bold text-yellow-800">
						💡 Kirjelda, aga ära ütle sõna, mis mildil!
					</p>
				</div>

				<!-- Guessing Buttons -->
				<h3 class="mb-4 text-center text-2xl font-bold text-purple-600">Kes arvas ära?</h3>
				<div class="mb-6 grid grid-cols-2 gap-4">
					{#each players.filter((p) => p.id !== players[currentPlayerIndex].id) as player (player.id)}
						<button
							onclick={() => playerGuessed(player.id)}
							class="{player.color} transform rounded-xl px-6 py-4 text-xl font-bold text-white shadow-lg transition hover:scale-105"
						>
							{player.name}
						</button>
					{/each}
				</div>

				<button
					onclick={nobodyGuessed}
					class="w-full transform rounded-xl bg-gray-500 px-6 py-4 text-xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-gray-600"
				>
					Keegi ei arvanud ära
				</button>
			</div>
		{/if}

		{#if gameState === 'gameEnd'}
			<!-- Game End Screen -->
			<div class="rounded-3xl bg-white p-8 text-center shadow-2xl">
				<h2 class="mb-8 text-5xl font-bold text-purple-600">🎉 Mäng läbi! 🎉</h2>

				{#if players.length > 0}
					{@const sortedPlayers = [...players].sort((a, b) => scores[b.id] - scores[a.id])}
					{@const winner = sortedPlayers[0]}

					<div
						class="{winner.color} mb-8 scale-105 transform rounded-2xl p-8 text-white shadow-2xl"
					>
						<p class="mb-2 text-3xl font-bold">Võitja:</p>
						<p class="text-7xl font-bold">{winner.name}</p>
						<p class="mt-4 text-5xl">{scores[winner.id]} 🏆</p>
					</div>

					<h3 class="mb-4 text-2xl font-bold text-gray-700">Lõppseis:</h3>
					<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
						{#each sortedPlayers as player (player.id)}
							<div class="{player.color} rounded-xl p-4 text-white shadow-lg">
								<p class="text-lg font-bold">{player.name}</p>
								<p class="text-4xl font-bold">{scores[player.id]} 🏆</p>
							</div>
						{/each}
					</div>
				{/if}

				<button
					onclick={resetGame}
					class="w-full transform rounded-xl bg-purple-600 px-8 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-purple-700"
				>
					🔄 Uus mäng
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}
</style>
