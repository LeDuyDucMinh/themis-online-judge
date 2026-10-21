import type { Topic, Problem, Submission, UserStats, StudentUser } from '../types/judge';

const STORAGE_KEYS = {
  TOPICS: 'faminh_judge_topics_v1',
  PROBLEMS: 'faminh_judge_problems_v1',
  SUBMISSIONS: 'faminh_judge_submissions_v1',
  ADMIN_PASSWORD: 'faminh_admin_password_v1',
  ADMIN_SESSION: 'faminh_admin_session_active_v1',
  STUDENTS: 'faminh_judge_students_v1',
  STUDENT_SESSION: 'faminh_judge_student_session_v1',
  THEME: 'faminh_judge_theme_v1',
};

export const DEFAULT_ADMIN_PASSWORD = 'faminh@2026';

export const DEFAULT_STUDENTS: StudentUser[] = [
  {
    id: 'student_1',
    fullName: 'Lê Duy Đức Minh',
    username: 'ducminh',
    password: '123',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'student_2',
    fullName: 'Nguyễn Văn An',
    username: 'vanan',
    password: '123',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_TOPICS: Topic[] = [
  {
    id: 'topic_array',
    name: 'Mảng 1 chiều & Kỹ thuật 2 con trỏ',
    description: 'Các bài toán thao tác mảng, dồn mảng, prefix sum, tìm kiếm nhị phân và sliding window.',
    order: 1,
    icon: 'Layers',
  },
  {
    id: 'topic_math',
    name: 'Số học & Số nguyên tố',
    description: 'Sàng Eratosthenes, phân tích thừa số nguyên tố, ước số chung lớn nhất (GCD), đồng dư thức modulo.',
    order: 2,
    icon: 'Calculator',
  },
  {
    id: 'topic_dp',
    name: 'Quy hoạch động (Dynamic Programming)',
    description: 'Quy hoạch động 1 chiều, bài toán cái túi (Knapsack), dãy con tăng dài nhất (LIS), xâu con chung.',
    order: 3,
    icon: 'Cpu',
  },
  {
    id: 'topic_graph',
    name: 'Lý thuyết Đồ thị & Cây',
    description: 'Duyệt DFS, BFS, tìm đường đi ngắn nhất Dijkstra, cây khung nhỏ nhất Kruskal.',
    order: 4,
    icon: 'Network',
  },
];

export const INITIAL_PROBLEMS: Problem[] = [
  {
    id: 'prob_tong2so',
    code: 'TONG2SO',
    title: 'Tổng hai số nguyên lớn',
    topicId: 'topic_array',
    difficulty: 'Dễ',
    timeLimit: 1.0,
    memoryLimit: 256,
    totalPoints: 10,
    description: `Cho hai số nguyên dương $A$ và $B$. Nhiệm vụ của bạn là tính tổng $S = A + B$.

### Dữ liệu vào:
- File văn bản chuẩn (hoặc file \`TONG2SO.INP\`) gồm một dòng duy nhất chứa hai số nguyên $A, B$ cách nhau bởi dấu cách.
- **Ràng buộc:** $1 \\le A, B \\le 10^{18}$.

### Dữ liệu ra:
- In ra một số nguyên duy nhất là kết quả của phép cộng $A + B$.`,
    inputFormat: 'Gồm một dòng chứa hai số nguyên dương A và B.',
    outputFormat: 'In ra một số nguyên duy nhất là tổng A + B.',
    constraints: '$1 \\le A, B \\le 10^{18}$',
    samples: [
      {
        id: 's1',
        input: '5 7',
        output: '12',
        explanation: 'Tổng của 5 và 7 là 12.',
      },
      {
        id: 's2',
        input: '1000000000 2000000000',
        output: '3000000000',
        explanation: 'Cần lưu ý sử dụng kiểu dữ liệu 64-bit (long long trong C++, int64 trong Pascal).',
      },
    ],
    testCases: [
      { id: 'tc1', name: 'Test #01 (Mẫu 1)', input: '5 7', expectedOutput: '12', points: 2.0, isHidden: false },
      { id: 'tc2', name: 'Test #02 (Mẫu 2)', input: '1000000000 2000000000', expectedOutput: '3000000000', points: 2.0, isHidden: false },
      { id: 'tc3', name: 'Test #03 (Biên nhỏ)', input: '1 1', expectedOutput: '2', points: 2.0, isHidden: false },
      { id: 'tc4', name: 'Test #04 (Số lớn)', input: '999999999999 1', expectedOutput: '1000000000000', points: 2.0, isHidden: true },
      { id: 'tc5', name: 'Test #05 (Cực đại)', input: '1000000000000000000 1000000000000000000', expectedOutput: '2000000000000000000', points: 2.0, isHidden: true },
    ],
    videoConfig: {
      enabled: true,
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Hướng dẫn giải bài TONG2SO & Kỹ thuật xử lý số nguyên 64-bit',
      unlockRule: 'always',
    },
    author: 'Thầy Minh (FAMINH)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    starterCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    // freopen("TONG2SO.INP", "r", stdin);
    // freopen("TONG2SO.OUT", "w", stdout);
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    long long a, b;
    if (cin >> a >> b) {
        cout << a + b << "\\n";
    }
    return 0;
}`,
      python: `import sys

# freopen("TONG2SO.INP", "r", stdin)
# freopen("TONG2SO.OUT", "w", stdout)

def solve():
    parts = sys.stdin.read().split()
    if len(parts) >= 2:
        a = int(parts[0])
        b = int(parts[1])
        print(a + b)

if __name__ == '__main__':
    solve()`,
      pascal: `program TONG2SO;
var
    a, b: int64;
begin
    // assign(input, 'TONG2SO.INP'); reset(input);
    // assign(output, 'TONG2SO.OUT'); rewrite(output);
    read(a, b);
    writeln(a + b);
end.`,
      java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLong()) {
            long a = sc.nextLong();
            long b = sc.nextLong();
            System.out.println(a + b);
        }
        sc.close();
    }
}`,
    },
  },
  {
    id: 'prob_prime',
    code: 'PRIME',
    title: 'Kiểm tra số nguyên tố & Đếm ước',
    topicId: 'topic_math',
    difficulty: 'Trung bình',
    timeLimit: 1.0,
    memoryLimit: 256,
    totalPoints: 10,
    description: `Một số nguyên dương $P > 1$ được gọi là **số nguyên tố** nếu nó chỉ có đúng hai ước số dương là $1$ và chính nó.

Cho số nguyên dương $N$. Hãy kiểm tra xem $N$ có phải là số nguyên tố hay không.

### Công thức toán học:
Một số $N$ là số nguyên tố khi và chỉ khi:
$$\\forall d \\in [2, \\lfloor\\sqrt{N}\\rfloor], \\quad N \\not\\equiv 0 \\pmod{d}$$

### Ràng buộc:
- $1 \\le N \\le 10^{12}$.
- Với $50\\%$ số test: $N \\le 10^6$.
- Với $50\\%$ số test còn lại: $N \\le 10^{12}$.`,
    inputFormat: 'Gồm một dòng chứa số nguyên dương N duy nhất.',
    outputFormat: 'In ra "YES" nếu N là số nguyên tố, ngược lại in ra "NO" (không phân biệt hoa thường).',
    constraints: '$1 \\le N \\le 10^{12}$',
    samples: [
      {
        id: 'sp_1',
        input: '7',
        output: 'YES',
        explanation: '7 chỉ chia hết cho 1 và 7.',
      },
      {
        id: 'sp_2',
        input: '1',
        output: 'NO',
        explanation: 'Số 1 không phải là số nguyên tố.',
      },
      {
        id: 'sp_3',
        input: '12',
        output: 'NO',
        explanation: '12 chia hết cho 2, 3, 4, 6.',
      },
    ],
    testCases: [
      { id: 'tc_p1', name: 'Test #01 (Nhỏ - 7)', input: '7', expectedOutput: 'YES', points: 2.0, isHidden: false },
      { id: 'tc_p2', name: 'Test #02 (Biên - 1)', input: '1', expectedOutput: 'NO', points: 2.0, isHidden: false },
      { id: 'tc_p3', name: 'Test #03 (Biên - 2)', input: '2', expectedOutput: 'YES', points: 2.0, isHidden: false },
      { id: 'tc_p4', name: 'Test #04 (Hợp số lớn)', input: '1000000000000', expectedOutput: 'NO', points: 2.0, isHidden: true },
      { id: 'tc_p5', name: 'Test #05 (Nguyên tố lớn)', input: '999999999989', expectedOutput: 'YES', points: 2.0, isHidden: true },
    ],
    videoConfig: {
      enabled: true,
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Video Bài giảng: Thuật toán kiểm tra số nguyên tố tối ưu O(sqrt(N))',
      unlockRule: 'after_submission',
    },
    author: 'Cô Mai Lan (FAMINH)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    starterCode: {
      cpp: `#include <iostream>
using namespace std;

bool isPrime(long long n) {
    if (n < 2) return false;
    if (n == 2 || n == 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (long long i = 5; i * i <= n; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0) return false;
    }
    return true;
}

int main() {
    // freopen("PRIME.INP", "r", stdin);
    // freopen("PRIME.OUT", "w", stdout);
    long long n;
    if (cin >> n) {
        if (isPrime(n)) cout << "YES\\n";
        else cout << "NO\\n";
    }
    return 0;
}`,
      python: `import sys

# freopen("PRIME.INP", "r", stdin)
# freopen("PRIME.OUT", "w", stdout)

def is_prime(n):
    if n < 2:
        return False
    if n in (2, 3):
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

def main():
    val = sys.stdin.read().strip()
    if val:
        n = int(val)
        print("YES" if is_prime(n) else "NO")

if __name__ == '__main__':
    main()`,
    },
  },
  {
    id: 'prob_lis',
    code: 'DAYCONTANG',
    title: 'Dãy con tăng dài nhất (LIS)',
    topicId: 'topic_dp',
    difficulty: 'Khó',
    timeLimit: 1.0,
    memoryLimit: 256,
    totalPoints: 10,
    description: `Cho một dãy gồm $N$ số nguyên $A = (a_1, a_2, \\dots, a_N)$. 

Một dãy con của $A$ là dãy thu được bằng cách xóa đi một số phần tử (hoặc không xóa phần tử nào) và giữ nguyên thứ tự của các phần tử còn lại.

Dãy con được gọi là **tăng nghiêm ngặt** nếu mỗi phần tử sau đều lớn hơn phần tử đứng ngay trước nó. Hãy tìm **độ dài của dãy con tăng nghiêm ngặt dài nhất**.

### Ví dụ:
Cho dãy $A = [1, 2, 5, 3, 4]$.
Các dãy con tăng là $[1, 2, 5]$, $[1, 2, 3, 4]$. Dãy con tăng dài nhất có độ dài là $4$.`,
    inputFormat: 'Dòng 1 chứa số nguyên N (1 <= N <= 10^5).\nDòng 2 chứa N số nguyên a1, a2, ..., aN.',
    outputFormat: 'In ra một số nguyên duy nhất là độ dài của dãy con tăng dài nhất.',
    constraints: '$1 \\le N \\le 10^5$, $|a_i| \\le 10^9$',
    samples: [
      {
        id: 's_lis1',
        input: '5\n1 2 5 3 4',
        output: '4',
        explanation: 'Dãy con tăng dài nhất là 1, 2, 3, 4.',
      },
      {
        id: 's_lis2',
        input: '6\n5 4 3 2 1 0',
        output: '1',
        explanation: 'Không có phần tử nào tăng, độ dài lớn nhất là 1.',
      },
    ],
    testCases: [
      { id: 'tc_lis1', name: 'Test #01 (Mẫu 1)', input: '5\n1 2 5 3 4', expectedOutput: '4', points: 2.0, isHidden: false },
      { id: 'tc_lis2', name: 'Test #02 (Giảm dần)', input: '6\n5 4 3 2 1 0', expectedOutput: '1', points: 2.0, isHidden: false },
      { id: 'tc_lis3', name: 'Test #03 (Tăng dần)', input: '5\n10 20 30 40 50', expectedOutput: '5', points: 2.0, isHidden: false },
      { id: 'tc_lis4', name: 'Test #04 (Dãy xen kẽ)', input: '8\n10 9 2 5 3 7 101 18', expectedOutput: '4', points: 2.0, isHidden: true },
      { id: 'tc_lis5', name: 'Test #05 (N lớn)', input: '7\n0 8 4 12 2 10 6', expectedOutput: '3', points: 2.0, isHidden: true },
    ],
    videoConfig: {
      enabled: true,
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Video Giải thích: Thuật toán DP O(N log N) bằng Binary Search cho bài toán LIS',
      unlockRule: 'full_score',
    },
    author: 'Ban Giám Khảo FAMINH',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    starterCode: {
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    // freopen("DAYCONTANG.INP", "r", stdin);
    // freopen("DAYCONTANG.OUT", "w", stdout);
    int n;
    if (!(cin >> n)) return 0;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];

    vector<int> tail;
    for (int x : a) {
        auto it = lower_bound(tail.begin(), tail.end(), x);
        if (it == tail.end()) {
            tail.push_back(x);
        } else {
            *it = x;
        }
    }

    cout << tail.size() << "\\n";
    return 0;
}`,
      python: `import sys
import bisect

# freopen("DAYCONTANG.INP", "r", stdin)
# freopen("DAYCONTANG.OUT", "w", stdout)

def solve():
    data = sys.stdin.read().split()
    if not data:
        return
    n = int(data[0])
    a = [int(x) for x in data[1:n+1]]

    tail = []
    for x in a:
        idx = bisect.bisect_left(tail, x)
        if idx == len(tail):
            tail.append(x)
        else:
            tail[idx] = x

    print(len(tail))

if __name__ == '__main__':
    solve()`,
    },
  },
];

export const storageService = {
  getTopics(): Topic[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TOPICS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(INITIAL_TOPICS));
      return INITIAL_TOPICS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_TOPICS;
    }
  },

  saveTopics(topics: Topic[]): void {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  },

  getProblems(): Problem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROBLEMS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(INITIAL_PROBLEMS));
      return INITIAL_PROBLEMS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_PROBLEMS;
    }
  },

  saveProblems(problems: Problem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(problems));
    } catch (err) {
      console.warn('[storageService] Lỗi lưu trữ problems (vượt quá dung lượng localStorage):', err);
    }
  },

  getSubmissions(): Submission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveSubmission(submission: Submission): void {
    const subs = this.getSubmissions();
    subs.unshift(submission); // Mới nhất lên đầu
    // Giữ tối đa 150 submissions gần nhất
    const trimmed = subs.slice(0, 150);
    try {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[storageService] Lỗi lưu trữ submissions vào localStorage:', err);
    }
  },

  getUserStats(student?: StudentUser | null): UserStats {
    let subs = this.getSubmissions();
    if (student) {
      subs = subs.filter((s) => {
        const matchName = s.userName && student.fullName &&
          s.userName.trim().toLowerCase() === student.fullName.trim().toLowerCase();
        const matchUser = s.userId && student.username &&
          s.userId.trim().toLowerCase() === student.username.trim().toLowerCase();
        return Boolean(matchName || matchUser);
      });
    }
    const solvedProblemIds = new Set<string>();
    const attemptedProblemIds = new Set<string>();
    let pointsAccumulated = 0;

    // Tính điểm cao nhất của mỗi bài
    const bestScoreMap = new Map<string, number>();

    for (const sub of subs) {
      attemptedProblemIds.add(sub.problemId);
      const currentBest = bestScoreMap.get(sub.problemId) || 0;
      if (sub.totalPointsEarned > currentBest) {
        bestScoreMap.set(sub.problemId, sub.totalPointsEarned);
      }
      if (sub.passedCount === sub.totalTests && sub.totalTests > 0) {
        solvedProblemIds.add(sub.problemId);
      }
    }

    bestScoreMap.forEach((score) => {
      pointsAccumulated += score;
    });

    return {
      solvedCount: solvedProblemIds.size,
      attemptedCount: attemptedProblemIds.size,
      totalSubmissions: subs.length,
      pointsAccumulated: +pointsAccumulated.toFixed(1),
    };
  },

  getProblemStatus(problemId: string, maxPoints: number, student?: StudentUser | null): 'UNSOLVED' | 'PARTIAL' | 'SOLVED' {
    let subs = this.getSubmissions().filter((s) => s.problemId === problemId);
    if (student) {
      subs = subs.filter((s) => {
        const matchName = s.userName && student.fullName &&
          s.userName.trim().toLowerCase() === student.fullName.trim().toLowerCase();
        const matchUser = s.userId && student.username &&
          s.userId.trim().toLowerCase() === student.username.trim().toLowerCase();
        return Boolean(matchName || matchUser);
      });
    }
    if (subs.length === 0) return 'UNSOLVED';

    const maxEarned = Math.max(...subs.map((s) => s.totalPointsEarned));
    if (maxEarned >= maxPoints) return 'SOLVED';
    if (maxEarned > 0) return 'PARTIAL';
    return 'UNSOLVED';
  },

  getAdminPassword(): string {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
  },

  setAdminPassword(newPassword: string): void {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, newPassword);
  },

  verifyAdminPassword(password: string): boolean {
    const stored = this.getAdminPassword();
    return password.trim() === stored.trim();
  },

  isAdminSessionActive(): boolean {
    return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  },

  setAdminSessionActive(active: boolean): void {
    if (active) {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    }
  },

  getStudents(): StudentUser[] {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      this.saveStudents(DEFAULT_STUDENTS);
      return DEFAULT_STUDENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_STUDENTS;
    }
  },

  saveStudents(students: StudentUser[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },

  addStudent(student: StudentUser): void {
    const list = this.getStudents();
    this.saveStudents([student, ...list]);
  },

  deleteStudent(id: string): void {
    const list = this.getStudents().filter((s) => s.id !== id);
    this.saveStudents(list);
  },

  getStudentSession(): StudentUser | null {
    const raw = sessionStorage.getItem(STORAGE_KEYS.STUDENT_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setStudentSession(student: StudentUser | null): void {
    if (student) {
      sessionStorage.setItem(STORAGE_KEYS.STUDENT_SESSION, JSON.stringify(student));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
    }
  },

  resetToDefault(): void {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(INITIAL_TOPICS));
    localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(INITIAL_PROBLEMS));
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_PASSWORD);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
  },
};

