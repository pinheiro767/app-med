import { GROUP_DATABASE, AUDIT_DATABASE } from "./database.js";

const membersState = { 1: [], 2: [], 3: [], 4: [] };
let chartInstance = null;

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.toggleGroup = function(groupId) {
  const target = document.getElementById(`group-body-${groupId}`);
  if (!target) return;
  target.classList.toggle("hidden");
};

window.exportExcel = function() {
  const rows = [["Grupo", "Integrante", "Nota", "Observação"]];
  document.querySelectorAll("#grade-body tr").forEach(tr => {
    const cols = tr.querySelectorAll("td");
    rows.push([
      cols[0]?.innerText || "",
      cols[1]?.innerText || "",
      cols[2]?.innerText || "",
      cols[3]?.innerText || ""
    ]);
  });

  const csv = rows
    .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "avaliacao_anatomia.csv";
  link.click();
};

window.gerarPDF = async function() {
  const element = document.body;
  const canvas = await html2canvas(element, { scale: 1 });
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = 190;
  const pageHeight = (canvas.height * pageWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 10, 10, pageWidth, pageHeight);
  pdf.save("avaliacao_anatomia.pdf");
};

function buildCards() {
  const cards = document.getElementById("cards");
  if (!cards) return;

  cards.innerHTML = "";

  Object.entries(GROUP_DATABASE).forEach(([groupId, group]) => {
    const section = document.createElement("section");
    section.className = "card";

    let html = `
      <button type="button" class="card-header" onclick="toggleGroup(${groupId})">
        <span class="badge">Grupo ${groupId}</span>
        <div>
          <h2>${escapeHtml(group.titulo)}</h2>
          <p>${escapeHtml(group.subtitulo)}</p>
        </div>
      </button>
      <div class="card-body hidden" id="group-body-${groupId}">
    `;

    group.secoes.forEach(sec => {
      html += `<div class="inner-block">`;
      html += `<h3>${escapeHtml(sec.titulo)}</h3>`;

      if (sec.itens && Array.isArray(sec.itens)) {
        html += `<ol>`;
        sec.itens.forEach(item => {
          html += `<li>${escapeHtml(item)}</li>`;
        });
        html += `</ol>`;
      }

      if (sec.texto) {
        html += `<p>${escapeHtml(sec.texto)}</p>`;
      }

      html += `</div>`;
    });

    html += `</div>`;
    section.innerHTML = html;
    cards.appendChild(section);
  });
}

function buildAudit() {
  const audit = document.getElementById("audit");
  if (!audit) return;

  audit.innerHTML = "";

  Object.entries(AUDIT_DATABASE).forEach(([groupId, group]) => {
    const criteriaHtml = group.criterios.map((criterion, idx) => `
      <div class="criterion">
        <label for="score-${groupId}-${idx}">${escapeHtml(criterion)}</label>
        <input
          id="score-${groupId}-${idx}"
          type="number"
          min="0"
          max="10"
          step="0.1"
          class="score-input"
          data-group="${groupId}"
          placeholder="0 a 10"
        >
      </div>
    `).join("");

    const section = document.createElement("section");
    section.className = "audit-card";
    section.innerHTML = `
      <div class="audit-header">
        <div>
          <h2>Grupo ${groupId} · ${escapeHtml(group.area)}</h2>
          <p class="small">${escapeHtml(group.roteiro)}</p>
        </div>
        <div class="group-mean" id="mean-${groupId}">0.00</div>
      </div>

      <div class="inner-block">
        <h3>Checklist específico</h3>
        ${criteriaHtml}
      </div>

      <div class="inner-block">
        <h3>Parecer técnico</h3>
        <textarea rows="4" placeholder="Observações"></textarea>
      </div>

      <div class="inner-block">
        <div class="member-top">
          <h3>Integrantes e notas</h3>
          <button type="button" onclick="addMember(${groupId})">Adicionar integrante</button>
        </div>
        <div id="members-${groupId}"></div>
      </div>
    `;

    audit.appendChild(section);
  });

  document.querySelectorAll(".score-input").forEach(input => {
    input.addEventListener("input", updateAnalytics);
  });
}

window.addMember = function(groupId) {
  membersState[groupId].push({ nome: "", nota: "", obs: "" });
  renderMembers(groupId);
  updateTable();
};

window.removeMember = function(groupId, index) {
  membersState[groupId].splice(index, 1);
  renderMembers(groupId);
  updateTable();
};

window.updateMember = function(groupId, index, field, value) {
  membersState[groupId][index][field] = value;
  updateTable();
};

function renderMembers(groupId) {
  const container = document.getElementById(`members-${groupId}`);
  if (!container) return;

  container.innerHTML = "";

  membersState[groupId].forEach((member, index) => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.innerHTML = `
      <input
        type="text"
        placeholder="Nome do integrante"
        value="${escapeHtml(member.nome)}"
        oninput="updateMember(${groupId}, ${index}, 'nome', this.value)"
      >
      <input
        type="number"
        min="0"
        max="10"
        step="0.1"
        placeholder="Nota"
        value="${escapeHtml(member.nota)}"
        oninput="updateMember(${groupId}, ${index}, 'nota', this.value)"
      >
      <input
        type="text"
        placeholder="Observação"
        value="${escapeHtml(member.obs)}"
        oninput="updateMember(${groupId}, ${index}, 'obs', this.value)"
      >
      <button type="button" onclick="removeMember(${groupId}, ${index})">Remover</button>
    `;
    container.appendChild(row);
  });
}

function getGroupMean(groupId) {
  const values = Array.from(document.querySelectorAll(`.score-input[data-group="${groupId}"]`))
    .map(input => Number(input.value))
    .filter(value => !Number.isNaN(value));

  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildChart() {
  const ctx = document.getElementById("chart");
  if (!ctx || typeof Chart === "undefined") return;

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Grupo 1", "Grupo 2", "Grupo 3", "Grupo 4"],
      datasets: [{
        label: "Média por grupo",
        data: [0, 0, 0, 0]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function updateAnalytics() {
  const means = [1, 2, 3, 4].map(groupId => getGroupMean(groupId));

  [1, 2, 3, 4].forEach(groupId => {
    const meanBox = document.getElementById(`mean-${groupId}`);
    if (meanBox) meanBox.textContent = getGroupMean(groupId).toFixed(2);
  });

  if (chartInstance) {
    chartInstance.data.datasets[0].data = means;
    chartInstance.update();
  }
}

function updateTable() {
  const tbody = document.getElementById("grade-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  [1, 2, 3, 4].forEach(groupId => {
    membersState[groupId].forEach(member => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Grupo ${groupId}</td>
        <td>${escapeHtml(member.nome)}</td>
        <td>${escapeHtml(member.nota)}</td>
        <td>${escapeHtml(member.obs)}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

function bootstrap() {
  buildCards();
  buildAudit();
  buildChart();
  updateTable();
  updateAnalytics();
}

bootstrap();
registerSW();
