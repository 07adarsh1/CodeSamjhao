import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    puter?: any;
  }
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[#*_`~>[\]()]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Mode = 'explain' | 'error' | 'roast' | 'interview' | 'hinglish';
type Lang = 'auto' | 'python' | 'javascript' | 'java' | 'cpp' | 'go';
type ShareFormat = 'story' | 'square';

interface LineExp {
  code: string;
  explain: string;
  roast?: string;
}

interface ErrorDetails {
  errorKyaHai: string;
  kyuAaya: string;
  fixKaiseKare: string;
  correctedCode?: string;
  tip: string;
  rawText?: string;
}

interface QuizItem {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface QuizData {
  quizzes: QuizItem[];
}

interface Explanation {
  type: 'recursion' | 'loop' | 'api' | 'oop' | 'conditional' | 'generic' | 'error';
  tldr: string;
  analogy: string;
  lines: LineExp[];
  interview: string;
  complexity: string;
  vibe: string;
  roastScore?: number;
  roastIssues?: string[];
  errorDetails?: ErrorDetails;
}

  const EXAMPLES = {
  recursion: `def factorial(n):
    # base case - yahi pe rukna hai
    if n == 0:
        return 1
    # recursive call - khud ko hi bula liya
    return n * factorial(n-1)`,
  loop: `for i in range(5):
    print(f"Item {i} - mess me token {i}")

# total 5 baar chalega`,
  api: `async function getUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    console.log("Data aa gaya:", data);
    return data;
  } catch (err) {
    console.error("Network fail ho gaya bhai");
  }
}`,
  roast: `def calc(a, b):
    x = []
    for i in range(len(a)):
        for j in range(len(b)):
            for k in range(5):
                temp = a[i] + b[j]
                x.append(temp * k)
    return x
# kya likha hai bhai ye?`,
  error: {
    error: `TypeError: Cannot read properties of undefined (reading 'map')
    at renderUsers (App.jsx:14:22)
    at UserList (App.jsx:8:5)`,
    code: `function UserList({ userGroup }) {
  // Buggy code: userGroup.users might be undefined when loading!
  return (
    <div>
      {userGroup.users.map(u => (
        <span key={u.id}>{u.name}</span>
      ))}
    </div>
  );
}`
  }
};

function highlightHinglish(text: string) {
  const dict = new Set(['bhai','hai','kya','ye','toh','matlab','kar','raha','wali','wala','ka','ki','ko','mein','me','se','ab','aur','nahi','tera','iska','iska','samjha','samjho','hota','ho','gaya','jaa','jaye','bana','likha','chal','ruka','roke','sahi','galat','thoda','bahut','ek','sab','sabzi','mandi','laptop','royega','jugaad','dekh','chalega','chalega']);
  const words = text.split(/(\s+)/);
  return words.map((w, i) => {
    const clean = w.toLowerCase().replace(/[^\w]/g,'');
    if (dict.has(clean) && clean.length>1) {
      return <span key={i} className="text-orange-400 font-bold">{w}</span>;
    }
    return <span key={i}>{w}</span>;
  });
}

function TypeWriter({ text, speed = 18, startDelay = 0, onDone }: { text: string; speed?: number; startDelay?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const isDoneRef = useRef(false);

  useEffect(() => {
    setDisplayed('');
    isDoneRef.current = false;
    let idx = 0;
    let intervalId: any = null;

    const delayId = setTimeout(() => {
      intervalId = setInterval(() => {
        idx += 1;
        setDisplayed(text.slice(0, idx));
        if (idx >= text.length) {
          clearInterval(intervalId);
          if (!isDoneRef.current) {
            isDoneRef.current = true;
            onDoneRef.current?.();
          }
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(delayId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-[8px] h-[1.1em] bg-orange-400 ml-[2px] -mb-[2px] animate-pulse" />
      )}
    </span>
  );
}

function detectRoastIssues(code: string): string[] {
  const issues: string[] = [];
  const lines = code.split('\n');
  const singleLetterRegex = /\b(let|var|const)?\s*[a-z]\b\s*=|\bfor\s+[a-z]\s+in\b|\b[a-z]\s*=\s*\[\]|\btemp\b|\btmp\b|\bxyz\b|\babc\b|\bdata1\b|\bvar1\b|\ba\s*,\s*b\b/;
  if (singleLetterRegex.test(code) || /\(a,\s*b\)/.test(code) || /def \w+\(a/.test(code)) {
    issues.push("single_letter");
  }
  const nestingCount = (code.match(/for\s|while\s/g) || []).length;
  const indentLevels = Math.max(...lines.map(l => (l.match(/^\s+/)?.[0].length || 0) / 4), 0);
  if (nestingCount >= 2 || indentLevels >= 3 || (code.includes('for') && code.split('for').length > 3)) {
    issues.push("deep_nesting");
  }
  const hasComments = /#|\/\/|\/\*|\*\/|"""/.test(code);
  const codeLines = lines.filter(l => l.trim().length > 5).length;
  if (!hasComments && codeLines > 3) {
    issues.push("no_comments");
  }
  if ((code.match(/for/g) || []).length >= 3) {
    issues.push("cubic");
  }
  if (/console\.log|print\(/.test(code) && !code.includes('Item')) {
    issues.push("print_debug");
  }
  return issues;
}

function detectType(code: string): Explanation['type'] {
  const c = code.toLowerCase();
  const hasRecursionPattern = /(\w+)\s*\([^)]*\)\s*.*\1\s*\(/.test(code) || c.includes('factorial') || (c.includes('return') && c.includes('n-1'));
  if (hasRecursionPattern || c.includes('recursion')) return 'recursion';
  if (c.includes('fetch') || c.includes('axios') || c.includes('await') || c.includes('async')) return 'api';
  if (c.includes('for ') || c.includes('while ') || c.includes('range(')) return 'loop';
  if (c.includes('class ')) return 'oop';
  if (c.includes('if ') || c.includes('else')) return 'conditional';
  return 'generic';
}

function generateRoastExplanation(code: string): Explanation {
  const type = detectType(code);
  const issues = detectRoastIssues(code);
  const rawLines = code.split('\n').filter(l => l.trim().length > 0);
  const hasSingle = issues.includes('single_letter');
  const hasNesting = issues.includes('deep_nesting') || issues.includes('cubic');
  const hasNoComments = issues.includes('no_comments');
  const cubic = issues.includes('cubic');

  let tldr = "";
  if (hasSingle && hasNesting) {
    tldr = "Bhai ye variable ka naam 'a', 'temp', 'xyz' kya hai? Sabzi mandi laga rakhi hai? Naam toh dhang ka rakh le! Aur ye nested loop... O(n^3)? Bhai tera laptop bhi royega isko chalate chalate... 🔥";
  } else if (hasSingle) {
    tldr = "Arre bhai 'a', 'b', 'x', 'temp' ?? Variable naam rakhne me kanjoosi? Thoda creativity dikha de, girlfriend ka naam bhi aise rakhta hai kya 'temp1'? 😭";
  } else if (hasNesting) {
    tldr = "Teen teen loop ek ke andar? Bhai Inception bana diya tune! O(n³) me tera code nahi, tera future slow hai! Ek loop me kaam nahi ho raha tha kya? 🔥💀";
  } else if (hasNoComments) {
    tldr = "Comment ek bhi nahi? Samjha kya future me khud bhi nahi samjhega ye kya likha tha! Agla developer tujhe gali deke jayega bhai!";
  } else {
    tldr = "Dekh bhai, kaam toh kar raha hai par aise jaise jugaad se chal rahi Maruti 800 pahad chadh rahi ho. Refactor kar le warna interviewer hasega! 😂";
  }

  const analogy = hasSingle
    ? `Ye code dekha maine toh laga koi raddi ka khat khola hai. Variable naam 'a', 'b', 'x' — bhai kirane ki dukan ka hisaab bhi isse accha likha hota hai! Aur ${cubic ? "teen loop ek ke upar ek, jaise shaadi me teen DJ ek saath baja rahe ho — shor hi shor hai, gaana koi nahi samajh raha." : "logic aisa ki pados wali aunty bhi confuse ho jaye."} ${hasNoComments ? "Comment toh likha hi nahi, matlab tu chahta hai koi aur samjhe hi na? Secret recipe hai kya?" : ""}`
    : `Bhai ye ${type} wala code dekh ke mera CPU garam ho gaya. ${cubic ? "O(n³) complexity? Bhai NASA ka supercomputer bhi bolega 'bhai rehne de'." : "Logic aisa hai jaise bina map ke Dilli me ghoom rahe ho — pahuch toh jaoge par 3 ghante extra lagenge."} Thoda clean code ka gyaan le le YouTube se!`;

  const interview = "Interviewer dekhega toh pehle hasega, phir bolega 'beta Big-O kya hai iska?' Tu bolega O(n³) aur woh bolega 'aur optimize?' Toh bol dena 'Sir hashmap use karke O(n) kar sakte hain, variable naam meaningful rakh ke readability badha sakte hain, aur comments add karke agle bande ki zindagi bacha sakte hain.' Roast sun liya, ab sudhar ja!";

  const lines: LineExp[] = rawLines.slice(0, 12).map((line) => {
    const trimmed = line.trim();
    const low = trimmed.toLowerCase();
    if (/def \w+\(a/.test(trimmed) || /\b[a-z]\b\s*=\s*\[\]/.test(trimmed) || trimmed.includes('temp =') || trimmed.match(/^[a-z]\s*=/)) {
      return { code: trimmed, explain: "Samajh gaya senior — tu lazy hai", roast: `Are 'a' kya hai? Alu? Anda? Naam toh bata de bhai kya store kar raha hai! 'userList', 'totalPrice' aise kuch rakh!` };
    }
    if (low.includes('for') && (rawLines.join('').match(/for/g) || []).length >= 2) {
      return { code: trimmed, explain: "Nested loop alert", roast: "Phir se loop? Bhai loop ke andar loop ke andar loop — tu jalebi bana raha hai ya code?" };
    }
    if (low.includes('for ') || low.includes('while')) {
      return { code: trimmed, explain: "Loop start", roast: "Chalo loop toh theek hai, par andar kya kar raha hai dekhte hain..." };
    }
    if (low.includes('return')) {
      return { code: trimmed, explain: "Return kar raha hai", roast: "Shukr hai return toh kiya, warna infinite tak ghoomta rehta!" };
    }
    if (low.includes('print') || low.includes('console.log')) {
      return { code: trimmed, explain: "Debug print", roast: "Print se debug? Bhai debugger use kar le, 2024 chal raha hai!" };
    }
    return { code: trimmed, explain: "Logic line", roast: "Ye line chal toh rahi hai par pata nahi kyu chal rahi hai — tu hi bata de?" };
  });

  return {
    type,
    tldr,
    analogy,
    lines,
    interview,
    complexity: cubic ? "⏱ Time: O(n³) 💀 | 💾 Space: O(n) — Laptop jal jayega!" : "⏱ Time: O(n²) | 💾 Space: O(n) — Theek-thaak bekaar",
    vibe: `Roast Score: ${Math.min(95, 60 + issues.length * 12)}/100 🔥 — ${issues.length > 2 ? "Bhai tu toh legend nikla!" : "Abhi bhi sudhar sakta hai"}`,
    roastScore: Math.min(95, 60 + issues.length * 12),
    roastIssues: issues,
  };
}

function generateExplanation(code: string, mode: Mode): Explanation {
  if (mode === 'roast') return generateRoastExplanation(code);
  const type = detectType(code);
  const rawLines = code.split('\n').filter(l => l.trim().length > 0);
  let tldr = '';
  let analogy = '';
  let interview = '';
  let complexity = '';
  let vibe = '';
  const isHinglishOnly = mode === 'hinglish';

  if (type === 'recursion') {
    tldr = isHinglishOnly
      ? "Bhai ye recursion hai, matlab function khud ko hi baar baar bula raha hai, jab tak kaam khatam na ho jaye. Base case pe rukta hai."
      : "Arre ye toh recursion hai! Function khud ko hi call kar raha hai jab tak base case na mile, jaise Inception movie.";
    analogy = isHinglishOnly
      ? "Socho ek banda hai jo sheeshe me khud ko dekh ke dusre bande ko bula raha hai, woh teesra, aise chain ban raha hai. Jab tak dulha nahi milta (n==0), baraat chalti rehti hai. Phir ek-ek karke sab wapas ghar aate hain. Stack me yaad rakhta hai kaun kaha tha."
      : "Yeh recursion shaadi ki baraat jaisa hai bhai. Ek banda dusre ko bula raha hai, woh teesre ko, chain chalta rehta hai jab tak dulha (base case n==0) nahi milta. Agar base case bhul gaye toh infinite loop — jaise woh rishtedaar jo har shaadi me puchta hai 'beta shaadi kab karoge?' aur khud loop me fas jata hai. Stack me calls jama hote jaate hain, phir ek-ek karke wapas aate hain.";
    interview = `🗣️ EXACT VERBAL PITCH:
"Sir, I've solved this using linear recursion. Base case 'n == 0' returns 1 to terminate the call stack and prevent infinite recursion. In each frame, we multiply n with the subproblem factorial(n-1) and wait for the stack to unwind."

⏱️ COMPLEXITY JUSTIFICATION:
• Time Complexity: O(n) — exactly n recursive stack frames are pushed.
• Space Complexity: O(n) — auxiliary call stack depth reaches n (non-tail-recursive).

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "Agar n = 50,000 ho toh stack overflow crash aayega. Space O(1) kaise karoge?"
• Tera Jawab: "Sir, hum iterative loop use karenge ya accumulator ke saath tail-call optimization likhenge jisse auxiliary stack space O(1) ho jayegi."

⚠️ EDGE CASES TO CALL OUT:
• Negative input (n < 0): Base condition miss hone par infinite recursion / StackOverflowError aayega.
• Integer Overflow: For n > 20, 64-bit integer overflow karega, so language-specific BigInt zaroori hai.`;
    complexity = "⏱ Time: O(n) | 💾 Space: O(n) stack";
    vibe = "Senior bolta: 'Recursion samajh gaya toh 50% DSA clear hai samjho'";
  } else if (type === 'loop') {
    tldr = isHinglishOnly
      ? "Ye seedha loop hai bhai, ek kaam ko baar baar kar raha hai, jaise attendance me naam pukarna."
      : "Simple sa loop hai bhai, ek-ek karke kaam nipat raha hai, jaise proxy lag rahi ho class me.";
    analogy = isHinglishOnly
      ? "College mess me line lagi hai, 5 bande khade hain. Har ek ko ek-ek karke thali mil rahi hai. 'i' matlab kaunsa number chal raha hai. Range(5) matlab total 5 log."
      : "Ye for loop bilkul college mess ki line jaisa hai. Token 0 se 4 tak lage hain, har bande ko ek-ek karke khana (print) mil raha hai. 'i' matlab token number hai jo har baar badh raha hai. Range(5) matlab 5 log hain line me. Mess wala bhaiya (interpreter) ek-ek ko bula raha hai.";
    interview = `🗣️ EXACT VERBAL PITCH:
"Sir, this is a standard linear iteration over range(5). We process elements sequentially from index 0 to 4 in a deterministic single-threaded loop."

⏱️ COMPLEXITY JUSTIFICATION:
• Time Complexity: O(n) — where n=5 iterations.
• Space Complexity: O(1) — constant auxiliary memory, no heap allocations.

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "For loop kab use karna chahiye vs While loop?"
• Tera Jawab: "Sir, For loop tab jab iteration count pehle se fixed ya deterministic ho; While loop tab jab termination condition dynamic runtime state ya event flag pe depend kare."

⚠️ EDGE CASES TO CALL OUT:
• Empty ranges, off-by-one errors on upper/lower bounds.`;
    complexity = "⏱ Time: O(n) | 💾 Space: O(1)";
    vibe = "Senior bolta: 'Loop me hi toh pura programming hai, yahi se sab shuru hota hai'";
  } else if (type === 'api') {
    tldr = isHinglishOnly
      ? "Ye API call hai bhai, matlab dusre server se data maang rahe ho, jaise padosi se cheeni lena."
      : "Ye API call hai, matlab dusre ke server se data maang rahe ho, Swiggy se biryani order karne jaisa.";
    analogy = isHinglishOnly
      ? "Tum ek bande ko bheja dukaan pe samaan lane, tab tak tum ghar pe dusra kaam kar rahe ho. Jab woh layega tab dekho ge. Agar raste me gir gaya toh try-catch sambhal lega."
      : "API call matlab padosi ke ghar se cheeni maangna. Tum fetch() ko bhej rahe ho, await kar rahe ho ki woh wapas aaye. Tab tak JS dusre kaam karta rahega — non-blocking hai, samjha? Jaise Swiggy boy ko bheja, tum tab tak Instagram scroll kar rahe ho. Jab data aayega tab .json() se dabba khologe. Try-catch isliye kyunki kabhi network fail ho sakta hai, jaise Swiggy wala raste me gir gaya.";
    interview = `🗣️ EXACT VERBAL PITCH:
"Sir, this is an asynchronous I/O operation using async/await. It dispatches a non-blocking HTTP GET request via fetch(), yields execution to the JavaScript event loop, and resumes on promise resolution with structured try/catch error handling."

⏱️ COMPLEXITY JUSTIFICATION:
• Time Complexity: O(1) JS execution + Network RTT latency.
• Space Complexity: O(1) auxiliary + memory for the parsed response payload.

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "Fetch fail hone par kya catch block 404/500 pakadta hai?"
• Tera Jawab: "No sir! Fetch only rejects on network failure or DNS errors. HTTP 404/500 me promise resolve hoti hai with res.ok === false, isiliye hume 'if (!res.ok) throw new Error()' check karna padta hai."

⚠️ EDGE CASES TO CALL OUT:
• Network timeouts (use AbortController), JSON parsing errors if body is empty or HTML.`;
    complexity = "⏱ Time: O(1) + network latency | 💾 Space: O(1)";
    vibe = "Senior bolta: 'API samajh gaya toh half backend samajh gaya'";
  } else if (type === 'oop') {
    tldr = isHinglishOnly
      ? "Class bana rahe ho bhai, matlab ek naksha bana diya, usse kitne bhi ghar bana lo."
      : "Class hai bhai, blueprint bana rahe ho, jaise ghar ka naksha — usse kitne bhi ghar bana sakte ho.";
    analogy = isHinglishOnly
      ? "Mummy ki recipe book samjho. Ek baar likh di toh usse roz paratha bana sakte ho. Har paratha alag hai par recipe same."
      : "Class matlab mummy ka khandani recipe book. Ek baar recipe (class) likh di, usse kitne bhi parathe (objects) bana lo. Constructor __init__ matlab jab naya paratha banega toh pehle kya karna hai. Self matlab 'mera wala' — har object apna data khud rakhta hai.";
    interview = `🗣️ EXACT VERBAL PITCH:
"Sir, this defines an object-oriented blueprint with encapsulated state and methods. Instances instantiate their own unique lexical state while sharing prototype methods to conserve memory."

⏱️ COMPLEXITY JUSTIFICATION:
• Time Complexity: O(1) object instantiation and method dispatch.
• Space Complexity: O(1) per instance state.

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "Composition vs Inheritance — kab kya prefer karoge?"
• Tera Jawab: "Sir, Composition over Inheritance prefer karenge for loose coupling ('has-a' vs 'is-a'), taaki fragile base class problem na ho."

⚠️ EDGE CASES TO CALL OUT:
• Null pointer dereferences on uninitialized fields, circular references causing memory leaks.`;
    complexity = "⏱ Time: Depends | 💾 Space: O(n) objects";
    vibe = "Senior bolta: 'Class banani aa gayi toh Java wale izzat dene lagte hain'";
  } else if (type === 'conditional') {
    tldr = "If-else ka chakkar hai, matlab 'agar ye hua toh ye karo, nahi toh woh karo' — desi parents jaisa logic.";
    analogy = "Ye if-else bilkul mummy jaisa hai. Agar number 90% se upar aaye toh 'shabaash beta' (if block), nahi toh 'Sharma ji ke bete ko dekho' (else block). Condition check ho raha hai, uske hisab se rasta decide ho raha hai.";
    interview = `🗣️ EXACT VERBAL PITCH:
"Sir, this is a deterministic branching structure. It evaluates conditions sequentially with short-circuit evaluation to direct control flow to the appropriate execution path."

⏱️ COMPLEXITY JUSTIFICATION:
• Time Complexity: O(1) branch condition evaluation.
• Space Complexity: O(1) constant auxiliary space.

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "Multiple if-else if ladders ko kaise refactor karoge?"
• Tera Jawab: "Sir, agar discrete keys hain toh Lookup Table / Object Dictionary ya Switch statement use karenge, aur complex rules me Strategy Pattern laga sakte hain."

⚠️ EDGE CASES TO CALL OUT:
• Type coercion pitfalls (e.g. == vs ===), unhandled default/fallback cases.`;
    complexity = "⏱ Time: O(1) | 💾 Space: O(1)";
    vibe = "Senior bolta: 'If-else galat lagaya toh pura logic gaya'";
  } else {
    tldr = "Arre ye toh basic structure hai, variable, function, thoda logic — starter pack hai coding ka.";
    analogy = "Ye code bilkul chai banane jaisa hai. Pehle paani garam (variable declare), phir chai patti (logic), phir cheeni (return). Har line ka ek kaam hai, step-by-step. Jaise recipe follow kar rahe ho.";
    interview = `🗣️ EXACT VERBAL PITCH:
"Sir, this logic follows clean, modular design principles with single responsibility. Variables and control flow are structured for readability and maintainability."

⏱️ COMPLEXITY JUSTIFICATION:
• Time Complexity: O(1) to O(n) depending on data scale.
• Space Complexity: O(1) auxiliary memory.

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "Isko production-ready banana ho toh kya add karoge?"
• Tera Jawab: "Sir, strict input validation, proper error boundaries, automated unit tests covering boundary cases, aur structured logging add karenge."

⚠️ EDGE CASES TO CALL OUT:
• Null/undefined parameters, edge boundary inputs, unexpected type coercion.`;
    complexity = "⏱ Time: O(1) to O(n) | 💾 Space: O(1)";
    vibe = "Senior bolta: 'Pehle simple code samajh, phir complex pe ja'";
  }

  const lines: LineExp[] = rawLines.slice(0, 12).map((line) => {
    const trimmed = line.trim();
    const low = trimmed.toLowerCase();
    if (low.startsWith('def ') || low.startsWith('function ') || low.includes('async function')) {
      return { code: trimmed, explain: isHinglishOnly ? `Function bana rahe ho, ek dabba jisme code rakha hai.` : `Function define kar rahe ho — matlab ek dabba bana diya jisme code rakha hai, jab chahiye tab bula sakte ho. Naam important hai.` };
    }
    if (low.startsWith('if ') || low.startsWith('if(')) {
      return { code: trimmed, explain: `Condition check — 'agar ye sach hai toh andar wala chalega'. Gatekeeper hai.` };
    }
    if (low.includes('return')) {
      return { code: trimmed, explain: isHinglishOnly ? `Kaam khatam, result wapas bhej diya.` : `Return matlab kaam khatam, result wapas bhej diya. Jaise dukan se samaan leke ghar aana.` };
    }
    if (low.includes('for ') || low.includes('while')) {
      return { code: trimmed, explain: isHinglishOnly ? `Loop shuru, ye line baar baar chalegi.` : `Loop start — ab yahi line baar-baar chalegi. Counter sambhal ke.` };
    }
    if (low.includes('await') || low.includes('fetch')) {
      return { code: trimmed, explain: isHinglishOnly ? `Ruko, network se data aa raha hai.` : `Ruko zara, network se data aa raha hai. Await matlab 'aane do phir aage badhenge'.` };
    }
    if (low.includes('try') || low.includes('catch') || low.includes('except')) {
      return { code: trimmed, explain: `Safety net hai, agar error aaya toh app crash nahi hoga. Helmet pehenna jaisa.` };
    }
    if (low.includes('print') || low.includes('console.log')) {
      return { code: trimmed, explain: isHinglishOnly ? `Print kara rahe ho console me dekhne ke liye.` : `Debug ke liye print kara rahe ho — console me dikhega kya ho raha hai.` };
    }
    if (low.includes('class ')) {
      return { code: trimmed, explain: `Class ban rahi hai — blueprint. Isse objects banenge.` };
    }
    if (low.includes('=')) {
      return { code: trimmed, explain: isHinglishOnly ? `Variable me value daal rahe ho.` : `Variable me value daal rahe ho, dabbe me samaan rakhne jaisa.` };
    }
    return { code: trimmed, explain: `Ye line logic ka hissa hai, flow ko aage badha rahi hai.` };
  });

  return { type, tldr, analogy, lines, interview, complexity, vibe };
}

async function fetchGroqExplanation(code: string, mode: Mode): Promise<Explanation> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No Groq API key configured in .env");
  }

  const systemPrompt = `You are a hilarious, highly experienced Indian senior software engineer who explains programming code in authentic, conversational Hinglish (Hindi and English mixed naturally in Roman script).
Current Mode: ${
  mode === 'roast'
    ? 'BRUTAL ROAST (be funny, savage, and deeply sarcastic about bad patterns, terrible naming like single-letter variables, deep nesting, and anti-patterns like Sharma ji ka beta roasts, while still being educational)'
    : mode === 'interview'
    ? 'INTERVIEW PREP (deliver a winning FAANG/MNC technical interview playbook with exact first-person verbal pitch, time/space complexity proofs, counter-question traps, and edge cases)'
    : 'FRIENDLY SENIOR DEV EXPLANATION (relatable, vivid, and diverse desi analogies in conversational Hinglish)'
}.

CRITICAL INSTRUCTION FOR ANALOGIES & EXPLANATIONS:
Avoid repeating only "chai tapri" or "Swiggy". Draw creatively and randomly from this DIVERSE CATALOG OF REAL-WORLD DESI SCENARIOS that best fit the code logic:
1. Daily Indian Commute & Traffic:
   - Mumbai local / Delhi Metro peak rush: Concurrency, race conditions, buffer overflow, thread contention ("gate khulte hi bina mutex ke 50 log ghus gaye").
   - IRCTC Tatkal booking at 10:00 AM: Load spikes, DDoS, rate limiting, session timeouts, race conditions for quota.
   - Auto-rickshaw bhaiya refusing meter: 404 Route Not Found, 503 Service Unavailable, timeout & retry logic.
   - Narrow gali / Silk Board traffic jam: Deadlocks (aamne-saamne do gaadiyan, resource koi release nahi kar raha).
2. Desi Food, Kirana & Bazaars:
   - Golgappa / Panipuri counter: FIFO Queues, buffer underrun when plate runs dry, batch processing.
   - Mohalle ki kirana dukaan ka bahi-khata (udhaar register): Database transactions, ACID compliance, memory leaks (hisaab likhna bhool gaye).
   - Sabzi mandi bargaining: Binary search / divide & conquer (₹100 vs ₹50 settle at ₹75).
   - Halwai frying samosas in kadai: Background worker threads / async jobs vs front counter UI serving customers.
   - Mumbai Dabbawala tiffin delivery: Robust packet routing, load balancing, zero packet drop architecture.
3. Desi Parivaar & Social Dynamics:
   - Mummy vs Papa budget dynamics: Mummy = Global Redux/Context store (pata hai har kamre me kya hai), Papa = Read-only config.
   - Papa ka batua vs Fridge: Access modifiers (batua is 'private' with UnauthorizedException, fridge is 'public').
   - Khandaani zameen & sanskaar: Inheritance ('extends') and method overriding ('polymorphism' - zameen leke startup khol liya).
   - Mohalle ki gossip aunties in balcony: Pub/Sub broadcast event listeners, zero-latency webhooks.
   - Bin-bulaaye rishtedaar on door: Unhandled interrupts, high-priority preemption (IRQ).
4. Gully Cricket & Bollywood:
   - Gully cricket rules: Custom business logic & edge cases ("jiski bat uski pehli batting", "one-tip-one-hand out", "ball naali me gayi toh match terminate").
   - 90s Bollywood drama ("Mere Karan Arjun aayenge"): Promises, async/await resolution, eventual consistency.
   - Third umpire DRS review: Validation pipeline, frame-by-frame deep equality checks.
5. College / Hostel Jugaad:
   - Hostel mess Sunday special paneer hunt: Resource starvation, race conditions (low priority processes get only gravy).
   - Exam hall cheating chits: Pass-by-reference vs pass-by-value, shallow copy vs deep copy (dost ka roll number mistake bhi copy ho gaya).
   - Electric kettle me Maggi cook karna: Embedded systems optimization, hardware memory constraints, pure jugaad.

Select the analogy that genuinely matches the data structure or algorithm being used in the code!

CRITICAL INSTRUCTION FOR "interview" FIELD:
DO NOT write meta-instructions like "Explain that..." or "Mention call stack...".
Instead, write an authentic, high-impact FAANG interview playbook formatted with these exact 4 double-newline-separated sections in natural Tech-Hinglish:
🗣️ EXACT VERBAL PITCH: "Sir, I've implemented this using... [exact spoken pitch in first person]"

⏱️ COMPLEXITY JUSTIFICATION:
• Time: O(...) — [exact reason why]
• Space: O(...) — [exact reason why, mentioning call stack or auxiliary memory]

🎯 COUNTER-QUESTION TRAP:
• Interviewer puchega: "[Exact follow-up trap interviewer will ask]"
• Tera Jawab: "[Winning technical counter-answer]"

⚠️ EDGE CASES TO CALL OUT:
• [Key boundary cases like negative numbers, empty arrays, or integer overflow]

Return ONLY a JSON object with this EXACT structure:
{
  "type": "recursion" | "loop" | "api" | "oop" | "conditional" | "generic",
  "tldr": "1-2 sentence funny summary in Hinglish",
  "analogy": "Hilarious real-world desi analogy drawn from the diverse categories above in Hinglish",
  "interview": "Full 4-part interview playbook formatted as specified above",
  "complexity": "Time: O(...) | Space: O(...)",
  "vibe": "What senior dev says in Hinglish",
  "lines": [
    { "code": "exact code line", "explain": "what this line does in Hinglish", "roast": "optional roast comment" }
  ],
  "roastScore": 45,
  "roastIssues": ["issue 1 in Hinglish", "issue 2 in Hinglish"]
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Code to explain:\n\`\`\`\n${code}\n\`\`\`` }
      ],
      response_format: { type: "json_object" },
      temperature: mode === 'roast' ? 0.7 : 0.4,
      max_tokens: 1500
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  const rawLines = code.split('\n').filter(l => l.trim().length > 0);
  const fallbackLines = rawLines.slice(0, 10).map(l => ({
    code: l.trim(),
    explain: "Ye line step-by-step logic execute kar rahi hai.",
    roast: mode === 'roast' ? "Is line me thoda dhyan do bhai" : undefined
  }));

  return {
    type: parsed.type || detectType(code),
    tldr: parsed.tldr || "Arre bhai ye code mast chal raha hai.",
    analogy: parsed.analogy || "Ye bilkul Swiggy pe biryani mangane jaisa hai.",
    interview: parsed.interview || "Interviewer ko bolna: Code modular hai aur clean architecture follow karta hai.",
    complexity: parsed.complexity || "Time: O(n) | Space: O(1)",
    vibe: parsed.vibe || "Senior bolta: Logic theek hai, deploy maar sakte hain.",
    lines: Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed.lines : fallbackLines,
    roastScore: parsed.roastScore ?? (mode === 'roast' ? 65 : undefined),
    roastIssues: parsed.roastIssues ?? (mode === 'roast' ? ["Thoda variable naming improve karo", "Edge cases handle nahi kiye"] : undefined)
  };
}

async function fetchGroqErrorExplanation(errorMsg: string, codeSnippet: string): Promise<Explanation> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No Groq API key configured in .env");
  }

  const systemPrompt = `You are a seasoned, empathetic yet hilarious Indian Senior Developer explaining software bugs & runtime errors in natural Hinglish.
Task: Explain errors in Hinglish with 5 structured fields: ERROR KYA HAI?, KYU AAYA with diverse desi analogy, FIX KAISE KARE with corrected code, and TIP. Always use conversational "Arre bhai...".

CRITICAL INSTRUCTION FOR ERROR ANALOGIES:
DO NOT just use chai tapri or Swiggy. Select a vibrant, culturally iconic desi analogy that best fits the error cause:
- Null / Undefined / Property access crash: Golgappa counter pe bina puri ke paani peena, ya khali dabbe me haath daalna.
- Out of range / Index out of bounds: Sabzi mandi me 3 logo ki line me 10th bande ko aawaz lagana, ya autorickshaw me 3 ki jagah 10 log thunsna.
- Deadlock / Infinite Loop / Hang: Mumbai local ke gate pe do log aamne-saamne phas gaye (na koi andar jaa raha na bahar), ya Silk Board / narrow gali me do auto aamne-saamne.
- Timeout / Network Fail / Unhandled Promise: 10:00 AM IRCTC Tatkal pe session expire ho jana, ya auto-rickshaw wale bhaiya ka bolna "udhar nahi jaunga".
- Permission / Auth / Private Variable Access: Papa ka batua bina permission kholna (UnauthorizedAccessException), ya hostel mess me bina coupon ke plate uthana.
- Type Mismatch / Invalid Cast: Mohalle ki kirana dukaan ke udhaar bahi-khate me doodh ke badle cement ka hisaab likh dena.
- Unhandled Exception / Sudden Crash: Gully cricket me ball kisi ke ghar ke kaanch pe lag gayi aur match turant terminate ho gaya.

Return ONLY a valid JSON object matching this schema:
{
  "errorKyaHai": "Explain what this error means in Hinglish (start with Arre bhai...)",
  "kyuAaya": "Why did this error happen? Explain with a hilarious, diverse desi analogy from the categories above in Hinglish",
  "fixKaiseKare": "Step-by-step fix in Hinglish",
  "correctedCode": "The complete working corrected code snippet",
  "tip": "Senior pro-tip in Hinglish starting with Arre bhai..."
}`;

  const userPrompt = `Error:\n${errorMsg}\n\nCode:\n${codeSnippet}`;

  // Try llama-3.3-70b-versatile first as requested, with fallback models
  const candidateModels = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "groq/compound"];
  let resData: any = null;

  for (const model of candidateModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 1500
        })
      });

      if (res.ok) {
        resData = await res.json();
        break;
      }
    } catch (e) {
      // try next candidate model
    }
  }

  if (!resData || !resData.choices?.[0]?.message?.content) {
    throw new Error("Groq API error or models unavailable");
  }

  let rawContent = resData.choices[0].message.content.trim();
  if (rawContent.startsWith("```")) {
    rawContent = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const parsed = JSON.parse(rawContent);
  const errorKyaHai = parsed.errorKyaHai || "Arre bhai, code me runtime issue aaya hai!";
  const kyuAaya = parsed.kyuAaya || "Unexpected value ya missing check ki wajah se issue hua.";
  const fixKaiseKare = parsed.fixKaiseKare || "Code me safe check lagao aur types verify karo.";
  const correctedCode = parsed.correctedCode || "// Check and verify inputs";
  const tip = parsed.tip || "Arre bhai, hamesha edge cases aur inputs validate kiya karo!";

  return {
    type: 'error',
    tldr: errorKyaHai,
    analogy: kyuAaya,
    interview: fixKaiseKare,
    complexity: "Error Solved 🛠️",
    vibe: "Senior bolta: 'Error se ghabrao mat bhai, error hi sabse bada guru hai!'",
    lines: [
      { code: errorMsg.split('\n')[0] || "Error", explain: errorKyaHai }
    ],
    errorDetails: {
      errorKyaHai,
      kyuAaya,
      fixKaiseKare,
      correctedCode,
      tip
    }
  };
}

function generateLocalErrorExplanation(errorMsg: string, codeSnippet: string): Explanation {
  const errLow = errorMsg.toLowerCase();
  let errorKyaHai = "Arre bhai, code execute hote waqt crash ho gaya hai!";
  let kyuAaya = "Code kisi aisi value ya memory ko access karne ki koshish kar raha hai jo available hi nahi hai. Jaise khali jeb se paise nikalna!";
  let fixKaiseKare = "Pehle check karo variable null ya undefined toh nahi hai, aur conditions check karo.";
  let correctedCode = codeSnippet ? `// Safe check add karo bhai:\nif (typeof data !== 'undefined') {\n  // your code\n}` : "";
  let tip = "Arre bhai, run karne se pehle console.log se value print karke dekh liya karo!";

  if (errLow.includes("undefined") || errLow.includes("null") || errLow.includes("typeerror")) {
    errorKyaHai = "Arre bhai, TypeError hai! Matlab kisi aisi cheez pe property ya method call kar rahe ho jo exist hi nahi karti (undefined hai).";
    kyuAaya = "Ye bilkul aisa hai jaise bina chai banaye cup me chai dhundh rahe ho! Jab dabba hi khali hai toh data kahan se aayega?";
    fixKaiseKare = "Optional chaining (?.) use karo ya if condition laga ke pehle check karo ki object exist karta hai ya nahi.";
    correctedCode = `// Safe way to access:\nif (userGroup && userGroup.users) {\n  userGroup.users.map(u => u.name);\n}`;
    tip = "Arre bhai, hamesha JavaScript me optional chaining (obj?.property) use kiya karo taaki app crash na ho!";
  } else if (errLow.includes("index") || errLow.includes("range")) {
    errorKyaHai = "Arre bhai, IndexError / RangeError hai! Matlab list ya array ki limit ke bahar ja rahe ho.";
    kyuAaya = "College mess me sirf 3 bande khade hain aur tum 5th number wale bande ko bula rahe ho! Jo hai hi nahi usko bulaoge toh system cheekhega hi!";
    fixKaiseKare = "Array ka length check karo (index < array.length) item access karne se pehle.";
    correctedCode = `// Index check karo:\nif (index >= 0 && index < items.length) {\n  console.log(items[index]);\n}`;
    tip = "Arre bhai, array indexing 0 se start hoti hai, toh last element hamesha length - 1 hota hai!";
  }

  return {
    type: 'error',
    tldr: errorKyaHai,
    analogy: kyuAaya,
    interview: fixKaiseKare,
    complexity: "Error Solved 🛠️",
    vibe: "Senior bolta: 'Error se ghabrao mat bhai, debug karna hi developer ka kaam hai!'",
    lines: [
      { code: errorMsg.split('\n')[0] || "Error", explain: errorKyaHai }
    ],
    errorDetails: {
      errorKyaHai,
      kyuAaya,
      fixKaiseKare,
      correctedCode,
      tip
    }
  };
}

async function fetchGroqQuiz(codeSnippet: string, exp: Explanation | null): Promise<QuizData> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No Groq API key configured");
  }

  const systemPrompt = `You are a fun, witty senior software engineer who creates a 3-question MCQ quiz in Hinglish based on the provided code and explanation.
Tone: Fun, desi, engaging, educational. Use authentic Hinglish (bhai, arre, output, logic, kyu, kaise) and connect questions or explanations with relatable desi scenarios (Mumbai local, Tatkal booking, Panipuri, Kirana udhaar, Gully cricket, Hostel jugaad) where relevant.
Requirements:
1. Generate exactly 3 questions testing the user's understanding of the code/error concepts.
2. Each question must have an array of exactly 4 options.
3. The 'correct' field MUST be the 0-based integer index of the correct option (0, 1, 2, or 3).
4. The 'explanation' field explains WHY this option is correct in relatable Hinglish.
5. Return ONLY a valid JSON object matching this schema:
{
  "quizzes": [
    {
      "question": "MCQ Question in Hinglish",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Desi Hinglish explanation why this option is correct"
    }
  ]
}`;

  const userPrompt = `Code:\n${codeSnippet}\n\nConcept Summary:\n${exp?.tldr || ''}\n${exp?.analogy || ''}`;

  const candidateModels = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "groq/compound"];
  let resData: any = null;

  for (const model of candidateModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
          max_tokens: 1500
        })
      });

      if (res.ok) {
        resData = await res.json();
        break;
      }
    } catch (e) {
      // try next model
    }
  }

  if (!resData || !resData.choices?.[0]?.message?.content) {
    throw new Error("Groq Quiz API error or models unavailable");
  }

  let rawContent = resData.choices[0].message.content.trim();
  if (rawContent.startsWith("```")) {
    rawContent = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(rawContent);
  if (!Array.isArray(parsed.quizzes) || parsed.quizzes.length === 0) {
    throw new Error("Invalid quiz structure returned by Groq");
  }

  return {
    quizzes: parsed.quizzes.slice(0, 3).map((q: any) => ({
      question: q.question || "Bhai is code ka sahi logic kya hai?",
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
      correct: typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3 ? q.correct : 0,
      explanation: q.explanation || "Senior bolta: Logic clear hona sabse zaroori hai!"
    }))
  };
}

function generateLocalQuiz(codeSnippet: string, exp: Explanation | null): QuizData {
  const c = (codeSnippet + " " + (exp?.tldr || "")).toLowerCase();
  
  if (c.includes("factorial") || c.includes("recursion") || exp?.type === 'recursion') {
    return {
      quizzes: [
        {
          question: "Arre bhai, yahan 'if n == 0: return 1' lagana kyu zaroori hai?",
          options: [
            "Ye Base Case hai jo recursion ko infinite loop me jaane se rokta hai",
            "Ye loop ko 1 se multiply karne ke liye hai",
            "Python me return 1 likhna mandatory hota hai",
            "Memory free karne ke liye likha hai"
          ],
          correct: 0,
          explanation: "Base case recursion ki break hoti hai! Agar n==0 check nahi kiya toh function khud ko bar-bar call karega jab tak stack overflow na ho jaye."
        },
        {
          question: "Agar hum factorial(3) call karein toh recursive calls kis order me honge?",
          options: [
            "factorial(3) -> factorial(2) -> factorial(1) -> factorial(0)",
            "factorial(0) -> factorial(1) -> factorial(2) -> factorial(3)",
            "Direct 3 * 2 * 1 calculate ho jata hai bina recursive call ke",
            "Sirf factorial(3) ek hi baar chalta hai"
          ],
          correct: 0,
          explanation: "Recursion top se bottom jata hai: factorial(3) call karta hai factorial(2) ko, fir factorial(1), aur aakhir me factorial(0) pe rukta hai."
        },
        {
          question: "Is factorial code ki Time Complexity kya hai?",
          options: [
            "O(n) - kyunki n se 0 tak n+1 calls hote hain",
            "O(1) - constant time",
            "O(n²) - nested loop chal raha hai",
            "O(log n) - binary search ho raha hai"
          ],
          correct: 0,
          explanation: "N se 0 tak har step me ek call hoti hai, isliye total n calls execute hote hain yaani linear time O(n)."
        }
      ]
    };
  }

  if (c.includes("typeerror") || c.includes("undefined") || exp?.type === 'error') {
    return {
      quizzes: [
        {
          question: "Arre bhai, 'Cannot read properties of undefined' error aam taur par kyu aata hai?",
          options: [
            "Jab kisi null ya undefined variable pe dot (.) laga ke property access karte hain",
            "Kyunki computer me RAM khatam ho gayi hai",
            "JavaScript me semi-colon (;) lagana bhool gaye",
            "Browser purana version use kar raha hai"
          ],
          correct: 0,
          explanation: "Jab dabba (object) hi khali ya undefined hai, aur hum uske andar ki cheez dhundhne ja rahe hain toh JavaScript TypeError de deta hai."
        },
        {
          question: "Modern JavaScript me undefined properties se crash bachane ka sabse clean tarika kya hai?",
          options: [
            "Optional chaining operator use karna jaise 'userGroup?.users?.map'",
            "Sabhi variables ko any type cast kar dena",
            "Console.log ko hide kar dena",
            "Try/catch ke andar poora code wrap karke ignore karna"
          ],
          correct: 0,
          explanation: "Optional chaining (?.) agar pehle undefined mile toh aage badhe bina safely undefined return karta hai, crash nahi karta."
        },
        {
          question: "Production me runtime error se bachne ke liye senior developer kya advise karega?",
          options: [
            "API response ko pehle validate karo ya default empty array/object provide karo",
            "User ko bolna ki page refresh karte rahein",
            "Hardcoded data daal do bina API call ke",
            "Sirf local host pe chalao, deploy mat karo"
          ],
          correct: 0,
          explanation: "Always guard inputs with default values (e.g. users = []) aur data structure check kiya karo!"
        }
      ]
    };
  }

  if (c.includes("for ") || c.includes("range") || exp?.type === 'loop') {
    return {
      quizzes: [
        {
          question: "Python me 'range(5)' total kitne iterations chalata hai?",
          options: [
            "5 iterations (0, 1, 2, 3, 4)",
            "6 iterations (0 se 5 tak)",
            "4 iterations (1 se 4 tak)",
            "Infinite iterations"
          ],
          correct: 0,
          explanation: "Python range(n) hamesha 0 se start hota hai aur n-1 tak jata hai, total n elements."
        },
        {
          question: "Agar nested loop ho (for i in range(n): for j in range(n):), toh complexity kya hogi?",
          options: [
            "O(n²) - quadratic time complexity",
            "O(n) - linear time complexity",
            "O(2n) - two times n",
            "O(1) - constant time"
          ],
          correct: 0,
          explanation: "Loop ke andar loop hone par har i ke liye j n-baar chalega, yaani n * n = O(n²)."
        },
        {
          question: "Loop me 'break' statement ka asli kaam kya hota hai?",
          options: [
            "Current loop ko turant terminate karke bahar nikal jana",
            "Sirf current iteration skip karke next pe jana",
            "Pura program stop kar dena",
            "Loop ko reverse order me chalana"
          ],
          correct: 0,
          explanation: "Break loop ko instantly tod ke bahar nikal deta hai, jabki continue sirf current round skip karta hai."
        }
      ]
    };
  }

  return {
    quizzes: [
      {
        question: "Is code snippet ka core purpose kya hai?",
        options: [
          exp?.tldr ? exp.tldr.slice(0, 60) + "..." : "Specific logic step-by-step execute karna",
          "System ko intentionally crash karna",
          "Memory leak create karna",
          "Random numbers print karna"
        ],
        correct: 0,
        explanation: "Code ka mukhya dhyan core business logic aur structured processing pe hai."
      },
      {
        question: "Clean code likhte waqt sabse pehla rule kya follow karna chahiye?",
        options: [
          "Meaningful variable names aur modular functions use karna",
          "Ek hi line me saara code likhna",
          "Har line ke baad sleep laga dena",
          "Variables ka naam a, b, c, x, y rakhna"
        ],
        correct: 0,
        explanation: "Desi senior rule: Code aisa likho jo 6 mahine baad padhne par samajh aaye, na ki sir dard bane!"
      },
      {
        question: "Code ko test aur debug karne ka best approach kya hai?",
        options: [
          "Edge cases test karna (jaise null, empty list, negative inputs)",
          "Sirf ideal input test karke deploy maar dena",
          "Errors ko ignore karna",
          "Sirf console.clear() chalate rehna"
        ],
        correct: 0,
        explanation: "Edge cases test karne se hi asli bugs pakad me aate hain production me jaane se pehle."
      }
    ]
  };
}

export default function App() {
  const [code, setCode] = useState(EXAMPLES.recursion);
  const [errorText, setErrorText] = useState(EXAMPLES.error.error);
  const [lang, setLang] = useState<Lang>('auto');
  const [mode, setMode] = useState<Mode>('explain');
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showAll, setShowAll] = useState({ tldr: false, analogy: false, lines: false, interview: false });
  const [copied, setCopied] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [voiceModel, setVoiceModel] = useState<'aditi' | 'kajal' | 'alloy'>('alloy');
  const [audioTime, setAudioTime] = useState({ current: 0, duration: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFormat, setShareFormat] = useState<ShareFormat>('story');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qIndex: number]: number }>({});
  const outputRef = useRef<HTMLDivElement>(null);
  const quizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    setIsAudioPlaying(false);
    setIsAudioLoading(false);
    setAudioTime(t => ({ ...t, current: 0 }));
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Dynamic Browser Tab Title Management
  useEffect(() => {
    const updateTitle = () => {
      if (document.hidden) {
        document.title = "👀 Kidhar chale bhai? Code toh samjh le! | codeSamjhao 🎧";
        return;
      }

      if (isExplaining) {
        document.title = "⚡ Samjha raha hu... | codeSamjhao 🎧";
      } else if (isAudioPlaying) {
        document.title = "▶ Sunte raho... | codeSamjhao 🎧";
      } else if (isQuizLoading) {
        document.title = "🎯 Quiz ban raha hai... | codeSamjhao 🎧";
      } else if (quizData) {
        document.title = "🎯 Desi Quiz Active | codeSamjhao 🎧";
      } else {
        const modeTitles: Record<Mode, string> = {
          explain: "codeSamjhao — Asli Desi Code Explainer 🎧",
          error: "🚨 Crime Scene Debugger | codeSamjhao 🎧",
          roast: "🔥 Savage Code Roast | codeSamjhao 🎧",
          interview: "💼 FAANG Interview Prep | codeSamjhao 🎧",
          hinglish: "🇮🇳 Full Desi Tadka | codeSamjhao 🎧"
        };
        document.title = modeTitles[mode] || "codeSamjhao — Asli Desi Code Explainer 🎧";
      }
    };

    updateTitle();
    document.addEventListener("visibilitychange", updateTitle);
    return () => {
      document.removeEventListener("visibilitychange", updateTitle);
    };
  }, [mode, isExplaining, isAudioPlaying, isQuizLoading, quizData]);

  useEffect(() => {
    if (shareOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [shareOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExplain();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, errorText, mode, isExplaining]);

  const handleExplain = async () => {
    if (mode === 'error') {
      if (!errorText.trim() && !code.trim()) {
        setToast("Error message ya code me se kuch toh daalo bhai! 🚨");
        return;
      }
    } else {
      if (!code.trim()) return;
    }

    stopAudio();
    setIsExplaining(true);
    setShowAll({ tldr: false, analogy: false, lines: false, interview: false });
    setExplanation(null);
    setQuizData(null);
    setSelectedAnswers({});

    const hasGroq = Boolean(import.meta.env.VITE_GROQ_API_KEY);

    if (mode === 'error') {
      if (hasGroq) {
        setToast("⚡ Groq Llama 3.3 70B se Error diagnosis & fix generate ho raha hai...");
        try {
          const exp = await fetchGroqErrorExplanation(errorText, code);
          setExplanation(exp);
          setIsExplaining(false);
          setToast("✅ Error breakdown & fix ready! 🚀");
          setTimeout(() => setShowAll(s => ({ ...s, tldr: true, analogy: true })), 100);
          return;
        } catch (err) {
          console.warn("Groq Error API failed, using local fallback:", err);
          setToast("⚠️ Groq offline fallback — local error fix ready! 🚀");
        }
      }
      setTimeout(() => {
        const exp = generateLocalErrorExplanation(errorText, code);
        setExplanation(exp);
        setIsExplaining(false);
        setTimeout(() => setShowAll(s => ({ ...s, tldr: true, analogy: true })), 100);
      }, 500);
      return;
    }

    if (hasGroq) {
      setToast("⚡ Groq AI se live Hinglish explanation generate ho rahi hai...");
      try {
        const exp = await fetchGroqExplanation(code, mode);
        setExplanation(exp);
        setIsExplaining(false);
        setToast("✅ Live Groq AI explanation ready! 🚀");
        setTimeout(() => setShowAll(s => ({ ...s, tldr: true })), 100);
        return;
      } catch (err) {
        console.warn("Groq API error, falling back to smart local generator:", err);
        setToast("⚠️ Groq fallback — local explanation ready! 🚀");
      }
    }

    setTimeout(() => {
      const exp = generateExplanation(code, mode);
      setExplanation(exp);
      setIsExplaining(false);
      setTimeout(() => setShowAll(s => ({ ...s, tldr: true })), 100);
    }, 600);
  };

  const handleGenerateQuiz = async () => {
    if (!explanation && !code.trim()) {
      setToast("Pehle code explain kara le bhai, phir quiz banega! 🎯");
      return;
    }
    setIsQuizLoading(true);
    setSelectedAnswers({});
    setToast("⚡ Groq se Hinglish Quiz generate ho raha hai...");

    const hasGroq = Boolean(import.meta.env.VITE_GROQ_API_KEY);
    const targetCode = mode === 'error' ? `Error: ${errorText}\nCode:\n${code}` : code;

    const scrollToQuiz = () => {
      setTimeout(() => {
        quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    };

    if (hasGroq) {
      try {
        const data = await fetchGroqQuiz(targetCode, explanation);
        setQuizData(data);
        setIsQuizLoading(false);
        setToast("✅ 3 MCQs Hinglish Quiz ready! 🎯");
        scrollToQuiz();
        return;
      } catch (err) {
        console.warn("Groq Quiz API error, using local fallback:", err);
        setToast("⚠️ Local fallback se quiz ready! 🎯");
      }
    }

    setTimeout(() => {
      const data = generateLocalQuiz(targetCode, explanation);
      setQuizData(data);
      setIsQuizLoading(false);
      setToast("✅ 3 MCQs Hinglish Quiz ready! 🎯");
      scrollToQuiz();
    }, 600);
  };

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [qIdx]: optIdx
    }));
  };

  const handleExample = (key: keyof typeof EXAMPLES) => {
    stopAudio();
    setQuizData(null);
    setSelectedAnswers({});
    if (key === 'error') {
      setErrorText(EXAMPLES.error.error);
      setCode(EXAMPLES.error.code);
      setMode('error');
      setExplanation(null);
      setShowAll({ tldr: false, analogy: false, lines: false, interview: false });
      setToast("📋 Loaded Error example — ab 'Fix Karo' dabao! 🚨");
      return;
    }
    setCode(EXAMPLES[key] as string);
    setExplanation(null);
    setShowAll({ tldr: false, analogy: false, lines: false, interview: false });
    if (key === 'roast') setMode('roast');
    setToast(`📋 Loaded ${key} example — ${key==='roast'?'roast ready 🔥':'samjhne ke liye ready'}`);
  };

  const handleCopy = () => {
    if (!explanation) return;
    if (explanation.errorDetails) {
      const text = `🚨 ERROR KYA HAI:\n${explanation.errorDetails.errorKyaHai}\n\n🍛 KYU AAYA:\n${explanation.errorDetails.kyuAaya}\n\n🛠️ FIX KAISE KARE:\n${explanation.errorDetails.fixKaiseKare}\n\nCORRECTED CODE:\n${explanation.errorDetails.correctedCode || ''}\n\n💡 TIP:\n${explanation.errorDetails.tip}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      return;
    }
    const text = `TL;DR: ${explanation.tldr}\n\nAnalogy: ${explanation.analogy}\n\nBreakdown:\n${explanation.lines.map(l => `${l.code} => ${l.explain}${l.roast ? ` | Roast: ${l.roast}` : ''}`).join('\n')}\n\nInterview: ${explanation.interview}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fallbackToWebSpeech = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsAudioLoading(false);
      setIsAudioPlaying(false);
      setToast("Browser audio not supported ❌");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang.toLowerCase().includes('hi') || v.lang.toLowerCase().includes('in'));
      if (hindiVoice) utterance.voice = hindiVoice;
      utterance.rate = 0.95;

      utterance.onstart = () => {
        setIsAudioLoading(false);
        setIsAudioPlaying(true);
        setToast("🔊 Playing voice via Web Speech fallback");
      };
      utterance.onend = () => {
        setIsAudioPlaying(false);
        setIsAudioLoading(false);
        setAudioTime(t => ({ ...t, current: 0 }));
      };
      utterance.onerror = () => {
        setIsAudioPlaying(false);
        setIsAudioLoading(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsAudioLoading(false);
      setIsAudioPlaying(false);
      setToast("Voice playback error ❌");
    }
  };

  const formatAudioTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAudioPlay = async () => {
    if (!explanation) {
      setToast("Pehle code explain kara le bhai, phir sunenge! 🎧");
      return;
    }
    if (isAudioPlaying || isAudioLoading) {
      stopAudio();
      return;
    }

    stopAudio();
    setIsAudioLoading(true);
    const voiceLabel = voiceModel === 'alloy' ? 'OpenAI Alloy' : voiceModel === 'kajal' ? 'Polly Kajal' : 'Polly Aditi';
    setToast(`🔊 Free Puter.js Hinglish Voice (${voiceLabel}) load ho rahi hai...`);

    const speechRaw = explanation.errorDetails
      ? `${explanation.errorDetails.errorKyaHai}. ${explanation.errorDetails.kyuAaya}. ${explanation.errorDetails.fixKaiseKare}. ${explanation.errorDetails.tip}`
      : mode === 'roast'
      ? `${explanation.tldr}. ${explanation.vibe}. ${explanation.analogy}`
      : `${explanation.tldr}. ${explanation.analogy}`;
    const speechText = cleanTextForSpeech(speechRaw);

    try {
      if (typeof window !== 'undefined' && window.puter && window.puter.ai && window.puter.ai.txt2speech) {
        let audio: HTMLAudioElement;
        if (voiceModel === 'alloy') {
          audio = await window.puter.ai.txt2speech(speechText, {
            provider: 'openai',
            model: 'gpt-4o-mini-tts',
            voice: 'alloy'
          });
        } else {
          audio = await window.puter.ai.txt2speech(speechText, {
            provider: 'aws-polly',
            voice: voiceModel === 'kajal' ? 'Kajal' : 'Aditi',
            language: 'hi-IN'
          });
        }

        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          setAudioTime({ current: 0, duration: audio.duration || 0 });
        };

        audio.ontimeupdate = () => {
          setAudioTime({
            current: audio.currentTime || 0,
            duration: audio.duration || 0
          });
        };

        audio.onended = () => {
          setIsAudioPlaying(false);
          setIsAudioLoading(false);
          setAudioTime(t => ({ ...t, current: 0 }));
        };

        audio.onerror = (e) => {
          console.warn("Puter audio error, falling back to Web Speech:", e);
          fallbackToWebSpeech(speechText);
        };

        await audio.play();
        setIsAudioLoading(false);
        setIsAudioPlaying(true);
        setToast(`🔊 Bol raha hai: ${voiceLabel}`);
      } else {
        fallbackToWebSpeech(speechText);
      }
    } catch (err) {
      console.warn("Puter txt2speech error, using fallback:", err);
      fallbackToWebSpeech(speechText);
    }
  };

  const openShare = (format: ShareFormat) => {
    if (!explanation) {
      setToast("Pehle code samjha le bhai, phir share karna! 📸");
      return;
    }
    setShareFormat(format);
    setShareOpen(true);
  };

  const handleDownloadPNG = () => {
    setToast("⬇️ Downloading... (Pillow generates this in Python prod version)");
    setTimeout(() => setShareOpen(false), 900);
  };

  const detectedLang = (() => {
    if (lang !== 'auto') return lang;
    const c = code.toLowerCase();
    if (c.includes('def ') || c.includes('range(')) return 'python';
    if (c.includes('async') || c.includes('console.log') || c.includes('function') || c.includes('const ') || c.includes('let ') || c.includes('=>')) return 'javascript';
    if (c.includes('public class') || c.includes('system.out')) return 'java';
    if (c.includes('#include') || c.includes('std::')) return 'cpp';
    if (c.includes('package ') || c.includes('func ')) return 'go';
    return 'python';
  })();

  const activeLang = lang === 'auto' ? detectedLang : lang;

  const langExtensions: Record<string, string> = {
    python: 'py',
    javascript: 'js',
    java: 'java',
    cpp: 'cpp',
    go: 'go',
    auto: 'py',
  };

  const currentExt = langExtensions[activeLang] || 'py';

  const editorFileName = (() => {
    if (mode === 'error') return 'error-debugger.log';
    if (mode === 'roast') return `roast-me.${currentExt}`;
    if (mode === 'interview') return `interview-prep.${currentExt}`;
    if (mode === 'hinglish') return `desi-code.${currentExt}`;
    return `code-input.${currentExt}`;
  })();

  const modeConfig = [
    { id: 'explain' as Mode, label: 'Explain ⚡', emoji: '⚡', desc: 'Analogy + Hinglish' },
    { id: 'error' as Mode, label: 'Error 🚨', emoji: '🚨', desc: 'Error samjho & fix pao' },
    { id: 'roast' as Mode, label: 'Roast 🔥', emoji: '🔥', desc: 'Beizzati ke saath seekh' },
    { id: 'interview' as Mode, label: 'Interview 💼', emoji: '💼', desc: 'FAANG ready' },
    { id: 'hinglish' as Mode, label: 'Full Desi 🇮🇳', emoji: '🇮🇳', desc: 'Full desi tadka' },
  ];

  const MODE_THEMES: Record<Mode, {
    name: string;
    accent: string;
    badge: string;
    badgeBg: string;
    badgeText: string;
    actionBtnText: string;
    actionBtnBg: string;
    actionBtnTextCol: string;
    headerBannerBg: string;
    activeTabClass: string;
  }> = {
    explain: {
      name: 'Explain Mode',
      accent: '#6366F1',
      badge: '⚡ 100% ASLI DESI',
      badgeBg: 'bg-[#6366F1]',
      badgeText: 'text-white',
      actionBtnText: 'Samjha de bhai ⚡',
      actionBtnBg: 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#4F46E5] hover:to-[#4338CA]',
      actionBtnTextCol: 'text-white',
      headerBannerBg: 'bg-[#6366F1]',
      activeTabClass: 'bg-[#6366F1] text-white border-2 border-black shadow-[3px_3px_0px_#000]'
    },
    error: {
      name: 'Error Debugger',
      accent: '#FF007F',
      badge: '🚨 CRIME SCENE INVESTIGATOR',
      badgeBg: 'bg-[#FF007F]',
      badgeText: 'text-white',
      actionBtnText: 'Fix karo bhai 🚨',
      actionBtnBg: 'bg-[#FF007F] hover:bg-[#FF3399]',
      actionBtnTextCol: 'text-white',
      headerBannerBg: 'bg-[#FF007F]',
      activeTabClass: 'bg-[#FF007F] text-white border-2 border-black shadow-[3px_3px_0px_#000]'
    },
    roast: {
      name: 'Brutal Roast',
      accent: '#FF2A2A',
      badge: '🔥 DIL PE MAT LENA',
      badgeBg: 'bg-[#FF2A2A]',
      badgeText: 'text-white',
      actionBtnText: 'Roast kar de bhai 🔥',
      actionBtnBg: 'bg-[#FF2A2A] hover:bg-[#FF5555]',
      actionBtnTextCol: 'text-white',
      headerBannerBg: 'bg-[#FF2A2A]',
      activeTabClass: 'bg-[#FF2A2A] text-white border-2 border-black shadow-[3px_3px_0px_#000]'
    },
    interview: {
      name: 'Interview Prep',
      accent: '#00FF66',
      badge: '💼 CTC 1 CRORE WALA CONFIDENCE',
      badgeBg: 'bg-[#00FF66]',
      badgeText: 'text-black',
      actionBtnText: 'Crack karwa do 💼',
      actionBtnBg: 'bg-[#00FF66] hover:bg-[#33FF85]',
      actionBtnTextCol: 'text-black',
      headerBannerBg: 'bg-[#00FF66]',
      activeTabClass: 'bg-[#00FF66] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
    },
    hinglish: {
      name: 'Full Desi Tadka',
      accent: '#00F0FF',
      badge: '🇮🇳 0% ENGLISH BORING GYAAN',
      badgeBg: 'bg-[#00F0FF]',
      badgeText: 'text-black',
      actionBtnText: 'Desi me batao 🇮🇳',
      actionBtnBg: 'bg-[#00F0FF] hover:bg-[#33F3FF]',
      actionBtnTextCol: 'text-black',
      headerBannerBg: 'bg-[#00F0FF]',
      activeTabClass: 'bg-[#00F0FF] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
    }
  };

  const currentTheme = MODE_THEMES[mode] || MODE_THEMES.explain;

  const codeSnippetPreview = code.split('\n').slice(0, 5).join('\n').slice(0, 180);
  const roastTextPreview = explanation ? (mode === 'roast' ? explanation.tldr : explanation.tldr) : '';

  return (
    <div className="h-screen w-screen overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-[#0c0d12] text-zinc-100 flex flex-col">
      {/* Toast Notification */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none flex flex-col items-center gap-2">
        {toast && (
          <div className="pointer-events-auto font-space text-[13px] font-bold px-4 py-2.5 bg-[#6366F1] text-white border-2 border-black shadow-[4px_4px_0px_#000] flex items-center gap-2.5 max-w-[90vw] animate-bounce">
            <span className="text-[16px]">📢</span>
            <span className="leading-tight">{toast}</span>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareOpen && explanation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-[920px] max-h-[92vh] overflow-auto neo-box rounded-xl p-5 border-2 border-black shadow-[8px_8px_0px_#000] bg-[#121216]">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[20px]">📸</span>
                <span className="font-funky text-[14px] text-white">SHARE CARD GENERATOR</span>
                <span className="font-marker text-xs px-2 py-0.5 bg-[#6366F1] text-white border border-black rotate-1">VIRAL READY</span>
              </div>
              <button
                onClick={() => setShareOpen(false)}
                className="w-8 h-8 rounded border-2 border-black bg-[#FF2A2A] text-white font-funky flex items-center justify-center neo-btn"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-start justify-center">
              {/* Preview Card */}
              <div className="flex flex-col items-center">
                <div
                  id="share-card-container"
                  style={{
                    width: shareFormat === 'story' ? '300px' : '360px',
                    height: shareFormat === 'story' ? '533px' : '360px',
                    background: '#09090d',
                    border: '3px solid #000',
                    boxShadow: '6px 6px 0px #000',
                    padding: '20px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    fontFamily: 'Space Grotesk, sans-serif'
                  }}
                >
                  <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="codeSamjhao" className="w-5 h-5 rounded-md object-cover border border-black" />
                      <span className="font-funky text-xs text-[#818CF8]">codeSamjhao.exe</span>
                    </div>
                    <span className="font-marker text-[10px] px-1.5 py-0.5 bg-[#FF007F] text-white border border-black -rotate-2">
                      {mode.toUpperCase()}
                    </span>
                  </div>

                  <div className="my-auto space-y-3">
                    <div className="font-funky text-[13px] text-white leading-snug">
                      "{roastTextPreview.slice(0, 160)}..."
                    </div>
                    {explanation.analogy && (
                      <div className="text-[11px] text-zinc-300 font-mono bg-[#161622] p-2.5 border border-zinc-700">
                        💡 {explanation.analogy.slice(0, 140)}...
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-zinc-800 pt-2 flex items-center justify-between text-[9px] font-mono text-zinc-400">
                    <span>⚡ Groq + Puter.js</span>
                    <span>@codesamjhao</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 w-full">
                  <button
                    onClick={() => setShareFormat(f => f === 'story' ? 'square' : 'story')}
                    className="flex-1 font-space text-xs font-bold py-2 bg-[#1f1f28] text-zinc-200 border-2 border-black neo-btn"
                  >
                    Switch to {shareFormat === 'story' ? 'Square (1:1)' : 'Story (9:16)'}
                  </button>
                  <button
                    onClick={handleDownloadPNG}
                    className="flex-1 font-funky text-xs py-2 bg-[#6366F1] text-white border-2 border-black neo-btn hover:bg-[#4F46E5]"
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endless Marquee Ticker Tape */}
      <div className="w-full bg-gradient-to-r from-[#4338CA] via-[#4F46E5] to-[#0891B2] text-white border-b-2 border-black overflow-hidden py-1 shrink-0 font-funky text-[11px] uppercase tracking-wider flex items-center shadow-[0_2px_0px_#000] z-20">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-6">
          <span>⚡ CHAI SUTTA & ALGORITHMS</span>
          <span>•</span>
          <span>🔥 100% UNFILTERED HINGLISH</span>
          <span>•</span>
          <span>🚨 SYSTEM FAAD CODE DECODER</span>
          <span>•</span>
          <span>☕ BUG AAYA? CHAI PEELO</span>
          <span>•</span>
          <span>👾 0% AI SLOP GUARANTEED</span>
          <span>•</span>
          <span>🌶️ TEKHA EXPLAINER</span>
          <span>•</span>
          <span>🏎️ DESI JUGAD ENGINE</span>
          <span>•</span>
          <span>💻 FAANG CRACKER</span>
          <span>•</span>
          <span>💯 TAPRI TESTED</span>
          <span>•</span>
          <span>⚡ CHAI SUTTA & ALGORITHMS</span>
          <span>•</span>
          <span>🔥 100% UNFILTERED HINGLISH</span>
          <span>•</span>
          <span>🚨 SYSTEM FAAD CODE DECODER</span>
          <span>•</span>
          <span>☕ BUG AAYA? CHAI PEELO</span>
          <span>•</span>
          <span>👾 0% AI SLOP GUARANTEED</span>
          <span>•</span>
          <span>🌶️ TEKHA EXPLAINER</span>
          <span>•</span>
          <span>🏎️ DESI JUGAD ENGINE</span>
          <span>•</span>
          <span>💻 FAANG CRACKER</span>
          <span>•</span>
          <span>💯 TAPRI TESTED</span>
          <span>•</span>
        </div>
      </div>

      {/* Main App Container */}
      <div className="relative z-10 w-full max-w-[1640px] mx-auto px-3 sm:px-4 lg:px-5 py-2 sm:py-3 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="shrink-0 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-black border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center shrink-0 -rotate-2 p-0.5">
              <img src="/logo.png" alt="codeSamjhao logo" className="w-full h-full object-cover rounded-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-funky text-[22px] sm:text-[24px] tracking-tight leading-none text-white flex items-center gap-1">
                  <span>codeSamjhao</span>
                  <span className="text-[#22D3EE]">.exe</span>
                </h1>
                <span className="font-marker text-[11px] px-2 py-0.5 bg-[#FF007F] text-white border-2 border-black rotate-2 shadow-[2px_2px_0px_#000]">
                  0% AI SLOP
                </span>
                <span className="mono text-[10px] font-bold px-1.5 py-0.5 bg-[#1f1f28] text-zinc-300 border border-black">
                  v3.0 LIVE
                </span>
              </div>
              <p className="font-space text-[12px] text-zinc-400 font-semibold mt-0.5 flex items-center gap-1.5">
                <span>Dimaag ka dahi karne wala code?</span>
                <span className="text-[#22D3EE] font-black">•</span>
                <span className="text-[#22D3EE] font-marker text-[13px]">Ab senior sambhal lega!</span>
              </p>
            </div>
          </div>

          {/* Mode Selector Buttons */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#14141c] border-2 border-black shadow-[4px_4px_0px_#000] overflow-x-auto">
            {modeConfig.map((m) => {
              const active = mode === m.id;
              const theme = MODE_THEMES[m.id];
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setMode(m.id);
                    if (m.id !== mode) {
                      setToast(`${m.emoji} ${m.label} active — ${m.desc}`);
                    }
                  }}
                  className={`relative whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-space font-bold transition-all duration-100 ${
                    active
                      ? `${theme.activeTabClass} scale-[1.02]`
                      : 'bg-[#1c1c24] text-zinc-300 border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#282834] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                  }`}
                >
                  <span className="text-[13px]">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden xl:flex items-center gap-2 text-[11px] mono shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border-2 border-black shadow-[2px_2px_0px_#000] font-funky ${currentTheme.badgeBg} ${currentTheme.badgeText}`}>
              <span>⚡</span> {currentTheme.badge}
            </span>
          </div>
        </header>

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch flex-1 min-h-0 w-full">
          {/* Left Editor Column */}
          <div className="rounded-xl neo-box overflow-hidden flex flex-col h-full min-h-[520px] lg:min-h-0 border-2 border-black shadow-[6px_6px_0px_#000] bg-[#121218]">
            {/* Editor Window Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b-2 border-black bg-[#181822] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF2A2A] border border-black shadow-sm" />
                  <div className="w-3 h-3 rounded-full bg-[#FFE600] border border-black shadow-sm" />
                  <div className="w-3 h-3 rounded-full bg-[#00FF66] border border-black shadow-sm" />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black border border-zinc-700">
                  <span className="text-[11px]">{activeLang === 'python' ? '🐍' : activeLang === 'javascript' ? '🟨' : activeLang === 'java' ? '☕' : activeLang === 'cpp' ? '⚙️' : '🐹'}</span>
                  <span className="mono text-[11px] text-[#22D3EE] font-bold">{editorFileName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  className="mono text-[11px] font-bold bg-[#101016] border-2 border-black rounded px-2 py-1 text-zinc-200 cursor-pointer shadow-[2px_2px_0px_#000]"
                >
                  <option value="auto">🤖 Auto-detect ({detectedLang})</option>
                  <option value="python">🐍 Python (.py)</option>
                  <option value="javascript">🟨 JavaScript (.js)</option>
                  <option value="java">☕ Java (.java)</option>
                  <option value="cpp">⚙️ C++ (.cpp)</option>
                  <option value="go">🐹 Go (.go)</option>
                </select>
              </div>
            </div>

            {/* Error Mode Warning Banner */}
            {mode === 'error' && (
              <div className="hazard-stripes h-3 w-full border-b-2 border-black shrink-0" />
            )}

            {/* Editor Body */}
            {mode === 'error' ? (
              <div className="p-3.5 sm:p-4 flex flex-col gap-3 bg-[#0d0d12] flex-1 min-h-0 overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-funky text-[11px] text-[#FF007F] flex items-center gap-1">
                      <span>🚨</span> 1. ERROR / STACK TRACE
                    </label>
                    <span className="font-marker text-[10px] text-rose-300">CRIME SCENE DATA</span>
                  </div>
                  <textarea
                    value={errorText}
                    onChange={(e) => setErrorText(e.target.value)}
                    placeholder="Paste terminal error or stacktrace here...&#10;e.g. TypeError: Cannot read properties of undefined (reading 'map')"
                    spellCheck={false}
                    className="w-full h-[115px] shrink-0 mono text-[12px] leading-[19px] p-3 rounded-lg border-2 border-black bg-[#160a0f] text-rose-100 placeholder:text-rose-400/40 focus:outline-none focus:border-[#FF007F] resize-none shadow-[3px_3px_0px_#000]"
                  />
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-funky text-[11px] text-zinc-300 flex items-center gap-1">
                      <span>💻</span> 2. ASSOCIATED CODE
                    </label>
                    <span className="font-marker text-[10px] text-amber-300">CODE WITH BUG</span>
                  </div>
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Paste the code that caused this error..."
                    spellCheck={false}
                    className="w-full flex-1 min-h-[130px] mono text-[12.5px] leading-[20px] p-3 rounded-lg border-2 border-black bg-[#0a0a0f] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#6366F1] resize-none overflow-y-auto shadow-[3px_3px_0px_#000]"
                    style={{ tabSize: 2 }}
                  />
                </div>
              </div>
            ) : (
              <div className="relative flex-1 min-h-0 flex flex-col bg-[#0b0b10]">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={`def factorial(n): return 1 if n==0 else n*factorial(n-1)`}
                  spellCheck={false}
                  className="w-full h-full mono text-[13px] leading-[21px] p-4 bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none overflow-y-auto font-mono selection:bg-[#6366F1]/40 selection:text-[#EEF2FF]"
                  style={{ tabSize: 2 }}
                />
              </div>
            )}

            {/* Quick Try Pills */}
            <div className="px-3.5 py-2 border-t-2 border-black bg-[#161620] flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="font-marker text-[11px] text-[#818CF8] mr-1">QUICK TRY:</span>
              <button
                onClick={() => { setCode(EXAMPLES.recursion); setMode('explain'); }}
                className="font-space text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c1c28] border-2 border-black neo-btn text-zinc-200 hover:bg-[#6366F1] hover:text-white"
              >
                Factorial 🔄
              </button>
              <button
                onClick={() => { setCode(EXAMPLES.loop); setMode('explain'); }}
                className="font-space text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c1c28] border-2 border-black neo-btn text-zinc-200 hover:bg-[#6366F1] hover:text-white"
              >
                For Loop 🔁
              </button>
              <button
                onClick={() => { setCode(EXAMPLES.api); setMode('explain'); }}
                className="font-space text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c1c28] border-2 border-black neo-btn text-zinc-200 hover:bg-[#6366F1] hover:text-white"
              >
                API Call 🌐
              </button>
              <button
                onClick={() => { setCode(EXAMPLES.roast); setMode('roast'); }}
                className="font-space text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c1c28] border-2 border-black neo-btn text-red-300 hover:bg-[#FF2A2A] hover:text-white"
              >
                Gobar Code 🔥
              </button>
              <button
                onClick={() => {
                  setErrorText(EXAMPLES.error.error);
                  setCode(EXAMPLES.error.code);
                  setMode('error');
                }}
                className="font-space text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c1c28] border-2 border-black neo-btn text-rose-300 hover:bg-[#FF007F] hover:text-white"
              >
                TypeError 🚨
              </button>
            </div>

            {/* Launch Action Bar */}
            <div className="p-3 border-t-2 border-black bg-[#181822] flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={handleExplain}
                disabled={isExplaining}
                className={`flex-1 font-funky text-[13.5px] uppercase tracking-wider py-2.5 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_#000] neo-btn flex items-center justify-center gap-2 font-black ${currentTheme.actionBtnBg} ${currentTheme.actionBtnTextCol} ${
                  isExplaining ? 'opacity-80 cursor-wait' : ''
                }`}
              >
                {isExplaining ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    <span>Processing Gyaan...</span>
                  </>
                ) : (
                  <span>{currentTheme.actionBtnText}</span>
                )}
              </button>

              <button
                onClick={() => {
                  setCode('');
                  setErrorText('');
                  setExplanation(null);
                  setQuizData(null);
                }}
                className="font-space text-[11px] font-bold px-3 py-2.5 rounded-lg border-2 border-black bg-[#22222e] text-zinc-300 hover:bg-[#FF2A2A] hover:text-white neo-btn shrink-0"
              >
                Clear
              </button>
            </div>

            {/* Terminal Status Bar */}
            <div className="px-3 py-1.5 border-t-2 border-black bg-black flex items-center justify-between mono text-[10px] text-zinc-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#00FF66] font-bold">● LIVE</span>
                <span>{code.split('\n').length} lines</span>
                <span>•</span>
                <span>{code.length} chars</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="text-[#22D3EE] font-bold">GROQ LLAMA 3.3 READY ⚡</span>
              </div>
            </div>
          </div>

          {/* Right Results Column */}
          <div className="rounded-xl neo-box overflow-hidden flex flex-col h-full min-h-[520px] lg:min-h-0 border-2 border-black shadow-[6px_6px_0px_#000] bg-[#121218]">
            {/* Results Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b-2 border-black bg-[#181822] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF2A2A] border border-black shadow-sm" />
                  <div className="w-3 h-3 rounded-full bg-[#FFE600] border border-black shadow-sm" />
                  <div className="w-3 h-3 rounded-full bg-[#00FF66] border border-black shadow-sm" />
                </div>
                <span className="font-funky text-[11.5px] text-white tracking-wide">
                  {mode === 'error' ? 'BUG BUSTER TERMINAL 🚨' : mode === 'roast' ? 'ROAST ARENA 🔥' : 'GYAAN CONSOLE ⚡'}
                </span>
              </div>

              {explanation && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isQuizLoading}
                    className="font-funky text-[10px] px-2.5 py-1 rounded bg-[#FF007F] text-white border-2 border-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1"
                  >
                    <span>🎯</span> {isQuizLoading ? 'Generating...' : 'Quiz Bana de'}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="font-space text-[10.5px] font-bold px-2.5 py-1 rounded bg-[#00F0FF] text-black border-2 border-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1"
                  >
                    <span>{copied ? '✓' : '📋'}</span> {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Retro Cyber-Cassette Boombox Audio Deck */}
            <div className="px-3.5 py-2 border-b-2 border-black bg-[#161622] shrink-0">
              <div className="bg-[#0e0e14] border-2 border-black rounded-lg p-2.5 shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={handleAudioPlay}
                    disabled={isAudioLoading}
                    className={`w-10 h-10 rounded border-2 border-black neo-btn flex items-center justify-center shrink-0 font-black text-[15px] ${
                      isAudioLoading
                        ? 'bg-[#6366F1] text-white animate-pulse cursor-wait'
                        : isAudioPlaying
                        ? 'bg-[#FF007F] text-white'
                        : 'bg-[#6366F1] text-white'
                    }`}
                    aria-label="Play Hinglish voice"
                  >
                    {isAudioLoading ? '⏳' : isAudioPlaying ? '❚❚' : '▶'}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-funky text-[10.5px] tracking-wider text-white flex items-center gap-1">
                        <span>📻</span> DESI BOOMBOX
                      </span>
                      <span className="font-marker text-[10.5px] text-[#22D3EE] -rotate-1 hidden sm:inline">
                        SIDE A: {voiceModel.toUpperCase()}
                      </span>
                      <span className={`mono text-[9px] font-bold px-1.5 py-0.2 border border-black ${
                        isAudioPlaying
                          ? 'bg-[#00FF66] text-black animate-pulse'
                          : isAudioLoading
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {isAudioLoading ? 'LOADING...' : isAudioPlaying ? 'ON AIR 🎙️' : 'READY'}
                      </span>
                    </div>

                    {/* Equalizer VU-Bars */}
                    <div className="flex items-center gap-[3px] h-[18px] mt-1">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-[3px] transition-all duration-150"
                          style={{
                            backgroundColor: isAudioPlaying
                              ? (i % 3 === 0 ? '#6366F1' : i % 3 === 1 ? '#06B6D4' : '#818CF8')
                              : '#27272a',
                            height: isAudioPlaying ? `${5 + Math.sin(i * 0.9) * 8 + Math.random() * 8}px` : '4px',
                            opacity: isAudioPlaying ? 1 : 0.4
                          }}
                        />
                      ))}
                      <span className="ml-2 mono text-[10.5px] text-[#00FF66] font-black tracking-wider bg-black px-1.5 py-0.5 border border-zinc-800">
                        {isAudioPlaying || audioTime.current > 0
                          ? `${formatAudioTime(audioTime.current)} / ${formatAudioTime(audioTime.duration || 18)}`
                          : `0:00 / ${formatAudioTime(audioTime.duration || 18)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="mono text-[10px] font-bold text-zinc-400">VOICE:</span>
                  <select
                    value={voiceModel}
                    onChange={(e) => {
                      stopAudio();
                      setVoiceModel(e.target.value as any);
                    }}
                    className="mono text-[10.5px] font-bold bg-[#1c1c28] text-[#22D3EE] border-2 border-black rounded px-2 py-1 cursor-pointer shadow-[2px_2px_0px_#000]"
                  >
                    <option value="alloy">Alloy (OpenAI TTS)</option>
                    <option value="aditi">Aditi (Polly Hinglish)</option>
                    <option value="kajal">Kajal (Polly Hinglish)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results Output Area */}
            <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto">
              {!explanation && !isExplaining ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-6">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-2xl border-2 border-black bg-[#121218] overflow-hidden shadow-[4px_4px_0px_#000] -rotate-3 p-1 flex items-center justify-center">
                      <img src="/logo.png" alt="codeSamjhao Mascot" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-sm px-1.5 py-0.5 rounded-full bg-[#6366F1] border border-black shadow-sm">
                      {mode === 'error' ? '🚨' : mode === 'roast' ? '🔥' : '⚡'}
                    </span>
                  </div>
                  <h3 className="font-funky text-[18px] text-white">
                    {mode === 'error' ? 'ERROR CHIPKAO, SOLUTION PAO' : mode === 'roast' ? 'BURA CODE DAAL, ROAST PAO' : 'CODE CHIPKAO, GYAAN PAO'}
                  </h3>
                  <p className="font-space text-[13px] text-zinc-300 mt-1 max-w-[340px] leading-relaxed">
                    {mode === 'error'
                      ? 'Terminal ka stacktrace left me chipka. Senior bina kisi judgement ke kyu aaya aur working fix dega!'
                      : mode === 'roast'
                      ? 'Gobar code chipka, senior full beizzati karega par sudhaar ka tareeka bhi batayega!'
                      : 'Left me code daal, "Samjha de bhai" dabaa. Desi analogy ke saath pura logic crystal clear ho jayega.'}
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-2 w-full max-w-[340px]">
                    {[
                      { icon: mode === 'error' ? '🚨' : '🍛', t: mode === 'error' ? 'Error Diagnosis' : 'Desi Real-Life Analogies', d: mode === 'error' ? 'Kyu aaya simple Hinglish me' : 'Local train, mess line, kirana hisaab' },
                      { icon: '📻', t: 'Sunke Samjho', d: 'Free Puter.js AI Voice (Aditi, Kajal, Alloy)' },
                      { icon: '🎯', t: 'MCQ Quiz Engine', d: 'Samajh aaya ya nahi check karo' }
                    ].map((f) => (
                      <div key={f.t} className="flex items-center gap-2.5 p-2.5 rounded border-2 border-black bg-[#161622] text-left shadow-[2px_2px_0px_#000]">
                        <span className="text-[18px]">{f.icon}</span>
                        <div>
                          <div className="font-space font-bold text-[12px] text-white">{f.t}</div>
                          <div className="font-space text-[11px] text-zinc-400">{f.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : isExplaining ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[340px] gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-black border-t-[#6366F1] animate-spin" />
                  <div className="text-center">
                    <div className="font-funky text-[14px] text-[#818CF8]">
                      {mode === 'error' ? 'SENIOR ERROR TRACE DIAGNOSE KAR RAHA HAI...' : mode === 'roast' ? 'SENIOR CODE DEKH KE HAS RAHA HAI...' : 'SENIOR CHAI PEETE HUE CODE PADH RAHA HAI...'}
                    </div>
                    <div className="font-marker text-[12px] text-zinc-400 mt-1">
                      {mode === 'error' ? '"Arre bhai, ye error toh kisi se bhi ho sakta hai!"' : mode === 'roast' ? '"bhai ye variable ka naam kya rakh diya tune?"' : '"ruk beta, abhi samjhata hu..."'}
                    </div>
                  </div>
                </div>
              ) : explanation ? (
                <div className="space-y-4">
                  {/* Status Vibe Stamp */}
                  <div className="flex items-center justify-between">
                    <div className="font-marker text-xs px-2.5 py-1 bg-[#1c1c28] text-[#22D3EE] border-2 border-black shadow-[2px_2px_0px_#000] -rotate-1">
                      {explanation.vibe}
                    </div>
                    {mode === 'roast' && (
                      <span className="font-marker text-xs px-2 py-0.5 bg-[#FF2A2A] text-white border-2 border-black rotate-2 shadow-[2px_2px_0px_#000]">
                        DIL PE MAT LE BHAI 🌶️
                      </span>
                    )}
                  </div>

                  {/* ERROR MODE CARDS */}
                  {explanation.errorDetails ? (
                    <div className="space-y-3.5">
                      {/* 1. Error Kya Hai */}
                      <div className="rounded-lg border-2 border-black bg-[#160d14] shadow-[4px_4px_0px_#000] overflow-hidden">
                        <div className="bg-[#FF007F] text-white font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center">
                          <span>🚨 1. ERROR KYA HAI?</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(explanation.errorDetails?.errorKyaHai || '');
                              setToast("📋 Error description copied!");
                            }}
                            className="text-[9.5px] px-1.5 py-0.5 bg-black text-white font-space font-bold neo-btn"
                          >
                            COPY
                          </button>
                        </div>
                        <div className="p-3.5 font-space text-[13.5px] font-semibold text-rose-100 leading-relaxed">
                          {explanation.errorDetails.errorKyaHai}
                        </div>
                      </div>

                      {/* 2. Kyu Aaya */}
                      <div className="rounded-lg border-2 border-black bg-[#18150d] shadow-[4px_4px_0px_#000] overflow-hidden">
                        <div className="bg-[#6366F1] text-white font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center">
                          <span>🍛 2. KYU AAYA? (DESI ANALOGY)</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(explanation.errorDetails?.kyuAaya || '');
                              setToast("📋 Desi analogy copied!");
                            }}
                            className="text-[9.5px] px-1.5 py-0.5 bg-black text-white font-space font-bold neo-btn"
                          >
                            COPY
                          </button>
                        </div>
                        <div className="p-3.5 font-space text-[13px] text-amber-100 leading-relaxed">
                          {explanation.errorDetails.kyuAaya}
                        </div>
                      </div>

                      {/* 3. Fix Kaise Kare */}
                      <div className="rounded-lg border-2 border-black bg-[#0d1812] shadow-[4px_4px_0px_#000] overflow-hidden">
                        <div className="bg-[#00FF66] text-black font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center">
                          <span>🛠️ 3. FIX KAISE KARE?</span>
                          {explanation.errorDetails.correctedCode && (
                            <button
                              onClick={() => {
                                if (explanation.errorDetails?.correctedCode) {
                                  navigator.clipboard.writeText(explanation.errorDetails.correctedCode);
                                  setToast("📋 Working fix code copied!");
                                }
                              }}
                              className="text-[9.5px] px-2 py-0.5 bg-black text-[#00FF66] font-space font-bold neo-btn"
                            >
                              COPY FIX CODE
                            </button>
                          )}
                        </div>
                        <div className="p-3.5 font-space text-[13px] text-emerald-100 leading-relaxed">
                          <p className="mb-2">{explanation.errorDetails.fixKaiseKare}</p>
                          {explanation.errorDetails.correctedCode && (
                            <div className="rounded border-2 border-black bg-black p-3 mt-2 overflow-x-auto">
                              <div className="mono text-[10px] text-[#00FF66] font-bold mb-1">
                                ✓ WORKING CODE:
                              </div>
                              <pre className="mono text-[12px] text-emerald-200">
                                <code>{explanation.errorDetails.correctedCode}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4. Pro Tip */}
                      <div className="rounded-lg border-2 border-black bg-[#150d1a] shadow-[4px_4px_0px_#000] overflow-hidden">
                        <div className="bg-[#A855F7] text-white font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center">
                          <span>💡 4. SENIOR PRO TIP</span>
                        </div>
                        <div className="p-3.5 font-space text-[13px] text-purple-100 leading-relaxed font-semibold">
                          {explanation.errorDetails.tip}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* EXPLAIN / ROAST / INTERVIEW CARDS */
                    <div className="space-y-3.5">
                      {/* TL;DR Card */}
                      <div className="rounded-lg border-2 border-black bg-[#14141c] shadow-[4px_4px_0px_#000] overflow-hidden">
                        <div className={`font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center ${
                          mode === 'roast' ? 'bg-[#FF2A2A] text-white' : 'bg-[#6366F1] text-white'
                        }`}>
                          <span>{mode === 'roast' ? '🔥 ROAST — SEEDHA DIL PE' : '⚡ TL;DR — EK LINE ME'}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(explanation.tldr);
                              setToast("📋 TL;DR copied!");
                            }}
                            className="text-[9.5px] px-1.5 py-0.5 bg-black text-white font-space font-bold neo-btn"
                          >
                            COPY
                          </button>
                        </div>
                        <div className="p-3.5 font-space text-[14px] font-semibold text-zinc-100 leading-relaxed">
                          {explanation.tldr}
                        </div>
                      </div>

                      {/* Desi Analogy Card */}
                      {explanation.analogy && (
                        <div className="rounded-lg border-2 border-black bg-[#14141c] shadow-[4px_4px_0px_#000] overflow-hidden">
                          <div className={`font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center ${
                            mode === 'roast' ? 'bg-[#FF5500] text-white' : 'bg-[#FF007F] text-white'
                          }`}>
                            <span>{mode === 'roast' ? '💀 FULL ROAST STORY' : '🍛 DESI ANALOGY — SAMJHA?'}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(explanation.analogy);
                                setToast("📋 Analogy copied!");
                              }}
                              className="text-[9.5px] px-1.5 py-0.5 bg-black text-white font-space font-bold neo-btn"
                            >
                              COPY
                            </button>
                          </div>
                          <div className="p-3.5 font-space text-[13.5px] text-zinc-200 leading-relaxed">
                            {explanation.analogy}
                          </div>
                        </div>
                      )}

                      {/* Line by line Breakdown */}
                      {explanation.lines && explanation.lines.length > 0 && (
                        <div className="rounded-lg border-2 border-black bg-[#121218] shadow-[4px_4px_0px_#000] overflow-hidden">
                          <div className="bg-[#00F0FF] text-black font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center">
                            <span>{mode === 'roast' ? '🔪 LINE-BY-LINE CHIR PHAAD' : '🔍 LINE-BY-LINE BREAKDOWN'}</span>
                            <span className="mono text-[10px] font-bold">{explanation.lines.length} LINES</span>
                          </div>
                          <div className="p-3 space-y-2.5 max-h-[350px] overflow-y-auto">
                            {explanation.lines.map((l, i) => (
                              <div key={i} className="p-2.5 rounded border-2 border-black bg-[#181822] shadow-[2px_2px_0px_#000]">
                                <code className="mono text-[11.5px] text-[#22D3EE] block bg-black p-1.5 rounded border border-zinc-700 whitespace-pre overflow-x-auto mb-1.5">
                                  {l.code}
                                </code>
                                <div className="font-space text-[12px] text-zinc-300">
                                  <span className="text-[#00FF66] font-bold mr-1">↳</span>
                                  {l.explain}
                                </div>
                                {mode === 'roast' && l.roast && (
                                  <div className="font-marker text-[11px] text-[#FF2A2A] bg-black p-1 rounded border border-[#FF2A2A]/40 mt-1">
                                    🔥 {l.roast}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interview Tip / Roast Redemption */}
                      {explanation.interview && (
                        <div className="rounded-lg border-2 border-black bg-[#121218] shadow-[4px_4px_0px_#000] overflow-hidden">
                          <div className="bg-[#00FF66] text-black font-funky text-[11px] px-3 py-1.5 border-b-2 border-black flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                              <span>{mode === 'roast' ? '🛠️' : '💼'}</span>
                              <span>{mode === 'roast' ? 'SUDHAAR KAISE KAREGA?' : 'INTERVIEW ME KAISE BOLNA HAI'}</span>
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(explanation.interview);
                                setToast("📋 Interview playbook copied!");
                              }}
                              className="text-[9.5px] px-2 py-0.5 bg-black text-white font-space font-bold neo-btn"
                            >
                              COPY PLAYBOOK
                            </button>
                          </div>
                          <div className="p-3.5 space-y-2.5 font-space text-[12.5px] leading-relaxed">
                            {explanation.interview.split('\n\n').map((block, bIdx) => {
                              const trimmed = block.trim();
                              if (!trimmed) return null;
                              const isPitch = trimmed.startsWith('🗣️');
                              const isComplexity = trimmed.startsWith('⏱️');
                              const isTrap = trimmed.startsWith('🎯');
                              const isEdge = trimmed.startsWith('⚠️');

                              return (
                                <div
                                  key={bIdx}
                                  className={`p-2.5 rounded border-2 border-black shadow-[2px_2px_0px_#000] whitespace-pre-line ${
                                    isPitch
                                      ? 'bg-[#181828] border-[#6366F1] text-indigo-100'
                                      : isComplexity
                                      ? 'bg-[#122218] border-[#00FF66] text-emerald-100'
                                      : isTrap
                                      ? 'bg-[#261c12] border-amber-500 text-amber-100'
                                      : isEdge
                                      ? 'bg-[#26141a] border-rose-500 text-rose-100'
                                      : 'bg-[#1a1a24] border-zinc-700 text-zinc-200'
                                  }`}
                                >
                                  {trimmed}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Share Card Trigger Banner */}
                  <div className="rounded-lg border-2 border-black bg-[#6366F1] text-white p-3 shadow-[4px_4px_0px_#000] flex items-center justify-between gap-3">
                    <div>
                      <div className="font-funky text-[12px]">📸 DOSTON KO BHI SAMJHAO!</div>
                      <div className="font-space text-[11px] font-semibold">Instagram Story & Square card download karo.</div>
                    </div>
                    <button
                      onClick={() => openShare('story')}
                      className="font-funky text-[11px] px-3 py-1.5 rounded bg-black text-white border-2 border-black neo-btn"
                    >
                      SHARE CARD
                    </button>
                  </div>

                  {/* Quiz Section */}
                  {quizData && quizData.quizzes && quizData.quizzes.length > 0 && (
                    <div ref={quizRef} className="mt-4 rounded-xl border-2 border-black bg-[#14141c] p-4 shadow-[6px_6px_0px_#000]">
                      <div className="flex items-center justify-between pb-2.5 border-b-2 border-black mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[20px]">🎯</span>
                          <span className="font-funky text-[13px] text-[#818CF8]">DESI MCQ QUIZ</span>
                        </div>
                        <span className="font-marker text-xs px-2 py-0.5 bg-[#FF007F] text-white border border-black rotate-1">
                          {Object.keys(selectedAnswers).length} / {quizData.quizzes.length} ATTEMPTED
                        </span>
                      </div>

                      <div className="space-y-4">
                        {quizData.quizzes.map((q, qIdx) => {
                          const isAnswered = selectedAnswers[qIdx] !== undefined;
                          const selectedOption = selectedAnswers[qIdx];
                          const isCorrect = isAnswered && selectedOption === q.correct;
                          return (
                            <div key={qIdx} className="p-3.5 rounded-lg border-2 border-black bg-[#181822] shadow-[3px_3px_0px_#000]">
                              <div className="font-space font-bold text-[13px] text-white mb-2.5 flex items-start gap-2">
                                <span className="font-funky text-[#22D3EE]">{qIdx + 1}.</span>
                                <span>{q.question}</span>
                              </div>

                              <div className="space-y-2">
                                {q.options.map((opt, optIdx) => {
                                  const isSelected = selectedOption === optIdx;
                                  const isThisCorrect = optIdx === q.correct;
                                  return (
                                    <button
                                      type="button"
                                      key={optIdx}
                                      onClick={() => handleSelectOption(qIdx, optIdx)}
                                      className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded border-2 border-black cursor-pointer font-space text-[12.5px] transition-all text-left neo-btn ${
                                        isSelected
                                          ? isThisCorrect
                                            ? 'bg-[#00FF66] text-black font-bold shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#FF2A2A] text-white font-bold shadow-[2px_2px_0px_#000]'
                                          : isAnswered && isThisCorrect
                                          ? 'bg-[#00FF66]/25 border-dashed text-emerald-200 font-semibold'
                                          : 'bg-[#101016] text-zinc-300 hover:bg-[#1c1c28]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <span className="mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 shrink-0">
                                          {String.fromCharCode(65 + optIdx)}
                                        </span>
                                        <span className="leading-snug">{opt}</span>
                                      </div>
                                      {isAnswered && isThisCorrect && (
                                        <span className="font-funky text-[11px] text-[#00FF66] shrink-0 ml-2">
                                          ✓ SAHI
                                        </span>
                                      )}
                                      {isAnswered && isSelected && !isThisCorrect && (
                                        <span className="font-funky text-[11px] text-white shrink-0 ml-2">
                                          ✗ GALAT
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {isAnswered && (
                                <div className={`mt-3 p-2.5 rounded border-2 border-black font-space text-[12px] leading-relaxed shadow-[2px_2px_0px_#000] ${
                                  isCorrect
                                    ? 'bg-[#00FF66]/20 text-emerald-200 border-[#00FF66]'
                                    : 'bg-[#6366F1]/20 text-indigo-100 border-[#6366F1]'
                                }`}>
                                  <span className="font-bold mr-1">
                                    {isCorrect ? '🎉 Shabash!' : '💡 Sahi Logic:'}
                                  </span>
                                  {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Quiz Score Summary */}
                      {Object.keys(selectedAnswers).length === quizData.quizzes.length && (
                        <div className="mt-4 p-4 rounded-lg border-2 border-black bg-gradient-to-r from-[#4338CA] to-[#0891B2] text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[4px_4px_0px_#000]">
                          <div className="flex items-center gap-3">
                            <span className="text-[30px]">🏆</span>
                            <div>
                              <div className="font-funky text-[14px]">
                                SCORE: {quizData.quizzes.reduce((acc, q, idx) => acc + (selectedAnswers[idx] === q.correct ? 1 : 0), 0)} / {quizData.quizzes.length}
                              </div>
                              <div className="font-space text-[12px] font-bold">
                                {quizData.quizzes.reduce((acc, q, idx) => acc + (selectedAnswers[idx] === q.correct ? 1 : 0), 0) === 3
                                  ? 'Gazab bhai! 100% Senior level logic clear hai!'
                                  : quizData.quizzes.reduce((acc, q, idx) => acc + (selectedAnswers[idx] === q.correct ? 1 : 0), 0) >= 2
                                  ? 'Badiya performance! Thoda sa revision aur full marks pakke.'
                                  : 'Arre tension nahi, explanation dubara dekh aur firse try kar!'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setSelectedAnswers({})}
                              className="font-space text-[11px] font-bold px-3 py-2 bg-black text-white rounded border-2 border-black neo-btn"
                            >
                              🔄 Reset Answers
                            </button>
                            <button
                              onClick={handleGenerateQuiz}
                              disabled={isQuizLoading}
                              className="font-funky text-[11px] px-3 py-2 bg-[#FF007F] text-white rounded border-2 border-black neo-btn"
                            >
                              ⚡ Naya Quiz
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 mt-2 py-1 px-2 flex flex-wrap items-center justify-between gap-2 mono text-[10px] text-zinc-400 border-t-2 border-black">
          <div className="flex items-center gap-2">
            <span className="font-funky text-white">codeSamjhao.exe</span>
            <span>•</span>
            <span className="font-space font-semibold text-zinc-400">100% Desi • 0% AI Slop • Chai-Powered</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#22D3EE] font-bold">⚡ Groq Llama 3.3 + 📻 Puter.js Free Voice</span>
            <span className="font-funky text-[9px] px-1.5 py-0.5 bg-[#00FF66] text-black border border-black">v3.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
