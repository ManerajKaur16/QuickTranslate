// ------- Elements -------
const uploadInput = document.getElementById("uploadInput");
const previewEl   = document.getElementById("preview");
const statusEl    = document.getElementById("status");
const errorBox    = document.getElementById("errorBox");
const resultEl    = document.getElementById("result");
const detectBtn   = document.getElementById("detectBtn");
const resetBtn    = document.getElementById("resetBtn");
const loadingBox  = document.getElementById("loading");

// Camera elements
const openCamBtn  = document.getElementById("openCamBtn");
const snapBtn     = document.getElementById("snapBtn");
const cameraEl    = document.getElementById("camera");
const canvasEl    = document.getElementById("capture-canvas");

let cameraStream = null;

// API base: if page is not served from Flask :5050, call the Flask server directly
const API_BASE =
  (location.port && location.port !== "5050")
    ? "http://localhost:5050"
    : ""; // same origin (Flask)

// ------- Helpers -------
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

function clearMsg() {
  statusEl.textContent = "";
  errorBox.textContent = "";
  resultEl.textContent = "";
  resultEl.classList.add("hidden");
}

function setBusy(isBusy) {
  detectBtn.disabled = isBusy;
  detectBtn.textContent = isBusy ? "Detecting…" : "Detect Sign";
  loadingBox.style.display = isBusy ? "block" : "none";
}

function showError(msg) {
  errorBox.textContent = msg; // styled by .status-message in your CSS
}

function showResult(label, conf) {
  const confTxt = typeof conf === "number" ? ` (${(conf * 100).toFixed(1)}%)` : "";
  resultEl.textContent = `Detected: ${label}${confTxt}`;
  resultEl.classList.remove("hidden");
}

function hidePreview() {
  previewEl.classList.remove("show");
  previewEl.removeAttribute("src");
}

function showPreviewFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    previewEl.src = e.target.result;
    previewEl.classList.add("show"); // .show is in your CSS
  };
  reader.readAsDataURL(file);
}

// Validate file only (no preview yet for regular uploads/paste)
function validateFile(file) {
  clearMsg();
  if (!file) return false;

  if (!VALID_TYPES.includes(file.type)) {
    showError("Please upload a JPG, PNG, or WEBP image.");
    uploadInput.value = "";
    hidePreview();
    return false;
  }

  if (file.size > MAX_SIZE) {
    showError("File is too large. Please choose an image ≤ 10 MB.");
    uploadInput.value = "";
    hidePreview();
    return false;
  }

  hidePreview();
  return true;
}

// ------- File input -------
uploadInput.addEventListener("change", () => {
  const file = uploadInput.files && uploadInput.files[0];
  validateFile(file); // validation only
});

// ------- Camera logic -------
async function openCamera() {
  clearMsg();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    cameraEl.srcObject = cameraStream;
    await cameraEl.play();
    cameraEl.classList.add("show");   // your CSS forces display when .show
    snapBtn.classList.remove("hidden");
    statusEl.textContent = "Camera is on. Frame the sign and click Take Photo.";
  } catch (err) {
    console.error(err);
    showError("Camera not available or permission denied.");
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraEl.pause();
  cameraEl.removeAttribute("srcObject");
  cameraEl.classList.remove("show");
  snapBtn.classList.add("hidden");
}

// >>> CHANGE HERE: show the captured image immediately <<<
async function snapPhoto() {
  if (!cameraStream) {
    showError("Camera is not active.");
    return;
  }
  const w = cameraEl.videoWidth || 640;
  const h = cameraEl.videoHeight || 480;
  canvasEl.width = w;
  canvasEl.height = h;
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(cameraEl, 0, 0, w, h);

  const blob = await new Promise(resolve => canvasEl.toBlob(resolve, "image/jpeg", 0.95));
  stopCamera();

  const file = new File([blob], "camera.jpg", { type: "image/jpeg" });

  // Put into the hidden file input so detect uses it
  const dt = new DataTransfer();
  dt.items.add(file);
  uploadInput.files = dt.files;

  // Show preview of the captured photo right away
  showPreviewFromFile(file);

  statusEl.textContent = "Photo captured. Ready to detect.";
}

// Buttons
openCamBtn.addEventListener("click", openCamera);
snapBtn.addEventListener("click", snapPhoto);

// ------- Paste support -------
document.addEventListener("paste", e => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      const blob = item.getAsFile();
      if (!blob) continue;
      const file = new File([blob], `pasted.${(blob.type.split("/")[1] || "png")}`, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      uploadInput.files = dt.files;
      if (validateFile(file)) {
        statusEl.textContent = "Image pasted. Ready to detect.";
        // (We keep preview-after-detect for uploads/paste; change to showPreviewFromFile(file)
        // here too if you want it to show immediately.)
      }
      e.preventDefault();
      break;
    }
  }
});

// ------- Reset -------
resetBtn.addEventListener("click", () => {
  clearMsg();
  uploadInput.value = "";
  hidePreview();
  stopCamera();
});

// ------- Predict -------
async function predictSign() {
  clearMsg();

  const file = uploadInput.files && uploadInput.files[0];
  if (!file) {
    showError("Please choose an image first (upload, paste, or take a photo).");
    return;
  }
  if (!validateFile(file)) return;

  try {
    setBusy(true);
    statusEl.textContent = "Uploading image…";

    const formData = new FormData();
    formData.append("image", file);

    const resp = await fetch(`${API_BASE}/predict-road-sign`, {
      method: "POST",
      body: formData
    });

    if (!resp.ok) {
      if (resp.status === 413) throw new Error("Image too large (HTTP 413). Try a smaller image.");
      throw new Error(`Server error (HTTP ${resp.status}).`);
    }

    const data = await resp.json();
    statusEl.textContent = "Detection completed.";

    if (data.prediction) {
      showResult(data.prediction, data.confidence);
      // For uploads/paste we still show preview after detection:
      if (!previewEl.src) showPreviewFromFile(file);
    } else if (Array.isArray(data.topk) && data.topk.length) {
      const best = data.topk[0];
      showResult(best.label ?? best.name ?? "Unknown", best.confidence);
      if (!previewEl.src) showPreviewFromFile(file);
    } else {
      showError("No prediction returned.");
    }
  } catch (err) {
    console.error(err);
    showError(err.message || "Detection failed.");
  } finally {
    setBusy(false);
  }
}

// Expose for onclick in HTML
window.predictSign = predictSign;
