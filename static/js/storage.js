const DB_NAME = "avaliacao_anatomia_db";
const STORE_FOTOS = "fotos";

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = function(event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_FOTOS)) {
        db.createObjectStore(STORE_FOTOS, {
          keyPath: "id",
          autoIncrement: true
        });
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

function salvarFoto(grupo, file) {
  return new Promise(async (resolve, reject) => {
    if (!grupo || !file || !file.type.startsWith("image/")) {
      reject(new Error("Grupo ou arquivo de imagem inválido."));
      return;
    }

    try {
      const db = await abrirDB();
      const tx = db.transaction(STORE_FOTOS, "readwrite");
      const store = tx.objectStore(STORE_FOTOS);

      const reader = new FileReader();

      reader.onload = function() {
        const request = store.add({
          grupo,
          nome: file.name,
          tipo: file.type,
          imagem: reader.result,
          data: new Date().toISOString()
        });

        request.onsuccess = function() {
          resolve(request.result);
        };

        request.onerror = function() {
          reject(request.error);
        };
      };

      reader.onerror = function() {
        reject(reader.error);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

async function listarFotos(grupo) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_FOTOS, "readonly");
  const store = tx.objectStore(STORE_FOTOS);

  return new Promise((resolve, reject) => {
    const fotos = [];
    const request = store.openCursor();

    request.onsuccess = function(event) {
      const cursor = event.target.result;

      if (cursor) {
        if (cursor.value.grupo === grupo) {
          fotos.push(cursor.value);
        }

        cursor.continue();
      } else {
        resolve(fotos);
      }
    };

    request.onerror = function() {
      reject(request.error);
    };
  });
}
