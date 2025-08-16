let finalTranslation = "";
let capturedImageBlob = null;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const snapBtn = document.getElementById('snapBtn');
const preview = document.getElementById('capturedImagePreview');
const imageInput = document.getElementById("imageInput");
const translatedTextDiv = document.getElementById("translatedText");

// === Open camera and show video ===
document.getElementById('openCameraBtn').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.classList.add('show');
    snapBtn.style.display = "block";
    canvas.classList.remove('show');
    preview.classList.remove('show');
  } catch (error) {
    alert("Camera access denied or unavailable.");
    console.error(error);
  }
});

// === Snap photo from video feed ===
snapBtn.addEventListener('click', () => {
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.classList.add('show');

  const stream = video.srcObject;
  stream.getTracks().forEach(track => track.stop());
  video.srcObject = null;
  video.classList.remove('show');
  snapBtn.style.display = "none";

  canvas.toBlob(blob => {
    capturedImageBlob = blob;
    preview.src = URL.createObjectURL(blob);
    preview.classList.add('show');
    alert("📸 Photo captured! Now click 'Translate Image'.");
  }, 'image/png');
});

// === Translate button ===
document.getElementById("translateBtn").addEventListener("click", async () => {
  const lang = document.getElementById("languageSelect").value || "ms"; // default to Malay
  const imageToUse = capturedImageBlob || imageInput.files[0];

  if (!imageToUse) {
    alert("❗ Please upload or capture an image first.");
    return;
  }

  translatedTextDiv.innerText = "⏳ Processing image...";

  try {
    const imageDataUrl = await preprocessImageBeforeOCR(imageToUse);
    const result = await Tesseract.recognize(imageDataUrl, 'eng');
    let text = result.data.text.trim();

    // === CLEAN TEXT ===
    text = text
      .replace(/[^\w\s.,'’"?!-]/g, "")   // Remove special unwanted chars
      .replace(/\s{2,}/g, " ")           // Replace multiple spaces
      .replace(/\n+/g, "\n")             // Normalize newlines
      .replace(/(\.\.+|\-\-+|\~+)/g, ".") // Fix repeated punctuation
      .replace(/^\s+|\s+$/g, "");         // Trim start/end

    text = text.charAt(0).toUpperCase() + text.slice(1);

    if (!text) {
      translatedTextDiv.innerText = "❌ No recognizable text found.";
      return;
    }

    const translationRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`);
    const translationData = await translationRes.json();
    const translated = translationData[0].map(d => d[0]).join(" ");

    finalTranslation = translated;
    translatedTextDiv.innerHTML = `
      <strong>📄 Extracted Text:</strong><br>
      <p style="white-space: pre-wrap; font-style: italic;">${text}</p>
      <strong>🌍 Translated:</strong><br>
      <p style="white-space: pre-wrap;"><b>${translated}</b></p>
    `;
  } catch (error) {
    console.error(error);
    translatedTextDiv.innerText = "❌ Translation failed. Try again.";
  }
});

// === Preprocess Image Before OCR ===
async function preprocessImageBeforeOCR(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const scale = 1.3;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          let bw = avg > 140 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = bw;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };

    reader.readAsDataURL(blob);
  });
}

// === Speak Translated Text ===
document.getElementById("speakBtn").addEventListener("click", () => {
  if (!finalTranslation) return;
  const utterance = new SpeechSynthesisUtterance(finalTranslation);
  speechSynthesis.cancel(); // stop any ongoing speech
  speechSynthesis.speak(utterance);
});

// === Copy Translated Text ===
document.getElementById("copyBtn").addEventListener("click", () => {
  if (!finalTranslation) return;
  navigator.clipboard.writeText(finalTranslation)
    .then(() => alert("✅ Translation copied to clipboard!"))
    .catch(() => alert("❌ Failed to copy text."));
});
