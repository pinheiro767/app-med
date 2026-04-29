import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SEMANAS, CRITERIOS_GERAIS } from "./database.js";

const supabaseUrl = "https://sygawhmxmuhbeinapqlj.supabase.co";
const supabaseKey = "sb_publishable_WBtluEOS7AlQqAylTlOnuQ_v-2W2KHJ";
const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY = "avaliacao_anatomia_pwa_v3";

let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let chart = null;
let zoomAtual = 1;

function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function key(semana, turma, grupo, criterio, avaliadora) {
  return `${semana}_${turma}_G${grupo}_C${criterio}_${avaliadora}`;
}

function chaveEhNotaCriterio(chave) {
  return /^semana\d+_[^_]+_G\d+_C\d+_(carmem|claudia)$/.test(chave);
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
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizarNota(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";

  let n = Number(String(valor).replace(",", "."));

  if (!Number.isFinite(n)) return "";
  if (n < 0) n = 0;

  return Number(n.toFixed(2));
}

function normalizarNotaIndividual(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";

  let n = Number(String(valor).replace(",", "."));

  if (!Number.isFinite(n)) return "";
  if (n < 0) n = 0;

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

function correlacaoPearson(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y)) return 0;

  const pares = [];

  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const vx = Number(x[i]);
    const vy = Number(y[i]);

    if (Number.isFinite(vx) && Number.isFinite(vy)) {
      pares.push([vx, vy]);
    }
  }

  const n = pares.length;
  if (n < 2) return 0;

  let somaX = 0;
  let somaY = 0;
  let somaXY = 0;
  let somaX2 = 0;
  let somaY2 = 0;

  pares.forEach(([vx, vy]) => {
    somaX += vx;
    somaY += vy;
    somaXY += vx * vy;
    somaX2 += vx * vx;
    somaY2 += vy * vy;
  });

  const numerador = n * somaXY - somaX * somaY;

  const denominador = Math.sqrt(
    (n * somaX2 - somaX * somaX) *
    (n * somaY2 - somaY * somaY)
  );

  if (!Number.isFinite(denominador) || denominador === 0) return 0;

  const r = numerador / denominador;

  return Number.isFinite(r) ? Number(r.toFixed(4)) : 0;
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

function nomeAvaliadora(codigo) {
  if (codigo === "carmem") return "Profª Drª Carmem Patrícia Barbosa";
  if (codigo === "claudia") return "Profª Drª Cláudia Pinheiro";
  return codigo;
}

function nomeSemana(id) {
  return SEMANAS[id]?.titulo || id;
}

function nomeTurma(semanaId, turmaId) {
  return SEMANAS[semanaId]?.turmas?.[turmaId]?.titulo || turmaId;
}

function nomeGrupo(semanaId, turmaId, grupoId) {
  return SEMANAS[semanaId]?.turmas?.[turmaId]?.grupos?.[String(grupoId).replace("G", "")]?.titulo || grupoId;
}

function alunosGrupo(semanaId, turmaId, grupoId) {
  const id = String(grupoId).replace("G", "");
  return SEMANAS[semanaId]?.turmas?.[turmaId]?.grupos?.[id]?.alunos || [];
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

    const fotos = request.result.filter(foto => foto.grupo === grupo);

    if (!fotos.length) {
      galeria.innerHTML = `<p>Nenhuma foto anexada ainda para este grupo.</p>`;
      return;
    }

    fotos.forEach(foto => {
      const url = URL.createObjectURL(foto.arquivo);

      const figure = document.createElement("figure");
      figure.className = "image-card";
      figure.innerHTML = `
        <img src="${url}" alt="${escapeHtml(foto.nome)}">
        <figcaption>${escapeHtml(foto.nome)}</figcaption>
      `;

      galeria.appendChild(figure);
    });
  };
};

window.limparFotosIndexedDB = async function(grupo) {
  const confirmar = confirm("Tem certeza que deseja remover as fotos anexadas deste grupo?");
  if (!confirmar) return;

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
  if (!chaveEhNotaCriterio(chave)) return;

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

    if (error) console.error("Erro ao atualizar nota:", error);
  } else {
    const { error } = await supabase
      .from("avaliacoes")
      .insert(registro);

    if (error) console.error("Erro ao inserir nota:", error);
  }
}

/* ==============================
   SALVAR NOTAS E CAMPOS
================================*/

window.salvarNota = function(chave, valor, input = null) {
  if (valor === "" || valor === null || valor === undefined) {
    delete state[chave];
    salvar();
    updateAnalytics();
    return;
  }

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

window.salvarCampo = function(chave, valor) {
  state[chave] = valor;
  salvar();
};

window.salvarNotaIndividual = function(chave, valor, input = null) {
  if (valor === "" || valor === null || valor === undefined) {
    delete state[chave];
    salvar();
    return;
  }

  const nota = normalizarNotaIndividual(valor);

  if (nota === "") {
    delete state[chave];
  } else {
    state[chave] = nota;
  }

  salvar();
};

window.carregarComentarioGrupo = function(semanaId, turmaId, grupoId) {
  return state[`${semanaId}_${turmaId}_G${grupoId}_comentarioGrupo`] || "";
};

window.salvarComentarioGrupo = function(semanaId, turmaId, grupoId, valor) {
  state[`${semanaId}_${turmaId}_G${grupoId}_comentarioGrupo`] = valor;
  salvar();
};

/* ==============================
   RESULTADOS
================================*/

function coletarResultados() {
  const resultados = [];

  Object.entries(state).forEach(([chave, valor]) => {
    if (!chaveEhNotaCriterio(chave)) return;

    const info = interpretarChave(chave);
    const criterioTexto = CRITERIOS_GERAIS[info.criterioIndex] || `Critério ${info.criterioIndex + 1}`;
    const alunos = alunosGrupo(info.semana, info.turma, info.grupo);

    alunos.forEach(aluno => {
      resultados.push({
        chave,
        semana: info.semana,
        semanaTitulo: nomeSemana(info.semana),
        turma: info.turma,
        turmaTitulo: nomeTurma(info.semana, info.turma),
        grupo: info.grupo,
        grupoTitulo: nomeGrupo(info.semana, info.turma, info.grupo),
        aluno,
        criterio: info.criterioIndex,
        criterioTexto,
        avaliadora: info.avaliadora,
        avaliadoraNome: nomeAvaliadora(info.avaliadora),
        nota: numero(valor),
        media: numero(valor)
      });
    });
  });

  return resultados;
}

function coletarResultadosPorGrupo() {
  const resultados = [];

  Object.entries(state).forEach(([chave, valor]) => {
    if (!chaveEhNotaCriterio(chave)) return;

    const info = interpretarChave(chave);
    const criterioTexto = CRITERIOS_GERAIS[info.criterioIndex] || `Critério ${info.criterioIndex + 1}`;

    resultados.push({
      chave,
      semana: info.semana,
      semanaTitulo: nomeSemana(info.semana),
      turma: info.turma,
      turmaTitulo: nomeTurma(info.semana, info.turma),
      grupo: info.grupo,
      grupoTitulo: nomeGrupo(info.semana, info.turma, info.grupo),
      criterio: info.criterioIndex,
      criterioTexto,
      avaliadora: info.avaliadora,
      avaliadoraNome: nomeAvaliadora(info.avaliadora),
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
  const linhasGrupo = coletarResultadosPorGrupo();
  const linhasAlunos = coletarResultados();
  const medias = linhasGrupo.map(l => l.media).filter(v => v > 0);

  const campoMedia = document.getElementById("mediaGeral");
  const campoMediana = document.getElementById("medianaGeral");
  const campoDesvio = document.getElementById("desvioPadrao");
  const campoCorrelacao = document.getElementById("correlacao");

  if (campoMedia) campoMedia.textContent = media(medias).toFixed(2);
  if (campoMediana) campoMediana.textContent = mediana(medias).toFixed(2);
  if (campoDesvio) campoDesvio.textContent = desvioPadrao(medias).toFixed(2);

  const notasCarmem = [];
  const notasClaudia = [];

  linhasGrupo.forEach(linha => {
    if (linha.avaliadora === "carmem") {
      const par = linhasGrupo.find(item =>
        item.semana === linha.semana &&
        item.turma === linha.turma &&
        item.grupo === linha.grupo &&
        item.criterio === linha.criterio &&
        item.avaliadora === "claudia"
      );

      if (par) {
        notasCarmem.push(linha.nota);
        notasClaudia.push(par.nota);
      }
    }
  });

  if (campoCorrelacao) {
    campoCorrelacao.textContent = correlacaoPearson(notasCarmem, notasClaudia).toFixed(2);
  }

  renderTabelaResultados(linhasAlunos);
  renderGrafico(linhasGrupo);
};

/* ==============================
   TABELAS
================================*/

function renderTabelaResultados(linhas) {
  const thead = document.getElementById("resultsHead");
  const tbody = document.getElementById("resultsBody");
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>Semana</th>
      <th>Turma</th>
      <th>Grupo</th>
      <th>Aluno</th>
      <th>Critério</th>
      <th>Avaliadora</th>
      <th>Nota</th>
    </tr>
  `;

  tbody.innerHTML = "";

  linhas.forEach(l => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(l.semanaTitulo)}</td>
      <td>${escapeHtml(l.turmaTitulo)}</td>
      <td>${escapeHtml(l.grupoTitulo)}</td>
      <td>${escapeHtml(l.aluno)}</td>
      <td>${escapeHtml(l.criterioTexto)}</td>
      <td>${escapeHtml(l.avaliadoraNome)}</td>
      <td>${escapeHtml(l.nota.toFixed(2))}</td>
    `;

    tbody.appendChild(tr);
  });
}

window.mostrarDetalhesAlunos = function() {
  renderTabelaResultados(coletarResultados());
};

window.mostrarResumoGrupos = function() {
  const linhasGrupo = coletarResultadosPorGrupo();
  const mapa = {};

  linhasGrupo.forEach(l => {
    const id = `${l.semana}_${l.turma}_${l.grupo}`;

    if (!mapa[id]) {
      mapa[id] = {
        semanaTitulo: l.semanaTitulo,
        turmaTitulo: l.turmaTitulo,
        grupoTitulo: l.grupoTitulo,
        alunos: alunosGrupo(l.semana, l.turma, l.grupo),
        notas: []
      };
    }

    mapa[id].notas.push(l.nota);
  });

  const resumo = Object.values(mapa).map(item => ({
    ...item,
    media: media(item.notas),
    total: item.notas.reduce((a, b) => a + b, 0)
  }));

  const thead = document.getElementById("resultsHead");
  const tbody = document.getElementById("resultsBody");
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>Semana</th>
      <th>Turma</th>
      <th>Grupo</th>
      <th>Aluno</th>
      <th>Média</th>
      <th>Total lançado</th>
    </tr>
  `;

  tbody.innerHTML = "";

  resumo.forEach(r => {
    r.alunos.forEach(aluno => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(r.semanaTitulo)}</td>
        <td>${escapeHtml(r.turmaTitulo)}</td>
        <td>${escapeHtml(r.grupoTitulo)}</td>
        <td>${escapeHtml(aluno)}</td>
        <td>${escapeHtml(r.media.toFixed(2))}</td>
        <td>${escapeHtml(r.total.toFixed(2))}</td>
      `;

      tbody.appendChild(tr);
    });
  });
};

/* ==============================
   GRÁFICO
================================*/

function renderGrafico(linhas) {
  const ctx = document.getElementById("chartGrupos");
  if (!ctx) return;

  const labels = linhas.map(l => `${l.grupo.replace("G", "Grupo ")} - ${l.avaliadoraNome.split(" ").pop()}`);
  const dados = linhas.map(l => l.nota);

  if (chart) chart.destroy();

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
          suggestedMax: 1
        }
      }
    }
  });
}

/* ==============================
   EXPORTAÇÕES GERAIS
================================*/

window.exportarAvaliacaoJSON = function() {
  const dadosExportados = coletarResultados().map(item => ({
    chave: item.chave,
    semanaId: item.semana,
    turmaId: item.turma,
    grupoId: item.grupo,
    criterioIndex: item.criterio,
    avaliadoraCodigo: item.avaliadora,
    semana: item.semanaTitulo,
    turma: item.turmaTitulo,
    grupo: item.grupoTitulo,
    aluno: item.aluno,
    criterio: item.criterioTexto,
    avaliadora: item.avaliadoraNome,
    nota: item.nota
  }));

  const blob = new Blob([JSON.stringify(dadosExportados, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "avaliacao_anatomia_alunos_individualizados.json";
  a.click();

  URL.revokeObjectURL(url);
};

window.exportCSV = function() {
  const linhas = coletarResultados();

  const cabecalho = [
    "Semana",
    "Turma",
    "Grupo",
    "Aluno",
    "Critério",
    "Avaliadora",
    "Nota"
  ];

  const csv = [
    cabecalho.join(";"),
    ...linhas.map(l => [
      l.semanaTitulo,
      l.turmaTitulo,
      l.grupoTitulo,
      l.aluno,
      l.criterioTexto,
      l.avaliadoraNome,
      l.nota.toFixed(2).replace(".", ",")
    ].map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "avaliacao_anatomia_alunos_individualizados.csv";
  a.click();

  URL.revokeObjectURL(url);
};

window.gerarPDF = async function() {
  const area = document.getElementById("app-root");

  if (!area || !window.jspdf || !window.html2canvas) {
    alert("Não foi possível gerar PDF. Verifique se jsPDF e html2canvas carregaram.");
    return;
  }

  const canvas = await html2canvas(area, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save("avaliacao_anatomia.pdf");
};

/* ==============================
   EXPORTAÇÃO POR GRUPO
================================*/

window.exportarGrupoCSV = function(semanaId, turmaId, grupoId) {
  const grupo = SEMANAS[semanaId].turmas[turmaId].grupos[grupoId];
  if (!grupo) return;

  const linhas = [];

  linhas.push([
    "Semana",
    "Turma",
    "Grupo",
    "Aluno",
    "Nota individual",
    "Comentário individual",
    "Comentário geral do grupo"
  ]);

  const comentarioGrupo = carregarComentarioGrupo(semanaId, turmaId, grupoId);

  grupo.alunos.forEach((aluno, index) => {
    const base = `${semanaId}_${turmaId}_G${grupoId}_A${index}`;

    linhas.push([
      SEMANAS[semanaId].titulo,
      SEMANAS[semanaId].turmas[turmaId].titulo,
      grupo.titulo,
      aluno,
      state[`${base}_notaIndividual`] || "",
      state[`${base}_comentarioIndividual`] || "",
      comentarioGrupo
    ]);
  });

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `grupo_${grupoId}_${semanaId}_${turmaId}.csv`;
  a.click();

  URL.revokeObjectURL(url);
};

window.gerarPDFGrupoAtual = async function() {
  const area = document.getElementById("relatorioGrupoAtual");

  if (!area || !window.jspdf || !window.html2canvas) {
    alert("Não foi possível gerar PDF. Verifique se jsPDF e html2canvas carregaram.");
    return;
  }

  const canvas = await html2canvas(area, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save("relatorio_grupo_com_fotos.pdf");
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

      if (Array.isArray(dados)) {
        dados.forEach(item => {
          const nota = normalizarNota(item.nota);

          if (nota === "") return;

          if (item.chave && chaveEhNotaCriterio(item.chave)) {
            state[item.chave] = nota;
            return;
          }

          if (
            item.semanaId &&
            item.turmaId &&
            item.grupoId &&
            item.criterioIndex !== undefined &&
            item.avaliadoraCodigo
          ) {
            const chave = key(
              item.semanaId,
              item.turmaId,
              String(item.grupoId).replace("G", ""),
              item.criterioIndex,
              item.avaliadoraCodigo
            );

            state[chave] = nota;
          }
        });

        salvar();
        updateAnalytics();

        alert("Notas importadas e juntadas com as suas com sucesso.");
        return;
      }

      Object.entries(dados).forEach(([chave, valor]) => {
        if (!chaveEhNotaCriterio(chave)) return;

        const nota = normalizarNota(valor);

        if (nota === "") {
          delete state[chave];
        } else {
          state[chave] = nota;
        }
      });

      salvar();
      updateAnalytics();

      alert("Avaliação importada e juntada com sucesso.");
    } catch {
      alert("Erro ao importar. Verifique se o arquivo é um JSON válido.");
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
  const grupo = SEMANAS[semanaId].turmas[turmaId].grupos[grupoId];
  const area = document.getElementById("evaluationArea");
  if (!area) return;

  const fotoKey = `${semanaId}_${turmaId}_G${grupoId}`;

  area.innerHTML = `
    <div class="card" id="relatorioGrupoAtual">
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
        <summary>Avaliação do grupo</summary>

        <p>
          Digite a nota desejada para cada critério.
          O campo aceita valores livres e pode ser apagado quando necessário.
        </p>

        ${CRITERIOS_GERAIS.map((criterio, index) => {
          const kCarmem = key(semanaId, turmaId, grupoId, index, "carmem");
          const kClaudia = key(semanaId, turmaId, grupoId, index, "claudia");

          return `
            <div class="evaluation-grid">
              <strong>${formatarCriterio(criterio)}</strong>

              <label>
                Carmem
                <input type="number" min="0" step="0.01"
                  value="${escapeHtml(state[kCarmem] ?? "")}"
                  oninput="salvarNota('${kCarmem}', this.value, this)">
              </label>

              <label>
                Cláudia
                <input type="number" min="0" step="0.01"
                  value="${escapeHtml(state[kClaudia] ?? "")}"
                  oninput="salvarNota('${kClaudia}', this.value, this)">
              </label>
            </div>
          `;
        }).join("")}

        <label>
          Comentário geral do avaliador sobre o grupo
          <textarea
            rows="4"
            oninput="salvarComentarioGrupo('${semanaId}', '${turmaId}', '${grupoId}', this.value)"
          >${escapeHtml(carregarComentarioGrupo(semanaId, turmaId, grupoId))}</textarea>
        </label>
      </details>

      <details class="accordion" open>
        <summary>Avaliação individual dos alunos dentro do grupo</summary>

        <p>
          Esta seção não altera os critérios coletivos. Ela registra nota individual, participação e comentário por aluno.
        </p>

        ${grupo.alunos.map((aluno, index) => {
          const base = `${semanaId}_${turmaId}_G${grupoId}_A${index}`;
          return `
            <div class="evaluation-grid">
              <strong>${escapeHtml(aluno)}</strong>

              <label>
                Nota individual
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value="${escapeHtml(state[`${base}_notaIndividual`] ?? "")}"
                  oninput="salvarNotaIndividual('${base}_notaIndividual', this.value, this)"
                >
              </label>

              <label>
                Comentário individual
                <textarea
                  rows="2"
                  oninput="salvarCampo('${base}_comentarioIndividual', this.value)"
                >${escapeHtml(state[`${base}_comentarioIndividual`] ?? "")}</textarea>
              </label>
            </div>
          `;
        }).join("")}
      </details>

      <details class="accordion" open>
        <summary>Fotos do grupo</summary>

        <p>
          As fotos ficam salvas no aparelho e vinculadas a este grupo.
        </p>

        <input
          type="file"
          accept="image/*"
          multiple
          onchange="uploadFotoIndexedDB(event, '${fotoKey}')"
        >

        <div id="fotosIndexedDB" class="gallery"></div>
      </details>

      <div class="export-actions">
        <button class="secondary" onclick="exportarGrupoCSV('${semanaId}', '${turmaId}', '${grupoId}')">
          Gerar Excel do grupo
        </button>

        <button class="secondary" onclick="gerarPDFGrupoAtual()">
          Gerar PDF do grupo com fotos
        </button>
      </div>
    </div>
  `;

  listarFotosIndexedDB(fotoKey);
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
   PROVAS E SIMULADOS
================================*/

function calcularNotaSimulado(acertos, total, notaMaxima) {
  const a = Number(acertos);
  const t = Number(total);
  const n = Number(notaMaxima);

  if (!Number.isFinite(a) || !Number.isFinite(t) || !Number.isFinite(n) || t <= 0) {
    return 0;
  }

  return Number(((a / t) * n).toFixed(2));
}

window.renderSimulados = function() {
  let area = document.getElementById("simuladosArea");

  if (!area) {
    area = document.createElement("section");
    area.id = "simuladosArea";
    area.className = "card";

    const root = document.getElementById("app-root") || document.body;
    root.appendChild(area);
  }

  if (!Array.isArray(state.simulados)) {
    state.simulados = [];
  }

  area.innerHTML = `
    <details class="accordion">
      <summary>Provas e Simulados</summary>

      <span class="badge">Provas e Simulados</span>
      <h2>Calculadora de acertos e notas</h2>

      <p>
        Cadastre alunos, informe a quantidade de acertos, o total de questões e a nota máxima.
        O sistema calcula automaticamente a nota final.
      </p>

      <p>
        Exemplo: se a prova tiver 50 questões e a nota máxima for 1,0,
        então 20 acertos resultam em nota 0,4.
      </p>

      <div class="evaluation-grid">
        <label>
          Nome do aluno
          <input id="simAluno" type="text" placeholder="Nome do aluno">
        </label>

        <label>
          Acertos
          <input id="simAcertos" type="number" min="0" step="1" placeholder="Ex: 20">
        </label>

        <label>
          Total de questões
          <input id="simTotal" type="number" min="1" step="1" placeholder="Ex: 50">
        </label>

        <label>
          Nota máxima
          <input id="simNotaMax" type="number" min="0" step="0.1" value="1">
        </label>
      </div>

      <button class="secondary" onclick="adicionarAlunoSimulado()">
        Adicionar aluno
      </button>

      <button class="secondary" onclick="exportarSimuladoCSV()">
        Gerar Excel do simulado
      </button>

      <button class="secondary" onclick="limparSimulados()">
        Limpar simulados
      </button>

      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Acertos</th>
            <th>Total</th>
            <th>Nota máxima</th>
            <th>Nota calculada</th>
          </tr>
        </thead>
        <tbody>
          ${state.simulados.map(item => `
            <tr>
              <td>${escapeHtml(item.aluno)}</td>
              <td>${escapeHtml(item.acertos)}</td>
              <td>${escapeHtml(item.total)}</td>
              <td>${escapeHtml(item.notaMaxima)}</td>
              <td>${escapeHtml(item.notaCalculada)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </details>
  `;
};

window.adicionarAlunoSimulado = function() {
  const aluno = document.getElementById("simAluno")?.value || "";
  const acertos = document.getElementById("simAcertos")?.value || "";
  const total = document.getElementById("simTotal")?.value || "";
  const notaMaxima = document.getElementById("simNotaMax")?.value || "1";

  if (!aluno.trim()) {
    alert("Digite o nome do aluno.");
    return;
  }

  if (!Array.isArray(state.simulados)) {
    state.simulados = [];
  }

  const notaCalculada = calcularNotaSimulado(acertos, total, notaMaxima);

  state.simulados.push({
    aluno,
    acertos,
    total,
    notaMaxima,
    notaCalculada
  });

  salvar();
  renderSimulados();
};

window.exportarSimuladoCSV = function() {
  if (!Array.isArray(state.simulados) || !state.simulados.length) {
    alert("Nenhum aluno cadastrado no simulado.");
    return;
  }

  const linhas = [
    ["Aluno", "Acertos", "Total de questões", "Nota máxima", "Nota calculada"],
    ...state.simulados.map(item => [
      item.aluno,
      item.acertos,
      item.total,
      item.notaMaxima,
      String(item.notaCalculada).replace(".", ",")
    ])
  ];

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "provas_e_simulados.csv";
  a.click();

  URL.revokeObjectURL(url);
};

window.limparSimulados = function() {
  const confirmar = confirm("Deseja limpar apenas a seção Provas e Simulados?");
  if (!confirmar) return;

  state.simulados = [];
  salvar();
  renderSimulados();
};

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
renderSimulados();
configurarInstalacao();
registrarPWA();
