type StoreName = 'settings' | 'reviewState' | 'repertoires' | 'theoryNotes' | 'runtimeAssets';

const DATABASE_NAME = 'chess-openings-local-first';
const DATABASE_VERSION = 2;

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toError(request.error, 'IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(toError(transaction.error, 'IndexedDB transaction failed.'));
    transaction.onabort = () => reject(toError(transaction.error, 'IndexedDB transaction aborted.'));
  });
}

export async function openBrowserDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains('reviewState')) {
        database.createObjectStore('reviewState', { keyPath: 'cardId' });
      }

      if (!database.objectStoreNames.contains('repertoires')) {
        database.createObjectStore('repertoires', { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains('theoryNotes')) {
        database.createObjectStore('theoryNotes', { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains('runtimeAssets')) {
        database.createObjectStore('runtimeAssets', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toError(request.error, 'IndexedDB open failed.'));
  });
}

export async function getRecord<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openBrowserDb();
  const transaction = db.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const result = await requestToPromise<T | undefined>(store.get(key) as IDBRequest<T | undefined>);
  await transactionComplete(transaction);
  return result;
}

export async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  const db = await openBrowserDb();
  const transaction = db.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const result = await requestToPromise<T[]>(store.getAll() as IDBRequest<T[]>);
  await transactionComplete(transaction);
  return result;
}

export async function putRecord<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openBrowserDb();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  store.put(value);
  await transactionComplete(transaction);
}

export async function deleteRecord(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openBrowserDb();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  store.delete(key);
  await transactionComplete(transaction);
}
