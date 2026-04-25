import { GROUP_DATABASE } from "./database.js";

const cards = document.getElementById("cards");

/* ------------------------------
   FUNÇÃO SEGURA PARA HTML
--------------------------------*/

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ------------------------------
   GERAR CARDS DOS GRUPOS
--------------------------------*/

if (cards) {

  Object.entries(GROUP_DATABASE).forEach(([id, g]) => {

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <h2>${escapeHtml(g.titulo)}</h2>
      <p>${escapeHtml(g.subtitulo)}</p>
    `;

    cards.appendChild(div);

  });

}

/* ------------------------------
   EXPORTAR CSV (EXCEL)
--------------------------------*/

function exportCSV() {

  let csv = "Grupo,Aluno,Nota\n";

  const linhas = document.querySelectorAll("#grade-body tr");

  if (!linhas.length) {
    alert("Nenhuma avaliação encontrada.");
    return;
  }

  linhas.forEach(row => {

    const cols = row.querySelectorAll("td");

    if (cols.length >= 3) {

      const grupo = cols[0].innerText.trim();
      const aluno = cols[1].innerText.trim();
      const nota = cols[2].innerText.trim();

      csv += `"${grupo}","${aluno}","${nota}"\n`;

    }

  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "avaliacao_anatomia.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

}

/* ------------------------------
   GERAR PDF
--------------------------------*/

async function gerarPDF() {

  const element = document.getElementById("app-root") || document.body;

  const canvas = await html2canvas(element, {
    scale: 1.6,
    useCORS: true
  });

  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = 210;
  const pageHeight = 297;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let position = 0;
  let heightLeft = imgHeight;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {

    position = heightLeft - imgHeight;
    pdf.addPage();

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

    heightLeft -= pageHeight;
  }

  pdf.save("avaliacao_anatomia.pdf");

}

/* ------------------------------
   EXPORTAR FUNÇÕES
--------------------------------*/

window.exportCSV = exportCSV;
window.gerarPDF = gerarPDF;