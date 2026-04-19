/**
 * LocalSyncService - Gerencia a soberania de dados local (File System Access API)
 * Vence a sandbox do navegador permitindo gravação direta de arquivos no notebook/PC.
 */

const DB_NAME = "CognixOS_LocalSync";
const STORE_NAME = "file_handles";
const HANDLE_KEY = "current_chat_backup";

export const LocalSyncService = {
  /**
   * Verifica se o navegador suporta a API necessária
   */
  isSupported: () => {
    return 'showSaveFilePicker' in window;
  },

  /**
   * Abre o seletor de arquivos nativo do OS
   */
  selectFile: async (): Promise<boolean> => {
    try {
      // @ts-ignore - File System Access API is experimental
      const handle = await window.showSaveFilePicker({
        suggestedName: `cognixos_chat_backup.json`,
        types: [{
          description: 'CognixOS Chat Backup',
          accept: { 'application/json': ['.json'] },
        }],
      });
      
      await LocalSyncService._saveHandle(handle);
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
      console.error("Erro ao selecionar arquivo:", err);
      throw err;
    }
  },

  /**
   * Escreve o conteúdo no arquivo selecionado
   */
  syncChatToLocal: async (chatContent: any): Promise<void> => {
    const handle = await LocalSyncService._loadHandle();
    if (!handle) return;

    try {
      // Verificar/Requisitar permissão (necessário após cada refresh/sessão)
      // Nota: Isso geralmente exige uma interação do usuário na primeira vez da sessão
      const status = await handle.queryPermission({ mode: 'readwrite' });
      if (status !== 'granted') {
          // No contexto do chat, se não tiver permissão, não podemos forçar o prompt sem clique
          // Mas se o usuário acabou de clicar e o handle foi persistido, funcionará.
          return; 
      }

      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(chatContent, null, 2));
      await writable.close();
      console.log("[LocalSync] Sincronização offline concluída com sucesso.");
    } catch (err) {
      console.error("[LocalSync] Falha na sincronização local:", err);
    }
  },

  /**
   * Solicita permissão de escrita explicitamente (chamado via clique de botão)
   */
  requestPermission: async (): Promise<boolean> => {
    const handle = await LocalSyncService._loadHandle();
    if (!handle) return false;
    
    // @ts-ignore
    const status = await handle.requestPermission({ mode: 'readwrite' });
    return status === 'granted';
  },

  /**
   * Verifica se existe um arquivo vinculado
   */
  hasLinkedFile: async (): Promise<boolean> => {
    const handle = await LocalSyncService._loadHandle();
    return !!handle;
  },

  // --- Helpers Privados para IndexedDB ---

  _getDB: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  _saveHandle: async (handle: any) => {
    const db = await LocalSyncService._getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  },

  _loadHandle: async (): Promise<any | null> => {
    const db = await LocalSyncService._getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};
