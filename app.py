from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os
import base64
from google.cloud import texttospeech
import pytesseract


pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = Flask(__name__, template_folder='.')
CORS(app)

# === Static Routes ===
@app.route('/<path:filename>')
def serve_static_from_root(filename):
    return send_from_directory('.', filename)

@app.route('/style.css')
def serve_css():
    return send_from_directory('.', 'style.css')

@app.route('/sidebar.html')
def serve_sidebar():
    return send_from_directory('.', 'sidebar.html')

@app.route("/index")
def index_page():
    return render_template("index.html")


from flask import send_from_directory

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)


# === Google TTS ===
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(os.getcwd(), "smartlibrarymanagementsy-13082-fa5e78db88f9.json")
client = texttospeech.TextToSpeechClient()

@app.route("/tts", methods=["POST"])
def tts():
    data = request.json
    text = data.get("text")
    lang = data.get("lang", "en-US")

    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(language_code=lang, ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL)
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
    audio_content = base64.b64encode(response.audio_content).decode("utf-8")
    return jsonify({"audio": audio_content})

# === Load Sentiment Model ===
MODEL_PATH = "C:/Users/kaurm/Downloads/FYP Data and Models/final_idiom_sentiment_model"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

# === Load Excel Idioms ===
df = pd.read_excel("C:/Users/kaurm/Downloads/FYP Data and Models\malay_idioms_fully_cleaned_final.xlsx")
df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]

# === Idiom Dictionary ===
idiom_dict = {}
available_languages = set()
sentiment_map = {0: "Negative 😞", 1: "Neutral 😐", 2: "Positive 😊"}

for _, row in df.iterrows():
    idiom_raw = str(row["idiom"]).strip()
    idiom_lower = idiom_raw.lower()

    idiom_dict[idiom_lower] = {
        "original": idiom_raw,
        "translations": {}
    }

    for col in df.columns:
        if col.startswith("meaning_") and pd.notna(row[col]):
            lang = col.replace("meaning_", "").capitalize()
            idiom_dict[idiom_lower]["translations"][lang] = str(row[col]).strip()
            available_languages.add(lang)

# === Main Idioms Page ===
@app.route("/", methods=["GET", "POST"])
@app.route("/idioms", methods=["GET", "POST"])
def idioms_page():
    result = None
    if request.method == "POST":
        user_input = request.form.get("idiom", "").strip()
        idiom_lower = user_input.lower()
        selected_lang = request.form.get("language", "").capitalize()

        idiom_entry = idiom_dict.get(idiom_lower)
        translation = idiom_entry["translations"].get(selected_lang) if idiom_entry else None
        idiom_original = idiom_entry["original"] if idiom_entry else user_input

        # === FIXED: Preserve casing in model input ===
        sentiment_input = translation if translation else idiom_original
        model_input_text = f"{sentiment_input} | {selected_lang.lower()}"
        tokens = tokenizer(model_input_text, return_tensors="pt", truncation=True, padding=True)

        with torch.no_grad():
            outputs = model(**tokens)
            pred = torch.argmax(outputs.logits).item()
            sentiment_pred = sentiment_map.get(pred, "Unknown")

        if translation:
            result = (
                f"Idiom: <b>{idiom_original}</b><br><br>"
                f"Translation : <b>{translation}</b><br><br>"
                f"<b>{sentiment_pred}</b><br>"
            )
        else:
            result = (
                f"Idiom: <b>{idiom_original}</b><br><br>"
                f"Translation: <b>Translation not found</b><br><br>"
                f"<b>{sentiment_pred}</b><br>"
            )

    return render_template("idioms.html", languages=sorted(available_languages), result=result)

# === Other Pages ===
@app.route("/home")
def home_page():
    return render_template("main.html")

@app.route("/text")
def text_page():
    return render_template("text-translator.html")

@app.route("/speech")
def speech_page():
    return render_template("speech-translator.html")

@app.route("/sign")
def sign_page():
    return render_template("sign-language.html")

@app.route("/image")
def image_page():
    return render_template("image-translator.html")

@app.route("/settings")
def settings_page():
    return render_template("settings.html")
    

# =========================================== #
# ============== Sign Language ============== #
# =========================================== #

@app.route("/predict-letters", methods=["POST"])
def predict_letters():
    data = request.get_json()
    text = data.get("text", "").upper()

    sign_images = []

    for char in text:
        if char.isalpha():
            image_filename = f"{char}.jpg"
            image_path = os.path.join("assets", "sign-alphabet-image", image_filename)
            if os.path.exists(image_path):
                sign_images.append({"letter": char, "url": f"/assets/sign-alphabet-image/{image_filename}"})
            else:
                sign_images.append({"letter": char, "url": None})

    return jsonify({"images": sign_images})

# =========================================================== #
# ============== Sign Language Video Detection ============== #
# =========================================================== #

from PIL import Image
import numpy as np
import cv2
from keras.models import load_model

# === Load Trained Keras Model ===
try:
    sign_model = load_model("c:/Users/kaurm/Downloads/FYP Data and Models/Alphabet_MSL_Cleaned/sign_language_model.keras")
    print("✅ Model loaded successfully.")
except Exception as e:
    print("❌ Error loading model:", e)

sign_labels = [chr(i) for i in range(65, 91)]  # A-Z

@app.route("/predict-sign-image", methods=["POST"])
def predict_sign_image():
    file = request.files.get("image")
    if file:
        image = Image.open(file).convert("RGB")
        image = image.resize((64, 64))
        image = np.array(image) / 255.0
        image = np.expand_dims(image, axis=0)

        prediction = sign_model.predict(image, verbose=0)
        idx = np.argmax(prediction[0])
        label = sign_labels[idx]
        confidence = float(np.max(prediction[0]) * 100)

        return jsonify({
            "label": label,
            "confidence": round(confidence, 2)
        })
    return jsonify({"error": "No image received"}), 400


# =========================================================== #
# ============== Malaysian Road Sign Classification ========= #
# =========================================================== #
import json
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.resnet50 import preprocess_input
from flask import request, jsonify, render_template

# --------- PATHS (EDIT THESE) ----------
KERAS_MODEL_PATH = r"C:/Users/kaurm/Downloads/FYP Data and Models/ResNet50_road_sign_model/best_model.keras"
LABELS_JSON_PATH = r"C:/Users/kaurm/Downloads/FYP Data and Models/ResNet50_road_sign_model/labels.json"
# ---------------------------------------

# Load Keras model once at startup
road_sign_clf = tf.keras.models.load_model(KERAS_MODEL_PATH)

# Infer input size
try:
    RS_H, RS_W = road_sign_clf.input_shape[1], road_sign_clf.input_shape[2]
except Exception:
    RS_H, RS_W = 224, 224  # fallback (ResNet50 default)

# Load labels -> index -> name
with open(LABELS_JSON_PATH, "r", encoding="utf-8") as f:
    labels_data = json.load(f)
index_to_label = (
    {int(v): k for k, v in labels_data.items()}
    if isinstance(labels_data, dict)
    else {i: name for i, name in enumerate(labels_data)}
)

def _rs_preprocess(file_storage):
    img = Image.open(file_storage.stream).convert("RGB").resize((RS_W, RS_H))
    arr = np.asarray(img, dtype=np.float32)
    arr = preprocess_input(arr)
    return np.expand_dims(arr, axis=0)

@app.route("/predict-road-sign", methods=["POST"])
def predict_road_sign():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image uploaded"}), 400
    try:
        x = _rs_preprocess(file)
        probs = road_sign_clf.predict(x, verbose=0)[0]
        top_idx = int(np.argmax(probs))
        return jsonify({
            "prediction": index_to_label.get(top_idx, f"class_{top_idx}"),
            "confidence": float(probs[top_idx])
        })
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

@app.route("/road-sign")
def road_sign_page():
    return render_template("road_sign.html")


if __name__ == "__main__":
    app.run(debug=True, port=5050)