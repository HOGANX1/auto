function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function showFloatingMessage(text, duration = 5000) {
    const div = document.createElement('div');
    div.innerText = text;
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: rgba(108, 99, 255, 0.9); color: white;
        padding: 15px 25px; border-radius: 10px; font-family: sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(5px);
        border: 1px solid rgba(255,255,255,0.2); animation: slideIn 0.5s ease-out;
    `;
    document.body.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, duration);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
`;
document.head.appendChild(style);

async function syncProfileAndGroups() {
    showFloatingMessage("AutoPost: انتظر 5 ثوانٍ لجمع بيانات البروفايل...");
    await sleep(5000);

    let profileName = "حساب فيسبوك";
    let avatarUrl = "";

    const potentialSelectors = [
      'h1[dir="auto"]',
      'h1 span',
      'a[href*="/me/"] span',
      'a[aria-label="Your profile"] span',
      'a[aria-label="الملف الشخصي"] span',
      '[role="main"] h1',
      '.x78zum5 .x15zct6 h1', // كلاسات فيسبوك الحديثة لاسم البروفايل
      'title'
    ];

    for (let s of potentialSelectors) {
      if (profileName !== "حساب فيسبوك" && profileName !== "") break;
      const elements = document.querySelectorAll(s);
      for (let el of elements) {
        let text = (s === 'title') ? document.title : el.innerText?.trim();
        if (s === 'title') text = text.replace(' | Facebook', '').replace(' - Facebook', '').replace('فيسبوك | ', '');
        
        if (text && text.length > 2 && text.length < 60) {
          const forbidden = [
            'Notifications', 'إشعارات', 'Home', 'الرئيسية', 'Facebook', 'فيسبوك', 
            'Groups', 'مجموعات', 'Chats', 'دردشات', 'Messenger', 'ماسنجر', 
            'Marketplace', 'Gaming', 'Saved', 'ذكريات', 'Memories', 'Feeds', 'الموجز',
            'friends', 'صديق', 'Posts', 'منشورات'
          ];
          if (!forbidden.some(word => text.toLowerCase().includes(word.toLowerCase()))) { 
            profileName = text; 
            break; 
          }
        }
      }
    }
    
    // محاولة سحب الصورة الشخصية بدقة أكبر
    for (let s of [
        'svg[role="img"] image', 
        'img[alt*="profile picture" i]', 
        'img[src*="scontent"]',
        'a[aria-label*="profile picture" i] img'
    ]) {
      const el = document.querySelector(s);
      if (el) { 
        avatarUrl = el.getAttribute('xlink:href') || el.src; 
        if (avatarUrl && avatarUrl.startsWith('http')) break; 
      }
    }

    chrome.runtime.sendMessage({ action: "PROFILE_EXTRACTED", payload: { username: profileName, avatar_url: avatarUrl } });
}

async function extractGroups() {
    showFloatingMessage("AutoPost: جاري سحب المجموعات... يرجى الانتظار (المستهدف 1100+ جروب)");
    let groups = [];
    let lastHeight = 0;
    
    // زيادة عدد التمريرات للسماح بسحب أكثر من 1000 جروب
    for (let i = 0; i < 150; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(2500); // زيادة وقت الانتظار لضمان التحميل
        
        const elements = document.querySelectorAll('a[href*="/groups/"]');
        elements.forEach(el => {
            const name = el.innerText?.trim();
            const url = el.href;
            if (name && url && url.includes('/groups/') && !url.includes('/create/') && name.length > 2) {
                if (!groups.find(g => g.group_url === url)) {
                    groups.push({ group_name: name, group_url: url });
                }
            }
        });

        // رسالة تقدم كل 10 تمريرات
        if (i % 10 === 0) {
            showFloatingMessage(`جاري السحب... تم العثور على ${groups.length} جروب حتى الآن`);
        }

        if (document.body.scrollHeight === lastHeight && i > 20) break;
        lastHeight = document.body.scrollHeight;
        
        if (groups.length >= 1200) break; // توقف عند الوصول للحد الأقصى المطللوب
    }

    showFloatingMessage(`✅ اكتمل السحب! تم العثور على ${groups.length} جروب.`);

    chrome.storage.local.get(['sync_state'], (result) => {
        const state = result.sync_state || {};
        const finalData = { profile: state.profile || {}, groups: groups };
        chrome.runtime.sendMessage({ action: "SAVE_DATA_AND_REDIRECT", payload: finalData });
    });
}

async function extractGroupsOnly() {
    showFloatingMessage("AutoPost: جاري سحب المجموعات فقط... (المستهدف 1100+ جروب)");
    let groups = [];
    let lastHeight = 0;

    for (let i = 0; i < 150; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(2500);
        document.querySelectorAll('a[href*="/groups/"]').forEach(el => {
            const name = el.innerText?.trim();
            const url = el.href;
            if (name && url && !url.includes('/create/') && name.length > 2 && !groups.find(g => g.group_url === url)) {
                groups.push({ group_name: name, group_url: url });
            }
        });

        if (i % 10 === 0) {
            showFloatingMessage(`جاري السحب... تم العثور على ${groups.length} جروب حتى الآن`);
        }

        if (document.body.scrollHeight === lastHeight && i > 20) break;
        lastHeight = document.body.scrollHeight;
        
        if (groups.length >= 1200) break;
    }
    showFloatingMessage(`✅ اكتمل السحب! تم العثور على ${groups.length} جروب.`);
    chrome.runtime.sendMessage({ action: "SAVE_GROUPS_AND_REDIRECT", payload: { groups: groups } });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXECUTE_POST") {
        executePostingLogic(request.payload);
    }
});

async function waitForEditor(container = document, maxAttempts = 30) {
    const selectors = [
        'div[role="textbox"][contenteditable="true"]',
        'div[data-lexical-editor="true"]',
        'div[contenteditable="true"]',
        '.notranslate[contenteditable="true"]',
        '[role="textbox"]',
        'div[aria-label*="Say something"]',
        'div[aria-label*="قول شيئاً"]',
        'div[aria-label*="بماذا تفكر"]',
        'div[aria-label*="Write something"]',
        'div[aria-label*="اكتب شيئاً"]',
        '[contenteditable="true"]'
    ];

    for (let i = 0; i < maxAttempts; i++) {
        // نكرر البحث في الـ container ثم في الـ document كخيار طوارئ
        const searchAreas = [container];
        if (container !== document) searchAreas.push(document);

        for (let area of searchAreas) {
            for (let sel of selectors) {
                const elements = area.querySelectorAll(sel);
                for (let el of elements) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 5 && rect.height > 5) {
                        // تجنب التعليقات
                        const isComment = el.closest('[role="complementary"]') || el.closest('[aria-label*="Comment"]');
                        if (isComment) continue;
                        
                        return el;
                    }
                }
            }
        }
        await sleep(1000);
    }
    return null;
}

async function typeText(editor, text) {
    editor.focus();
    // مسح النص القديم بالكامل
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(500);

    try {
        // تحويل النص إلى HTML احترافي يحافظ على كل شيء
        const htmlContent = text
            .split(/\r?\n/)
            .map(line => {
                const escapedLine = line.replace(/ /g, '&nbsp;');
                return escapedLine.trim() === "" ? "<p><br></p>" : `<p>${escapedLine}</p>`;
            })
            .join("");
        
        console.log("EXEC: Attempting insertHTML with formatted content");
        const success = document.execCommand('insertHTML', false, htmlContent);
        
        // المحاولة الثانية: إذا لم يظهر النص (بعض النسخ تقيد insertHTML)
        if (!success || editor.innerText.trim() === "" || editor.innerText.length < 5) {
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].length > 0) document.execCommand('insertText', false, lines[i]);
                if (i < lines.length - 1) document.execCommand('insertParagraph');
            }
        }
    } catch (e) {
        console.error("Type Error:", e);
        if (editor.innerText.trim() === "") editor.innerText = text;
    }

    await sleep(1000);
    // إرسال الأحداث لتنشيط زر النشر
    for (let evtType of ['input', 'keydown', 'keyup', 'change', 'blur']) {
        editor.dispatchEvent(new Event(evtType, { bubbles: true }));
    }
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

async function executePostingLogic(payload) {
    console.log("EXEC: Starting posting logic with payload:", payload);
    try {
        const { postText, mediaFiles, groupName } = payload;
        
        if (!postText) {
            console.warn("EXEC: No postText provided in payload!");
        }
        
        // 1. الضغط على صندوق "اكتب شيئاً" لفتح النافذة المنبثقة
        const openComposer = () => {
            showFloatingMessage("🔎 جاري البحث عن صندوق النشر...");
            
            // استراتيجية 1: البحث عن طريق الـ aria-label (الأكثر دقة)
            // نركز البحث في الجزء العلوي من الصفحة (Main Feed) لتجنب التعليقات
            const main = document.querySelector('[role="main"]');
            const searchArea = main || document;

            const ariaPlaceholders = ["Write something...", "بماذا تفكر؟", "اكتب شيئاً...", "Create a public post...", "What's on your mind?", "Create post", "إنشاء منشور"];
            for (let label of ariaPlaceholders) {
                const el = searchArea.querySelector(`div[aria-label="${label}"]`) || 
                           searchArea.querySelector(`div[aria-label*="${label}"]`);
                if (el) {
                    // التحقق أن هذا ليس صندوق تعليق
                    const isComment = el.closest('[role="complementary"]') || el.closest('[aria-label*="Comment"]') || el.closest('[aria-label*="تعليق"]');
                    if (isComment) continue;

                    console.log('Found by aria-label in main area:', label);
                    el.click();
                    return true;
                }
            }

            // استراتيجية اضافية للفيسبوك الجديد
            const roleButtons = searchArea.querySelectorAll('div[role="button"]');
            for (let rb of roleButtons) {
                const txt = rb.innerText;
                if (txt?.includes('Write something') || txt?.includes('بماذا تفكر')) {
                    // تجنب التعليقات
                    if (rb.closest('[role="complementary"]') || rb.closest('[aria-label*="Comment"]')) continue;
                    
                    rb.click();
                    return true;
                }
            }

            // استراتيجية 2: البحث عن نص داخل أزرار
            const placeholders = [
                "Write something", "بماذا تفكر", "إبداء منشور", "اكتب شيئاً", 
                "What's on your mind", "منشور", "Post", "Create a public post",
                "إنشاء منشور عام", "Create post", "اضف منشور", "Write...", "اكتب...",
                "What’s on your mind?", "Start a post", "إنشاء منشور"
            ];
            
            const allButtons = Array.from(document.querySelectorAll('div[role="button"], div[tabindex="0"], span, div[role="link"]'));
            for (let btn of allButtons) {
                const txt = btn.innerText?.trim();
                if (txt && placeholders.some(p => txt === p || txt?.includes(p))) {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 20 && rect.height > 10) {
                        // تجنب التعليقات
                        if (btn.closest('[role="complementary"]') || btn.closest('[aria-label*="Comment"]')) continue;
                        
                        console.log('Found by text content:', txt);
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        btn.click();
                        // محاولة ثانية بالضغط على الأب في حال كان الزر مغلفاً
                        setTimeout(() => { if (btn.parentElement) btn.parentElement.click(); }, 500);
                        return true;
                    }
                }
            }

            // استراتيجية 3: البحث عن أي عنصر يحتوي على نص الكتابة
            const allElements = searchArea.querySelectorAll('div, span, b');
            for (let el of allElements) {
                const txt = el.innerText?.trim();
                if (txt === "Write something..." || txt === "بماذا تفكر؟" || txt === "اكتب شيئاً..." || txt === "Create a public post...") {
                    el.click();
                    return true;
                }
            }

            // استراتيجية 4: الضغط على زر "صورة/فيديو" لفتح النافذة
            const photoBtn = searchArea.querySelector('div[aria-label="Photo/Video"]') || 
                             searchArea.querySelector('div[aria-label="صورة/فيديو"]');
            if (photoBtn) {
                photoBtn.click();
                return true;
            }

            return false;
        };

        showFloatingMessage("🚀 بدء عملية النشر في: " + groupName);
        if (!openComposer()) {
            const main = document.querySelector('[role="main"]');
            if (main) {
                const firstBtn = main.querySelector('div[role="button"]');
                if (firstBtn) firstBtn.click();
            }
        }

        await sleep(5000);

        // 2. العثور على منطقة الكتابة (الدايالوج)
        let container = document;
        let dialog = null;
        for (let i = 0; i < 15; i++) {
            dialog = document.querySelector('div[role="dialog"]');
            if (dialog) break;
            await sleep(1000);
        }
        if (dialog) container = dialog;

        // 3. رفع المرفقات أولاً (هذا يفتح مساحة الكتابة بشكل صحيح)
        if (mediaFiles && mediaFiles.length > 0) {
            showFloatingMessage("🖼️ جاري تحضير الصور...");
            const photoBtn = (() => {
                const selectors = ['div[aria-label="Photo/Video"]', 'div[aria-label="صورة/فيديو"]', 'i[class*="photo"]'];
                for (let s of selectors) {
                    const b = container.querySelector(s)?.closest('div[role="button"]');
                    if (b) return b;
                }
                return null;
            })();

            if (photoBtn) {
                photoBtn.click();
                await sleep(3000);
            }

            try {
                const response = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: "FETCH_MEDIA", urls: mediaFiles }, resolve);
                });

                if (response && response.files && response.files.length > 0) {
                    const dataTransfer = new DataTransfer();
                    for (const file of response.files) {
                        const byteCharacters = atob(file.base64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                        const dataFile = new File([new Uint8Array(byteNumbers)], file.name, { type: file.mimeType });
                        dataTransfer.items.add(dataFile);
                    }

                    // البحث عن الـ input في كامل الصفحة لضمان العثور عليه
                    const fileInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"]');
                    if (fileInput) {
                        console.log("EXEC: File input found, assigning files...");
                        fileInput.files = dataTransfer.files;
                        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                        await sleep(10000); // زيادة وقت الانتظار لـ 10 ثوانٍ للرفع
                    } else {
                        console.error("EXEC: File input NOT found!");
                    }
                }
            } catch (e) { console.error("Media Error:", e); }
        }

        // 4. كتابة النص (بعد استقرار النافذة والتحميل)
        const editor = await waitForEditor(container);
        if (editor) {
            console.log("EXEC: Editor found, starting typeText. Text length:", postText?.length);
            showFloatingMessage("✍️ جاري كتابة النص...");
            await typeText(editor, postText || "");
            await sleep(3000);
        } else {
            console.error("EXEC: Editor NOT found after 15 attempts!");
            showFloatingMessage("❌ فشل العثور على محرر النصوص");
        }

        // 5. الضغط على نشر (البحث بذكاء أكبر عن الزر)
        const getSubmitBtn = () => {
            const selectors = [
                'div[aria-label="Post"][role="button"]',
                'div[aria-label="نشر"][role="button"]',
                'div[aria-label="Share"][role="button"]',
                'div[aria-label="مشاركة"][role="button"]',
                'div[data-testid="post-button"]',
                'div[role="button"] div span'
            ];
            
            for (let s of selectors) {
                const btn = container.querySelector(s);
                if (btn) return btn;
            }

            // البحث عن نص دقيق داخل الأزرار داخل الدايالوج فقط
            const dialogButtons = Array.from(container.querySelectorAll('div[role="button"]'));
            return dialogButtons.find(b => {
                const txt = b.innerText?.trim();
                // نرفض الأزرار التي تحتوي على "التالي" أو "مجموعات" لتجنب فتح نوافذ أخرى
                if (txt?.includes('Next') || txt?.includes('التالي') || txt?.includes('Groups') || txt?.includes('مجموعات')) return false;
                return txt === "Post" || txt === "نشر" || txt === "Share" || txt === "مشاركة" || txt === "Done" || txt === "تم";
            });
        };

        let submitBtn = getSubmitBtn();
        let attempts = 0;
        while (attempts < 20) {
            submitBtn = getSubmitBtn();
            if (submitBtn) {
                const isDisabled = submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.hasAttribute('disabled');
                if (!isDisabled) break;
                if (editor) {
                    editor.focus();
                    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
                }
            }
            await sleep(1500);
            attempts++;
        }

        if (submitBtn) {
            submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(1000);
            
            // محاولة الضغط بأكثر من طريقة
            submitBtn.click();
            
            const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
            const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
            submitBtn.dispatchEvent(mouseDownEvent);
            submitBtn.dispatchEvent(mouseUpEvent);

            await sleep(5000); 
            
            const pageText = document.body.innerText;
            if (pageText.includes("Pending admin approval") || pageText.includes("بانتظار موافقة المسؤول") || pageText.includes("موافقة المسؤول")) {
                chrome.runtime.sendMessage({ action: "POST_PENDING", groupName: groupName });
            } else {
                chrome.runtime.sendMessage({ action: "POST_COMPLETED", groupName: groupName });
            }
        } else {
            chrome.runtime.sendMessage({ action: "POST_FAILED", groupName: groupName, reason: "Could not find Post button after multiple attempts" });
        }
    } catch (e) {
        chrome.runtime.sendMessage({ action: "POST_FAILED", groupName: payload.groupName, reason: e.message });
    }
}

// Check initial state
chrome.storage.local.get(['sync_state'], (result) => {
    const state = result.sync_state || {};
    if (state.step === 1 && !window.location.href.includes('/groups/')) syncProfileAndGroups();
    else if (state.step === 2 && window.location.href.includes('/groups/joins')) extractGroups();
    else if (state.step === 'sync_groups_only' && window.location.href.includes('/groups/joins')) extractGroupsOnly();
});