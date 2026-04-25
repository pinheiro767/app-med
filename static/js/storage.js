const DB_NAME = "avaliacao_anatomia_db";
const STORE_FOTOS = "fotos";

function abrirDB() {
  return new Promise((resolve, reject) => {

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = function(e) {
      const db = e.target.result;
      db.createObjectStore(STORE_FOTOS, { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = function(e) {
      resolve(e.target.result);
    };

    request.onerror = function(e) {
      reject(e);
    };

  });
}

export async function salvarFoto(grupo, file) {

  const db = await abrirDB();
  const tx = db.transaction(STORE_FOTOS, "readwrite");
  const store = tx.objectStore(STORE_FOTOS);

  const reader = new FileReader();

  reader.onload = function() {
    store.add({
      grupo,
      imagem: reader.result,
      data: new Date()
    });
  };

  reader.readAsDataURL(file);
}

export async function listarFotos(grupo) {

  const db = await abrirDB();
  const tx = db.transaction(STORE_FOTOS, "readonly");
  const store = tx.objectStore(STORE_FOTOS);

  return new Promise(resolve => {

    const fotos = [];

    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;

      if (cursor) {

        if (cursor.value.grupo === grupo) {
          fotos.push(cursor.value);
        }

        cursor.continue();

      } else {
        resolve(fotos);
      }
    };

  });
}
