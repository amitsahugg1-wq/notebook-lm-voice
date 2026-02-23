import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DialogueLine, SpeakerPair } from "../types";

// Always use process.env.API_KEY directly as per the official GenAI SDK guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generatePodcastScript(facts: string, pair: SpeakerPair, temperature: number = 0.7): Promise<DialogueLine[]> {
  const prompt = `
    You are an expert educational podcaster and scriptwriter.
    Create a VERY LONG, EXTREMELY ELABORATIVE, and SUPER ENGAGING podcast script in Hindi (Devanagari script).

    SPEAKERS:
    1. ${pair.speaker1.name} (Teacher/Mentor): Expert, brilliant, patient, and uses "Desi" analogies to explain things deeply.
    2. ${pair.speaker2.name} (Student/Aspirant): Curious, asks follow-up questions, and summarizes what he/she learned.

    CONTEXT/FACTS: "${facts}"

    CRITICAL INSTRUCTION - ELABORATIVE DEPTH & ZERO OMISSION:
    - You MUST cover EVERY SINGLE FACT from the input. "कोई भी पॉइंट छूटना नहीं चाहिए" (Not a single point should be missed).
    - DEEP EXPLANATION: For every point, ${pair.speaker1.name} must not just state it, but explain the 'WHY' and 'HOW'. Use a simple example or a story for every technical term. 
    - ELONGATE: Even if a point is small, expand it into a conversation. ${pair.speaker2.name} should ask, "सर/मैम, इसका मतलब क्या हुआ?" and ${pair.speaker1.name} should break it down further.
    - CADENCE & PAUSING: Use ellipses (...) and commas to force the voice engine to take natural pauses (ठहराव). Ensure the script feels like a deep, unhurried classroom discussion.

    CORE RULES FOR EXPRESSIONS, TRICKS, EXAM QUESTIONS & QUIZ:
    - PREVIOUS YEAR QUESTIONS (PYQs): बातचीत के बीच-बीच में (interspersed), उस टॉपिक से संबंधित विभिन्न प्रतियोगी परीक्षाओं (जैसे UPSC, SSC, State PSC, Banking, Railway आदि) में पूछे गए प्रश्न-उत्तर (PYQs) भी शामिल करें। ${pair.speaker1.name} को यह बताना चाहिए कि कौन सा सवाल किस परीक्षा में आया था (e.g., ${pair.speaker1.name} says: "${pair.speaker2.name}, तुम्हें पता है ये सवाल 2019 के SSC में भी आया था? सवाल था... और उसका जवाब है...").
    - EXPRESSIONS: स्क्रिप्ट में जहां जरूरी हो वहां, bracket के अंदर English में expressions भी लिखे हों (जैसे: (laughing), (thinking), (surprised), (calm), (aha!) आदि) ताकि पढ़ते वक्त भाव समझ आएं।
    - SELECTIVE TRICKS: Identify ONLY those facts that are genuinely hard to remember (भूलने लायक) or are extremely important (इम्पॉर्टेंट). 
    - TRICK QUALITY: Create extremely RELATABLE and SIMPLE "Desi Tricks". Think of everyday Indian life examples (like Samosa, Bollywood characters, Cricket, or common household items) to make the facts stick. The trick should feel natural, funny, and deeply "Desi" (ट्रिक्स एकदम देसी और मजेदार होनी चाहिए, जैसे हम दोस्तों के बीच बातें करते हैं, ताकि तुरंत याद हो जाएं).
    - RESTRUCTURED RAPID FIRE QUIZ: End the session with a "Super Rapid Fire Quiz".
    - QUIZ FORMAT: The format must be strictly Question -> Answer -> Question -> Answer. 
      - ${pair.speaker1.name} asks a question.
      - ${pair.speaker2.name} gives the answer (using the easy tricks taught).
      - ${pair.speaker1.name} confirms/appreciates and immediately asks the next question.
    - QUIZ QUANTITY: Do NOT limit to 4-5 questions. Create as many questions as necessary (जरूरत के हिसाब से) to ensure all major points covered in the lesson are reviewed.
    - REPETITION: Repeat the core fact using: "एक बार फिर से सुनो..."

    Output MUST be a JSON array of objects with 'speaker' and 'text'. The script must be VERY LONG to accommodate the deeper explanations and the extended interactive quiz.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', 
    contents: prompt,
    config: {
      temperature: temperature,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ['speaker', 'text']
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
}

export async function generatePodcastAudio(script: DialogueLine[], pair: SpeakerPair, tempo: number = 1.0): Promise<string> {
  const ttsPrompt = script.map(line => `${line.speaker}: ${line.text}`).join('\n\n');

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro-preview-tts",
    contents: [{ parts: [{ text: `ULTRA-HIGH FIDELITY NOTEBOOKLM PERFORMANCE:
    
    IMPORTANT: Speak at a ${tempo > 1 ? 'faster' : tempo < 1 ? 'slower' : 'normal'} tempo (Target speed: ${tempo}x).
    1. DELIBERATE PAUSING (ठहराव): Force significant pauses (1s) after the mentor explains a complex concept.
    2. EXPLANATORY TONE: ${pair.speaker1.name} (Voice: ${pair.speaker1.voice}) should sound like they are truly teaching, with a slow, clear, and reassuring tempo.
    3. CURIOUS CADENCE: ${pair.speaker2.name} (Voice: ${pair.speaker2.voice}) should sound thoughtful, pausing to "process" information before responding with an "Aha!".
    4. STUDIO QUALITY: Ensure crystal clear articulation of Hindi/Sanskrit terms.
    5. EXPRESSION GUIDANCE (CRITICAL): USE the bracketed expressions (like (laughing), (thinking), (surprised), (excited)) to guide your performance, tone, and emotion. DO NOT speak the bracketed words themselves; they are cues for how you should sound, not text to be read.

    Perform the following deep-dive revision session:
    \n\n${ttsPrompt}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: pair.speaker1.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: pair.speaker1.voice } 
              }
            },
            {
              speaker: pair.speaker2.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: pair.speaker2.voice }
              }
            }
          ]
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");

  return base64Audio;
}