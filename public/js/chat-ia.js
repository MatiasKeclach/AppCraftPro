const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

sendBtn.addEventListener("click", async () => {
  const message = chatInput.value.trim();
  if (!message) return;

  appendMessage("Tú", message);
  chatInput.value = "";

  try {
    const res = await fetch("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    appendMessage("IA", data.reply);

  } catch (err) {
    appendMessage("IA", "Error al conectarse con el servidor.");
  }
});

function appendMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.textContent = `${sender}: ${text}`;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}