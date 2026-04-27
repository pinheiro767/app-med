import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SEMANAS, CRITERIOS_GERAIS } from "./database.js";

const supabaseUrl = "https://sygawhmxmuhbeinapqlj.supabase.co";
const supabaseKey = "sb_publishable_WBtluEOS7AlQqAylTlOnuQ_v-2W2KHJ";
const supabase = createClient(supabaseUrl, supabaseKey);

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

function interpretarChave(chave) {
  const partes = chave.split("_");

  return {
    semana: partes[0],
    turma: partes[1],
    grupo: partes[2],
    criterioIndex: Number(partes[3].replace("C", "")),
    avaliadora: partes[4]
  };
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function normalizarNota(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  let n = Number(valor);
  if (!Number.isFinite(n)) return "";
  if (n < 0) n = 0;
  if (n > 0.1) n = 0.1;
  return Number(n.toFixed(2));
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

function formatarCriterio(criterio) {
  return escapeHtml(criterio)
    .replace(" A. ", "<br><span>A. ")
    .replace(" B. ", "</span><br><span>B. ") + "</span>";
}

/* ==============================
   FOTOS COM INDEXEDDB
================================*/

const FOTO_DB = "avaliacao_anatomia_fotos";
const FOTO_STORE = "fotos";

function abrirBancoFotos() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FOTO_DB, 1);

    request.onupgradeneeded = function(event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(FOTO_STORE)) {
        db.createObjectStore(FOTO_STORE, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };

    request.onerror = function() {
      reject(request.error);
    };
  });
}

window.uploadFotoIndexedDB = async function(event, grupo) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const db = await abrirBancoFotos();
  const tx = db.transaction(FOTO_STORE, "readwrite");
  const store = tx.objectStore(FOTO_STORE);

  files.forEach(file => {
    if (!file.type.startsWith("image/")) return;

    store.add({
      grupo,
      nome: file.name,
      tipo: file.type,
      data: new Date().toISOString(),
      arquivo: file
    });
  });

  tx.oncomplete = () => {
    alert("Foto(s) salva(s) no aparelho.");
    listarFotosIndexedDB(grupo);
  };
};

window.listarFotosIndexedDB = async function(grupo) {
  const db = await abrirBancoFotos();
  const tx = db.transaction(FOTO_STORE, "readonly");
  const store = tx.objectStore(FOTO_STORE);
  const request = store.getAll();

  request.onsuccess = function() {
    const galeria = document.getElementById("fotosIndexedDB");
    if (!galeria) return;

    galeria.innerHTML = "";

    request.result
      .filter(foto => foto.grupo === grupo)
      .forEach(foto => {
        const url = URL.createObjectURL(foto.arquivo);

        const figure = document.createElement("figure");
        figure.innerHTML = `
          <img src="${url}" alt="${escapeHtml(foto.nome)}">
          <figcaption>${escapeHtml(foto.nome)}</figcaption>
        `;

        galeria.appendChild(figure);
      });
  };
};

window.limparFotosIndexedDB = async function(grupo) {
  const db = await abrirBancoFotos();
  const tx = db.transaction(FOTO_STORE, "readwrite");
  const store = tx.objectStore(FOTO_STORE);
  const request = store.getAll();

  request.onsuccess = function() {
    request.result.forEach(foto => {
      if (foto.grupo === grupo) {
        store.delete(foto.id);
      }
    });

    alert("Fotos removidas deste registro.");
    listarFotosIndexedDB(grupo);
  };
};

/* ==============================
   SUPABASE
================================*/

async function salvarNotaSupabase(chave, valor) {
  const nota = normalizarNota(valor);
  if (nota === "") return;

  const dados = interpretarChave(chave);
  const criterio = CRITERIOS_GERAIS[dados.criterioIndex] || `Critério ${dados.criterioIndex + 1}`;

  const registro = {
    semana: dados.semana,
    turma: dados.turma,
    grupo: dados.grupo,
    aluno: "",
    criterio,
    avaliadora: dados.avaliadora,
    nota
  };

  const { data, error: buscaErro } = await supabase
    .from("avaliacoes")
    .select("id")
    .match({
      semana: registro.semana,
      turma: registro.turma,
      grupo: registro.grupo,
      criterio: registro.criterio,
      avaliadora: registro.avaliadora
    })
    .limit(1);

  if (buscaErro) {
    console.error("Erro ao buscar nota no Supabase:", buscaErro);
    return;
  }

  if (data && data.length > 0) {
    const { error } = await supabase
      .from("avaliacoes")
      .update({ nota: registro.nota })
      .eq("id", data[0].id);

    if (error) {
      console.error("Erro ao atualizar nota:", error);
    }
  } else {
    const { error } = await supabase
      .from("avaliacoes")
      .insert(registro);

    if (error) {
      console.error("Erro ao inserir nota:", error);
    }
  }
}

/* ==============================
   SALVAR NOTAS
================================*/

window.salvarNota = function(chave, valor) {
  const nota = normalizarNota(valor);

  if (nota === "") {
    delete state[chave];
  } else {
    state[chave] = nota;
  }

  salvar();
  salvarNotaSupabase(chave, nota);
  updateAnalytics();
};

/* ==============================
   RESULTADOS
================================*/

function coletarResultados() {
  const resultados = [];

  Object.entries(state).forEach(([chave, valor]) => {
    if (!chave.includes("_G")) return;
    if (chave.startsWith("uploads_")) return;

    const info = interpretarChave(chave);

    resultados.push({
      semana: info.semana,
      turma: info.turma,
      grupo: info.grupo,
      criterio: info.criterioIndex,
      avaliadora: info.avaliadora,
      nota: numero(valor),
      media: numero(valor)
    });
  });

  return resultados;
}

/* ==============================
   ANALYTICS
================================*/

window.updateAnalytics = function() {
  const linhas = coletarResultados();
  const medias = linhas.map(l => l.media).filter(v => v > 0);

  const campoMedia = document.getElementById("mediaGeral");
  const campoMediana = document.getElementById("medianaGeral");
  const campoDesvio = document.getElementById("desvioPadrao");

  if (campoMedia) campoMedia.textContent = media(medias).toFixed(2);
  if (campoMediana) campoMediana.textContent = mediana(medias).toFixed(2);
  if (campoDesvio) campoDesvio.textContent = desvioPadrao(medias).toFixed(2);

  renderTabelaResultados(linhas);
  renderGrafico(linhas);
};

/* ==============================
   RENDER TABELA
================================*/

function renderTabelaResultados(linhas) {
  const tbody = document.getElementById("resultsBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  linhas.forEach(l => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(l.semana)}</td>
      <td>${escapeHtml(l.turma)}</td>
      <td>${escapeHtml(l.grupo)}</td>
      <td>${escapeHtml(l.avaliadora)}</td>
      <td>${escapeHtml(l.nota.toFixed(2))}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* ==============================
   GRÁFICO
================================*/

function renderGrafico(linhas) {
  const ctx = document.getElementById("chartGrupos");
  if (!ctx) return;

  const labels = linhas.map(l => `${l.semana}-${l.grupo}`);
  const dados = linhas.map(l => l.nota);

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Notas por critério",
        data: dados
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 0.1
        }
      }
    }
  });
}

/* ==============================
   EXPORTAÇÃO JSON
================================*/

window.exportarAvaliacaoJSON = function() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "avaliacao_anatomia.json";
  a.click();
};

/* ==============================
   IMPORTAÇÃO JSON
================================*/

window.importarAvaliacaoJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);

      state = dados;
      salvar();

      alert("Avaliação importada com sucesso.");

      updateAnalytics();
    } catch {
      alert("Erro ao importar. Verifique se o arquivo é um JSON válido exportado pelo app.");
    }
  };

  reader.readAsText(file);
};

/* ==============================
   IMAGENS GRUPO 4
================================*/

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
        src="/static/imagens/grupo4/${escapeHtml(img)}"
        class="modal-img"
        id="modalImg"
        alt="Imagem ${escapeHtml(numero)}"
      >

      <p class="modal-caption">Imagem ${escapeHtml(numero)} — ${escapeHtml(img)}</p>
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

/* ==============================
   RENDER SEMANAS E GRUPOS
================================*/

function renderSemanas() {
  const container = document.getElementById("weekCards");
  if (!container) return;

  container.innerHTML = "";

  Object.entries(SEMANAS).forEach(([semanaId, semana]) => {
    const card = document.createElement("div");
    card.className = "card";

    let html = `
      <span class="badge">${escapeHtml(semana.titulo)}</span>
      <p>${escapeHtml(semana.descricao)}</p>
    `;

    Object.entries(semana.turmas).forEach(([turmaId, turma]) => {
      html += `<div class="group-content"><h3>${escapeHtml(turma.titulo)}</h3>`;

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
  if (!area) return;

  area.innerHTML = `
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

      <details class="accordion" open>
        <summary>O que o grupo deve fazer</summary>
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
        <summary>O que observar na avaliação</summary>
        <ul>
          ${grupo.observar.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </details>

      ${grupo.imagens ? renderGaleriaGrupo4(grupo.imagens) : ""}

      <details class="accordion" open>
        <summary>Avaliação</summary>

        <p>
          Cada critério vale de <strong>0 até 0,1</strong>.
        </p>

        ${CRITERIOS_GERAIS.map((criterio, index) => {
          const kCarmem = key(semanaId, turmaId, grupoId, index, "carmem");
          const kClaudia = key(semanaId, turmaId, grupoId, index, "claudia");

          return `
            <div class="evaluation-grid">
              <strong>${formatarCriterio(criterio)}</strong>

              <label>
                Carmem
                <input type="number" min="0" max="0.1" step="0.01"
                  value="${escapeHtml(state[kCarmem] ?? "")}"
                  oninput="salvarNota('${kCarmem}', this.value)">
              </label>

              <label>
                Cláudia
                <input type="number" min="0" max="0.1" step="0.01"
                  value="${escapeHtml(state[kClaudia] ?? "")}"
                  oninput="salvarNota('${kClaudia}', this.value)">
              </label>
            </div>
          `;
        }).join("")}
      </details>
    </div>
  `;

  area.scrollIntoView({ behavior: "smooth" });
};

function renderGaleriaGrupo4(imagens) {
  return `
    <details class="accordion" open>
      <summary>Imagens do Grupo 4 — Anatomia Radiológica</summary>
      <div class="gallery">
        ${imagens.map((img, index) => `
          <figure class="image-card" onclick="abrirImagemGrupo4('${escapeHtml(img)}', ${index + 1})">
            <img src="/static/imagens/grupo4/${escapeHtml(img)}" alt="Imagem ${index + 1}">
            <figcaption>Imagem ${index + 1} — ${escapeHtml(img)}</figcaption>
          </figure>
        `).join("")}
      </div>
    </details>
  `;
}

/* ==============================
   PWA
================================*/

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
    if (!deferredPrompt) {
      alert("O navegador ainda não liberou a instalação. Tente abrir pelo Chrome e recarregar a página.");
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    btn.style.display = "none";
  });
}

function registrarPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  }
}

/* ==============================
   INICIAR APP
================================*/

renderSemanas();
updateAnalytics();
configurarInstalacao();
registrarPWA();
