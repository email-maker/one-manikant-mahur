const sendBtn = document.getElementById("sendBtn");
const countBox = document.getElementById("count");

sendBtn.onclick = async () => {
  sendBtn.disabled = true;
  sendBtn.innerText = "Sending...";

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderName: senderName.value,
      gmail: gmail.value,
      apppass: apppass.value,
      subject: subject.value,
      message: message.value,
      to: to.value
    })
  });

  const data = await res.json();
  sendBtn.disabled = false;
  sendBtn.innerText = "Send All";

  countBox.innerText = `${data.count}/28`;

  if (!data.success) alert(data.msg);
  else alert(`Mail Send Successful ✅\nSent: ${data.sent}`);
};

function logout(){
  localStorage.removeItem("auth");
  location.href="/";
}
