<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { wordList } from '$lib/words';
	import { playerColors } from '$lib/assets/colors';
	import imageUrls from '$lib/assets/images.json';
	import type { Word } from '$lib/words';
	import type { GameState, ImageMode, Player } from '$lib/types';

	function setCookie(name: string, value: string, days: number) {
		let expires = '';
		if (days) {
			const date = new Date();
			date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
			expires = '; expires=' + date.toUTCString();
		}

		if (typeof document !== 'undefined') {
			document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
		}
	}

	function getCookie(name: string): string | null {
		if (typeof document === 'undefined') {
			return null;
		}
		const nameEQ = name + '=';
		const ca = document.cookie.split(';');
		for (let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) === ' ') c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
		}
		return null;
	}

	function eraseCookie(name: string) {
		if (typeof document !== 'undefined') {
			document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
		}
	}

	let gameState = $state<GameState>('setup');
	let players = $state<Player[]>([]);
	let currentRound = $state(0);
	let currentPlayerIndex = $state(0);
	let currentImage = $state<string | null>(null);
	let scores = $state<Record<number, number>>({});
	let imageMode = $state<ImageMode>('local');
	let availableImages = $state<string[]>([]);
	let usedImages = $state<string[]>([]);
	let selectedWord = $state<Word | null>(null);
	let usedWords = $state<Word[]>([]);
	let currentImageName = $state<string | null>(null);
	let smallKidsExplainEverySecond = $state(false);
	let nextRegularPlayerIndex = $state(0);
	let nextSmallKidIndex = $state(0);

	onMount(async () => {
		loadS3Images();
		loadUsedImagesFromCookie();
	});

	function loadUsedImagesFromCookie() {
		const storedImages = getCookie('usedImages');
		if (storedImages) {
			try {
				const parsedImages = JSON.parse(storedImages);
				if (Array.isArray(parsedImages)) {
					usedImages = parsedImages;
					console.log(`Loaded ${usedImages.length} used images from cookie.`);
				}
			} catch (e) {
				console.error('Failed to parse usedImages cookie:', e);
				usedImages = []; // Reset if cookie is corrupt
			}
		}
	}

	function loadS3Images() {
		availableImages = Object.values(imageUrls);
		console.log(`Loaded ${availableImages.length} images from S3`);
	}

	function getImageNameFromUrl(url: string): string {
		const match = url.match(/-([A-Z]+)\.png$/i);
		return match ? match[1] : '';
	}

	function addPlayer() {
		const playerName = prompt('Sisesta mängija nimi:');
		if (playerName && playerName.trim()) {
			const isSmallKid = confirm('Kas see on väike laps? (saab 4 punkti arvamise eest). OK = jah, on. Cancel = ei ole väike laps.');
			const newPlayer: Player = {
				id: Date.now(),
				name: playerName.trim(),
				color: playerColors[players.length % playerColors.length],
				isSmallKid
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

		nextRegularPlayerIndex = 0;
		nextSmallKidIndex = 0;

		if (
			smallKidsExplainEverySecond &&
			players.some((p) => p.isSmallKid) &&
			players.some((p) => !p.isSmallKid)
		) {
			const firstSmallKidIndex = players.findIndex((p) => p.isSmallKid);
			currentPlayerIndex = firstSmallKidIndex !== -1 ? firstSmallKidIndex : 0;
		} else {
			currentPlayerIndex = 0;
		}

		gameState = 'handoff';
		usedWords = [];
	}

	async function showImage() {
		if (imageMode === 'local' && availableImages.length > 0) {
			const unused = availableImages.filter((img) => !usedImages.includes(img));

			if (unused.length === 0) {
				alert('Kõik pildid on näidatud! Alustame otsast peale.');
				usedImages = [];
				eraseCookie('usedImages');
				currentImage = availableImages[Math.floor(Math.random() * availableImages.length)];
			} else {
				currentImage = unused[Math.floor(Math.random() * unused.length)];
			}

			if (currentImage) {
				usedImages.push(currentImage);
				setCookie('usedImages', JSON.stringify(usedImages), 365);
				currentImageName = getImageNameFromUrl(currentImage);
			}
			selectedWord = null;
		} else if (imageMode === 'local' && availableImages.length === 0) {
			alert('Kohalikud pildid puuduvad! Palun vali "Otsi sõna järgi" režiim.');
			return;
		} else if (imageMode === 'word') {
			const unusedWords = wordList.filter((word) => !usedWords.some((used) => used.et === word.et));

			let randomWord: Word;
			if (unusedWords.length === 0) {
				usedWords = [];
				randomWord = wordList[Math.floor(Math.random() * wordList.length)];
			} else {
				randomWord = unusedWords[Math.floor(Math.random() * unusedWords.length)];
			}

			usedWords.push(randomWord);
			selectedWord = randomWord;
			currentImageName = null;

			const searchTerm = randomWord.en;

			try {
				const response = await fetch(`/api/search-image?q=${encodeURIComponent(searchTerm)}`);
				const data = await response.json();

				if (data.imageUrl) {
					currentImage = data.imageUrl;
				} else {
					throw new Error('No image returned');
				}
			} catch (error) {
				console.error('Image search failed:', error);
				// Fallback: show placeholder with the word
				currentImage = `https://placehold.co/800x600/purple/white?text=${encodeURIComponent(
					searchTerm
				)}`;
			}
		}

		currentRound++;
		gameState = 'showing';
	}

	function playerGuessed(guesserId: number) {
		const guesser = players.find((p) => p.id === guesserId);
		const pointsToAdd = guesser?.isSmallKid ? 4 : 1;
		scores[guesserId] += pointsToAdd;
		scores = { ...scores };
		nextPlayer();
	}

	function nobodyGuessed() {
		nextPlayer();
	}

	function nextPlayer() {
		const smallKids = players.filter((p) => p.isSmallKid);
		const regularPlayers = players.filter((p) => !p.isSmallKid);

		if (smallKidsExplainEverySecond && smallKids.length > 0 && regularPlayers.length > 0) {
			const currentPlayer = players[currentPlayerIndex];
			let nextPlayer: Player;

			if (currentPlayer.isSmallKid) {
				nextPlayer = regularPlayers[nextRegularPlayerIndex];
				nextRegularPlayerIndex = (nextRegularPlayerIndex + 1) % regularPlayers.length;
			} else {
				nextPlayer = smallKids[nextSmallKidIndex];
				nextSmallKidIndex = (nextSmallKidIndex + 1) % smallKids.length;
			}

			currentPlayerIndex = players.findIndex((p) => p.id === nextPlayer.id);
		} else {
			currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
		}

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
		eraseCookie('usedImages');
		usedWords = [];
		nextRegularPlayerIndex = 0;
		nextSmallKidIndex = 0;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 p-4">
	<div class="mx-auto max-w-4xl">
		<div class="mt-4 mb-8 text-center">
			<h1 class="mb-2 text-6xl font-bold text-white drop-shadow-lg">🎭 Pildi Alias 🎨</h1>
			<p class="text-2xl text-white drop-shadow">Kirjelda ilma sõna ütlemata!</p>
		</div>

		{#if gameState === 'setup'}
			<div class="rounded-3xl bg-white p-8 shadow-2xl">
				<h2 class="mb-6 text-center text-4xl font-bold text-purple-600">Lisa mängijad</h2>

				<div class="mb-8">
					{#each players as player (player.id)}
						<div
							class="flex items-center justify-between {player.color} mb-3 rounded-xl p-4 text-white shadow-lg"
						>
							<div>
								<span class="text-2xl font-bold">{player.name}</span>
								{#if player.isSmallKid}
									<span
										class="ml-2 rounded-full bg-yellow-400 px-2 py-1 text-sm font-bold text-yellow-900"
										>👶 Väike laps (4p)</span
									>
								{/if}
							</div>
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
						{#if players.some((p) => p.isSmallKid) && players.some((p) => !p.isSmallKid)}
							<div class="mb-6 rounded-xl bg-blue-100 p-4">
								<label class="flex cursor-pointer items-center gap-3">
									<input
										type="checkbox"
										bind:checked={smallKidsExplainEverySecond}
										class="h-5 w-5 cursor-pointer"
									/>
									<span class="text-lg font-bold text-blue-800">
										👶 Väikesed lapsed seletavad igal teisel korral
									</span>
								</label>
								<p class="mt-2 text-sm text-blue-700">
									Kui väike laps tahab rohkem seletada, mis pildil, siis tšekka see ja iga teine
									kord seletab väike laps
								</p>
							</div>
						{/if}

						<h3 class="mb-4 text-2xl font-bold text-purple-600">Vali piltide allikas:</h3>

						<div class="mb-4 flex gap-4">
							<button
								onclick={() => (imageMode = 'local')}
								class="flex-1 rounded-xl py-3 text-lg font-bold {imageMode === 'local'
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 text-gray-700'}"
							>
								📁 Enda pildid
							</button>
							<button
								onclick={() => (imageMode = 'word')}
								class="flex-1 rounded-xl py-3 text-lg font-bold {imageMode === 'word'
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 text-gray-700'}"
							>
								🔍 Netist sõna järgi
							</button>
						</div>

						{#if imageMode === 'word'}
							<div class="mb-4 rounded-xl border-4 border-green-400 bg-green-100 p-4">
								<p class="text-center font-bold text-green-800">
									✨ Sõnad valitakse automaatselt listist
								</p>
								<p class="text-center text-sm text-green-700">
									Iga voor saab uue juhusliku sõna ({wordList.length} sõna saadaval)
								</p>
							</div>
						{/if}

						{#if imageMode === 'local' && availableImages.length > 0}
							<div class="mb-4 rounded-xl border-4 border-green-400 bg-green-100 p-4">
								<p class="text-center font-bold text-green-800">
									✅ Laetud {availableImages.length} pilti.
									<span class="block text-sm text-green-700"
										>Juba nähtud: {usedImages.length} / {availableImages.length}</span
									>
								</p>
							</div>
						{/if}

						{#if imageMode === 'local' && availableImages.length === 0}
							<div class="mb-4 rounded-xl border-4 border-yellow-400 bg-yellow-100 p-4">
								<p class="font-bold text-yellow-800">⚠️ Enda pildid puuduvad</p>
								<p class="text-sm text-yellow-700">
									Kontrolli, et images.json fail oleks õigesti seadistatud.
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
			<div class="rounded-3xl bg-white p-8 text-center shadow-2xl">
				<h2 class="mb-8 text-5xl font-bold text-purple-600">Kelle kord:</h2>
				<div
					class="{players[currentPlayerIndex]
						.color} mb-8 scale-105 transform rounded-2xl p-8 text-white shadow-2xl"
				>
					<p class="text-7xl font-bold">{players[currentPlayerIndex].name}</p>
				</div>

				{#if currentRound > 0}
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
						kord!
					</p>
				</div>

				<div class="mb-8 rounded-2xl bg-gray-100 p-4">
					{#if currentImage}
						<img
							src={currentImage}
							alt="Pilt"
							class="mb-4 max-h-96 w-full rounded-xl object-contain shadow-lg"
						/>
					{/if}
					{#if selectedWord}
						<div class="rounded-xl bg-purple-600 px-6 py-4 text-center text-white">
							<p class="text-4xl font-bold uppercase">{selectedWord.et}</p>
						</div>
					{:else if currentImageName}
						<div class="rounded-xl bg-purple-600 px-6 py-4 text-center text-white">
							<p class="text-4xl font-bold uppercase">{currentImageName}</p>
						</div>
					{/if}
				</div>

				<div class="mb-8 rounded-xl border-4 border-yellow-400 bg-yellow-100 p-4">
					<p class="text-center text-lg font-bold text-yellow-800">
						💡 Kirjelda, aga ära ütle sõna!
					</p>
				</div>

				<h3 class="mb-4 text-center text-2xl font-bold text-purple-600">Kes arvas ära?</h3>
				<div class="mb-6 grid grid-cols-2 gap-4">
					{#each players.filter((p) => p.id !== players[currentPlayerIndex].id) as player (player.id)}
						<button
							onclick={() => playerGuessed(player.id)}
							class="{player.color} transform rounded-xl px-6 py-4 text-xl font-bold text-white shadow-lg transition hover:scale-105"
						>
							{player.name}
							{#if player.isSmallKid}
								<span class="block text-sm">(+4p)</span>
							{/if}
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
