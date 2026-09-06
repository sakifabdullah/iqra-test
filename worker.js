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
        // API: SAVE NEW SUBMISSION (Status: Pending)
        // ----------------------------------------------------
        if (url.pathname === "/api/scores" && request.method === "POST") {
            try {
                const body = await request.json();
                const existing = JSON.parse((await env.QUIZ_KV.get("scores")) || "[]");

                // Calculate attempt number
                const previousAttempts = existing.filter(e => e.name.toLowerCase() === body.name.toLowerCase()).length;
                const attemptNumber = previousAttempts + 1;

                // Generate unique ID for this paper
                const paperId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

                existing.unshift({
                    id: paperId,
                    name: body.name,
                    attempt: attemptNumber,
                    answers: body.answers, // Student's raw input
                    status: "pending",     // Needs teacher review
                    score: 0,
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
        // API: TEACHER SUBMITS GRADES
        // ----------------------------------------------------
        if (url.pathname === "/api/grade" && request.method === "POST") {
            try {
                const body = await request.json();
                const existing = JSON.parse((await env.QUIZ_KV.get("scores")) || "[]");

                const index = existing.findIndex(e => e.id === body.id);
                if (index > -1) {
                    existing[index].score = body.score;
                    existing[index].status = "graded";
                    existing[index].gradedAnswers = body.gradedAnswers; // Array of true/false

                    await env.QUIZ_KV.put("scores", JSON.stringify(existing));
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { "Content-Type": "application/json" }
                    });
                }
                return new Response(JSON.stringify({ error: "Paper not found" }), { status: 404 });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 400 });
            }
        }

        // ----------------------------------------------------
        // API: CLEAR SCOREBOARD (Abrarul Haq only)
        // ----------------------------------------------------
        if (url.pathname === "/api/clear" && request.method === "POST") {
            try {
                const body = await request.json();
                if ((body.adminName || "").trim().toLowerCase() === "abrarul haq") {
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
    <title>আরবি ভাষা অনুশীলন (Teacher Grading)</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap');

        :root {
            --primary: #176b52;
            --light: #f4faf7;
            --accent: #d9a441;
            --danger: #c73e3a;
            --text: #1e2925;
            --pending: #d9a441;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: #eef4f1; color: var(--text); font-family: "Noto Sans Bengali", sans-serif; }
        .container { max-width: 900px; margin: auto; padding: 20px; }
        .card { background: #fff; border-radius: 18px; padding: 28px; margin: 16px 0; box-shadow: 0 6px 24px #00000012; }
        header { text-align: center; padding: 24px 10px; }
        h1 { color: var(--primary); margin: 0 0 8px; }
        .subtitle { color: #607069; }
        label { font-weight: 700; display: block; margin: 12px 0 7px; }
        input[type="text"], textarea { width: 100%; padding: 14px; border: 1.5px solid #ccd8d2; border-radius: 10px; font: inherit; font-size: 17px; }
        textarea { min-height: 92px; resize: vertical; }
        
        button { border: 0; border-radius: 10px; padding: 13px 20px; font: inherit; font-weight: 700; cursor: pointer; background: var(--primary); color: white; margin-top: 14px; }
        button.secondary { background: #e8efeb; color: var(--primary); }
        button.danger { background: var(--danger); }
        .hidden { display: none !important; }
        
        .section-title { background: var(--light); padding: 12px 16px; border-radius: 10px; color: var(--primary); font-weight: 800; margin-top: 28px; }
        .question { padding: 20px 0; border-bottom: 1px solid #edf0ee; }
        .qnum { font-weight: 800; color: var(--primary); }
        .arabic { font-family: "Noto Naskh Arabic", serif; font-size: 28px; direction: rtl; text-align: right; line-height: 1.7; margin: 10px 0; }
        .prompt { font-size: 17px; margin: 8px 0; }
        .progress-wrap { height: 10px; background: #e4ece8; border-radius: 99px; overflow: hidden; margin-top: 10px; }
        .progress { height: 100%; background: var(--primary); width: 0%; transition: .3s; }

        /* SCOREBOARD */
        .scoreboard-card { margin-top: 30px; }
        .scoreboard-header { display: flex; flex-direction: column; align-items: flex-start; gap: 15px; margin-bottom: 20px; }
        .warning-box { display: flex; align-items: center; flex-wrap: wrap; gap: 15px; background: #fff8f7; padding: 12px 16px; border-left: 5px solid var(--danger); border-radius: 8px; width: 100%; }
        .teacher-warning { background: #fffdf5; border-left: 5px solid var(--pending); padding: 16px; border-radius: 8px; margin-bottom: 20px; font-weight: 700; color: #8a641c; }
        .success-box { background: #f4fbf7; border-left: 5px solid #31906c; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-weight: 700; color: var(--primary); text-align: center; font-size: 18px; }
        .warning-text { font-size: 15px; color: var(--danger); font-weight: 700; flex: 1; }
        .scoreboard-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .scoreboard-table th, .scoreboard-table td { padding: 12px; text-align: left; border-bottom: 1px solid #edf0ee; }
        .scoreboard-table th { background: var(--light); color: var(--primary); font-weight: 700; }
        .rank-badge { font-weight: bold; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: #e8efeb; color: var(--primary); }
        .attempt-tag { font-size: 12px; color: #607069; font-weight: normal; margin-top: 3px; }

        /* GRADING / REVIEW UI */
        .mistake { border-left: 5px solid #d3dee0; background: #f9fbfb; padding: 16px; margin: 14px 0; border-radius: 10px; }
        .mistake-number { font-weight: 800; color: #5a757a; margin-bottom: 8px; }
        .answer-label { font-weight: 700; margin-top: 10px; font-size: 14px; color: #666; }
        .given-answer { margin: 5px 0; color: #111; font-size: 18px; font-weight: 600; }
        .correct-answer { margin-top: 5px; color: var(--primary); font-weight: 700; }
        .grading-options { margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ccd8d2; display: flex; gap: 20px; }
        .grading-options label { margin: 0; display: inline-flex; align-items: center; gap: 8px; font-size: 16px; cursor: pointer; background: #fff; padding: 10px 15px; border-radius: 8px; border: 1px solid #ccd8d2; }
        .grading-options input[type="radio"] { width: auto; transform: scale(1.3); margin: 0; }
        .status-pending { color: var(--pending); font-weight: 700; }
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
            <input type="text" id="studentName" placeholder="পূর্ণ নাম (ইংরেজিতে বা বাংলায়)">
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
                <button type="button" id="submitBtn" onclick="submitQuiz()">উত্তর জমা দিন</button>
            </div>
        </div>

        <!-- POST-SUBMISSION SUCCESS MESSAGE -->
        <div id="submittedScreen" class="hidden">
            <div class="card" style="text-align:center; padding: 40px 20px;">
                <h2 style="color:var(--primary);">মাশাআল্লাহ!</h2>
                <p style="font-size:18px;">আপনার খাতাটি সফলভাবে জমা হয়েছে।</p>
                <p style="color:#607069;">শিক্ষক খাতাটি মূল্যায়ন (Grade) করার পর স্কোরবোর্ডে আপনার নম্বর দেখতে পাবেন।</p>
                <button onclick="window.location.reload()">স্কোরবোর্ডে ফিরে যান</button>
            </div>
        </div>

        <!-- TEACHER REVIEW / GRADING SCREEN -->
        <div id="reviewScreen" class="hidden">
            <div class="card" id="reviewContent">
                <!-- Dynamically populated by JS -->
            </div>
            <div style="text-align: center; margin-bottom: 30px;">
                <button class="secondary" onclick="closeReview()">স্কোরবোর্ডে ফিরে যান (Back)</button>
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
                            <th>খাতা</th>
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
                    ["عَمَّةٌ", ["একজন ফুফু", "একটি ফুফু", "ফুফু", "ফুপি", "একজন ফুপি"]],
                    ["أَيُّهَا الْوَلَدُ", ["হে বালক", "হে বালক।", "হে ছেলে", "হে ছেলে।"]],
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
                    ["هَذِهِ مَدْرَسَةٌ صَغِيرَةٌ", ["এটি একটি ছোট বিদ্যালয়", "এটি একটি ছোট বিদ্যালয়", "এটি একটি ছোট স্কুল", "এটি একটি ছোট মাদ্রাসা"]],
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
                    ["كَيْفَ هَذَا الْكِتَابُ؟", ["DYNAMIC_KITAB"]],
                    ["كَيْفَ التِّلْمِيذُ؟", ["DYNAMIC_TILMEEZ"]],
                    ["هَلْ هَذَا مَسْجِدٌ؟", ["نَعَمْ، هَذَا مَسْجِدٌ", "نعم هذا مسجد", "نَعَمْ هَذَا مَسْجِدٌ"]],
                    ["هَلْ هَذَا الْمَسْجِدُ جَمِيلٌ؟", ["نَعَمْ، هَذَا الْمَسْجِدُ جَمِيلٌ", "نعم هذا المسجد جميل", "نَعَمْ هَذَا الْمَسْجِدُ جَمِيلٌ"]],
                    ["مَا اسْمُكَ؟", ["DYNAMIC_NAME"]]
                ]
            }
        ];

        let questions = []; // Flattened list of all questions
        let currentName = "";
        let globalScoreList = []; 

        // Initialize flattened questions array globally so grading UI can access it
        sections.forEach((s, si) => {
            s.items.forEach((item, ii) => {
                questions.push({ ...s, item, si, ii });
            });
        });

        function toBanglaNumber(number) {
            const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
            return String(number).replace(/\\d/g, d => digits[d]);
        }

        // Returns the reference answer for the teacher
        function getCorrectAnswer(q) {
            if (q.item[1][0] === "DYNAMIC_NAME") return "اسمي ... (আপনার নাম)";
            if (q.item[1][0] === "DYNAMIC_TILMEEZ") return "التِّلْمِيذُ ... (যেকোনো পুংলিঙ্গ শব্দ)";
            if (q.item[1][0] === "DYNAMIC_KITAB") return "هَذَا الْكِتَابُ ... (যেকোনো পুংলিঙ্গ শব্দ)";
            // For other questions, just show the first acceptable answer as a reference
            return q.item[1][0];
        }

        function startQuiz() {
            currentName = document.getElementById("studentName").value.trim();
            if (!currentName) {
                alert("অনুগ্রহ করে আপনার নাম লিখুন।");
                return;
            }

            document.getElementById("startScreen").classList.add("hidden");
            document.getElementById("scoreboardSection").classList.add("hidden");
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

        // SUBMIT TEST TO BACKEND WITHOUT GRADING
        async function submitQuiz() {
            const btn = document.getElementById("submitBtn");
            btn.disabled = true;
            btn.textContent = "জমা হচ্ছে...";

            let studentAnswers = [];
            questions.forEach((q, i) => {
                const textarea = document.querySelector(\`[data-q="\${i}"]\`);
                studentAnswers.push(textarea ? textarea.value.trim() : "");
            });

            try {
                await fetch("/api/scores", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: currentName, answers: studentAnswers, total: 25 })
                });
                
                document.getElementById("quizScreen").classList.add("hidden");
                document.getElementById("submittedScreen").classList.remove("hidden");
                fetchScoreboard(); // Refresh in background
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e) {
                alert("জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
                btn.disabled = false;
                btn.textContent = "উত্তর জমা দিন";
            }
        }

        // ---------------------------------------------
        // SCOREBOARD & TEACHER GRADING API
        // ---------------------------------------------
        async function fetchScoreboard() {
            try {
                const res = await fetch("/api/scores");
                globalScoreList = await res.json();
                const tbody = document.getElementById("scoreboardBody");

                if (!globalScoreList || globalScoreList.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#777;">এখনও কোনো স্কোর নেই।</td></tr>';
                    return;
                }

                tbody.innerHTML = globalScoreList.map((item, idx) => {
                    // Decide what to show based on status
                    let scoreDisplay = item.status === "pending" 
                        ? \`<span class="status-pending">অপেক্ষমাণ</span>\` 
                        : \`<span style="color:var(--primary);font-weight:700;">\${toBanglaNumber(item.score)} / \${toBanglaNumber(item.total)}</span>\`;

                    return \`
                    <tr>
                        <td><span class="rank-badge">\${toBanglaNumber(idx + 1)}</span></td>
                        <td>
                            <b>\${escapeHtml(item.name)}</b>
                            <div class="attempt-tag">চেষ্টা: \${toBanglaNumber(item.attempt || 1)}</div>
                        </td>
                        <td>\${scoreDisplay}</td>
                        <td>
                            <button class="secondary" style="margin:0;padding:6px 12px;font-size:13px;" onclick="viewPaper('\${item.id}')">খাতা দেখুন</button>
                            <div style="font-size:12px;color:#777;margin-top:5px;">\${item.timestamp}</div>
                        </td>
                    </tr>
                    \`;
                }).join("");
            } catch (e) {
                console.error("Scoreboard fetch failed", e);
            }
        }

        // GENERATE THE TEACHER GRADING INTERFACE OR STUDENT REVIEW
        function viewPaper(id) {
            const paper = globalScoreList.find(x => x.id === id);
            if (!paper) return;

            document.getElementById("startScreen").classList.add("hidden");
            document.getElementById("scoreboardSection").classList.add("hidden");
            document.getElementById("reviewScreen").classList.remove("hidden");

            const container = document.getElementById("reviewContent");
            let html = \`<h2>শিক্ষার্থী: \${escapeHtml(paper.name)} (চেষ্টা: \${toBanglaNumber(paper.attempt || 1)})</h2>\`;

            if (paper.status === "pending") {
                html += \`
                    <div class="teacher-warning">
                        ⚠️ সতর্কবাণী: শুধুমাত্র শিক্ষক এই খাতাটি মূল্যায়ন করবেন।
                    </div>
                    <form id="gradingForm">
                \`;
            } else {
                html += \`
                    <div class="success-box">
                        এই খাতাটির মূল্যায়ন সম্পন্ন হয়েছে।<br>
                        প্রাপ্ত নম্বর: \${toBanglaNumber(paper.score)} / \${toBanglaNumber(paper.total)}
                    </div>
                \`;
            }

            paper.answers.forEach((ans, i) => {
                const q = questions[i];
                html += \`
                <div class="mistake">
                    <div class="mistake-number">প্রশ্ন \${toBanglaNumber(i + 1)}</div>
                    <div class="arabic" style="font-size:24px">\${q.item[0]}</div>
                    <div class="answer-label">শিক্ষার্থীর উত্তর:</div>
                    <div class="given-answer" dir="rtl" style="font-family:'Noto Naskh Arabic',serif;font-size:22px;">\${ans || "<em>কোনো উত্তর দেওয়া হয়নি</em>"}</div>
                    <div class="answer-label">সঠিক উত্তর (রেফারেন্স):</div>
                    <div class="correct-answer" dir="rtl" style="font-family:'Noto Naskh Arabic',serif;font-size:20px;">\${getCorrectAnswer(q)}</div>
                \`;

                if (paper.status === "pending") {
                    html += \`
                    <div class="grading-options">
                        <label><input type="radio" name="grade_\${i}" value="1" required> ✅ সঠিক</label>
                        <label><input type="radio" name="grade_\${i}" value="0"> ❌ ভুল</label>
                    </div>
                    \`;
                } else {
                    const isCorrect = paper.gradedAnswers[i];
                    html += \`
                    <div style="margin-top:15px; font-weight:800; font-size:16px; color: \${isCorrect ? 'var(--primary)' : 'var(--danger)'}">
                        \${isCorrect ? '✅ সঠিক হিসেবে মূল্যায়ন করা হয়েছে' : '❌ ভুল হিসেবে মূল্যায়ন করা হয়েছে'}
                    </div>
                    \`;
                }

                html += \`</div>\`;
            });

            if (paper.status === "pending") {
                html += \`
                    <div style="text-align:center; margin-top:20px;">
                        <button type="button" onclick="submitGrades('\${paper.id}')" style="font-size:18px; padding: 15px 30px;">মূল্যায়ন জমা দিন (Submit Grades)</button>
                    </div>
                    </form>
                \`;
            }

            container.innerHTML = html;
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        // TEACHER SUBMITS THE FINAL GRADES
        async function submitGrades(id) {
            const form = document.getElementById("gradingForm");
            
            // Check if teacher answered all radio buttons
            if (!form.checkValidity()) {
                alert("দয়া করে প্রতিটি প্রশ্নের জন্য 'সঠিক' বা 'ভুল' নির্বাচন করুন।");
                return;
            }

            let score = 0;
            let gradedAnswers = []; // true/false array

            questions.forEach((q, i) => {
                const val = form.elements[\`grade_\${i}\`].value;
                const isCorrect = (val === "1");
                gradedAnswers.push(isCorrect);
                if (isCorrect) score++;
            });

            try {
                const res = await fetch("/api/grade", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, score, gradedAnswers })
                });

                if (res.ok) {
                    alert("খাতাটি সফলভাবে মূল্যায়ন করা হয়েছে!");
                    closeReview();
                    fetchScoreboard();
                } else {
                    alert("সমস্যা হয়েছে, আবার চেষ্টা করুন।");
                }
            } catch (e) {
                console.error("Grading failed", e);
            }
        }

        function closeReview() {
            document.getElementById("reviewScreen").classList.add("hidden");
            document.getElementById("startScreen").classList.remove("hidden");
            document.getElementById("scoreboardSection").classList.remove("hidden");
        }

        async function clearScoreboard() {
            if (!confirm("আপনি কি নিশ্চিত যে সম্পূর্ণ স্কোরবোর্ড মুছে ফেলতে চান?")) return;
            const adminName = prompt("স্কোরবোর্ড মুছতে শিক্ষকের নাম (Abrarul Haq) লিখুন:");
            if (!adminName) return; 

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