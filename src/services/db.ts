import type { Problem, TestCase, Submission } from '../types/judge.ts';

const DB_NAME = 'faminh_judge_idb_v2';
const DB_VERSION = 3; // Bắt buộc version 3 để đảm bảo mọi trình duyệt đều kích hoạt onupgradeneeded và tạo đủ 4 Object Stores

const STORES = {
  PROBLEMS: 'problems',
  TEST_CASES: 'testCases',
  SUBMISSIONS: 'submissions',
  TOPICS: 'topics',
};

function isIDBSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!isIDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.PROBLEMS)) {
        db.createObjectStore(STORES.PROBLEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.TEST_CASES)) {
        db.createObjectStore(STORES.TEST_CASES, { keyPath: 'problemId' });
      }
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) {
        db.createObjectStore(STORES.SUBMISSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.TOPICS)) {
        db.createObjectStore(STORES.TOPICS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Kiểm tra an toàn: nếu thiếu bất kỳ store nào do cache version cũ, đóng lại và mở phiên bản cao hơn để tạo đủ
      const missing = Object.values(STORES).some((s) => !db.objectStoreNames.contains(s));
      if (missing) {
        db.close();
        dbPromise = null;
        const higherVersion = db.version + 1;
        const upgradeReq = window.indexedDB.open(DB_NAME, higherVersion);
        upgradeReq.onupgradeneeded = (e) => {
          const upDb = (e.target as IDBOpenDBRequest).result;
          Object.values(STORES).forEach((s) => {
            if (!upDb.objectStoreNames.contains(s)) {
              upDb.createObjectStore(s, { keyPath: s === STORES.TEST_CASES ? 'problemId' : 'id' });
            }
          });
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => reject(upgradeReq.error);
        return;
      }
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Tự động phục hồi toàn bộ dữ liệu từ database cũ faminh_judge_idb_v1 (nếu có)
 */
async function tryRecoverFromV1(): Promise<{
  problems: Problem[];
  testCases: Map<string, TestCase[]>;
  submissions: Submission[];
} | null> {
  if (!isIDBSupported()) return null;
  try {
    const v1Request = window.indexedDB.open('faminh_judge_idb_v1');
    const v1Db = await new Promise<IDBDatabase | null>((resolve) => {
      v1Request.onsuccess = () => resolve(v1Request.result);
      v1Request.onerror = () => resolve(null);
    });

    if (!v1Db) return null;

    let v1Problems: Problem[] = [];
    if (v1Db.objectStoreNames.contains('problems')) {
      v1Problems = await new Promise((resolve) => {
        try {
          const tx = v1Db.transaction('problems', 'readonly');
          const req = tx.objectStore('problems').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    let v1TestCasesList: Array<{ problemId: string; testCases: TestCase[] }> = [];
    if (v1Db.objectStoreNames.contains('testCases')) {
      v1TestCasesList = await new Promise((resolve) => {
        try {
          const tx = v1Db.transaction('testCases', 'readonly');
          const req = tx.objectStore('testCases').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    let v1Submissions: Submission[] = [];
    if (v1Db.objectStoreNames.contains('submissions')) {
      v1Submissions = await new Promise((resolve) => {
        try {
          const tx = v1Db.transaction('submissions', 'readonly');
          const req = tx.objectStore('submissions').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    v1Db.close();

    const testMap = new Map(v1TestCasesList.map((t) => [t.problemId, t.testCases]));
    if (v1Problems.length > 0 || v1TestCasesList.length > 0 || v1Submissions.length > 0) {
      console.log('[idbService] Đã tìm thấy dữ liệu từ DB v1 cũ, tiến hành di chuyển sang v2:', {
        problems: v1Problems.length,
        tests: v1TestCasesList.length,
        submissions: v1Submissions.length,
      });
      return { problems: v1Problems, testCases: testMap, submissions: v1Submissions };
    }
    return null;
  } catch {
    return null;
  }
}

export const idbService = {
  isSupported(): boolean {
    return isIDBSupported();
  },

  async getAllProblems(): Promise<Problem[]> {
    if (!isIDBSupported()) return [];
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.PROBLEMS)) return [];

      let problems: Problem[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PROBLEMS, 'readonly');
        const store = tx.objectStore(STORES.PROBLEMS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      // Lấy kèm toàn bộ test cases từ STORES.TEST_CASES
      let testMap = new Map<string, TestCase[]>();
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) {
        const testCasesList: Array<{ problemId: string; testCases: TestCase[] }> = await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORES.TEST_CASES, 'readonly');
            const store = tx.objectStore(STORES.TEST_CASES);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });
        testMap = new Map(testCasesList.map((t) => [t.problemId, t.testCases]));
      }

      // Nếu v2 chưa có bài hoặc bị thiếu test, tự động kiểm tra và di trú từ v1 cũ
      if (problems.length === 0 || testMap.size === 0) {
        const v1Data = await tryRecoverFromV1();
        if (v1Data) {
          if (problems.length === 0 && v1Data.problems.length > 0) {
            problems = v1Data.problems;
            await this.saveProblems(problems);
          }
          for (const [probId, tests] of v1Data.testCases.entries()) {
            if (!testMap.has(probId) || (testMap.get(probId)?.length || 0) < tests.length) {
              testMap.set(probId, tests);
              await this.saveTestCases(probId, tests);
            }
          }
        }
      }

      // STORES.TEST_CASES là kho lưu trữ chuẩn xác và đầy đủ nhất cho test cases
      return problems.map((p) => {
        const savedTests = testMap.get(p.id);
        if (savedTests && savedTests.length > 0) {
          return { ...p, testCases: savedTests };
        }
        return p;
      });
    } catch (err) {
      console.warn('[idbService] Lỗi getAllProblems:', err);
      return [];
    }
  },

  async saveProblems(problems: Problem[]): Promise<void> {
    if (!isIDBSupported() || !problems || problems.length === 0) return;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.PROBLEMS)) return;

      const storeNames = [STORES.PROBLEMS];
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) {
        storeNames.push(STORES.TEST_CASES);
      }

      const tx = db.transaction(storeNames, 'readwrite');
      const probStore = tx.objectStore(STORES.PROBLEMS);
      const testStore = db.objectStoreNames.contains(STORES.TEST_CASES)
        ? tx.objectStore(STORES.TEST_CASES)
        : null;

      for (const p of problems) {
        probStore.put(p);
        if (testStore && p.testCases && p.testCases.length > 0) {
          testStore.put({ problemId: p.id, testCases: p.testCases, updatedAt: new Date().toISOString() });
        }
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[idbService] Lỗi lưu problems vào IndexedDB:', err);
      throw err;
    }
  },

  async deleteProblem(problemId: string): Promise<void> {
    if (!isIDBSupported()) return;
    try {
      const db = await getDB();
      const storeNames = [];
      if (db.objectStoreNames.contains(STORES.PROBLEMS)) storeNames.push(STORES.PROBLEMS);
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) storeNames.push(STORES.TEST_CASES);
      if (storeNames.length === 0) return;

      const tx = db.transaction(storeNames, 'readwrite');
      if (db.objectStoreNames.contains(STORES.PROBLEMS)) tx.objectStore(STORES.PROBLEMS).delete(problemId);
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) tx.objectStore(STORES.TEST_CASES).delete(problemId);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[idbService] Lỗi xóa bài trong IndexedDB:', err);
      throw err;
    }
  },

  async saveProblem(problem: Problem): Promise<void> {
    if (!isIDBSupported()) return;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.PROBLEMS)) {
        throw new Error('Database chưa có bảng problems');
      }

      const storeNames = [STORES.PROBLEMS];
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) {
        storeNames.push(STORES.TEST_CASES);
      }

      const tx = db.transaction(storeNames, 'readwrite');
      const probStore = tx.objectStore(STORES.PROBLEMS);
      const testStore = db.objectStoreNames.contains(STORES.TEST_CASES)
        ? tx.objectStore(STORES.TEST_CASES)
        : null;

      if (testStore && problem.testCases && problem.testCases.length > 0) {
        testStore.put({
          problemId: problem.id,
          testCases: problem.testCases,
          updatedAt: new Date().toISOString(),
        });
        probStore.put(problem);
      } else if (testStore) {
        // Giữ lại test cases đã có trong testStore nếu object problem cập nhật không mang theo testCases
        const existingReq = testStore.get(problem.id);
        existingReq.onsuccess = () => {
          const existingTests = existingReq.result?.testCases;
          if (existingTests && existingTests.length > 0) {
            probStore.put({ ...problem, testCases: existingTests });
          } else {
            probStore.put(problem);
          }
        };
      } else {
        probStore.put(problem);
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[idbService] Lỗi lưu problem vào IndexedDB:', err);
      throw err;
    }
  },

  async saveTestCases(problemId: string, testCases: TestCase[]): Promise<void> {
    if (!isIDBSupported() || !testCases) return;
    try {
      const db = await getDB();
      const storeNames = [];
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) storeNames.push(STORES.TEST_CASES);
      if (db.objectStoreNames.contains(STORES.PROBLEMS)) storeNames.push(STORES.PROBLEMS);
      if (storeNames.length === 0) return;

      const tx = db.transaction(storeNames, 'readwrite');
      if (db.objectStoreNames.contains(STORES.TEST_CASES)) {
        tx.objectStore(STORES.TEST_CASES).put({
          problemId,
          testCases,
          updatedAt: new Date().toISOString(),
        });
      }

      // Cập nhật cả trường testCases trong object problem ở STORES.PROBLEMS
      if (db.objectStoreNames.contains(STORES.PROBLEMS)) {
        const probStore = tx.objectStore(STORES.PROBLEMS);
        const getReq = probStore.get(problemId);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const prob = getReq.result;
            prob.testCases = testCases;
            prob.updatedAt = new Date().toISOString();
            probStore.put(prob);
          }
        };
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[idbService] Lỗi lưu test cases vào IndexedDB:', err);
      throw err;
    }
  },

  async getTestCases(problemId: string): Promise<TestCase[] | null> {
    if (!isIDBSupported()) return null;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.TEST_CASES)) return null;

      const directResult = await new Promise<TestCase[] | null>((resolve) => {
        const tx = db.transaction(STORES.TEST_CASES, 'readonly');
        const store = tx.objectStore(STORES.TEST_CASES);
        const req = store.get(problemId);
        req.onsuccess = () => {
          if (req.result && req.result.testCases && req.result.testCases.length > 0) {
            resolve(req.result.testCases);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });

      if (directResult && directResult.length > 0) {
        return directResult;
      }

      // Thử tìm trong problem store của v2
      if (db.objectStoreNames.contains(STORES.PROBLEMS)) {
        const probResult = await new Promise<TestCase[] | null>((resolve) => {
          const tx = db.transaction(STORES.PROBLEMS, 'readonly');
          const store = tx.objectStore(STORES.PROBLEMS);
          const req = store.get(problemId);
          req.onsuccess = () => {
            if (req.result && req.result.testCases && req.result.testCases.length > 0) {
              resolve(req.result.testCases);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        });
        if (probResult && probResult.length > 0) {
          return probResult;
        }
      }

      // Thử tìm trong v1 cũ
      const v1Data = await tryRecoverFromV1();
      if (v1Data) {
        const v1Tests = v1Data.testCases.get(problemId);
        if (v1Tests && v1Tests.length > 0) {
          await this.saveTestCases(problemId, v1Tests);
          return v1Tests;
        }
        const v1Prob = v1Data.problems.find((p) => p.id === problemId);
        if (v1Prob && v1Prob.testCases && v1Prob.testCases.length > 0) {
          await this.saveTestCases(problemId, v1Prob.testCases);
          return v1Prob.testCases;
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  async getAllSubmissions(): Promise<Submission[]> {
    if (!isIDBSupported()) return [];
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) return [];

      let list: Submission[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.SUBMISSIONS, 'readonly');
        const store = tx.objectStore(STORES.SUBMISSIONS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      // Nếu v2 chưa có submission nào, thử khôi phục từ v1
      if (list.length === 0) {
        const v1Data = await tryRecoverFromV1();
        if (v1Data && v1Data.submissions && v1Data.submissions.length > 0) {
          list = v1Data.submissions;
          await this.saveSubmissions(list);
        }
      }

      return list;
    } catch (err) {
      console.warn('[idbService] Lỗi getAllSubmissions:', err);
      return [];
    }
  },

  async getSubmissionById(id: string): Promise<Submission | null> {
    if (!isIDBSupported() || !id) return null;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) return null;
      const tx = db.transaction(STORES.SUBMISSIONS, 'readonly');
      const store = tx.objectStore(STORES.SUBMISSIONS);
      return new Promise<Submission | null>((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async saveSubmissions(submissions: Submission[]): Promise<void> {
    if (!isIDBSupported() || !submissions || submissions.length === 0) return;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) {
        throw new Error('Database chưa có bảng submissions');
      }

      const tx = db.transaction(STORES.SUBMISSIONS, 'readwrite');
      const store = tx.objectStore(STORES.SUBMISSIONS);
      for (const s of submissions) {
        store.put(s);
      }
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[idbService] Lỗi lưu submissions vào IndexedDB:', err);
      throw err;
    }
  },

  async saveSubmission(submission: Submission): Promise<void> {
    if (!isIDBSupported()) return;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) {
        throw new Error('Database chưa có bảng submissions');
      }

      const tx = db.transaction(STORES.SUBMISSIONS, 'readwrite');
      const store = tx.objectStore(STORES.SUBMISSIONS);
      store.put(submission);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[idbService] Lỗi lưu submission vào IndexedDB:', err);
      throw err;
    }
  },

  async clearSubmissions(): Promise<void> {
    if (!isIDBSupported()) return;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) return;
      const tx = db.transaction(STORES.SUBMISSIONS, 'readwrite');
      tx.objectStore(STORES.SUBMISSIONS).clear();
    } catch (err) {
      console.warn('[idbService] Lỗi clear submissions:', err);
    }
  },

  async deleteSubmissionsForStudent(studentId: string, username?: string, fullName?: string): Promise<void> {
    if (!isIDBSupported()) return;
    try {
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) return;
      const tx = db.transaction(STORES.SUBMISSIONS, 'readwrite');
      const store = tx.objectStore(STORES.SUBMISSIONS);
      const req = store.getAll();
      await new Promise<void>((resolve) => {
        req.onsuccess = () => {
          const list: Submission[] = req.result || [];
          const cleanId = studentId ? studentId.trim().toLowerCase() : '';
          const cleanUser = username ? username.trim().toLowerCase() : '';
          const cleanName = fullName ? fullName.trim().toLowerCase() : '';
          for (const s of list) {
            const matchId = cleanId && s.userId && s.userId.trim().toLowerCase() === cleanId;
            const matchUser = cleanUser && s.userId && s.userId.trim().toLowerCase() === cleanUser;
            const matchName = cleanName && s.userName && s.userName.trim().toLowerCase() === cleanName;
            if (matchId || matchUser || matchName) {
              store.delete(s.id);
            }
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[idbService] Lỗi xóa submissions theo học sinh:', err);
    }
  },

  async clearAllData(): Promise<void> {
    if (!isIDBSupported()) return;
    try {
      const db = await getDB();
      const stores = [STORES.PROBLEMS, STORES.TEST_CASES, STORES.SUBMISSIONS, STORES.TOPICS].filter(
        (s) => db.objectStoreNames.contains(s)
      );
      if (stores.length > 0) {
        const tx = db.transaction(stores, 'readwrite');
        stores.forEach((s) => tx.objectStore(s).clear());
      }
    } catch (err) {
      console.warn('[idbService] Lỗi clearAllData:', err);
    }
  },
};
