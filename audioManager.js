(() => {
  "use strict";

  const SOURCES = Object.freeze({
    sfx_wrong_order: "assets/audio/wrong_order.mp3",
    sfx_correct_boy: "assets/audio/thank_you_boy.mp3",
    sfx_correct_woman: "assets/audio/thank_you_woman.mp3",
    sfx_click: "assets/audio/click_food.mp3",
    bgm_musical: "assets/audio/bgm_musical.mp3"
  });
  const effects = Object.fromEntries(
    Object.entries(SOURCES)
      .filter(([name]) => name !== "bgm_musical")
      .map(([name, source]) => {
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.volume = 1.0;
        return [name, audio];
      })
  );
  let bgmVolume = 100;
  let sfxVolume = 100;
  let activeUtterance = null;
  let music = createMusic();
  let speechUnavailableNotified = false;
  let daySummaryActive = false;
  let generatedAudioContext = null;

  function createMusic() {
    const audio = new Audio(SOURCES.bgm_musical);
    audio.preload = "auto";
    audio.volume = 1.0;
    audio.loop = true;
    return audio;
  }

  function startPlayback(audio, source, fallback, restart = false) {
    const onFailure = error => {
      console.error(`Unable to play audio asset ${source}.`, error);
      fallback();
    };
    try {
      if (restart) audio.currentTime = 0;
      const playback = audio.play();
      if (playback) void playback.catch(onFailure);
    } catch (error) {
      onFailure(error);
    }
  }

  function applyMusicVolume() {
    music.volume = bgmVolume / 100 * (activeUtterance ? 0.2 : 1);
  }

  function finishSpeech(utterance) {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    applyMusicVolume();
  }

  function speakCustomer(text, gender) {
    const synthesis = window.speechSynthesis;
    if (daySummaryActive) return false;
    if (!synthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      if (!speechUnavailableNotified) {
        console.warn("Customer voice is unavailable because this browser does not support speech synthesis.");
        speechUnavailableNotified = true;
      }
      return false;
    }

    const utterance = new window.SpeechSynthesisUtterance(text);
    const voices = synthesis.getVoices();
    const voice = voices.find(candidate => /^(fil|tl)-ph$/i.test(candidate.lang))
      || voices.find(candidate => /^(fil|tl)-/i.test(candidate.lang));
    utterance.lang = voice?.lang || "fil-PH";
    if (voice) utterance.voice = voice;
    utterance.volume = 1.0;
    utterance.pitch = gender === "female" ? 1.4 : 0.85;
    utterance.rate = 0.95;
    utterance.onend = () => finishSpeech(utterance);
    utterance.onerror = event => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        console.error("Unable to speak customer dialogue.", event.error);
      }
      finishSpeech(utterance);
    };

    activeUtterance = utterance;
    applyMusicVolume();
    try {
      synthesis.cancel();
      synthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error("Unable to start customer speech synthesis.", error);
      finishSpeech(utterance);
      return false;
    }
  }

  function playSFX(name) {
    if (daySummaryActive || sfxVolume === 0) return;
    const patterns = {
      levelUp: [
        { frequency: 523.25, duration: 0.16, delay: 0 },
        { frequency: 659.25, duration: 0.16, delay: 0.12 },
        { frequency: 783.99, duration: 0.16, delay: 0.24 },
        { frequency: 1046.5, duration: 0.42, delay: 0.36 }
      ],
      newDay: [
        { frequency: 784, endFrequency: 1046.5, duration: 0.24, delay: 0 },
        { frequency: 1046.5, endFrequency: 1396.9, duration: 0.3, delay: 0.16 },
        { frequency: 880, duration: 0.34, delay: 0.45 }
      ],
      reset: [
        { frequency: 659.25, endFrequency: 523.25, duration: 0.1, delay: 0 },
        { frequency: 523.25, endFrequency: 392, duration: 0.1, delay: 0.08 }
      ]
    };
    const pattern = patterns[name];
    if (!pattern) throw new Error(`Unknown generated sound effect: ${name}`);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn(`Unable to play ${name} sound effect because this browser does not support Web Audio.`);
      return;
    }
    try {
      if (!generatedAudioContext) generatedAudioContext = new AudioContextClass();
      if (generatedAudioContext.state === "suspended") void generatedAudioContext.resume();
      for (const note of pattern) {
        const oscillator = generatedAudioContext.createOscillator();
        const gain = generatedAudioContext.createGain();
        const start = generatedAudioContext.currentTime + note.delay;
        const end = start + note.duration;
        const peak = 0.16 * sfxVolume / 100;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency, start);
        if (note.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, end);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(generatedAudioContext.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      }
    } catch (error) {
      console.error(`Unable to play ${name} sound effect.`, error);
    }
  }

  window.AudioManager = Object.freeze({
    play(name, fallback) {
      if (daySummaryActive) return;
      const audio = effects[name];
      if (!audio) throw new Error(`Unknown audio effect: ${name}`);
      audio.volume = sfxVolume / 100;
      startPlayback(audio, SOURCES[name], fallback, true);
    },
    playBgm(fallback) {
      if (daySummaryActive || bgmVolume === 0 || !music.paused) return;
      applyMusicVolume();
      startPlayback(music, SOURCES.bgm_musical, fallback);
    },
    reinitializeBgm(fallback) {
      if (daySummaryActive) return;
      music.pause();
      music = createMusic();
      music.load();
      if (bgmVolume > 0) startPlayback(music, SOURCES.bgm_musical, fallback);
    },
    setVolumes(nextBgmVolume, nextSfxVolume) {
      bgmVolume = Math.max(0, Math.min(100, Number(nextBgmVolume)));
      sfxVolume = Math.max(0, Math.min(100, Number(nextSfxVolume)));
      Object.values(effects).forEach(audio => { audio.volume = sfxVolume / 100; });
      applyMusicVolume();
      if (bgmVolume === 0) music.pause();
    },
    getBgmVolume() {
      return daySummaryActive ? 0 : bgmVolume * (activeUtterance ? 0.2 : 1);
    },
    playSFX,
    speakCustomer,
    setDaySummaryActive(active) {
      daySummaryActive = active === true;
      if (daySummaryActive) {
        const utterance = activeUtterance;
        activeUtterance = null;
        window.speechSynthesis?.cancel();
        if (utterance) {
          utterance.onend = null;
          utterance.onerror = null;
        }
        music.pause();
      } else {
        applyMusicVolume();
      }
    },
    cancelCustomerSpeech() {
      const utterance = activeUtterance;
      activeUtterance = null;
      window.speechSynthesis?.cancel();
      applyMusicVolume();
      if (utterance) {
        utterance.onend = null;
        utterance.onerror = null;
      }
    }
  });
})();
