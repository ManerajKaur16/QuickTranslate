function translateText() {
  const text = document.getElementById("textInput").value.trim();
  const lang = document.getElementById("langSelect").value;
  const output = document.getElementById("outputBox");

  if (text === "") {
    output.innerHTML = "❗ Please type or speak something.";
    return;
  }

  output.innerHTML = `Translating "<strong>${text}</strong>" from <strong>${lang}</strong> into sign language...`;
}

// Translate using IMAGE sequence
async function translateToImage() {
  const input = document.getElementById("textInput").value.trim();
  const output = document.getElementById("outputBox");
  output.innerHTML = "";

  if (!input) {
    output.innerHTML = "❗ Please type or speak something.";
    return;
  }

  try {
    const response = await fetch("/predict-letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input })
    });

    const result = await response.json();
    const letters = result.images;

    if (!letters.length) {
      output.innerHTML = "❗ No valid letters found.";
      return;
    }

    const heading = document.createElement("div");
    heading.innerHTML = `<strong>Sign Language for:</strong> "${input.toUpperCase()}"<br><br>`;
    output.appendChild(heading);

    const wordDiv = document.createElement("div");
    wordDiv.style.marginBottom = "20px";

    letters.forEach(item => {
      const wrapper = document.createElement("div");
      wrapper.style.display = "inline-block";
      wrapper.style.textAlign = "center";
      wrapper.style.margin = "5px";

      const img = document.createElement("img");
      img.src = item.url || "assets/sign-alphabet-image/placeholder.jpg";
      img.alt = item.letter;
      img.style.width = "80px";
      img.style.border = "2px solid #ccc";

      const caption = document.createElement("p");
      caption.style.margin = "4px 0 0";
      caption.style.fontSize = "14px";
      caption.innerHTML = `<b>${item.letter}</b>`;

      wrapper.appendChild(img);
      wrapper.appendChild(caption);
      wordDiv.appendChild(wrapper);
    });

    output.appendChild(wordDiv);
  } catch (error) {
    console.error("Error:", error);
    output.innerHTML = "❗ Error fetching sign images.";
  }
}

// 🎤 Speech Input to trigger image translation
function startSpeechRecognition() {
  const lang = document.getElementById("langSelect").value;
  const output = document.getElementById("outputBox");

  if (!('webkitSpeechRecognition' in window)) {
    alert("Speech recognition not supported in this browser.");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  output.innerHTML = "🎙️ Listening... Please speak clearly.";

  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("textInput").value = transcript;
    translateToImage();
  };

  recognition.onerror = (event) => {
    output.innerHTML = `❗ Speech recognition error: ${event.error}`;
  };

  recognition.onend = () => {
    console.log("Speech recognition ended.");
  };
}

// 📷 Webcam sign prediction
function startWebcamPrediction() {
  const video = document.createElement("video");
  video.setAttribute("autoplay", true);
  video.setAttribute("playsinline", true);
  video.style.width = "300px";
  video.style.height = "300px";
  video.style.border = "2px solid #444";

  const output = document.getElementById("outputBox");
  output.innerHTML = "<strong>📷 Show your hand sign in the webcam feed below, it will predict in 3 seconds...</strong><br><br>";
  output.appendChild(video);

  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;

      setTimeout(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 100, 100, 200, 200, 0, 0, 64, 64);

        canvas.toBlob((blob) => {
          const formData = new FormData();
          formData.append("image", blob, "frame.jpg");

          fetch("/predict-sign-image", {
            method: "POST",
            body: formData
          })
            .then(res => res.json())
            .then(data => {
              output.innerHTML += `<br><h3>✅ Predicted: <b>${data.label}</b> (${data.confidence}%)</h3>`;
              stream.getTracks().forEach(t => t.stop());
            })
            .catch(err => {
              output.innerHTML += "<br>❌ Prediction failed.";
              console.error(err);
            });
        }, "image/jpeg");
      }, 3000);
    })
    .catch((err) => {
      output.innerHTML = "❌ Unable to access webcam.";
      console.error(err);
    });
}
