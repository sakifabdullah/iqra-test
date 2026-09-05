export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // ----------------------------------------------------
        // API: GET SCOREBOARD
        // ----------------------------------------------------
        if (url.pathname === "/api/scores" && request.method === "GET") {
            const data = await env.QUIZ_KV.get("scores");
            return new Response(data || "[]", {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        // ----------------------------------------------------
        // API: SAVE SCORE
        // ----------------------------------------------------
        if (url.pathname === "/api/scores" && request.method === "POST") {
            try {
                const body = await request.json();
                const existing = JSON.parse((await env.QUIZ_KV.get("scores")) || "[]");

                existing.unshift({
                    name: body.name,
                    score: body.score,
                    total: body.total || 25,
                    timestamp: new Date().toLocaleTimeString("bn-BD", {
                        timeZone: "Asia/Dhaka",
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short"
                    })
                });

                // Keep the latest 100 entries
                await env.QUIZ_KV.put("scores", JSON.stringify(existing.slice(0, 100)));

                return new Response(JSON.stringify({ success: true }), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 400 });
            }
        }

        // ----------------------------------------------------
        // API: CLEAR SCOREBOARD (Sakib only)
        // ----------------------------------------------------
        if (url.pathname === "/api/clear" && request.method === "POST") {
            try {
                const body = await request.json();
                if ((body.adminName || "").trim().toLowerCase() === "sakib") {
                    await env.QUIZ_KV.put("scores", "[]");
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { "Content-Type": "application/json" }
                    });
                }
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 400 });
            }
        }

        // ----------------------------------------------------
        // SERVE FRONTEND (HTML)
        // ----------------------------------------------------
        return new Response(HTML_CONTENT, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
};

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>আরবি ভাষা অনুশীলন</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap');

        :root {
            --primary: #176b52;
            --light: #f4faf7;
            --accent: #d9a441;
            --danger: #c73e3a;
            --text: #1e2925;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: #eef4f1; color: var(--text); font-family: "Noto Sans Bengali", sans-serif; }
        .container { max-width: 900px; margin: auto; padding: 20px; }
        .card { background: #fff; border-radius: 18px; padding: 28px; margin: 16px 0; box-shadow: 0 6px 24px #00000012; }
        header { text-align: center; padding: 24px 10px; }
        h1 { color: var(--primary); margin: 0 0 8px; }
        .subtitle { color: #607069; }
        label { font-weight: 700; display: block; margin: 12px 0 7px; }
        input, textarea { width: 100%; padding: 14px; border: 1.5px solid #ccd8d2; border-radius: 10px; font: inherit; font-size: 17px; }
        textarea { min-height: 92px; resize: vertical; }
        button { border: 0; border-radius: 10px; padding: 13px 20px; font: inherit; font-weight: 700; cursor: pointer; background: var(--primary); color: white; margin-top: 14px; }
        button.danger { background: var(--danger); }
        .hidden { display: none !important; }
        .section-title { background: var(--light); padding: 12px 16px; border-radius: 10px; color: var(--primary); font-weight: 800; margin-top: 28px; }
        .question { padding: 20px 0; border-bottom: 1px solid #edf0ee; }
        .qnum { font-weight: 800; color: var(--primary); }
        .arabic { font-family: "Noto Naskh Arabic", serif; font-size: 28px; direction: rtl; text-align: right; line-height: 1.7; margin: 10px 0; }
        .prompt { font-size: 17px; margin: 8px 0; }
        .progress-wrap { height: 10px; background: #e4ece8; border-radius: 99px; overflow: hidden; margin-top: 10px; }
        .progress { height: 100%; background: var(--primary); width: 0%; transition: .3s; }

        /* MISTAKES & RESULTS */
        .mistakes-card { max-width: 700px; margin: 20px auto; }
        .mistakes-title { text-align: center; color: var(--danger); margin-top: 0; }
        .mistake { border-left: 5px solid var(--danger); background: #fff8f7; padding: 16px; margin: 14px 0; border-radius: 10px; }
        .mistake-number { font-weight: 800; color: var(--danger); margin-bottom: 8px; }
        .given-answer { margin: 5px 0 10px; color: #5d2927; }
        .correct-answer { margin-top: 5px; color: var(--primary); font-weight: 700; }
        .no-mistakes { border-left: 5px solid #31906c; background: #f4fbf7; padding: 18px; border-radius: 10px; text-align: center; font-weight: 700; color: var(--primary); }
        .result-card { max-width: 600px; margin: 30px auto; padding: 32px 24px; border-radius: 22px; background: #ffffff; box-shadow: 0 10px 35px #00000015; text-align: center; }
        .result-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 20px 0; }
        .result-stat { background: var(--light); border-radius: 14px; padding: 20px 10px; }
        .result-stat .value { font-size: 28px; font-weight: 800; color: var(--primary); }
        .score-box { margin-top: 18px; padding: 22px; border-radius: 16px; background: var(--primary); color: white; }
        .score-value { font-size: 42px; font-weight: 800; }
        .restart-wrap { text-align: center; padding-bottom: 30px; }

        /* SCOREBOARD */
        .scoreboard-card { margin-top: 30px; }
        .scoreboard-header { display: flex; flex-direction: column; align-items: flex-start; gap: 15px; margin-bottom: 20px; }
        
        .warning-box {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
            background: #fff8f7;
            padding: 12px 16px;
            border-left: 5px solid var(--danger);
            border-radius: 8px;
            width: 100%;
        }
        
        .warning-text { font-size: 15px; color: var(--danger); font-weight: 700; flex: 1; }
        
        .scoreboard-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .scoreboard-table th, .scoreboard-table td { padding: 12px; text-align: left; border-bottom: 1px solid #edf0ee; }
        .scoreboard-table th { background: var(--light); color: var(--primary); font-weight: 700; }
        .rank-badge { font-weight: bold; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: #e8efeb; color: var(--primary); }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div style="font-weight:800;color:#176b52;font-size:20px;margin-bottom:6px">ইকরা অনলাইন মাদ্রাসা</div>
            <div class="subtitle" style="margin-bottom:12px">ব্যাচঃ 11.B</div>
            <h1>আরবি ভাষা অনুশীলন</h1>
            <div class="subtitle">শব্দার্থ, অনুবাদ ও আরবি বাক্য অনুশীলন</div>
        </header>

        <!-- START SCREEN -->
        <div id="startScreen" class="card">
            <h2>শিক্ষার্থীর তথ্য</h2>
            <label>আপনার নাম লিখুন</label>
            <input id="studentName" placeholder="পূর্ণ নাম (ইংরেজিতে বা বাংলায়)">
            <p class="note">মোট প্রশ্ন: ২৫ | প্রতিটি প্রশ্নের মান: ১</p>
            <button onclick="startQuiz()">অনুশীলন শুরু করুন</button>
        </div>

        <!-- QUIZ SCREEN -->
        <div id="quizScreen" class="hidden">
            <div class="card">
                <div style="display:flex;justify-content:space-between;gap:10px">
                    <b id="studentDisplay"></b>
                    <b id="progressText">০ / ২৫</b>
                </div>
                <div class="progress-wrap">
                    <div class="progress" id="progressBar"></div>
                </div>
            </div>
            <form id="quizForm"></form>
            <div class="card">
                <button type="button" onclick="submitQuiz()">উত্তর জমা দিন</button>
            </div>
        </div>

        <!-- RESULT SCREEN -->
        <div id="resultScreen" class="hidden">
            <div class="card mistakes-card">
                <h2 class="mistakes-title" id="mistakesTitle">আপনার ভুলগুলো</h2>
                <div id="mistakes"></div>
            </div>

            <div class="result-card">
                <h2>ফলাফল</h2>
                <div class="result-name" id="resultName" style="font-size:20px;font-weight:700;margin:10px 0;"></div>
                <div class="result-stats">
                    <div class="result-stat">
                        <div>সঠিক উত্তর</div>
                        <div class="value" id="correctAnswers">০</div>
                    </div>
                    <div class="result-stat">
                        <div>ভুল উত্তর</div>
                        <div class="value" id="wrongAnswers">০</div>
                    </div>
                </div>
                <div class="score-box">
                    <div>আপনার স্কোর</div>
                    <div class="score-value" id="scoreText">০ / ২৫</div>
                </div>
            </div>

            <div class="restart-wrap">
                <button onclick="restart()">আবার চেষ্টা করুন</button>
            </div>
        </div>

        <!-- UNIFIED SCOREBOARD -->
        <div class="card scoreboard-card" id="scoreboardSection">
            <div class="scoreboard-header">
                <h2 style="margin:0;color:var(--primary);">🏆 লাইভ স্কোরবোর্ড</h2>
                
                <div class="warning-box">
                    <div class="warning-text">⚠️ দয়া করে শিক্ষক ছাড়া কেউ স্কোরবোর্ড মুছবেন না।</div>
                    <button class="danger" onclick="clearScoreboard()" style="margin: 0; padding: 10px 16px; font-size: 14px; white-space: nowrap;">স্কোরবোর্ড মুছুন</button>
                </div>
            </div>
            
            <div style="overflow-x:auto;">
                <table class="scoreboard-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>নাম</th>
                            <th>স্কোর</th>
                            <th>সময়</th>
                        </tr>
                    </thead>
                    <tbody id="scoreboardBody">
                        <tr><td colspan="4" style="text-align:center;">স্কোরবোর্ড লোড হচ্ছে...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const sections = [
            {
                title: "১. শব্দের অর্থ",
                type: "বাংলা অর্থ লিখুন",
                items: [
                    ["دَرَّاجَةٌ", ["একটি সাইকেল", "একটি সাইকেল।"]],
                    ["النَّافِذَةُ", ["জানালাটি", "জানালাটি।"]],
                    ["مَفْتُوحٌ", ["খোলা"]],
                    ["ضَيِّقٌ", ["সংকীর্ণ", "সরু", "সংকীর্ণ / সরু"]],
                    ["مَاهِرٌ", ["দক্ষ", "দক্ষ।"]],
                    ["عَمَّةٌ", ["একজন ফুফু", "একটি ফুফু", "ফুফু"]],
                    ["أَيُّهَا الْوَلَدُ", ["হে বালক", "হে বালক।"]],
                    ["خَالَةٌ", ["একজন খালা", "একটি খালা", "খালা"]],
                    ["الْعَدُوُّ", ["শত্রুটি", "শত্রু"]],
                    ["مُفِيدٌ", ["উপকারী", "উপকারী।"]]
                ]
            },
            {
                title: "২. বাক্যের অর্থ",
                type: "বাংলা অর্থ লিখুন",
                items: [
                    ["الْمَسْجِدُ كَبِيرٌ", ["মসজিদটি বড়", "মসজিদটি বড়।"]],
                    ["هَذِهِ مَدْرَسَةٌ صَغِيرَةٌ", ["এটি একটি ছোট বিদ্যালয়", "এটি একটি ছোট বিদ্যালয়", "এটি একটি ছোট স্কুল"]],
                    ["قَمِيصٌ جَدِيدٌ", ["একটি নতুন জামা", "একটি নতুন জামা।"]],
                    ["كَيْفَ السَّاعَةُ؟", ["ঘড়িটি কেমন", "ঘড়িটি কেমন?"]],
                    ["هَذَا الْوَلَدُ قَوِيٌّ وَذَلِكَ الْوَلَدُ ضَعِيفٌ", ["এই ছেলেটি শক্তিশালী এবং ওই ছেলেটি দুর্বল", "এই ছেলেটি শক্তিশালী এবং সেই ছেলেটি দুর্বল"]]
                ]
            },
            {
                title: "৩. বাংলা থেকে আরবি বাক্য",
                type: "আরবিতে উত্তর লিখুন",
                items: [
                    ["একটি রুমাল।", ["مِنْدِيلٌ", "منديل"]],
                    ["বইটি সুন্দর।", ["الْكِتَابُ جَمِيلٌ", "الكتاب جميل"]],
                    ["এই দরজাটি বন্ধ।", ["هَذَا الْبَابُ مُغْلَقٌ", "هذا الباب مغلق"]],
                    ["ফারহানা একজন দক্ষ শিক্ষিকা।", ["فَرْحَانَةُ مُعَلِّمَةٌ مَاهِرَةٌ", "فرحانة معلمة ماهرة"]],
                    ["এই উটটি বড় এবং ওই উটটি ছোট।", ["هَذَا الْجَمَلُ كَبِيرٌ وَذَلِكَ الْجَمَلُ صَغِيرٌ", "هذا الجمل كبير وذلك الجمل صغير"]]
                ]
            },
            {
                title: "৪. আরবিতে প্রশ্নের উত্তর",
                type: "আরবিতে উত্তর লিখুন",
                items: [
                    ["كَيْفَ هَذَا الْكِتَابُ؟", ["هَذَا الْكِتَابُ جَمِيلٌ", "هذا الكتاب جميل"]],
                    ["كَيْفَ التِّلْمِيذُ؟", ["التِّلْمِيذُ مَاهِرٌ", "التلميذ ماهر"]],
                    ["هَلْ هَذَا مَسْجِدٌ؟", ["نَعَمْ، هَذَا مَسْجِدٌ", "نعم هذا مسجد", "نَعَمْ هَذَا مَسْجِدٌ"]],
                    ["هَلْ هَذَا الْمَسْجِدُ جَمِيلٌ؟", ["نَعَمْ، هَذَا الْمَسْجِدُ جَمِيلٌ", "نعم هذا المسجد جميل", "نَعَمْ هَذَا الْمَسْجِدُ جَمِيلٌ"]],
                    ["مَا اسْمُكَ؟", ["DYNAMIC_NAME"]]
                ]
            }
        ];

        let questions = [];
        let currentName = "";

        // Standard text normalizer
        function normalize(s) {
            return (s || "")
                .trim()
                .toLowerCase()
                .replace(/[ًٌٍَُِّْـ]/g, "")
                .replace(/[إأآٱ]/g, "ا")
                .replace(/[ى]/g, "ي")
                .replace(/[؟،,.!?।]/g, "")
                .replace(/\\s+/g, " ");
        }

        function toBanglaNumber(number) {
            const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
            return String(number).replace(/\\d/g, d => digits[d]);
        }

        function startQuiz() {
            currentName = document.getElementById("studentName").value.trim();
            if (!currentName) {
                alert("অনুগ্রহ করে আপনার নাম লিখুন।");
                return;
            }

            questions = [];
            sections.forEach((s, si) => {
                s.items.forEach((item, ii) => {
                    questions.push({ ...s, item, si, ii });
                });
            });

            document.getElementById("startScreen").classList.add("hidden");
            document.getElementById("quizScreen").classList.remove("hidden");
            document.getElementById("studentDisplay").textContent = "শিক্ষার্থী: " + currentName;

            const form = document.getElementById("quizForm");
            form.innerHTML = "";
            let n = 0;

            sections.forEach(s => {
                let sec = document.createElement("div");
                sec.className = "card";
                sec.innerHTML = '<div class="section-title">' + s.title + '</div>';

                s.items.forEach(item => {
                    n++;
                    const isArabic = !s.title.includes("বাংলা থেকে");
                    sec.innerHTML += \`
                        <div class="question">
                          <div class="qnum">প্রশ্ন \${toBanglaNumber(n)}</div>
                          <div class="\${isArabic ? 'arabic' : 'prompt'}">\${item[0]}</div>
                          <div class="prompt">\${s.type}</div>
                          <textarea data-q="\${n - 1}" \${isArabic ? '' : 'dir="rtl"'} placeholder="আপনার উত্তর লিখুন"></textarea>
                        </div>
                    \`;
                });
                form.appendChild(sec);
            });

            document.getElementById("progressText").textContent = "০ / ২৫";
            document.getElementById("progressBar").style.width = "0%";
            document.querySelectorAll("textarea").forEach(t => t.addEventListener("input", updateProgress));
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        function updateProgress() {
            let filled = [...document.querySelectorAll("textarea")].filter(x => x.value.trim()).length;
            document.getElementById("progressText").textContent = toBanglaNumber(filled) + " / ২৫";
            document.getElementById("progressBar").style.width = (filled / 25 * 100) + "%";
        }

        function getCorrectAnswer(q) {
            if (q.item[1][0] === "DYNAMIC_NAME") {
                return "اسمي ... (আপনার নাম)";
            }
            return q.item[1][0];
        }

        function submitQuiz() {
            let correct = 0;
            let mistakes = [];

            questions.forEach((q, i) => {
                const textarea = document.querySelector(\`[data-q="\${i}"]\`);
                const answer = textarea ? textarea.value : "";
                let valid = false;

                // QUESTION 25 LOGIC
                if (q.item[1][0] === "DYNAMIC_NAME") {
                    const norm = normalize(answer);
                    const startsWithIsmi = norm.startsWith("اسمي");
                    const remainder = norm.replace(/^اسمي\\s*/, "");
                    const hasArabicCharacters = /[\\u0600-\\u06FF]/.test(remainder);
                    valid = startsWithIsmi && hasArabicCharacters;
                } else {
                    valid = q.item[1].some(x => normalize(answer) === normalize(x));
                }

                if (valid) {
                    correct++;
                } else {
                    mistakes.push({
                        question: q.item[0],
                        given: answer.trim() || "কোনো উত্তর দেওয়া হয়নি",
                        correct: getCorrectAnswer(q)
                    });
                }
            });

            showMistakes(mistakes);
            showResult(correct, mistakes.length);

            // Send score to backend
            saveScore(currentName, correct, 25);

            document.getElementById("quizScreen").classList.add("hidden");
            document.getElementById("resultScreen").classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        function showMistakes(mistakes) {
            const box = document.getElementById("mistakes");
            const title = document.getElementById("mistakesTitle");

            if (mistakes.length === 0) {
                title.textContent = "কোনো ভুল হয়নি!";
                box.innerHTML = '<div class="no-mistakes">মাশাআল্লাহ! আপনার কোনো ভুল হয়নি।</div>';
                return;
            }

            title.textContent = "আপনার ভুলগুলো — " + toBanglaNumber(mistakes.length) + "টি";
            box.innerHTML = mistakes.map((m, i) => \`
                <div class="mistake">
                  <div class="mistake-number">ভুল প্রশ্ন \${toBanglaNumber(i + 1)}</div>
                  <div class="arabic" style="font-size:24px">\${m.question}</div>
                  <div class="answer-label"><b>আপনার উত্তর:</b></div>
                  <div class="given-answer">\${m.given}</div>
                  <div class="answer-label"><b>সঠিক উত্তর:</b></div>
                  <div class="correct-answer" dir="rtl" style="font-family:'Noto Naskh Arabic',serif;font-size:23px">\${m.correct}</div>
                </div>
            \`).join("");
        }

        function showResult(score, wrong) {
            document.getElementById("resultName").textContent = currentName;
            document.getElementById("correctAnswers").textContent = toBanglaNumber(score);
            document.getElementById("wrongAnswers").textContent = toBanglaNumber(wrong);
            document.getElementById("scoreText").textContent = toBanglaNumber(score) + " / ২৫";
        }

        function restart() {
            document.getElementById("resultScreen").classList.add("hidden");
            document.getElementById("startScreen").classList.remove("hidden");
            document.getElementById("studentName").value = currentName;
        }

        // ---------------------------------------------
        // SCOREBOARD API CALLS
        // ---------------------------------------------
        async function fetchScoreboard() {
            try {
                const res = await fetch("/api/scores");
                const list = await res.json();
                const tbody = document.getElementById("scoreboardBody");

                if (!list || list.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#777;">এখনও কোনো স্কোর নেই।</td></tr>';
                    return;
                }

                tbody.innerHTML = list.map((item, idx) => \`
                    <tr>
                        <td><span class="rank-badge">\${toBanglaNumber(idx + 1)}</span></td>
                        <td><b>\${escapeHtml(item.name)}</b></td>
                        <td style="color:var(--primary);font-weight:700;">\${toBanglaNumber(item.score)} / \${toBanglaNumber(item.total)}</td>
                        <td style="font-size:14px;color:#777;">\${item.timestamp}</td>
                    </tr>
                \`).join("");
            } catch (e) {
                console.error("Scoreboard fetch failed", e);
            }
        }

        async function saveScore(name, score, total) {
            try {
                await fetch("/api/scores", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, score, total })
                });
                fetchScoreboard();
            } catch (e) {
                console.error("Save score failed", e);
            }
        }

        async function clearScoreboard() {
            if (!confirm("আপনি কি নিশ্চিত যে সম্পূর্ণ স্কোরবোর্ড মুছে ফেলতে চান?")) return;

            // Prompt for teacher's name as an added layer of security
            const adminName = prompt("স্কোরবোর্ড মুছতে শিক্ষকের নাম (Sakib) লিখুন:");
            
            if (!adminName) return; // Stop if they press cancel or leave it blank

            try {
                const res = await fetch("/api/clear", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ adminName: adminName })
                });

                if (res.ok) {
                    alert("স্কোরবোর্ড সফলভাবে মুছে ফেলা হয়েছে!");
                    fetchScoreboard();
                } else {
                    alert("অনুমতি মেলেনি! শুধুমাত্র শিক্ষক এটি মুছতে পারবেন।");
                }
            } catch (e) {
                alert("স্কোরবোর্ড মুছতে সমস্যা হয়েছে।");
            }
        }

        function escapeHtml(text) {
            const div = document.createElement("div");
            div.textContent = text;
            return div.innerHTML;
        }

        // Initial Load
        fetchScoreboard();
    </script>
</body>
</html>`;