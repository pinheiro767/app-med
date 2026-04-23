from flask import Flask, render_template, send_from_directory

app = Flask(__name__)

# página principal
@app.route("/")
def home():
    return render_template("index.html")

# manifest PWA
@app.route("/manifest.json")
def manifest():
    return send_from_directory(".", "manifest.json")

# service worker
@app.route("/sw.js")
def service_worker():
    return send_from_directory(".", "sw.js")

# ícones (caso necessário)
@app.route("/static/icons/<path:filename>")
def icons(filename):
    return send_from_directory("static/icons", filename)

# arquivos estáticos
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

if __name__ == "__main__":
    app.run(debug=True)
