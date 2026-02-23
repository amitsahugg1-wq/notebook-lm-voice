import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppStep, DialogueLine, SpeakerPair } from './types';
import { generatePodcastScript, generatePodcastAudio } from './services/geminiService';
import { decode, decodeAudioData, audioBufferToWavBlob } from './utils/audioUtils';
import { LoadingOverlay } from './components/LoadingOverlay';
import { StepIndicator } from './components/StepIndicator';
import { savePodcastToDrive, getSavedAudios, SavedAudio } from './services/storageService';

const SPEAKER_PAIRS: SpeakerPair[] = [
  {
    id: 'notebook-deep-dive',
    name: 'ज्ञानवानी मैम और अमित',
    description: 'Relatable Tricks + Super Revision',
    speaker1: { name: 'Gyanvani', role: 'सीनियर मेंटर (Female)', icon: 'fa-user-tie', voice: 'Kore' }, 
    speaker2: { name: 'Amit', role: 'स्वाभाविक छात्र (Male)', icon: 'fa-user-graduate', voice: 'Charon' }
  },
  {
    id: 'amit-sir-notebook',
    name: 'अमित सर और ज्ञानवाणी',
    description: 'Expert Mentorship + Deep Insights',
    speaker1: { name: 'Amit', role: 'सीनियर मेंटर (Male)', icon: 'fa-user-tie', voice: 'Charon' }, 
    speaker2: { name: 'Gyanvani', role: 'स्वाभाविक छात्रा (Female)', icon: 'fa-user-graduate', voice: 'Kore' }
  },
  {
    id: 'discussion-master',
    name: 'आर्यन और अनन्या',
    description: 'Interactive Masterclass',
    speaker1: { name: 'Aryan', role: 'एक्सपर्ट (Male)', icon: 'fa-bolt', voice: 'Puck' },
    speaker2: { name: 'Ananya', role: 'एस्पिरेंट (Female)', icon: 'fa-user-astronaut', voice: 'Kore' }
  }
];

const AVAILABLE_VOICES = [
  { id: 'Kore', label: 'Kore (Deep Mentor/Female)', gender: 'female' },
  { id: 'Charon', label: 'Charon (Curious Student/Male)', gender: 'male' },
  { id: 'Zephyr', label: 'Zephyr (Conversational/Male)', gender: 'male' },
  { id: 'Puck', label: 'Puck (Charismatic Host)', gender: 'male' },
  { id: 'Fenrir', label: 'Fenrir (Deep/Serious)', gender: 'male' },
];

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [inputMode, setInputMode] = useState<'facts' | 'script'>('facts');
  const [selectedPair, setSelectedPair] = useState<SpeakerPair>(SPEAKER_PAIRS[0]);
  
  const [speaker1Voice, setSpeaker1Voice] = useState(SPEAKER_PAIRS[0].speaker1.voice);
  const [speaker2Voice, setSpeaker2Voice] = useState(SPEAKER_PAIRS[0].speaker2.voice);

  const [facts, setFacts] = useState('');
  const [script, setScript] = useState<DialogueLine[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Storage states
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  
  // New settings states
  const [temperature, setTemperature] = useState(0.7);
  const [tempo, setTempo] = useState(1.0);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setSpeaker1Voice(selectedPair.speaker1.voice);
    setSpeaker2Voice(selectedPair.speaker2.voice);
  }, [selectedPair]);

  // Load saved audios on mount
  useEffect(() => {
    refreshLibrary();
  }, []);

  const refreshLibrary = async () => {
    const audios = await getSavedAudios();
    setSavedAudios(audios);
  };

  const scriptCharCount = useMemo(() => {
    return script.reduce((acc, line) => acc + line.text.length, 0);
  }, [script]);

  const currentPairWithCustomVoices = useMemo((): SpeakerPair => ({
    ...selectedPair,
    speaker1: { ...selectedPair.speaker1, voice: speaker1Voice },
    speaker2: { ...selectedPair.speaker2, voice: speaker2Voice }
  }), [selectedPair, speaker1Voice, speaker2Voice]);

  const parsePastedScript = (text: string): DialogueLine[] => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}

    const lines = text.split('\n').filter(l => l.trim().includes(':'));
    return lines.map(line => {
      const firstColonIndex = line.indexOf(':');
      const speaker = line.substring(0, firstColonIndex).trim();
      const dialogue = line.substring(firstColonIndex + 1).trim();
      return { speaker, text: dialogue };
    });
  };

  const handleGenerateScript = async () => {
    if (!facts.trim()) return;
    setIsProcessing(true);
    setStatusMsg(`${currentPairWithCustomVoices.speaker1.name} ${currentPairWithCustomVoices.speaker1.role.includes('Female') ? 'मैम' : 'सर'} हर पॉइंट को गहराई से समझा रहे हैं...`);
    try {
      const generatedScript = await generatePodcastScript(facts, currentPairWithCustomVoices, temperature);
      setScript(generatedScript);
      
      // AUTOMATICALLY SAVE SCRIPT TO DRIVE
      const topicName = facts.substring(0, 30).trim() || "Generated Script";
      const id = await savePodcastToDrive(`${topicName}...`, generatedScript, undefined, currentSessionId);
      setCurrentSessionId(id);
      await refreshLibrary();

      setStep(AppStep.SCRIPT);
    } catch (error) {
      console.error(error);
      alert('Script generation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadDirectScript = () => {
    if (!facts.trim()) return;
    const parsed = parsePastedScript(facts);
    if (parsed.length === 0) {
      alert("स्क्रिप्ट का फॉर्मेट सही नहीं है। कृपया 'Speaker: Dialogue' का उपयोग करें।");
      return;
    }
    setScript(parsed);
    setStep(AppStep.SCRIPT);
  };

  const handleGenerateAudio = async () => {
    setIsProcessing(true);
    setStatusMsg('ठहराव और विस्तृत व्याख्या के साथ ऑडियो तैयार हो रहा है...');
    try {
      const base64Audio = await generatePodcastAudio(script, currentPairWithCustomVoices, tempo);
      const audioBytes = decode(base64Audio);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedBuffer = await decodeAudioData(audioBytes, audioCtx, 24000, 1);
      const wavBlob = audioBufferToWavBlob(decodedBuffer);
      
      const generatedUrl = URL.createObjectURL(wavBlob);
      setAudioUrl(generatedUrl);

      // UPDATE ENTRY WITH AUDIO BLOB
      const topicName = facts.substring(0, 30).trim() || "Generated Lecture";
      await savePodcastToDrive(`${topicName}...`, script, wavBlob, currentSessionId);
      await refreshLibrary();

      setStep(AppStep.AUDIO);
    } catch (error) {
      console.error(error);
      alert('Audio generation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyScript = () => {
    const fullScript = script.map(line => `${line.speaker}: ${line.text}`).join('\n\n');
    navigator.clipboard.writeText(fullScript).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleUpdateScriptLine = (index: number, newText: string) => {
    const updatedScript = [...script];
    updatedScript[index] = { ...updatedScript[index], text: newText };
    setScript(updatedScript);
  };

  const reset = () => {
    setFacts('');
    setScript([]);
    setAudioUrl(null);
    setStep(AppStep.INPUT);
    setInputMode('facts');
    setCurrentSessionId(undefined);
  };

  const playSavedAudio = (item: SavedAudio) => {
    if (item.script) setScript(item.script);
    setCurrentSessionId(item.id);

    if (item.blob) {
      const url = URL.createObjectURL(item.blob);
      setAudioUrl(url);
      setStep(AppStep.AUDIO);
    } else {
      setStep(AppStep.SCRIPT);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col p-4 md:p-8 font-sans">
      {isProcessing && <LoadingOverlay message={statusMsg} />}

      <header className="max-w-5xl mx-auto w-full flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 rotate-3 border-2 border-indigo-400/30">
            <i className="fa-solid fa-graduation-cap text-white text-3xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
              ExamPod AI
            </h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Deep Explanatory Mode</p>
          </div>
        </div>
        <button onClick={reset} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700/50 shadow-lg">
          <i className="fa-solid fa-rotate-left text-indigo-400"></i>
          नया टॉपिक
        </button>
      </header>

      <main className="max-w-5xl mx-auto w-full flex-1">
        <StepIndicator currentStep={step} />

        {/* Step 1: Input & Mode Selection */}
        {step === AppStep.INPUT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Left: Input Area */}
            <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-6 md:p-10 backdrop-blur-xl relative shadow-2xl ring-1 ring-white/5 flex flex-col">
              
              <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-8 self-start shadow-inner">
                <button 
                  onClick={() => setInputMode('facts')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${inputMode === 'facts' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <i className="fa-solid fa-brain mr-2"></i>
                  विषय पेस्ट करें
                </button>
                <button 
                  onClick={() => setInputMode('script')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${inputMode === 'script' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <i className="fa-solid fa-file-audio mr-2"></i>
                  डायरेक्ट स्क्रिप्ट
                </button>
              </div>

              <div className="flex justify-between items-end mb-4 px-1">
                <div>
                  <h2 className="text-2xl font-black mb-1">
                    {inputMode === 'facts' ? 'सिलेबस की जानकारी' : 'पॉडकास्ट स्क्रिप्ट'}
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    {inputMode === 'facts' ? 'हर पॉइंट का विस्तृत विश्लेषण (NotebookLM स्टाइल)' : 'फॉर्मेट: "ज्ञानवानी: नमस्ते..."'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black bg-indigo-500/10 px-4 py-1.5 rounded-full text-indigo-400 border border-indigo-500/20">
                    {facts.length} CHARS
                  </span>
                </div>
              </div>
              
              <textarea
                className="w-full flex-1 min-h-[420px] bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all resize-none placeholder:text-slate-700 font-medium leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
                placeholder={inputMode === 'facts' 
                  ? "पूरी जानकारी यहाँ डालें... ज्ञानवानी मैम हर एक पॉइंट को बहुत गहराई से समझाएंगी।" 
                  : `ज्ञानवानी: अमित, आज हम क्या पढ़ेंगे?\nअमित: मैम, आज हम भारत के संविधान के बारे में जानेंगे...`}
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
              />
            </div>

            {/* Right: Speaker Selection & Actions */}
            <div className="lg:col-span-5 flex flex-col gap-8">
              <div>
                <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                  <i className="fa-solid fa-user-gear text-indigo-400"></i>
                  होस्ट और आवाज़ें (HD)
                </h2>
                <div className="space-y-4 mb-8">
                  {SPEAKER_PAIRS.map((pair) => (
                    <button
                      key={pair.id}
                      onClick={() => setSelectedPair(pair)}
                      className={`w-full text-left p-6 rounded-3xl border-2 transition-all group relative overflow-hidden ${
                        selectedPair.id === pair.id 
                          ? 'bg-indigo-600/10 border-indigo-500 shadow-2xl shadow-indigo-600/10' 
                          : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-5 relative z-10">
                        <div className="flex -space-x-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-slate-900 shadow-lg ${selectedPair.id === pair.id ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                            <i className={`fa-solid ${pair.speaker1.icon} text-lg`}></i>
                          </div>
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-slate-900 shadow-lg ${selectedPair.id === pair.id ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                            <i className={`fa-solid ${pair.speaker2.icon} text-lg`}></i>
                          </div>
                        </div>
                        <div>
                          <p className="font-black text-slate-100 text-lg">{pair.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">NotebookLM Deep Dive</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Generation Settings Section */}
                <div className="bg-slate-900/60 p-6 rounded-[2.5rem] border border-slate-800 shadow-inner mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-gear text-purple-500"></i>
                    AI Generation Controls
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                          Creativity (Temperature): {temperature.toFixed(1)}
                        </label>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                          Audio Tempo (Speed): {tempo.toFixed(1)}x
                        </label>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" max="2.0" step="0.1"
                        value={tempo}
                        onChange={(e) => setTempo(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Voice Select Customization */}
                <div className="bg-slate-900/60 p-6 rounded-[2.5rem] border border-slate-800 shadow-inner">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-indigo-500"></i>
                    Vocal Synthesis (2.5 Pro Grade)
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter ml-1">
                        1. Mentor: {selectedPair.speaker1.name} (Slow & Clear)
                      </label>
                      <div className="relative">
                        <select 
                          value={speaker1Voice}
                          onChange={(e) => setSpeaker1Voice(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-200 appearance-none focus:border-indigo-500 outline-none transition-all shadow-xl"
                        >
                          {AVAILABLE_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none text-xs"></i>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter ml-1">
                        2. Student: {selectedPair.speaker2.name} (Thoughtful)
                      </label>
                      <div className="relative">
                        <select 
                          value={speaker2Voice}
                          onChange={(e) => setSpeaker2Voice(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-200 appearance-none focus:border-emerald-500 outline-none transition-all shadow-xl"
                        >
                          {AVAILABLE_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none text-xs"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saved Drive Section - Minimal UI */}
              {savedAudios.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-[2.5rem]">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-hard-drive"></i>
                    Library (Recent Saves)
                  </h3>
                  <div className="space-y-2">
                    {savedAudios.map(audio => (
                      <button 
                        key={audio.id}
                        onClick={() => playSavedAudio(audio)}
                        className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                           <i className={`fa-solid ${audio.blob ? 'fa-play-circle text-indigo-500' : 'fa-file-lines text-emerald-500'}`}></i>
                           <span className="text-xs font-bold text-slate-300 truncate">{audio.name}</span>
                        </div>
                        <span className="text-[9px] text-slate-600 font-bold shrink-0">{new Date(audio.timestamp).toLocaleDateString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/10 space-y-4">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i>
                  Clarity & Pacing Engine:
                </h3>
                <ul className="text-xs text-slate-400 space-y-3 font-medium">
                  <li className="flex items-center gap-3"><i className="fa-solid fa-clock-rotate-left text-indigo-500"></i> Deliberate Pausing (ठहराव)</li>
                  <li className="flex items-center gap-3"><i className="fa-solid fa-magnifying-glass-plus text-indigo-500"></i> Elaborative Depth on Every Point</li>
                  <li className="flex items-center gap-3"><i className="fa-solid fa-microphone-lines text-indigo-500"></i> High Resolution TTS (24kHz)</li>
                </ul>
              </div>

              <button
                disabled={!facts.trim() || isProcessing}
                onClick={inputMode === 'facts' ? handleGenerateScript : handleLoadDirectScript}
                className={`w-full py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all duration-500 ${
                  facts.trim() && !isProcessing
                    ? inputMode === 'facts' 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] shadow-2xl shadow-indigo-600/30'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-[1.02] shadow-2xl shadow-emerald-600/30'
                    : 'bg-slate-900 text-slate-700 border border-slate-800 cursor-not-allowed'
                } active:scale-95`}
              >
                {inputMode === 'facts' ? 'विस्तृत मास्टरक्लास तैयार करें' : 'स्क्रिप्ट चेक करें'}
                <i className={`fa-solid ${inputMode === 'facts' ? 'fa-wand-magic-sparkles' : 'fa-chevron-right'}`}></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Script Review */}
        {step === AppStep.SCRIPT && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 shadow-3xl ring-1 ring-white/5">
            <div className="p-8 bg-slate-900/80 border-b border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="flex -space-x-5">
                   <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl border-2 border-indigo-400">
                     <i className={`fa-solid ${selectedPair.speaker1.icon} text-white text-xl`}></i>
                   </div>
                   <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-xl border-2 border-emerald-400">
                     <i className={`fa-solid ${selectedPair.speaker2.icon} text-white text-xl`}></i>
                   </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black">{selectedPair.name}</h2>
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">
                    AI Performance Review (Elaborative Mode)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCopyScript}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all border ${
                    copySuccess 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                  {copySuccess ? 'Copied!' : 'Copy Script'}
                </button>
              </div>
            </div>
            
            <div className="max-h-[65vh] overflow-y-auto p-8 space-y-10 scrollbar-thin scrollbar-thumb-slate-800 bg-slate-950/20">
              {script.map((line, idx) => {
                const isMentor = line.speaker.toLowerCase().includes(selectedPair.speaker1.name.toLowerCase()) || 
                                 line.speaker.includes(selectedPair.speaker1.role);
                const isFirst = isMentor;

                return (
                  <div key={idx} className={`flex gap-6 ${isFirst ? 'flex-row' : 'flex-row-reverse animate-in slide-in-from-side duration-500'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center border-2 shadow-xl ${
                      isFirst ? 'bg-indigo-600 border-indigo-400' : 'bg-emerald-600 border-emerald-400'
                    }`}>
                      <i className={`fa-solid ${isFirst ? selectedPair.speaker1.icon : selectedPair.speaker2.icon} text-white text-sm`}></i>
                    </div>
                    <div className={`max-w-[80%] group ${isFirst ? '' : 'text-right'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 px-1 flex items-center gap-2 ${
                        isFirst ? 'text-indigo-400' : 'text-emerald-400 flex-row-reverse'
                      }`}>
                        {line.speaker}
                      </p>
                      <div className={`p-6 rounded-[1.5rem] relative transition-all duration-300 hover:shadow-2xl ${
                        isFirst 
                          ? 'bg-slate-900 rounded-tl-none border-l-4 border-indigo-500 text-left' 
                          : 'bg-indigo-900/10 rounded-tr-none border-r-4 border-emerald-500 text-right'
                      }`}>
                        <textarea
                          value={line.text}
                          onChange={(e) => handleUpdateScriptLine(idx, e.target.value)}
                          rows={Math.max(1, Math.ceil(line.text.length / 50))}
                          className={`w-full bg-transparent text-slate-200 leading-relaxed font-semibold text-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/30 rounded-lg p-1 resize-none scrollbar-hide ${isFirst ? 'text-left' : 'text-right'}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-10 bg-slate-900/80 border-t border-slate-800/50 flex flex-col md:flex-row gap-6 items-center justify-center">
              <button
                onClick={handleGenerateAudio}
                className="w-full md:w-auto px-16 py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-[length:200%_auto] hover:bg-right transition-all duration-700 rounded-3xl font-black text-xl flex items-center justify-center gap-5 shadow-2xl active:scale-95"
              >
                <i className="fa-solid fa-broadcast-tower text-3xl"></i>
                HD ऑडियो ({tempo.toFixed(1)}x Speed)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Audio Playback */}
        {step === AppStep.AUDIO && audioUrl && (
          <div className="flex flex-col items-center justify-center text-center py-16 animate-in zoom-in duration-1000">
            <h2 className="text-5xl font-black mb-6 tracking-tighter">HD लेक्चर तैयार है!</h2>
            <p className="text-slate-500 max-w-xl mb-6 font-semibold text-lg leading-relaxed">
              {selectedPair.name} का यह NotebookLM स्टाइल रिवीज़न लेक्चर अब सुनने के लिए उपलब्ध है।
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <p className="text-emerald-500 text-xs font-black uppercase tracking-widest">
                <i className="fa-solid fa-cloud-arrow-up mr-2"></i>
                Saved to Local Drive
              </p>
            </div>

            <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/60 rounded-[3rem] p-12 shadow-3xl backdrop-blur-3xl ring-1 ring-white/10">
              <audio ref={audioRef} src={audioUrl} className="w-full h-16 mb-10 custom-audio" controls />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                 <a 
                  href={audioUrl} 
                  download={`exam_revision_deep_dive_${Date.now()}.wav`}
                  className="px-8 py-5 bg-white text-slate-900 hover:bg-slate-200 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 text-base"
                >
                  <i className="fa-solid fa-download text-xl"></i>
                  MP3 डाउनलोड
                </a>
                <button
                  onClick={handleCopyScript}
                  className={`px-8 py-5 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 text-base border-2 ${
                    copySuccess 
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                      : 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400 hover:bg-indigo-600/20'
                  }`}
                >
                  <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'} text-xl`}></i>
                  {copySuccess ? 'Copied!' : 'Copy All Script'}
                </button>
              </div>

              <button 
                onClick={reset}
                className="w-full px-10 py-6 bg-slate-800 hover:bg-slate-700 rounded-3xl font-black flex items-center justify-center gap-4 transition-all active:scale-95 border border-slate-700 text-lg"
              >
                <i className="fa-solid fa-plus-circle text-2xl"></i>
                नया टॉपिक शुरू करें
              </button>
            </div>

            {/* In-Step Library Access */}
            {savedAudios.length > 1 && (
               <div className="mt-20 w-full max-w-xl">
                  <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-8">Recent Library items</h3>
                  <div className="flex flex-wrap justify-center gap-4">
                    {savedAudios.slice(0, 3).map(audio => (
                      <button 
                        key={audio.id}
                        onClick={() => playSavedAudio(audio)}
                        className="px-5 py-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs font-bold text-slate-400 hover:text-indigo-400 transition-all flex items-center gap-2"
                      >
                         <i className={`fa-solid ${audio.blob ? 'fa-play-circle' : 'fa-file-lines'} opacity-50`}></i>
                        {audio.name}
                      </button>
                    ))}
                  </div>
               </div>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto w-full mt-16 py-10 border-t border-slate-900 text-center">
         <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.4em]">Deep Explanatory & Paced Mode Active</p>
      </footer>

      <style>{`
        .custom-audio::-webkit-media-controls-panel {
          background-color: #0f172a;
        }
        .custom-audio::-webkit-media-controls-current-time-display,
        .custom-audio::-webkit-media-controls-time-remaining-display {
          color: #f8fafc;
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-side { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;