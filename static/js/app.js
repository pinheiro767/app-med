import { SEMANAS, CRITERIOS_GERAIS } from "./database.js";
import { correlacaoPearson } from "./correlacao.js";

const STORAGE_KEY = "avaliacao_anatomia_pwa_v3";

let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let chart = null;
let zoomAtual = 1;
let grupoAbertoAtual = null;

function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function key(semana, turma, grupo, criterio, avaliadora) {
  return `${semana}_${turma}_G${grupo}_C${criterio}_${avaliadora}`;
}

function uploadKey(semanaId, turmaId, grupoId) {
  return `uploads_${semanaId}_${turmaId}_${grupoId}`;
}

function getUploads(semanaId, turmaId, grupoId) {
  return state[uploadKey(semanaId, turmaId, grupoId)] || { fotos: [], arquivos: [] };
}

function setUploads(semanaId, turmaId, grupoId, dados) {
  state[uploadKey(semanaId, turmaId, grupoId)] = dados;
  salvar();
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function media(valores) {
  const nums = valores.map(numero).filter(v => v > 0);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mediana(valores) {
  const nums = valores.map(numero).filter(v => v > 0).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const meio = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[meio] : (nums[meio - 1] + nums[meio]) / 2;
}

function desvioPadrao(valores) {
  const nums = valores.map(numero).filter(v => v > 0);
  if (nums.length < 2) return 0;
  const m = media(nums);
  const variancia = nums.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (nums.length - 1);
  return Math.sqrt(variancia);
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSemanas() {
  const container = document.getElementById("weekCards");
  container.innerHTML = "";

  Object.entries(SEMANAS).forEach(([semanaId, semana]) => {
    const card = document.createElement("div");
    card.className = "card";

    let html = `
      <span class="badge">${escapeHtml(semana.titulo)}</span>
      <p>${escapeHtml(semana.descricao)}</p>
    `;

    Object.entries(semana.turmas).forEach(([turmaId, turma]) => {
      html += `
        <div class="group-content">
          <h3>${escapeHtml(turma.titulo)}</h3>
      `;

      Object.entries(turma.grupos).forEach(([grupoId]) => {
        html += `
          <button class="secondary" onclick="abrirGrupo('${semanaId}', '${turmaId}', '${grupoId}')">
            Grupo ${grupoId}
          </button>
        `;
      });

      html += `</div>`;
    });

    card.innerHTML = html;
    container.appendChild(card);
  });
}

window.abrirGrupo = function(semanaId, turmaId, grupoId) {
  grupoAbertoAtual = { semanaId, turmaId, grupoId };

  const grupo = SEMANAS[semanaId].turmas[turmaId].grupos[grupoId];
  const area = document.getElementById("evaluationArea");

  const html = `
    <div class="card">
      <span class="badge">${escapeHtml(SEMANAS[semanaId].titulo)}</span>
      <h2>${escapeHtml(grupo.titulo)}</h2>
      <p><strong>${escapeHtml(SEMANAS[semanaId].turmas[turmaId].titulo)}</strong></p>

      <details class="accordion">
        <summary>Alunos responsáveis</summary>
        <ul class="student-list">
          ${grupo.alunos.map(a => `<li>${escapeHtml(a)}</li>`).join("")}
        </ul>
      </details>

      <details class="accordion">
        <summary>Conteúdo do grupo</summary>
        ${grupo.conteudo.map(secao => `
          <div class="group-content">
            <h3>${escapeHtml(secao.titulo)}</h3>
            <ul>
              ${secao.itens.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </details>

      <details class="accordion">
        <summary>O que observar durante a avaliação</summary>
        <ul>
          ${grupo.observar.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </details>

      ${grupo.imagens ? renderGaleriaGrupo4(grupo.imagens) : ""}

      <details class="accordion">
        <summary>Perguntas automáticas</summary>
        <div class="button-group">
          <button onclick="gerarPergunta('${semanaId}', '${turmaId}', '${grupoId}', 'Básica')">Pergunta básica</button>
          <button onclick="gerarPergunta('${semanaId}', '${turmaId}', '${grupoId}', 'Intermediária')">Pergunta intermediária</button>
          <button onclick="gerarPergunta('${semanaId}', '${turmaId}', '${grupoId}', 'Clínica')">Pergunta clínica</button>
        </div>

        <div id="questionBox" class="question-box">
          Clique em um botão para gerar uma pergunta.
        </div>
      </details>

      <details class="accordion">
        <summary>Avaliação — Profª Drª Carmem Patrícia Barbosa e Profª Drª Cláudia Pinheiro</summary>
        ${renderTabelaAvaliacao(semanaId, turmaId, grupoId)}
      </details>

      <details class="accordion">
        <summary>Fotos e arquivos do grupo</summary>
        ${renderMidiasGrupo(semanaId, turmaId, grupoId)}
      </details>

      <details class="accordion">
        <summary>Observações finais</summary>
        <textarea id="obs-${semanaId}-${turmaId}-${grupoId}" rows="4" placeholder="Registre observações sobre o grupo.">${escapeHtml(state[`obs-${semanaId}-${turmaId}-${grupoId}`] || "")}</textarea>

        <div style="margin-top:14px;">
          <button onclick="salvarObservacao('${semanaId}', '${turmaId}', '${grupoId}')">Salvar avaliação</button>
          <button class="secondary" onclick="updateAnalytics()">Atualizar estatísticas</button>
        </div>
      </details>
    </div>
  `;

  area.innerHTML = html;
  window.scrollTo({ top: area.offsetTop - 20, behavior: "smooth" });
};

function renderGaleriaGrupo4(imagens) {
  return `
    <details class="accordion">
      <summary>Imagens do Grupo 4 — Anatomia Radiológica</summary>
      <div class="gallery">
        ${imagens.map((img, index) => `
          <figure class="image-card" onclick="abrirImagemGrupo4('${img}', ${index + 1})">
            <img src="/static/imagens/grupo4/${img}" alt="Imagem ${index + 1}">
            <figcaption>Imagem ${index + 1} — ${img}</figcaption>
          </figure>
        `).join("")}
      </div>
    </details>
  `;
}

function renderTabelaAvaliacao(semanaId, turmaId, grupoId) {
  return `
    <div class="group-content">
      ${CRITERIOS_GERAIS.map((criterio, index) => {
        const kCarmem = key(semanaId, turmaId, grupoId, index, "carmem");
        const kClaudia = key(semanaId, turmaId, grupoId, index, "claudia");

        const notaCarmem = state[kCarmem] || "";
        const notaClaudia = state[kClaudia] || "";
        const m = media([notaCarmem, notaClaudia]).toFixed(2);

        return `
          <div class="evaluation-grid">
            <div>
              <strong>${index + 1}. ${escapeHtml(criterio)}</strong>
            </div>

            <label>
              Carmem
              <input type="number" min="0" max="10" step="0.1"
                value="${escapeHtml(notaCarmem)}"
                oninput="salvarNota('${kCarmem}', this.value)">
            </label>

            <label>
              Cláudia
              <input type="number" min="0" max="10" step="0.1"
                value="${escapeHtml(notaClaudia)}"
                oninput="salvarNota('${kClaudia}', this.value)">
            </label>

            <div class="media-box">${m}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderMidiasGrupo(semanaId, turmaId, grupoId) {
  const uploads = getUploads(semanaId, turmaId, grupoId);

  return `
    <div class="group-content">
      <h3>Fotos do trabalho físico</h3>

      <label class="file-label">
        Tirar foto / anexar fotos
        <input 
         type="file" 
         accept="image/*" 
         capture="environment" 
         multiple
         onchange="salvarFotosGrupo('${semanaId}', '${turmaId}', '${grupoId}', this.files)"
        >
      </label>
      <div class="gallery">
        ${uploads.fotos.map((foto, index) => `
          <figure>
            <img src="${foto.dados}" alt="${escapeHtml(foto.nome)}">
            <figcaption>${escapeHtml(foto.nome)}</figcaption>
            <button onclick="removerFotoGrupo('${semanaId}', '${turmaId}', '${grupoId}', ${index})">Remover</button>
          </figure>
        `).join("")}
      </div>

      <h3>Arquivos complementares</h3>

      <label class="file-label">
        Anexar PDF, Excel, Word ou imagem
        <input 
          type="file" 
          multiple
          onchange="salvarArquivosGrupo('${semanaId}', '${turmaId}', '${grupoId}', this.files)"
        >
      </label>

      <div class="file-list">
        ${uploads.arquivos.map((arquivo, index) => `
          <div class="file-card">
            <strong>${escapeHtml(arquivo.nome)}</strong>
            <span>${escapeHtml(arquivo.tipo)} · ${escapeHtml(arquivo.tamanho)}</span>
            <div>
              <a href="${arquivo.dados}" download="${escapeHtml(arquivo.nome)}">Baixar</a>
              <button onclick="removerArquivoGrupo('${semanaId}', '${turmaId}', '${grupoId}', ${index})">Remover</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

window.salvarFotosGrupo = function(semanaId, turmaId, grupoId, files) {
  const uploads = getUploads(semanaId, turmaId, grupoId);

  Array.from(files || []).forEach(file => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();

    reader.onload = event => {
      uploads.fotos.push({
        nome: file.name,
        tipo: file.type,
        tamanho: (file.size / 1024).toFixed(1) + " KB",
        dados: event.target.result
      });

      setUploads(semanaId, turmaId, grupoId, uploads);
      abrirGrupo(semanaId, turmaId, grupoId);
    };

    reader.readAsDataURL(file);
  });
};

window.salvarArquivosGrupo = function(semanaId, turmaId, grupoId, files) {
  const uploads = getUploads(semanaId, turmaId, grupoId);

  Array.from(files || []).forEach(file => {
    const reader = new FileReader();

    reader.onload = event => {
      uploads.arquivos.push({
        nome: file.name,
        tipo: file.type || "arquivo",
        tamanho: (file.size / 1024).toFixed(1) + " KB",
        dados: event.target.result
      });

      setUploads(semanaId, turmaId, grupoId, uploads);
      abrirGrupo(semanaId, turmaId, grupoId);
    };

    reader.readAsDataURL(file);
  });
};

window.removerFotoGrupo = function(semanaId, turmaId, grupoId, index) {
  const uploads = getUploads(semanaId, turmaId, grupoId);
  uploads.fotos.splice(index, 1);
  setUploads(semanaId, turmaId, grupoId, uploads);
  abrirGrupo(semanaId, turmaId, grupoId);
};

window.removerArquivoGrupo = function(semanaId, turmaId, grupoId, index) {
  const uploads = getUploads(semanaId, turmaId, grupoId);
  uploads.arquivos.splice(index, 1);
  setUploads(semanaId, turmaId, grupoId, uploads);
  abrirGrupo(semanaId, turmaId, grupoId);
};

window.salvarNota = function(chave, valor) {
  state[chave] = valor;
  salvar();
  updateAnalytics();
};

window.salvarObservacao = function(semanaId, turmaId, grupoId) {
  const id = `obs-${semanaId}-${turmaId}-${grupoId}`;
  const campo = document.getElementById(id);
  state[id] = campo.value;
  salvar();
  alert("Avaliação salva.");
};

window.gerarPergunta = function(semanaId, turmaId, grupoId, nivel) {
  const grupo = SEMANAS[semanaId].turmas[turmaId].grupos[grupoId];
  const perguntas = grupo.perguntas.filter(p => p.nivel === nivel);

  if (!perguntas.length) return;

  const sorteada = perguntas[Math.floor(Math.random() * perguntas.length)];

  document.getElementById("questionBox").innerHTML = `
    <strong>${escapeHtml(sorteada.nivel)}</strong>
    <p><strong>Pergunta:</strong> ${escapeHtml(sorteada.pergunta)}</p>
    <p><strong>Resposta esperada:</strong> ${escapeHtml(sorteada.respostaEsperada)}</p>
  `;
};

function coletarResultados() {
  const linhas = [];

  Object.entries(SEMANAS).forEach(([semanaId, semana]) => {
    Object.entries(semana.turmas).forEach(([turmaId, turma]) => {
      Object.entries(turma.grupos).forEach(([grupoId, grupo]) => {
        const mediasCriterios = CRITERIOS_GERAIS.map((criterio, index) => {
          const notaCarmem = numero(state[key(semanaId, turmaId, grupoId, index, "carmem")]);
          const notaClaudia = numero(state[key(semanaId, turmaId, grupoId, index, "claudia")]);
          return media([notaCarmem, notaClaudia]);
        }).filter(v => v > 0);

        const mediaFinalGrupo = media(mediasCriterios);

        grupo.alunos.forEach(aluno => {
          CRITERIOS_GERAIS.forEach((criterio, index) => {
            const notaCarmem = numero(state[key(semanaId, turmaId, grupoId, index, "carmem")]);
            const notaClaudia = numero(state[key(semanaId, turmaId, grupoId, index, "claudia")]);
            const mediaCriterio = media([notaCarmem, notaClaudia]);

            linhas.push({
              semana: semana.titulo,
              turma: turma.titulo,
              grupo: `Grupo ${grupoId}`,
              aluno,
              criterio,
              carmem: notaCarmem,
              claudia: notaClaudia,
              media: mediaCriterio,
              mediaFinalGrupo
            });
          });
        });
      });
    });
  });

  return linhas;
}

window.updateAnalytics = function() {
  const linhas = coletarResultados();
  const medias = linhas.map(l => l.media).filter(v => v > 0);

  document.getElementById("mediaGeral").textContent = media(medias).toFixed(2);
  document.getElementById("medianaGeral").textContent = mediana(medias).toFixed(2);
  document.getElementById("desvioPadrao").textContent = desvioPadrao(medias).toFixed(2);

  renderTabelaResultados(linhas);
  renderGrafico(linhas);
};

function renderTabelaResultados(linhas) {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  linhas.forEach(l => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(l.semana)}</td>
      <td>${escapeHtml(l.turma)}</td>
      <td>${escapeHtml(l.grupo)}</td>
      <td>${escapeHtml(l.aluno)}</td>
      <td>${escapeHtml(l.criterio)}</td>
      <td>${l.carmem.toFixed(1)}</td>
      <td>${l.claudia.toFixed(1)}</td>
      <td>${l.media.toFixed(2)}</td>
      <td>${l.mediaFinalGrupo.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGrafico(linhas) {
  const agrupado = {};

  linhas.forEach(l => {
    const chave = `${l.semana} · ${l.turma} · ${l.grupo}`;
    if (!agrupado[chave]) agrupado[chave] = [];
    if (l.media > 0) agrupado[chave].push(l.media);
  });

  const labels = Object.keys(agrupado);
  const dados = labels.map(label => media(agrupado[label]));

  const ctx = document.getElementById("chartGrupos");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Média final por grupo",
        data: dados
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 10 }
      }
    }
  });
}

window.exportCSV = function() {
  const linhas = coletarResultados();

  let csv = "Semana;Turma;Grupo;Aluno;Critério;Carmem;Cláudia;Média do Critério;Média Final do Grupo\n";

  linhas.forEach(l => {
    csv += `"${l.semana}";"${l.turma}";"${l.grupo}";"${l.aluno}";"${l.criterio}";"${l.carmem}";"${l.claudia}";"${l.media.toFixed(2)}";"${l.mediaFinalGrupo.toFixed(2)}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "avaliacao_anatomia_com_alunos.csv";
  link.click();
};

window.gerarPDF = async function() {
  const element = document.getElementById("app-root");

  const canvas = await html2canvas(element, {
    scale: 1.4,
    useCORS: true
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let position = margin;
  let heightLeft = imgHeight;

  pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save("relatorio_avaliacao_anatomia.pdf");
};

window.abrirImagemGrupo4 = function(img, numero) {
  const antigo = document.getElementById("imageModal");
  if (antigo) antigo.remove();

  zoomAtual = 1;

  const modal = document.createElement("div");
  modal.id = "imageModal";

  modal.innerHTML = `
    <div class="modal-bg" onclick="fecharImagemGrupo4()"></div>

    <div class="modal-content">
      <button class="modal-close" onclick="fecharImagemGrupo4()">×</button>

      <div class="zoom-toolbar">
        <button onclick="zoomImagemGrupo4(0.25)">+</button>
        <button onclick="zoomImagemGrupo4(-0.25)">−</button>
        <button onclick="resetZoomGrupo4()">Resetar</button>
      </div>

      <img
        src="/static/imagens/grupo4/${img}"
        class="modal-img"
        id="modalImg"
        alt="Imagem ${numero}"
      >

      <p class="modal-caption">Imagem ${numero} — ${img}</p>
    </div>
  `;

  document.body.appendChild(modal);
};

window.fecharImagemGrupo4 = function() {
  const modal = document.getElementById("imageModal");
  if (modal) modal.remove();
};

window.zoomImagemGrupo4 = function(valor) {
  const img = document.getElementById("modalImg");
  if (!img) return;

  zoomAtual = Math.max(0.5, Math.min(5, zoomAtual + valor));
  img.style.transform = `scale(${zoomAtual})`;
};

window.resetZoomGrupo4 = function() {
  const img = document.getElementById("modalImg");
  if (!img) return;

  zoomAtual = 1;
  img.style.transform = "scale(1)";
};

function registrarPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredPrompt = event;

  const btn = document.getElementById("installAppBtn");
  if (btn) btn.style.display = "inline-flex";
});

function configurarInstalacao() {
  const btn = document.getElementById("installAppBtn");

  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    btn.style.display = "none";
  });
}

window.exportarAvaliacaoJSON = function() {
  const dadosExportados = {
    app: "avaliacao_anatomia_pwa",
    versao: "1.0",
    dataExportacao: new Date().toISOString(),
    dados: state
  };

  const blob = new Blob(
    [JSON.stringify(dadosExportados, null, 2)],
    { type: "application/json" }
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);

  const data = new Date().toISOString().slice(0, 10);
  link.download = `avaliacao_anatomia_${data}.json`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
function resumirDadosImportados(dadosImportados) {
  const grupos = new Set();

  Object.keys(dadosImportados).forEach(chave => {
    const partes = chave.split("_");

    if (partes.length >= 4 && chave.includes("_G")) {
      const semana = partes[0];
      const turma = partes[1];
      const grupo = partes[2];

      grupos.add(`${semana} · ${turma} · ${grupo}`);
    }
  });

  if (!grupos.size) {
    return "Nenhum grupo identificado no arquivo.";
  }

  return Array.from(grupos).join("\n");
}

window.importarAvaliacaoJSON = function(event) {
  const file = event.target.files[0];

  if (!file) {
    alert("Nenhum arquivo selecionado.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const texto = e.target.result;

      if (!texto || texto.trim() === "") {
        alert("O arquivo está vazio.");
        return;
      }

      const arquivo = JSON.parse(texto);
      const dadosImportados = arquivo.dados || arquivo.state || arquivo;

      if (typeof dadosImportados !== "object" || dadosImportados === null) {
        alert("O arquivo não contém dados válidos de avaliação.");
        return;
      }

      state = {
        ...state,
        ...dadosImportados
      };

      salvar();
      updateAnalytics();

      if (grupoAbertoAtual) {
        abrirGrupo(
          grupoAbertoAtual.semanaId,
          grupoAbertoAtual.turmaId,
          grupoAbertoAtual.grupoId
        );
      }

      const resumo = resumirDadosImportados(dadosImportados);

alert(
  "Avaliação importada com sucesso.\n\nDados encontrados:\n" + resumo
);

      event.target.value = "";

    } catch (error) {
      console.error("Erro ao importar JSON:", error);
      alert("Erro ao importar. O arquivo precisa ser .json exportado pelo próprio app.");
    }
  };

  reader.readAsText(file, "UTF-8");
};

function calcularConcordancia(){

  const notasCarmem=[];
  const notasClaudia=[];

  state.avaliacoes.forEach(a=>{

    notasCarmem.push(a.carmem);
    notasClaudia.push(a.claudia);

  });

  const r=correlacaoPearson(notasCarmem,notasClaudia);

  document.getElementById("correlacao").innerText=r.toFixed(2);

}

renderSemanas();
updateAnalytics();
registrarPWA();
configurarInstalacao();
