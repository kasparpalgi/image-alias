<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Player {
		id: number;
		name: string;
		color: string;
	}

	type GameState = 'setup' | 'playing' | 'voting' | 'roundEnd';
	type ImageMode = 'local' | 'word';

	let gameState = $state<GameState>('setup');
	let players = $state<Player[]>([]);
	let currentRound = $state(0);
	let currentPlayerIndex = $state(0);
	let currentImage = $state<string | null>(null);
	let hint = $state('');
	let votes = $state<Record<number, number | null>>({});
	let scores = $state<Record<number, number>>({});
	let imageMode = $state<ImageMode>('local');
	let wordInput = $state('');
	let availableImages = $state<string[]>([]);

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
			// Try to fetch from API endpoint
			const response = await fetch('/api/images');
			if (response.ok) {
				availableImages = await response.json();
			} else {
				// Fallback: manually list your images here
				availableImages = [
					// Add your actual image paths here, e.g.:
					// '/images/cat.png',
					// '/images/dog.png',
				];
			}
		} catch (error) {
			console.error('Failed to load images:', error);
			// Fallback: manually list your images here
			availableImages = [
				// Add your actual image paths here
			];
		}
	}

	function addPlayer() {
		const playerName = prompt('Enter player name:');
		if (playerName && playerName.trim()) {
			const newPlayer: Player = {
				id: Date.now(),
				name: playerName.trim(),
				color: playerColors[players.length % playerColors.length]
			};
			players.push(newPlayer);
			scores[newPlayer.id] = 0;
			votes[newPlayer.id] = null;
		}
	}

	function removePlayer(playerId: number) {
		players = players.filter((p) => p.id !== playerId);
		delete scores[playerId];
		delete votes[playerId];
	}

	function startGame() {
		if (players.length < 2) {
			alert('Need at least 2 players!');
			return;
		}
		gameState = 'playing';
		startNewRound();
	}

	async function startNewRound() {
		currentRound++;
		hint = '';
		votes = Object.fromEntries(players.map((p) => [p.id, null]));

		if (imageMode === 'local' && availableImages.length > 0) {
			currentImage = availableImages[Math.floor(Math.random() * availableImages.length)];
		} else if (imageMode === 'word' && wordInput.trim()) {
			// Fetch from Unsplash
			currentImage = `https://source.unsplash.com/800x600/?${encodeURIComponent(wordInput.trim())}`;
			wordInput = '';
		} else {
			alert('Please select an image source!');
			return;
		}

		gameState = 'playing';
	}

	function submitHint() {
		if (hint.trim()) {
			gameState = 'voting';
		}
	}

	function castVote(voterId: number, votedForId: number) {
		votes[voterId] = votedForId;
		votes = { ...votes }; // Trigger reactivity
	}

	function checkVotingComplete(): boolean {
		const allVoted = players.every((p) => votes[p.id] !== null);
		if (!allVoted) return false;

		const votedFor = players.map((p) => votes[p.id]);
		const allSame = votedFor.every((v) => v === votedFor[0]);

		return allSame;
	}

	function finishVoting() {
		if (!checkVotingComplete()) {
			alert('Everyone must vote for the same person! Discuss and try again.');
			return;
		}

		const winnerId = votes[players[0].id];
		if (winnerId !== null) {
			scores[winnerId]++;
			scores = { ...scores }; // Trigger reactivity
		}

		gameState = 'roundEnd';
	}

	function nextRound() {
		currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
		startNewRound();
	}

	function resetGame() {
		gameState = 'setup';
		currentRound = 0;
		currentPlayerIndex = 0;
		scores = Object.fromEntries(players.map((p) => [p.id, 0]));
	}

	$effect(() => {
		if (gameState === 'voting') {
			// Auto-check if all votes are in and unanimous
			if (checkVotingComplete()) {
				setTimeout(() => {
					const winnerId = votes[players[0].id];
					const winner = players.find((p) => p.id === winnerId);
					if (winner) {
						alert(`🎉 Everyone agrees ${winner.name} guessed it! 🎉`);
					}
				}, 300);
			}
		}
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 p-4">
	<div class="mx-auto max-w-6xl">
		<!-- Header -->
		<div class="mt-4 mb-8 text-center">
			<h1 class="mb-2 text-6xl font-bold text-white drop-shadow-lg">🎭 Picture Alias Game 🎨</h1>
			<p class="text-2xl text-white drop-shadow">Explain without saying what it is!</p>
		</div>

		{#if gameState === 'setup'}
			<!-- Setup Screen -->
			<div class="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
				<h2 class="mb-6 text-center text-4xl font-bold text-purple-600">Add Players</h2>

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
								Remove
							</button>
						</div>
					{/each}
				</div>

				<button
					onclick={addPlayer}
					class="mb-4 w-full transform rounded-xl bg-green-500 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600"
				>
					➕ Add Player
				</button>

				{#if players.length >= 2}
					<div class="mt-6 border-t-4 border-purple-200 pt-6">
						<h3 class="mb-4 text-2xl font-bold text-purple-600">Choose Image Source:</h3>

						<div class="mb-4 flex gap-4">
							<button
								onclick={() => (imageMode = 'local')}
								class="flex-1 rounded-xl py-3 text-lg font-bold {imageMode === 'local'
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 text-gray-700'}"
							>
								📁 Local Images
							</button>
							<button
								onclick={() => (imageMode = 'word')}
								class="flex-1 rounded-xl py-3 text-lg font-bold {imageMode === 'word'
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 text-gray-700'}"
							>
								🔍 Search by Word
							</button>
						</div>

						{#if imageMode === 'word'}
							<input
								type="text"
								bind:value={wordInput}
								placeholder="Enter a word (e.g., 'elephant', 'car', 'flower')"
								class="mb-4 w-full rounded-xl border-4 border-purple-300 p-4 text-xl"
							/>
						{/if}

						<button
							onclick={startGame}
							class="w-full transform rounded-xl bg-purple-600 py-5 text-3xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-purple-700"
						>
							🚀 Start Game!
						</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if gameState === 'playing'}
			<!-- Playing Screen -->
			<div class="rounded-3xl bg-white p-8 shadow-2xl">
				<div class="mb-6 text-center">
					<h2 class="text-3xl font-bold text-purple-600">Round {currentRound}</h2>
					<p class="mt-2 text-2xl text-gray-700">
						<span
							class="font-bold {players[currentPlayerIndex]
								.color} rounded-full px-4 py-2 text-white"
						>
							{players[currentPlayerIndex].name}
						</span>
						is explaining!
					</p>
				</div>

				<div class="grid gap-8 md:grid-cols-2">
					<!-- Image Section -->
					<div class="rounded-2xl bg-gray-100 p-4">
						<p class="mb-4 text-center text-lg font-bold text-purple-600">
							🤫 Only {players[currentPlayerIndex].name} can see this!
						</p>
						{#if currentImage}
							<img
								src={currentImage}
								alt="Secret"
								class="h-96 w-full rounded-xl object-cover shadow-lg"
							/>
						{/if}
					</div>

					<!-- Hint Section -->
					<div>
						<h3 class="mb-4 text-2xl font-bold text-purple-600">Give Hints:</h3>
						<textarea
							bind:value={hint}
							placeholder="Type hints for others to guess... but don't say what it is!"
							class="mb-4 h-40 w-full resize-none rounded-xl border-4 border-purple-300 p-4 text-xl"
						></textarea>

						<button
							onclick={submitHint}
							disabled={!hint.trim()}
							class="w-full transform rounded-xl bg-green-500 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600 disabled:transform-none disabled:bg-gray-300"
						>
							✅ Submit & Start Voting
						</button>

						<div class="mt-6 rounded-xl border-4 border-yellow-400 bg-yellow-100 p-4">
							<p class="text-lg font-bold text-yellow-800">💡 Remember:</p>
							<ul class="list-inside list-disc text-yellow-800">
								<li>Describe what you see</li>
								<li>Don't say the word!</li>
								<li>Use actions, colors, shapes</li>
							</ul>
						</div>
					</div>
				</div>

				<!-- Scoreboard -->
				<div class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
					{#each players as player (player.id)}
						<div class="{player.color} rounded-xl p-4 text-center text-white shadow-lg">
							<p class="text-lg font-bold">{player.name}</p>
							<p class="text-3xl font-bold">{scores[player.id]} 🏆</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if gameState === 'voting'}
			<!-- Voting Screen -->
			<div class="rounded-3xl bg-white p-8 shadow-2xl">
				<h2 class="mb-6 text-center text-4xl font-bold text-purple-600">Who Guessed It? 🤔</h2>

				<div class="mb-8 rounded-2xl border-4 border-blue-400 bg-blue-100 p-6">
					<p class="mb-2 text-2xl font-bold text-blue-800">The Hint Was:</p>
					<p class="text-xl text-blue-900 italic">"{hint}"</p>
				</div>

				<p class="mb-6 text-center text-2xl font-bold text-gray-700">
					Everyone must vote for the same person!
				</p>

				<div class="mb-8 grid gap-6 md:grid-cols-2">
					{#each players as voter (voter.id)}
						<div class="{voter.color} rounded-2xl p-6 shadow-lg">
							<p class="mb-4 text-2xl font-bold text-white">{voter.name}'s Vote:</p>
							<div class="space-y-2">
								{#each players as candidate (candidate.id)}
									<button
										onclick={() => castVote(voter.id, candidate.id)}
										class="w-full transform rounded-xl px-4 py-3 text-lg font-bold transition hover:scale-105 {votes[
											voter.id
										] === candidate.id
											? 'scale-105 bg-white text-gray-800 shadow-xl'
											: 'bg-white/30 text-white hover:bg-white/50'}"
									>
										{votes[voter.id] === candidate.id ? '✓ ' : ''}{candidate.name}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<div class="text-center">
					{#if checkVotingComplete()}
						<p class="mb-4 text-2xl font-bold text-green-600">✅ Everyone agrees!</p>
					{:else}
						<p class="mb-4 text-xl text-gray-600">
							{players.filter((p) => votes[p.id] === null).length} players still need to vote
						</p>
					{/if}

					<button
						onclick={finishVoting}
						class="transform rounded-xl bg-purple-600 px-8 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-purple-700"
					>
						🎯 Finish Voting
					</button>
				</div>
			</div>
		{/if}

		{#if gameState === 'roundEnd'}
			<!-- Round End Screen -->
			<div class="rounded-3xl bg-white p-8 text-center shadow-2xl">
				<h2 class="mb-6 text-5xl font-bold text-purple-600">
					🎉 Round {currentRound} Complete! 🎉
				</h2>

				{#if players.length > 0}
					{@const winnerId = votes[players[0].id]}
					{@const winner = players.find((p) => p.id === winnerId)}

					{#if winner}
						<div
							class="{winner.color} mb-8 scale-105 transform rounded-2xl p-8 text-white shadow-2xl"
						>
							<p class="mb-2 text-3xl font-bold">Winner:</p>
							<p class="text-6xl font-bold">{winner.name}</p>
							<p class="mt-4 text-4xl">🏆 +1 Point!</p>
						</div>
					{/if}
				{/if}

				<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
					{#each players.sort((a, b) => scores[b.id] - scores[a.id]) as player (player.id)}
						<div class="{player.color} rounded-xl p-4 text-white shadow-lg">
							<p class="text-lg font-bold">{player.name}</p>
							<p class="text-4xl font-bold">{scores[player.id]} 🏆</p>
						</div>
					{/each}
				</div>

				<div class="flex justify-center gap-4">
					<button
						onclick={nextRound}
						class="transform rounded-xl bg-green-500 px-8 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600"
					>
						▶️ Next Round
					</button>
					<button
						onclick={resetGame}
						class="transform rounded-xl bg-red-500 px-8 py-4 text-2xl font-bold text-white shadow-lg transition hover:scale-105 hover:bg-red-600"
					>
						🔄 New Game
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif;
	}
</style>
