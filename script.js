function changeText() {
    document.getElementById("info").innerText =
        "You clicked the button! GitHub training is going great 🚀";
}
document.getElementById("myButton").addEventListener("click", changeText);
