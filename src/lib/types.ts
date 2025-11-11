export interface Player {
	id: number;
	name: string;
	color: string;
}

export type GameState = 'setup' | 'handoff' | 'showing' | 'gameEnd';
export type ImageMode = 'local' | 'word';
