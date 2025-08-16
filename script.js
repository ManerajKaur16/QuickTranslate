const auth = firebase.auth();
const db = firebase.database();

let confirmationResult = null;

// ✅ Setup reCAPTCHA
window.onload = () => {
  if (document.getElementById("recaptcha-container")) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'normal',
      callback: () => {
        console.log("reCAPTCHA solved");
        document.getElementById("send-otp-btn").disabled = false;
      }
    });
    recaptchaVerifier.render();
  }
};

// ✅ Step 1: Send OTP
function sendOTP() {
  const phoneNumber = document.getElementById("phone-number").value.trim();
  const status = document.getElementById("status");

  if (!phoneNumber.startsWith("+") || phoneNumber.length < 10) {
  status.innerText = "❌ Please enter a valid international phone number (e.g. +14155552671).";
  return;
}

  auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
    .then(result => {
      confirmationResult = result;
      status.innerText = "📲 OTP sent. Please check your phone.";
    })
    .catch(error => {
      status.innerText = "❌ Failed to send OTP: " + error.message;
    });
}

// ✅ Step 2: Verify OTP
function verifyOTP() {
  const code = document.getElementById("otp-code").value.trim();
  const status = document.getElementById("status");

  if (!confirmationResult) {
    status.innerText = "❌ Please request OTP first.";
    return;
  }

  confirmationResult.confirm(code)
    .then(() => {
      status.innerText = "✅ OTP verified! Now set your password.";
      document.getElementById("phone-pass-section").classList.remove("hidden");
    })
    .catch(() => {
      status.innerText = "❌ Incorrect OTP.";
    });
}

// ✅ Step 3: Finish registration
function finalizePhoneSignup() {
  const password = document.getElementById("otp-password").value.trim();
  const confirmPassword = document.getElementById("otp-confirm").value.trim();
  const status = document.getElementById("status");

  if (password.length < 6) {
    status.innerText = "❌ Password must be at least 6 characters.";
    return;
  }

  if (password !== confirmPassword) {
    status.innerText = "❌ Passwords do not match.";
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    status.innerText = "❌ User session not found.";
    return;
  }

  const pseudoEmail = user.phoneNumber + "@phone.fake";
  const credential = firebase.auth.EmailAuthProvider.credential(pseudoEmail, password);

  user.linkWithCredential(credential)
    .then(() => {
      db.ref("users/" + user.uid).set({
        user_id: user.uid,
        email: pseudoEmail,
        phone_number: user.phoneNumber,
        created_at: new Date().toISOString()
      });

      status.innerText = "✅ Registered successfully!";
      setTimeout(() => {
        window.location.href = "main.html";
      }, 1500);
    })
    .catch(error => {
      status.innerText = "❌ Could not complete registration: " + error.message;
    });
}

// ✅ Toggle password visibility
function toggleVisibility(fieldId, btn) {
  const field = document.getElementById(fieldId);
  const icon = btn.querySelector("img");

  if (field.type === "password") {
    field.type = "text";
    icon.src = "https://img.icons8.com/ios-glyphs/30/invisible.png";
    icon.alt = "Hide";
  } else {
    field.type = "password";
    icon.src = "https://img.icons8.com/ios-glyphs/30/visible.png";
    icon.alt = "Show";
  }
}
