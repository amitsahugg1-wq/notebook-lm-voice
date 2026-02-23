
export type SpeakerRole = 'Amit' | 'Gyanvani' | 'Aryan' | 'Ananya' | 'Dadi' | 'Golu';

export interface SpeakerPair {
  id: string;
  name: string;
  description: string;
  speaker1: { name: string; role: string; icon: string; voice: string };
  speaker2: { name: string; role: string; icon: string; voice: string };
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface PodcastState {
  facts: string;
  script: DialogueLine[];
  isLoading: boolean;
  statusMessage: string;
  audioBlobUrl: string | null;
  isAudioGenerating: boolean;
}

export enum AppStep {
  INPUT = 'INPUT',
  SCRIPT = 'SCRIPT',
  AUDIO = 'AUDIO'
}
