import { GROUP_DATABASE, AUDIT_DATABASE, ARTICLES } from "./database.js";

const STORAGE_KEY = "auditoria_mmii_app_data_v2";

const membersState = { 1: [], 2: [], 3: [], 4: [] };
const uploadsState = {
  1: { fotos: [], arquivos: [] },
  2: { fotos: [], arquivos: [] },
  3: { fotos: [], arquivos: [] },
  4: { fotos: [], arquivos: [] }
};

let chartInstance = null;
window.__savedCriteria = {};
window.__savedObservacoes = {};

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveAppState() {
  const payload = {
    membersState,
    uploadsState,
    criterios: collectCriteriaValues(),
    observacoes: collectObservationValues()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadAppState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);

    if (parsed.membersState) {
      Object.keys(parsed.membersState).forEach(groupId => {
        membersState[groupId] = parsed.membersState[groupId];
      });
    }

    if (parsed.uploadsState) {
      Object.keys(parsed.uploadsState).forEach(groupId => {
        uploadsState[groupId] = parsed.uploadsState[groupId];
      });
    }

    window.__savedCriteria = parsed.criterios || {};
    window.__savedObservacoes = parsed.observacoes || {};
  } catch (error) {
    console.error("Erro ao carregar dados salvos:", error);
  }
}

function collectCriteriaValues() {
  const result = {};
  document.querySelectorAll(".score-input").forEach(input => {
    result[input.id] = input.value;
  });
  return result;
}

function collectObservationValues() {
  const result = {};
  document.querySelectorAll("textarea[id^='obs-']").forEach(textarea => {
    result[textarea.id] = textarea.value;
  });
  return result;
}

function restoreCriteriaValues() {
  const savedCriteria = window.__savedCriteria || {};
  Object.entries(savedCriteria).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });

  const savedObs = window.__savedObservacoes || {};
  Object.entries(savedObs).forEach(([id, value]) => {
    const textarea = document.getElementById(id);
    if (textarea) textarea.value = value;
  });
}

function buildCards() {
  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  Object.entries(GROUP_DATABASE).forEach(([groupId, group]) => {
    const section = document.createElement("section");
    section.className = "card";

    let html = `
      <button class="card-header" onclick="toggleGroup(${groupId})">
        <span class="badge">Grupo ${groupId}</span>
        <div>
          <h2>${escapeHtml(group.titulo)}</h2>
          <p>${escapeHtml(group.subtitulo)}</p>
        </div>
      </button>
      <div class="card-body hidden" id="group-body-${groupId}">
    `;

    group.secoes.forEach(sec => {
      html += `<div class="inner-block"><h3>${escapeHtml(sec.titulo)}</h3>`;

      if (sec.itens) {
        html += "<ol>";
        sec.itens.forEach(item => {
          html += `<li>${escapeHtml(item)}</li>`;
        });
        html += "</ol>";
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

function buildArticles() {
  const container = document.getElementById("articles");
  container.innerHTML = "";

  ARTICLES.forEach(article => {
    const card = document.createElement("article");
    card.className = "science-card";

    card.innerHTML = `
      <div class="science-meta">
        <span class="science-year">${escapeHtml(article.ano)}</span>
        <span class="science-journal">${escapeHtml(article.revista)}</span>
      </div>
      <h3>${escapeHtml(article.titulo)}</h3>
      <p>${escapeHtml(article.descricao)}</p>
      <div class="science-footer">
        <p><strong>DOI:</strong> ${escapeHtml(article.doi || "")}</p>
        <a href="${article.link}" target="_blank" rel="noopener noreferrer">Abrir artigo</a>
      </div>
    `;

    container.appendChild(card);
  });
}

function buildAudit() {
  const audit = document.getElementById("audit");
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
          data-idx="${idx}"
          placeholder="Digite a nota de 0 a 10"
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
        <textarea
          id="obs-${groupId}"
          rows="4"
          placeholder="Registre observações anatômicas, topográficas, funcionais, biomecânicas e metodológicas."
        ></textarea>
      </div>

      <div class="inner-block">
        <h3>Fotos dos trabalhos do grupo</h3>
        <input type="file" accept="image/*" multiple class="photo-input" data-group="${groupId}">
        <div id="photo-preview-${groupId}" class="preview-grid" style="margin-top:12px;"></div>

        <h3 style="margin-top:16px;">Arquivos complementares</h3>
        <input type="file" multiple class="file-input" data-group="${groupId}">
        <div id="file-preview-${groupId}" style="margin-top:12px;"></div>
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
    input.addEventListener("input", () => {
      updateAnalytics();
      saveAppState();
    });
  });

  document.querySelectorAll("textarea[id^='obs-']").forEach(textarea => {
    textarea.addEventListener("input", saveAppState);
  });
}

function bindUploadEvents() {
  document.querySelectorAll(".photo-input").forEach(input => {
    input.addEventListener("change", (event) => {
      const groupId = Number(event.target.dataset.group);
      handlePhotos(groupId, event.target.files);
      event.target.value = "";
    });
  });

  document.querySelectorAll(".file-input").forEach(input => {
    input.addEventListener("change", (event) => {
      const groupId = Number(event.target.dataset.group);
      handleFiles(groupId, event.target.files);
      event.target.value = "";
    });
  });
}

window.toggleGroup = function(groupId) {
  const target = document.getElementById(`group-body-${groupId}`);
  target.classList.toggle("hidden");
};

window.addMember = function(groupId) {
  membersState[groupId].push({
    nome: "",
    nota: "",
    obs: ""
  });
  renderMembers(groupId);
  updateTable();
  updateAnalytics();
  saveAppState();
};

window.removeMember = function(groupId, index) {
  membersState[groupId].splice(index, 1);
  renderMembers(groupId);
  updateTable();
  saveAppState();
};

window.updateMember = function(groupId, index, field, value) {
  membersState[groupId][index][field] = value;
  updateTable();
  saveAppState();
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

window.handlePhotos = function(groupId, files) {
  Array.from(files || []).forEach(file => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = e => {
      uploadsState[groupId].fotos.push({
        nome: file.name,
        tipo: file.type,
        dados: e.target.result
      });
      renderSavedPhotos(groupId);
      saveAppState();
    };
    reader.readAsDataURL(file);
  });
};

function renderSavedPhotos(groupId) {
  const preview = document.getElementById(`photo-preview-${groupId}`);
  if (!preview) return;

  preview.innerHTML = "";

  uploadsState[groupId].fotos.forEach((foto, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "inner-block";
    wrapper.style.padding = "10px";

    wrapper.innerHTML = `
      <img src="${foto.dados}" alt="${escapeHtml(foto.nome)}" class="preview-image">
      <p class="small" style="margin-top:8px;">${escapeHtml(foto.nome)}</p>
      <button type="button" onclick="removePhoto(${groupId}, ${index})">Remover foto</button>
    `;

    preview.appendChild(wrapper);
  });
}

window.removePhoto = function(groupId, index) {
  uploadsState[groupId].fotos.splice(index, 1);
  renderSavedPhotos(groupId);
  saveAppState();
};

window.handleFiles = function(groupId, files) {
  Array.from(files || []).forEach(file => {
    uploadsState[groupId].arquivos.push({
      nome: file.name,
      tipo: file.type || "não identificado",
      tamanho: (file.size / 1024).toFixed(1) + " KB"
    });
  });

  renderSavedFiles(groupId);
  saveAppState();
};

function renderSavedFiles(groupId) {
  const preview = document.getElementById(`file-preview-${groupId}`);
  if (!preview) return;

  preview.innerHTML = "";

  uploadsState[groupId].arquivos.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "inner-block";
    item.style.padding = "10px";
    item.innerHTML = `
      <p><strong>Arquivo:</strong> ${escapeHtml(file.nome)}</p>
      <p class="small"><strong>Tipo:</strong> ${escapeHtml(file.tipo)}</p>
      <p class="small"><strong>Tamanho:</strong> ${escapeHtml(file.tamanho)}</p>
      <button type="button" onclick="removeFile(${groupId}, ${index})">Remover arquivo</button>
    `;
    preview.appendChild(item);
  });
}

window.removeFile = function(groupId, index) {
  uploadsState[groupId].arquivos.splice(index, 1);
  renderSavedFiles(groupId);
  saveAppState();
};

function getGroupCriteriaScores(groupId) {
  return Array.from(document.querySelectorAll(`.score-input[data-group="${groupId}"]`))
    .map(input => Number(input.value))
    .filter(value => !Number.isNaN(value));
}

function getGroupMean(groupId) {
  const values = getGroupCriteriaScores(groupId);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildChart() {
  const ctx = document.getElementById("chart");
  if (!ctx) return;

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

window.updateAnalytics = function() {
  const means = [1, 2, 3, 4].map(groupId => getGroupMean(groupId));

  [1, 2, 3, 4].forEach(groupId => {
    const meanBox = document.getElementById(`mean-${groupId}`);
    if (meanBox) {
      meanBox.textContent = getGroupMean(groupId).toFixed(2);
    }
  });

  if (chartInstance) {
    chartInstance.data.datasets[0].data = means;
    chartInstance.update();
  }

  updateTable();
};

function updateTable() {
  const tbody = document.getElementById("grade-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  [1, 2, 3, 4].forEach(groupId => {
    const area = AUDIT_DATABASE[groupId].area;
    const mediaGrupo = getGroupMean(groupId).toFixed(2);

    if (membersState[groupId].length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Grupo ${groupId}</td>
        <td>${escapeHtml(area)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td>${mediaGrupo}</td>
      `;
      tbody.appendChild(tr);
    } else {
      membersState[groupId].forEach(member => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>Grupo ${groupId}</td>
          <td>${escapeHtml(area)}</td>
          <td>${escapeHtml(member.nome)}</td>
          <td>${escapeHtml(member.nota)}</td>
          <td>${escapeHtml(member.obs)}</td>
          <td>${mediaGrupo}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  });
}

window.exportExcel = function() {
  let csv = "Grupo;Área;Integrante;Nota;Observação;Média do Grupo\n";

  document.querySelectorAll("#grade-body tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    const values = Array.from(cols).map(td => `"${td.innerText.replaceAll('"', '""')}"`);
    csv += values.join(";") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "avaliacao_mmii.csv";
  link.click();
};

window.gerarPDF = async function() {
  const element = document.getElementById("app-root");
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    scrollY: -window.scrollY
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
  heightLeft -= usableHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
  }

  pdf.save("avaliacao_mmii.pdf");
};

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

function bootstrap() {
  loadAppState();
  buildCards();
  buildArticles();
  buildAudit();
  bindUploadEvents();
  restoreCriteriaValues();

  [1, 2, 3, 4].forEach(groupId => {
    renderMembers(groupId);
    renderSavedPhotos(groupId);
    renderSavedFiles(groupId);
  });

  buildChart();
  updateTable();
  updateAnalytics();
}

bootstrap();
registerSW();
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredPrompt = event;

  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.style.display = "inline-flex";
  }
});

const installBtn = document.getElementById("installAppBtn");

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    installBtn.style.display = "none";
  });
}
