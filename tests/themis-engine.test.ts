import assert from 'node:assert/strict';
import {
  naturalCompare,
  normalizeThemisOutput,
  compareThemisOutputs,
  preprocessCodeForExecution,
  generateThemisRunScript,
  generateRealisticMemory,
  parseThemisBashOutput,
  gradeSubmission,
} from '../src/services/judgeEngine.ts';
import {
  INITIAL_TOPICS,
  INITIAL_PROBLEMS,
  storageService,
} from '../src/services/storageService.ts';
import type { Problem } from '../src/types/judge.ts';

// Setup mock localStorage and sessionStorage for Node.js environment
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] || null,
  };
};

const mockStorage = createMockStorage();
const mockSessionStorage = createMockStorage();

(globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
(globalThis as unknown as { sessionStorage: typeof mockSessionStorage }).sessionStorage = mockSessionStorage;

const createMockProblem = (
  partial: Partial<Problem> & { id: string; code: string; title: string; topicId: string }
): Problem => ({
  difficulty: 'Dễ',
  timeLimit: 1.0,
  memoryLimit: 256,
  totalPoints: 10,
  description: '',
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  samples: [],
  testCases: [],
  videoConfig: { enabled: false, type: 'youtube', url: '', unlockRule: 'always' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial,
});

let totalTestsRun = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTestsRun++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => {
          passedTests++;
          console.log(`  [PASS] ${name}`);
        },
        (err) => {
          console.error(`  [FAIL] ${name}:`, err);
          throw err;
        }
      );
    }
    passedTests++;
    console.log(`  [PASS] ${name}`);
    return Promise.resolve();
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err);
    throw err;
  }
}

async function main() {
  console.log('====================================================');
  console.log('BAT DAU KIEM THU TOAN DIEN HE THONG CHAM THEMIS');
  console.log('====================================================\n');

  // ==========================================
  // NHOM 1: KHOI TAO DULIEU (EMPTY SLATE)
  // ==========================================
  console.log('Nhom 1: Khoi tao du lieu trong sach (No auto-created samples)');
  
  await runTest('INITIAL_TOPICS va INITIAL_PROBLEMS mac dinh phai la mang rong []', () => {
    assert.deepEqual(INITIAL_TOPICS, [], 'INITIAL_TOPICS phai la mang rong []');
    assert.deepEqual(INITIAL_PROBLEMS, [], 'INITIAL_PROBLEMS phai la mang rong []');
  });

  await runTest('storageService.getTopics() va getProblems() tra ve mang rong khi chua co du lieu', () => {
    mockStorage.clear();
    const topics = storageService.getTopics();
    const problems = storageService.getProblems();
    assert.equal(topics.length, 0, 'topics phai co length 0');
    assert.equal(problems.length, 0, 'problems phai co length 0');
    // Khong duoc tu y ghi vao localStorage de tao de bai ao
    assert.equal(mockStorage.getItem('faminh_judge_topics_v2'), null);
    assert.equal(mockStorage.getItem('faminh_judge_problems_v2'), null);
  });

  await runTest('storageService.resetToDefault() dua topics va problems ve []', () => {
    storageService.saveTopics([{ id: 't1', name: 'Topic 1', description: 'Topic 1 description', order: 1 }]);
    storageService.saveProblems([
      createMockProblem({
        id: 'p1',
        code: 'P1',
        title: 'Prob 1',
        topicId: 't1',
        description: 'Desc',
      }),
    ]);

    assert.equal(storageService.getTopics().length, 1);
    assert.equal(storageService.getProblems().length, 1);

    storageService.resetToDefault();
    assert.equal(storageService.getTopics().length, 0, 'Sau resetToDefault topics phai la []');
    assert.equal(storageService.getProblems().length, 0, 'Sau resetToDefault problems phai la []');
  });

  await runTest('storageService.clearAllStorageAndCookies() xoa sach toan bo sessions, classes, problems va giu nguyen theme', () => {
    mockStorage.setItem('faminh_admin_password_v1', 'secret123');
    mockStorage.setItem('faminh_judge_theme_v1', 'dark');
    mockStorage.setItem('faminh_judge_students_v1', '[{"id":"s1"}]');
    mockStorage.setItem('faminh_judge_classes_v1', '[{"id":"c1"}]');

    storageService.clearAllStorageAndCookies();

    assert.equal(mockStorage.getItem('faminh_judge_theme_v1'), 'dark', 'Theme phai duoc bao toan');
    assert.equal(mockStorage.getItem('faminh_admin_password_v1'), null, 'Admin password phai bi xoa sach');
    assert.equal(mockStorage.getItem('faminh_judge_students_v1'), null, 'Students phai bi xoa sach');
    assert.equal(mockStorage.getItem('faminh_judge_classes_v1'), null, 'Classes phai bi xoa sach');
  });

  // ==========================================
  // NHOM 2: SAP XEP TU NHIEN THEMIS (NATURAL SORT)
  // ==========================================
  console.log('\nNhom 2: Sap xep tu nhien Natural Sort (Test #1 -> Test #20)');

  await runTest('naturalCompare sap xep dung thu tu tu nhien Test 1 den Test 20', () => {
    const raw = ['Test #10', 'Test #1', 'Test #20', 'Test #2', 'Test #9', 'Test #15'];
    const sorted = [...raw].sort(naturalCompare);
    assert.deepEqual(sorted, [
      'Test #1',
      'Test #2',
      'Test #9',
      'Test #10',
      'Test #15',
      'Test #20',
    ]);
  });

  await runTest('naturalCompare ho tro ten test dang tc1, tc2, tc10, tc20', () => {
    const raw = ['tc20', 'tc1', 'tc2', 'tc10'];
    const sorted = [...raw].sort(naturalCompare);
    assert.deepEqual(sorted, ['tc1', 'tc2', 'tc10', 'tc20']);
  });

  // ==========================================
  // NHOM 3: CHUAN HOA VA SO SANH OUTPUT THEMIS
  // ==========================================
  console.log('\nNhom 3: Chuan hoa va so sanh Output theo chuan Themis');

  await runTest('normalizeThemisOutput loai bo \\r\\n, trailing spaces va dong trong cuoi', () => {
    const input = 'line 1   \r\nline 2\t  \r\n\r\n\r\n';
    const normalized = normalizeThemisOutput(input);
    assert.equal(normalized, 'line 1\nline 2');
  });

  await runTest('compareThemisOutputs chap nhan sai khac khoang trang cuoi file', () => {
    assert.equal(compareThemisOutputs('12\n\n', '12'), true);
    assert.equal(compareThemisOutputs('12\r\n', '12\n'), true);
    assert.equal(compareThemisOutputs('   12   ', '12'), true);
  });

  await runTest('compareThemisOutputs chap nhan khoang trang giua cac token giong nhau', () => {
    assert.equal(compareThemisOutputs('1   2    3', '1 2 3'), true);
    assert.equal(compareThemisOutputs('1\n2\n3', '1 2 3'), true);
  });

  await runTest('compareThemisOutputs ho tro so thuc voi sai so 1e-6', () => {
    assert.equal(compareThemisOutputs('3.1415926', '3.14159265'), true);
    assert.equal(compareThemisOutputs('3.14159', '3.15'), false);
  });

  await runTest('compareThemisOutputs ho tro khong phan biet hoa thuong cho YES/NO/TRUE/FALSE', () => {
    assert.equal(compareThemisOutputs('YES', 'yes'), true);
    assert.equal(compareThemisOutputs('no', 'NO'), true);
    assert.equal(compareThemisOutputs('True', 'TRUE'), true);
    assert.equal(compareThemisOutputs('false', 'FALSE'), true);
    assert.equal(compareThemisOutputs('ABC', 'xyz'), false);
  });

  await runTest('compareThemisOutputs bat chinh xac token khong khop', () => {
    assert.equal(compareThemisOutputs('10 20', '10 30'), false);
    assert.equal(compareThemisOutputs('10 20', '10 20 30'), false);
  });

  // ==========================================
  // NHOM 4: TIEN XU LY CODE (PREPROCESS CODE & FREOPEN)
  // ==========================================
  console.log('\nNhom 4: Xu ly freopen 100% giu nguyen code hoc sinh');

  await runTest('preprocessCodeForExecution xoa sach moi bien the freopen C++', () => {
    const code = `#include <iostream>
#define int long long
using namespace std;

int arr[1000000];

int main() {
    freopen("TONG2SO.INP", "r", stdin);
    freopen ( "TONG2SO.OUT" , "w" , stdout ) ;
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}`;

    const { cleanedCode, freopenHandled } = preprocessCodeForExecution(code, 'cpp');
    assert.equal(freopenHandled, true);
    assert.equal(cleanedCode.includes('freopen'), false, 'Khong con lenh freopen nao');
    assert.equal(cleanedCode.includes('#define int long long'), true, 'Giu nguyen #define');
    assert.equal(cleanedCode.includes('int arr[1000000];'), true, 'Giu nguyen mang toan cuc');
    assert.equal(cleanedCode.includes('int main()'), true, 'Giu nguyen ten ham main');
    assert.equal(cleanedCode.includes('_student_main'), false, 'Tuyet doi khong rename ham main');
  });

  await runTest('preprocessCodeForExecution ho tro Pascal assign/reset/rewrite', () => {
    const pascalCode = `program Bai;
begin
    assign(input, 'BAI.INP'); reset(input);
    assign(output, 'BAI.OUT'); rewrite(output);
    read(a);
    writeln(a);
end.`;
    const { cleanedCode, freopenHandled } = preprocessCodeForExecution(pascalCode, 'pascal');
    assert.equal(freopenHandled, true);
    assert.equal(cleanedCode.includes('assign'), false);
    assert.equal(cleanedCode.includes('reset'), false);
    assert.equal(cleanedCode.includes('rewrite'), false);
  });

  await runTest('preprocessCodeForExecution ho tro Python sys.stdin = open(...)', () => {
    const pyCode = `import sys
sys.stdin = open('BAI.INP', 'r')
sys.stdout = open('BAI.OUT', 'w')
print(int(sys.stdin.read()))`;
    const { cleanedCode, freopenHandled } = preprocessCodeForExecution(pyCode, 'python');
    assert.equal(freopenHandled, true);
    assert.equal(cleanedCode.includes('sys.stdin = open'), false);
    assert.equal(cleanedCode.includes('sys.stdout = open'), false);
  });

  // ==========================================
  // NHOM 5: RAM DAO DONG CHAN THUC (NO HARDCODED 3.5 MB)
  // ==========================================
  console.log('\nNhom 5: Bo nho RAM dao dong chan thuc (1.1 MB - 3.8 MB)');

  await runTest('generateRealisticMemory sinh RAM trong [1.1, 3.8] MB cho C++ va khong trung lap 3.5 MB cung', () => {
    const ramValues: number[] = [];
    for (let i = 1; i <= 20; i++) {
      const ram = generateRealisticMemory(i, 'cpp');
      assert.ok(ram >= 1.1 && ram <= 3.8, `RAM ${ram} phai nam trong [1.1, 3.8] MB`);
      ramValues.push(ram);
    }
    const uniqueValues = new Set(ramValues);
    assert.ok(uniqueValues.size >= 5, `Phai co it nhat 5 gia tri RAM khac nhau tren 20 test (thuc te: ${uniqueValues.size})`);
  });

  await runTest('generateRealisticMemory ho tro Python (12.0 - 15.8 MB) va Java (28.0 - 35.0 MB)', () => {
    for (let i = 1; i <= 5; i++) {
      const pyRam = generateRealisticMemory(i, 'python');
      assert.ok(pyRam >= 12.0 && pyRam <= 15.8, `Python RAM ${pyRam} phai trong [12.0, 15.8]`);
      const javaRam = generateRealisticMemory(i, 'java');
      assert.ok(javaRam >= 28.0 && javaRam <= 35.0, `Java RAM ${javaRam} phai trong [28.0, 35.0]`);
    }
  });

  // ==========================================
  // NHOM 6: DRIVER SCRIPT RUN.SH & PARSER
  // ==========================================
  console.log('\nNhom 6: Sinh kịch bản run.sh va parse output chuẩn Themis');

  await runTest('generateThemisRunScript tao dung kich ban bash voi timeout, START/END date', () => {
    const script = generateThemisRunScript(20, 1.0, 'cpp');
    assert.ok(script.includes('#!/bin/bash'));
    assert.ok(script.includes('g++ -O2 -w solution.cpp -o solution'));
    assert.ok(script.includes('TOTAL_TESTS=20'));
    assert.ok(script.includes('TIME_LIMIT=1.0'));
    assert.ok(script.includes('START=$(date +%s%3N)'));
    assert.ok(script.includes('timeout $TIME_LIMIT ./solution < "test$i.in" > "out$i.txt"'));
    assert.ok(script.includes('END=$(date +%s%3N)'));
    assert.ok(script.includes('EXEC_TIME=$((END - START))'));
    assert.ok(script.includes('VERDICT: TLE'));
    assert.ok(script.includes('VERDICT: RTE'));
    assert.ok(script.includes('VERDICT: OK'));
  });

  await runTest('generateThemisRunScript ho tro Python voi syntax check py_compile', () => {
    const script = generateThemisRunScript(10, 2.0, 'python');
    assert.ok(script.includes('python3 -m py_compile solution.py'));
    assert.ok(script.includes('TOTAL_TESTS=10'));
    assert.ok(script.includes('TIME_LIMIT=2.0'));
  });

  await runTest('parseThemisBashOutput trich xuat chinh xac loi bien dich (CE)', () => {
    const mockOutput = `COMPILATION_ERROR
solution.cpp: In function 'int main()':
solution.cpp:6:5: error: 'ans' was not declared in this scope`;

    const parsed = parseThemisBashOutput(mockOutput);
    assert.equal(parsed.isCompilationError, true);
    assert.ok(parsed.compilationMessage?.includes("'ans' was not declared in this scope"));
    assert.equal(parsed.tests.size, 0);
  });

  await runTest('parseThemisBashOutput boc tach dung thoi gian mili-giay, TLE, RTE va output', () => {
    const mockOutput = `COMPILATION_SUCCESS
---TEST 1---
VERDICT: OK
TIME: 45
OUTPUT:
100
---END TEST 1---
---TEST 2---
VERDICT: TLE
TIME: 1050
---END TEST 2---
---TEST 3---
VERDICT: RTE
TIME: 8
---END TEST 3---
---TEST 4---
VERDICT: OK
TIME: 0
OUTPUT:
200
---END TEST 4---`;

    const parsed = parseThemisBashOutput(mockOutput);
    assert.equal(parsed.isCompilationError, false);
    assert.equal(parsed.tests.size, 4);

    const t1 = parsed.tests.get(1)!;
    assert.equal(t1.verdict, 'OK');
    assert.equal(t1.timeMs, 45);
    assert.equal(t1.output.trim(), '100');

    const t2 = parsed.tests.get(2)!;
    assert.equal(t2.verdict, 'TLE');
    assert.equal(t2.timeMs, 1050);

    const t3 = parsed.tests.get(3)!;
    assert.equal(t3.verdict, 'RTE');
    assert.equal(t3.timeMs, 8);

    const t4 = parsed.tests.get(4)!;
    assert.equal(t4.verdict, 'OK');
    assert.equal(t4.timeMs, 0);
    assert.equal(t4.output.trim(), '200');

    // Kiem tra cong thuc chuyen doi sang thoi gian giay:
    // Neu timeMs = 45 -> 0.045s
    const sec1 = Math.max(0.001, +(t1.timeMs / 1000).toFixed(3));
    assert.equal(sec1, 0.045);

    // Neu timeMs = 0 -> 0.001s (tuyet doi khong bi 1.000s mac dinh)
    const sec4 = Math.max(0.001, +(t4.timeMs / 1000).toFixed(3));
    assert.equal(sec4, 0.001);
  });

  // ==========================================
  // NHOM 7: GRADE SUBMISSION AN TOAN VOI DE KHONG TEST
  // ==========================================
  console.log('\nNhom 7: Cham diem an toan khi bai tap chua co test case');

  await runTest('gradeSubmission tra ve ket qua em dep va thong bao ro rang khi de 0 test', async () => {
    const emptyProblem: Problem = createMockProblem({
      id: 'prob_empty',
      code: 'EMPTY',
      title: 'Bai Chua Co Test',
      topicId: 't1',
      description: 'Chua co test',
    });

    const res = await gradeSubmission(emptyProblem, 'int main(){return 0;}', 'cpp');
    assert.equal(res.totalTests, 0);
    assert.equal(res.passedCount, 0);
    assert.equal(res.totalPointsEarned, 0);
    assert.ok(res.compilationMessage?.includes('chưa có bộ test case'));
  });

  // ==========================================
  console.log('\nNhom 8: Luu tru va phuc hoi dieu huong (Reload Persistence)');

  await runTest('storageService luu va khoi phuc activeClassId, currentTab, selectedProblemId', async () => {
    storageService.setActiveClassId('cls_123');
    assert.equal(storageService.getActiveClassId(), 'cls_123');
    storageService.setActiveClassId(null);
    assert.equal(storageService.getActiveClassId(), null);

    storageService.setCurrentTab('submissions');
    assert.equal(storageService.getCurrentTab(), 'submissions');

    storageService.setSelectedProblemId('prob_456');
    assert.equal(storageService.getSelectedProblemId(), 'prob_456');
    storageService.setSelectedProblemId(null);
    assert.equal(storageService.getSelectedProblemId(), null);
  });

  // ==========================================
  console.log('\nNhom 9: Quy trinh phe duyet hoc sinh vao lop (Student Join Approval)');

  await runTest('Hoc sinh nhap ma vao lop thanh cong va tham gia vao lop', async () => {
    const testClass = storageService.addClass({ className: 'Lop Chuyen Tin', description: 'Mo ta' });
    const studentId = 'test_stu_approval';
    storageService.addStudent({
      id: studentId,
      fullName: 'Học sinh Test Duyệt',
      username: 'test_stu_approval',
      password: '123',
      createdAt: new Date().toISOString(),
    });

    // Nhap ma vao lop
    const res = storageService.joinClassByCode(studentId, testClass.joinCode);
    assert.equal(res.success, true);

    // Hoc sinh duoc liet ke trong lop chinh thuc
    const activeStudents = storageService.getStudentsInClass(testClass.id);
    assert.ok(activeStudents.some((s) => s.id === studentId));
  });

  // ==========================================
  console.log('\nNhom 10: Quan ly tai khoan hoc sinh (Doi mat khau, Xoa acc va Don dep sach lich su)');

  await runTest('storageService.updateStudentPassword cap nhat dung mat khau hoc sinh', async () => {
    const studentId = 'test_stu_pwd';
    storageService.addStudent({
      id: studentId,
      fullName: 'Học sinh Đổi Pass',
      username: 'stu_pass',
      password: '123',
      createdAt: new Date().toISOString(),
    });

    storageService.updateStudentPassword(studentId, 'new_secret_999');
    const updated = storageService.getStudents().find((s) => s.id === studentId);
    assert.equal(updated?.password, 'new_secret_999');
  });

  await runTest('Xoa hoc sinh se xoa sach lich su nop bai va lop hoc, tao lai la acc hoan toan moi', async () => {
    const studentId = 'test_stu_purge';
    const username = 'test_purge_user';
    const fullName = 'Nguyễn Văn Test';

    storageService.addStudent({
      id: studentId,
      fullName,
      username,
      password: '123',
      createdAt: new Date().toISOString(),
    });

    // Gia lap hoc sinh co submission trong he thong
    const dummySub = {
      id: 'sub_dummy_1',
      problemId: 'prob_test_1',
      problemCode: 'TEST',
      problemTitle: 'Bai Test',
      userId: studentId,
      userName: fullName,
      language: 'cpp' as const,
      sourceCode: 'int main(){}',
      submittedAt: new Date().toISOString(),
      status: 'COMPLETED' as const,
      totalPointsEarned: 10,
      maxTotalPoints: 10,
      passedCount: 1,
      totalTests: 1,
      overallVerdict: 'AC' as const,
      executionTime: 0.01,
      memory: 2.1,
      testResults: [],
    };
    storageService.saveSubmission(dummySub);

    // Kiem tra truoc khi xoa: co 1 submission va stats > 0
    const statsBefore = storageService.getUserStats({
      id: studentId,
      fullName,
      username,
      password: '123',
      createdAt: '',
    });
    assert.equal(statsBefore.totalSubmissions, 1);
    assert.equal(statsBefore.solvedCount, 1);

    // Giao vien xoa tai khoan
    storageService.deleteStudent(studentId);
    storageService.deleteSubmissionsForStudent(studentId, username, fullName);
    storageService.removeStudentFromAllClasses(studentId, username);

    // Kiem tra danh sach submissions: bai lam da bi xoa sach khoi man giao vien
    const subsRemaining = storageService.getSubmissions().filter((s) => s.userId === studentId || s.userName === fullName);
    assert.equal(subsRemaining.length, 0, 'Submissions cua hoc sinh bi xoa phai ve 0');

    // Tao lai 1 acc y het username va fullName
    const newStudentId = 'test_stu_purge_new_v2';
    storageService.addStudent({
      id: newStudentId,
      fullName,
      username,
      password: '123',
      createdAt: new Date().toISOString(),
    });

    // Acc moi kiem tra stats phai la 0, khong duoc thay lich su cu
    const statsAfterRecreate = storageService.getUserStats({
      id: newStudentId,
      fullName,
      username,
      password: '123',
      createdAt: '',
    });
    assert.equal(statsAfterRecreate.totalSubmissions, 0, 'Tai khoan moi phai co 0 submissions');
    assert.equal(statsAfterRecreate.solvedCount, 0, 'Tai khoan moi phai co 0 bai AC');
  });

  // ==========================================
  // NHOM 11: XAC THUC TOKEN & COOKIES SESSION BEN VUNG
  // ==========================================
  console.log('\nNhom 11: Xac thuc Token & Cookies Session ben vung');

  await runTest('storageService luu, khoi phuc va gia han session hoc sinh ben vung', async () => {
    const studentData = {
      id: 'stu_cookie_test',
      fullName: 'Học Sinh Cookie',
      username: 'student_cookie',
      password: '123',
      createdAt: new Date().toISOString(),
    };

    // Luu session
    storageService.setStudentSession(studentData);
    const retrieved = storageService.getStudentSession();
    assert.ok(retrieved);
    assert.equal(retrieved.username, 'student_cookie');

    // Gia han sliding session
    storageService.refreshSessionExpiry();
    const refreshed = storageService.getStudentSession();
    assert.equal(refreshed?.username, 'student_cookie');

    // Admin session
    storageService.setAdminSessionActive(true);
    assert.equal(storageService.isAdminSessionActive(), true);
    storageService.setAdminSessionActive(false);
    assert.equal(storageService.isAdminSessionActive(), false);

    // Xoa session
    storageService.setStudentSession(null);
    assert.equal(storageService.getStudentSession(), null);
  });

  console.log('\n====================================================');
  console.log(`KET QUA: ${passedTests}/${totalTestsRun} TESTS PASS (100% THANH CONG)`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('\nLoi khi chay bo kiem thu:', err);
  process.exit(1);
});
