let currentPostingStatus = {
  isRunning: false,
  results: [],
  activeGroups: [],
  total: 0,
  current: 0
};

// مستمع لنتائج النشر (يجب أن يكون في المستوى الأعلى لضمان عمله دائماً)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if ((msg.action === "POST_COMPLETED" || msg.action === "POST_FAILED" || msg.action === "POST_PENDING") && sender.tab) {
    const result = {
      group_name: msg.groupName || "Group",
      url: msg.postUrl || sender.tab.url,
      status: msg.action === "POST_COMPLETED" ? "✅ تم النشر" : 
              msg.action === "POST_PENDING" ? "👮 بانتظار المشرف" :
              `❌ فشل (${msg.reason || 'خطأ'})`
    };
    
    // التأكد من عدم تكرار النتيجة لنفس الجروب في نفس الجولة
    const existingIdx = currentPostingStatus.results.findIndex(r => r.group_name === result.group_name);
    if (existingIdx !== -1) {
      currentPostingStatus.results[existingIdx] = result;
    } else {
      currentPostingStatus.results.push(result);
      currentPostingStatus.current++;
    }
    
    // إزالة الجروب من القائمة النشطة عند الاكتمال
    currentPostingStatus.activeGroups = currentPostingStatus.activeGroups.filter(g => g !== result.group_name);
  }
});

// هذه الدالة تتعامل مع الرسائل القادمة من موقعك (الاستضافة)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === "SYNC_ACCOUNT") {
      // Step 1: فتح الفيس بوك واستخراج بيانات البروفايل
      chrome.storage.local.set({ sync_state: { step: 1 } }, () => {
        chrome.tabs.create({ url: "https://www.facebook.com/me" });
      });
      sendResponse({ status: "started_profile_sync" });
      return true;
    }
    
    // عندما يسألنا الموقع: هل هناك بيانات تم جلبها؟
    if (request.action === "GET_SYNCED_DATA") {
      chrome.storage.local.get(['autopost_data'], (result) => {
        sendResponse({ data: result.autopost_data });
        // بعد إرسالها نقوم بمسحها لكي لا تتكرر
        chrome.storage.local.remove('autopost_data');
      });
      return true;
    }

    // بدء سحب الجروبات فقط
    if (request.action === "SYNC_GROUPS_ONLY") {
      chrome.storage.local.set({ sync_state: { step: 'sync_groups_only' } }, () => {
        chrome.tabs.create({ url: "https://www.facebook.com/groups/joins/?nav_source=tab" });
      });
      sendResponse({ status: "started_groups_sync" });
      return true;
    }

    // عندما يسألنا الموقع: ما هي حالة النشر؟
    if (request.action === "GET_POSTING_STATUS") {
      sendResponse(currentPostingStatus);
      return true;
    }

    // عندما يسألنا الموقع: هل هناك جروبات مسحوبة حديثاً؟
    if (request.action === "GET_SYNCED_GROUPS") {
      chrome.storage.local.get(['autopost_new_groups'], (result) => {
        sendResponse({ data: result.autopost_new_groups });
        chrome.storage.local.remove('autopost_new_groups');
      });
      return true;
    }

    // إيقاف النشر التلقائي
    if (request.action === "STOP_POSTING") {
      currentPostingStatus.isRunning = false;
      sendResponse({ status: "posting_stopped" });
      return true;
    }

    // بدء النشر التلقائي
    if (request.action === "START_POSTING") {
      const payload = request.payload;
      const { groups, parallel = 1, timer = 30, sleepTime = 5 } = payload;
      
      let currentIndex = 0;
      let activeWorkers = 0;

      currentPostingStatus = {
        isRunning: true,
        results: [],
        activeGroups: [], // لتتبع الجروبات التي يتم النشر فيها حالياً
        total: groups.length,
        current: 0
      };

      const runWorker = async () => {
        while (currentPostingStatus.isRunning && currentIndex < groups.length) {
          const groupIdx = currentIndex++;
          const group = groups[groupIdx];
          
          currentPostingStatus.activeGroups.push(group.group_name);
          activeWorkers++;
          await processGroup(group);
          activeWorkers--;
          
          if (currentIndex % parallel === 0 && currentIndex < groups.length) {
            await new Promise(r => setTimeout(r, sleepTime * 1000));
          }
        }

        if (activeWorkers === 0) {
          currentPostingStatus.isRunning = false;
        }
      };

      async function processGroup(group) {
        return new Promise((resolve) => {
          // فتح نافذة صغيرة جداً في زاوية الشاشة لتجنب خطأ الـ Bounds
          chrome.windows.create({ 
            url: group.group_url, 
            type: 'popup', 
            focused: false,
            width: 800,
            height: 600
          }, async (win) => {
            if (chrome.runtime.lastError || !win || !win.tabs || win.tabs.length === 0) {
              console.error('Failed to create window for group:', group.group_name, chrome.runtime.lastError?.message);
              return resolve();
            }
            
            // محاولة إخفاء النافذة عن طريق تصغيرها فوراً
            chrome.windows.update(win.id, { state: 'minimized' });
            const tabId = win.tabs[0].id;
            const windowId = win.id;

            // الانتظار حتى تحميل الصفحة
            await sleep(8000);
            
            // تحقق من وجود النافذة قبل المتابعة
            chrome.windows.get(windowId, (existingWindow) => {
              if (chrome.runtime.lastError || !existingWindow) {
                console.warn('Window closed before posting could start');
                return resolve();
              }

              if (!currentPostingStatus.isRunning) {
                chrome.windows.remove(windowId, () => { if (chrome.runtime.lastError) {} });
                return resolve();
              }

              chrome.tabs.sendMessage(tabId, { action: "EXECUTE_POST", payload: { ...payload, groupName: group.group_name } }, async () => {
                // تجاهل خطأ الـ Port closed إذا حدث
                if (chrome.runtime.lastError) { /* console.log('Port closed or no response'); */ }

                const start = Date.now();
                const timeout = (timer + 40) * 1000;
                
                while (Date.now() - start < timeout && currentPostingStatus.isRunning) {
                  const found = currentPostingStatus.results.find(r => r.group_name === group.group_name);
                  if (found) break;
                  await sleep(1000);
                }

                // محاولة غلق النافذة بهدوء
                chrome.windows.get(windowId, (finalWin) => {
                  if (!chrome.runtime.lastError && finalWin) {
                    chrome.windows.remove(windowId, () => { if (chrome.runtime.lastError) {} });
                  }
                  resolve();
                });
              });
            });
          });
        });
      }

      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

      for (let i = 0; i < Math.min(parallel, groups.length); i++) {
        runWorker();
      }

      sendResponse({ status: "posting_started" });
      return true;
    }
  }
);

// هذه الدالة تتعامل مع الرسائل القادمة من الزر العائم داخل صفحة الفيس بوك أو المحتوى المحقون
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROFILE_EXTRACTED") {
    // حفظ بيانات البروفايل والانتقال للخطوة 2: استخراج الجروبات
    chrome.storage.local.set({ 
      sync_state: { step: 2, profile: request.payload } 
    }, () => {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.update(sender.tab.id, { url: "https://www.facebook.com/groups/joins/" });
      }
    });
  }

  if (request.action === "SAVE_DATA_AND_REDIRECT") {
    chrome.storage.local.set({ 'autopost_data': request.payload }, () => {
      chrome.tabs.create({ url: "https://autopost-delta.vercel.app/accounts?sync=true" }, () => {
        // تم إلغاء غلق التاب بناءً على طلب المستخدم
        // if (sender.tab && sender.tab.id) chrome.tabs.remove(sender.tab.id);
      });
    });
  }

  if (request.action === "SAVE_GROUPS_AND_REDIRECT") {
    chrome.storage.local.set({ 'autopost_new_groups': request.payload.groups }, () => {
      chrome.tabs.create({ url: "https://autopost-delta.vercel.app/groups?sync=true" }, () => {
        // تم إلغاء غلق التاب بناءً على طلب المستخدم
        // if (sender.tab && sender.tab.id) chrome.tabs.remove(sender.tab.id);
      });
    });
  }

  // ── جلب الوسائط من background (بدون CORS) وإرسالها كـ base64 ──
  if (request.action === "FETCH_MEDIA") {
    const urls = request.urls || [];
    console.log("BG: Fetching media for:", urls.length, "files");
    
    Promise.all(urls.map(async (item) => {
      try {
        console.log("BG: Fetching URL:", item.url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // زيادة الوقت لـ 20 ثانية
        
        const res = await fetch(item.url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
            console.error(`BG: Fetch failed for ${item.url} with status ${res.status}`);
            return null;
        }
        const blob = await res.blob();
        console.log(`BG: Downloaded ${item.url}, size: ${blob.size} bytes`);
        
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            const ext = (item.url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
            resolve({
              base64,
              mimeType: blob.type || guessMimeBg(ext),
              name: `upload_${Date.now()}.${ext}`
            });
          };
          reader.onerror = (err) => {
            console.error("BG: FileReader error", err);
            resolve(null);
          };
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('BG: fetch error', item.url, e.message);
        return null;
      }
    })).then(results => {
      const validFiles = results.filter(f => f !== null);
      console.log("BG: Media fetch completed, valid files:", validFiles.length);
      sendResponse({ files: validFiles });
    });
    return true; // async
  }
});

// فتح الموقع عند الضغط على أيقونة الإضافة
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: "https://autopost-delta.vercel.app" });
});

function guessMimeBg(ext) {
  const m = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
    gif:'image/gif', mp4:'video/mp4', mov:'video/quicktime', webp:'image/webp' };
  return m[ext] || 'application/octet-stream';
}
