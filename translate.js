// === GLOBALS ===
let voicesReady = false;
let translatedText = ""; // 

// Detect if speech synthesis voices are ready
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => {
    voicesReady = true;
  };
}

// === MAIN TRANSLATION FUNCTION ===
async function translateText() {
  const input = document.getElementById("inputText").value;
  const sourceLang = document.getElementById("sourceLang").value;
  const targetLang = document.getElementById("targetLang").value;
  const outputDiv = document.getElementById("translatedText");
  const detectedLangMsg = document.getElementById("detectedLang");

  const apiKey = "AIzaSyB1bdyCh87pa1nQk_te72zrZLxrqlQvB-o";
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        q: input,
        ...(sourceLang ? { source: sourceLang } : {}),
        target: targetLang,
        format: "text",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    const translation = data?.data?.translations?.[0];

    if (translation) {
      translatedText = translation.translatedText; // 
      const detectedLang = translation.detectedSourceLanguage;

      outputDiv.innerText = translatedText;
      outputDiv.classList.remove("fade-in");
      void outputDiv.offsetWidth;
      outputDiv.classList.add("fade-in");

      detectedLangMsg.innerText =
        !sourceLang && detectedLang ? `Detected language: ${detectedLang.toUpperCase()}` : "";

      saveTranslation(input, translatedText, sourceLang || detectedLang, targetLang, "text_translation");
    } else {
      outputDiv.innerText = " Translation failed. Try again.";
    }
  } catch (error) {
    outputDiv.innerText = " Error: " + error.message;
  }
}

// === COPY TO CLIPBOARD ===
function copyTranslation() {
  if (translatedText) {
    navigator.clipboard.writeText(translatedText).then(() => {
      alert("Translation copied to clipboard!");
    });
  }
}

// === GENERAL SPEAK FUNCTION ===
async function speakText(text, lang) {
  const audioPlayer = new Audio();

  try {
    const res = await fetch("http://127.0.0.1:5050/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, lang: convertLangCode(lang) }) // e.g., 'ms' → 'ms-MY'
    });

    const data = await res.json();
    const audioBase64 = data.audio;

    if (audioBase64) {
      audioPlayer.src = "data:audio/mp3;base64," + audioBase64;

    const settings = JSON.parse(localStorage.getItem("settings")) || {};
    const speed = parseFloat(settings.speed || "1.0");
    audioPlayer.playbackRate = speed;

      audioPlayer.play();
    } else {
      alert("❌ No audio returned.");
    }
  } catch (err) {
    console.error("TTS Error:", err);
    alert("Failed to fetch speech.");
  }
}


function convertLangCode(shortCode) {
  // Map dropdown value to GCP-supported language code
  const map = {
    ar: "ar-XA", bn: "bn-IN", zh: "cmn-CN", en: "en-US", fa: "fa-IR",
    tl: "fil-PH", fr: "fr-FR", de: "de-DE", hi: "hi-IN", id: "id-ID",
    it: "it-IT", ja: "ja-JP", ko: "ko-KR", ml: "ml-IN", ms: "ms-MY",
    nl: "nl-NL", pa: "pa-IN", pl: "pl-PL", pt: "pt-PT", ru: "ru-RU",
    sw: "sw-KE", ta: "ta-IN", te: "te-IN", th: "th-TH", tr: "tr-TR",
    ur: "ur-IN", vi: "vi-VN"
  };
  return map[shortCode] || "en-US";
}


// === LISTEN TO INPUT TEXT ===
function speakInput() {
  const text = document.getElementById("inputText").value;
  const lang = document.getElementById("sourceLang").value || "en";
  speakText(text, lang);
}

// === LISTEN TO TRANSLATED TEXT ===
function speakOutput() {
  const lang = document.getElementById("targetLang").value || "en";
  speakText(translatedText, lang);
}

// === SAVE TO FIRESTORE ===
async function saveTranslation(input, translatedText, sourceLang, targetLang, type) {
  try {
    const userId = localStorage.getItem("user_id") || "guest_user";
    const dbRef = ref(database, "translations");
    const newRef = push(dbRef);

    const data = {
      translation_id: newRef.key,
      user_id: userId,
      input_text: input,
      translated_text: translatedText,
      source_lang: sourceLang,
      target_lang: targetLang,
      type: type,
      timestamp: new Date().toISOString()
    };

    await set(newRef, data);
    console.log("✅ Translation saved to Realtime Database.");
  } catch (error) {
    console.error("❌ Error saving to Realtime DB:", error);
  }
}
