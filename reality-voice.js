export class RealityVoice {
  constructor({ onTranscript = () => {}, onState = () => {}, language = "en-IN" } = {}) {
    this.onTranscript = onTranscript;
    this.onState = onState;
    this.language = language;
    this.recognition = null;
    this.listening = false;
    this.supportsRecognition = Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
    this.supportsSynthesis = Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance);
    this.createRecognition();
  }

  createRecognition() {
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = this.language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { this.listening = true; this.onState("listening"); };
    recognition.onend = () => { this.listening = false; this.onState("idle"); };
    recognition.onerror = (event) => { this.listening = false; this.onState("error", event.error || "Speech recognition failed."); };
    recognition.onresult = (event) => {
      let interim = ""; let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";
        if (event.results[index].isFinal) finalText += transcript;
        else interim += transcript;
      }
      this.onState("transcribing", interim);
      if (finalText.trim()) this.onTranscript(finalText.trim());
    };
    this.recognition = recognition;
  }

  start() {
    if (!this.recognition) { this.onState("unsupported", "Speech recognition is unavailable in this browser. You can still type your response."); return false; }
    if (this.listening) return true;
    try { this.recognition.lang = this.language; this.recognition.start(); return true; }
    catch (error) { this.onState("error", error.message); return false; }
  }

  stop() {
    try { this.recognition?.stop(); } catch { /* no active session */ }
    this.listening = false;
  }

  speak(text, options = {}) {
    if (!this.supportsSynthesis || !String(text || "").trim()) return false;
    this.stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 1800));
    utterance.lang = options.language || this.language;
    utterance.rate = Number(options.rate) || 1;
    utterance.pitch = Number(options.pitch) || (options.characterIndex % 2 ? 0.94 : 1.04);
    utterance.onstart = () => this.onState("speaking");
    utterance.onend = () => this.onState("idle");
    utterance.onerror = () => this.onState("idle");
    speechSynthesis.speak(utterance);
    return true;
  }

  stopSpeaking() {
    if (this.supportsSynthesis) speechSynthesis.cancel();
  }

  setLanguage(language) {
    this.language = language || "en-IN";
    if (this.recognition) this.recognition.lang = this.language;
  }

  destroy() {
    this.stop(); this.stopSpeaking();
    if (this.recognition) { this.recognition.onresult = null; this.recognition.onend = null; }
  }
}
