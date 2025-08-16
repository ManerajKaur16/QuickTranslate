function saveSettings() {
  const speed = document.getElementById("voiceSpeed").value;
  localStorage.setItem("settings", JSON.stringify({ speed, theme: selectedTheme }));

  const status = document.getElementById("status");
  status.innerText = " Settings saved successfully!";
  status.className = "status-message status-success";
}

function resetDefaults() {
  localStorage.removeItem("settings");
  document.getElementById("voiceSpeed").value = "1.0";
  document.getElementById("speedValue").innerText = "1.0x";
  previewTheme("light");

  const status = document.getElementById("status");
  status.innerText = " Settings reset to defaults.";
  status.className = "status-message status-reset";
}
