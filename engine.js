/* ================================================================
 * engine.js ——《已讀》播放引擎
 *
 * 這個檔案負責「怎麼播」，劇情內容都在 story.js。
 * 一般來說改劇情不用動這裡。
 *
 * 給學過 C++ 的你：
 *   const / let      宣告變數（const 宣告後不能再指向別的東西）
 *   (x) => { ... }   箭頭函式，就是一個沒有名字的小函式
 *   async / await    await 的意思是「等這件事做完再往下」，
 *                    這裡用來等讀者點一下，或等幾毫秒
 *   `${a}`           字串裡插入變數，類似 C++ 的 std::format
 *   a?.b             a 存在才讀 b，不存在就當作 undefined（不會當掉）
 *   a ?? b           a 是 null 或 undefined 時，改用 b
 * ================================================================ */
"use strict";

// ===== 1. 抓出畫面上的元素 =====
const $ = (id) => document.getElementById(id);
const ui = {
  app: $("app"),
  scene: $("scene"),
  sceneImg: $("scene-img"),
  scenePh: $("scene-ph"),
  camera: $("camera"),
  caption: $("caption"),
  captionWho: $("caption-who"),
  captionText: $("caption-text"),
  phone: $("phone"),
  screen: document.querySelector("#phone .screen"),
  clock: $("clock"),
  chatTitle: $("chat-title"),
  log: $("log"),
  notify: $("notify"),
  draft: $("draft"),
  choices: $("choices"),
  card: $("card"),
  cardText: $("card-text"),
  cardSub: $("card-sub"),
  cardBtn: $("card-btn"),
  curtain: $("curtain"),
  place: $("place"),
  placeText: $("place-text"),
  placeSub: $("place-sub"),
  ending: $("ending"),
  endingNo: $("ending-no"),
  endingTitle: $("ending-title"),
  endingTagline: $("ending-tagline"),
  endingResults: $("ending-results"),
  endingQuote: $("ending-quote"),
  endingList: $("ending-list"),
  endingUnlock: $("ending-unlock"),
  endingRetry: $("ending-retry"),
  endingSecret: $("ending-secret"),
  endingAgain: $("ending-again"),
  start: $("start"),
  startBtn: $("start-btn"),
  secretBtn: $("secret-btn"),
  startEndings: $("start-endings"),
  startTip: $("start-tip"),
  notice: $("notice"),
  rotate: $("rotate"),
  fsBtn: $("fs-btn"),
  dev: $("dev"),
  problems: $("problems"),
};

// 所有認得的 type，story.js 寫錯時用來提醒
const KNOWN_TYPES = [
  "narr", "talk", "msg", "sticker", "photo", "sys", "read", "typing",
  "draft", "erase", "unsend", "notify", "image", "card", "clock", "dim", "bgm",
  "amb", "fade", "place", "camera", "pause", "caret",
];

// 手機的主人。平常是「你」；隱藏章節換成阿哲的手機時，story.js 會寫 me: "阿哲"
const ME = "你";

// ===== 2. 遊戲狀態 =====
const state = {
  flags: {},       // 讀者做過的選擇，例如 { choice1: "A" }
  chat: undefined, // 目前打開的聊天室；null 代表手機收起來
  me: ME,          // 誰的訊息要靠右、在輸入框打字
  lastFrom: null,  // 上一則訊息是誰傳的（同一人連續傳，就不重複顯示名字和頭像）
  sceneId: null,   // 現在播到哪一幕
  image: null,     // 現在的插圖編號
  camera: { zoom: 1, x: 50, y: 50 }, // 鏡頭放大幾倍、對準哪裡（見「運鏡」那一段）
};
let runToken = 0;  // 每次重新開始就 +1，讓舊的播放流程自動停下

// 網址最後加 ?dev 或 #dev 就會打開開發者面板
const DEV = new URLSearchParams(location.search).has("dev") || location.hash === "#dev";
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = matchMedia("(pointer: coarse), (hover: none)").matches; // 手機、平板

// 「請將手機橫放」的畫面正蓋著的時候
const isRotateShowing = () => getComputedStyle(ui.rotate).display !== "none";

// ===== 3. 等待：等讀者點一下，或等幾毫秒 =====
let onTap = null; // 讀者點一下時要做的事
let onKey = null; // 互動進行中（例如收回訊息）時，空白鍵 / Enter 要做的事

function tap() {
  if (!onTap) return;
  const f = onTap;
  onTap = null;
  f();
}

// 點畫面任何地方都能繼續（按鈕、選單除外）
document.addEventListener("click", (e) => {
  if (e.target.closest("button, select, a, #dev, #problems")) return;
  if (isRotateShowing()) return; // 手機直著拿時，點畫面不算
  tap();
});

// 鍵盤：空白鍵 / Enter 繼續，1、2… 選擇，F 切換全螢幕
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest("select, input, textarea")) return;
  if (isRotateShowing()) return; // 直式畫面蓋著時，按鍵也不算

  // 選項，或結局卡上的按鈕
  const buttons = ui.choices.classList.contains("show")
    ? ui.choices.querySelectorAll(".choice")
    : ui.ending.classList.contains("show")
      ? ui.ending.querySelectorAll(".ending-actions button:not([hidden])")
      : null;
  if (buttons && /^[1-9]$/.test(e.key)) {
    if (e.repeat) return; // 按住數字鍵不放，不要連選好幾次
    const button = buttons[Number(e.key) - 1];
    if (button) {
      e.preventDefault();
      button.click();
    }
    return;
  }
  if (e.key === "f" || e.key === "F") {
    toggleFullscreen();
    return;
  }
  if ((e.key === " " || e.key === "Enter") && !e.target.closest("button")) {
    if (onKey) {
      e.preventDefault();
      if (!e.repeat) onKey(); // 按住空白鍵快轉時，不要順手把訊息收回
    } else if (onTap) {
      e.preventDefault();
      tap();
    }
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 等讀者點一下
function waitTap() {
  const token = runToken;
  return new Promise((resolve) => {
    ui.app.classList.add("waiting");
    onTap = () => {
      ui.app.classList.remove("waiting");
      if (token === runToken) resolve();
    };
  });
}

// 等 ms 毫秒；讀者點一下可以跳過等待
function wait(ms) {
  const token = runToken;
  return new Promise((resolve) => {
    const finish = () => {
      if (onTap === skip) onTap = null;
      if (token === runToken) resolve();
    };
    const skip = () => {
      clearTimeout(timer);
      finish();
    };
    const timer = setTimeout(finish, ms);
    onTap = skip;
  });
}

// ===== 4. 全螢幕 =====
const root = document.documentElement;
const canFullscreen = Boolean(
  (root.requestFullscreen && document.fullscreenEnabled) ||
  (root.webkitRequestFullscreen && document.webkitFullscreenEnabled)
);
const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

function enterFullscreen() {
  try {
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const result = request.call(root);
    // 有些地方不允許全螢幕（例如被嵌在別的網頁裡），那就把按鈕藏起來
    if (result && result.catch) result.catch(() => (ui.fsBtn.hidden = true));
  } catch (err) {
    ui.fsBtn.hidden = true;
  }
}
function exitFullscreen() {
  try {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    const result = exit.call(document);
    if (result && result.catch) result.catch(() => {});
  } catch (err) {
    /* 已經不是全螢幕，不用處理 */
  }
}
function toggleFullscreen() {
  if (!canFullscreen) return;
  if (isFullscreen()) exitFullscreen();
  else enterFullscreen();
}
// 全螢幕時藏起右上角的按鈕，離開後再出現
function updateFsButton() {
  ui.fsBtn.hidden = !canFullscreen || isFullscreen();
}
document.addEventListener("fullscreenchange", updateFsButton);
document.addEventListener("webkitfullscreenchange", updateFsButton);

// ===== 5. 畫出各種東西 =====
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// 把新東西加到聊天室最下面，並捲到底（舊訊息一次全部放好，直接跳到底）
let instantScroll = false;
function addToLog(node) {
  ui.log.appendChild(node);
  ui.log.scrollTo({ top: ui.log.scrollHeight, behavior: REDUCED_MOTION || instantScroll ? "auto" : "smooth" });
}

// 把聊天室裡的某一則捲到中間
// （用「捲到哪裡」而不是「再捲多少」，前一次捲動還沒停下來時才不會算錯）
function centerInLog(node) {
  const box = ui.log.getBoundingClientRect();
  const item = node.getBoundingClientRect();
  ui.log.scrollTo({
    top: ui.log.scrollTop + item.top - box.top - (box.height - item.height) / 2,
    behavior: REDUCED_MOTION ? "auto" : "smooth",
  });
}

// 對話框裡的文字（旁白或當面說的話）；沒有文字時對話框會淡出
// 字會一個一個出來，打字時點一下，剩下的字一次全部出來；回傳的 Promise 等字全部出來才完成
let captionId = 0; // 每換一次對話框的字就 +1，還沒打完的上一句就會停下來
async function setCaption(who, text) {
  const id = ++captionId;
  ui.captionWho.textContent = who;
  ui.captionWho.hidden = !who;
  ui.caption.classList.toggle("empty", !text);
  // 每個字先全部放好（看不見），對話框一開始就是最後的大小，字出來時不會跳行
  const chars = Array.from(text || "", (ch) => el("span", "", ch));
  ui.captionText.replaceChildren(...chars);
  const speed = STORY.textSpeed ?? 50;
  let hurry = REDUCED_MOTION || !speed;
  const speedUp = () => (hurry = true);
  for (const ch of chars) {
    ch.className = "on";
    if (hurry) continue;
    await sleep(speed);
    if (id !== captionId) break; // 已經換成下一句了
    // 第一個字出來後才接受點擊：讓這句出現的那一下點擊，不會順便把它整句跳出來
    if (!onTap) onTap = speedUp;
  }
  if (onTap === speedUp) onTap = null;
}

// 旁白、當面說的話：字全部出來後，0.5 秒內點了不算，之後再點一下才繼續
// （打字時點一下會整句跳出來，這樣連點兩下才不會直接跳過這一句）
async function showCaption(who, text) {
  const token = runToken;
  await setCaption(who, text);
  await sleep(500);
  if (token !== runToken) return halt();
  await waitTap();
}

// 插圖的檔案位置，例如 img/I01.jpg
const imageUrl = (id) => `${STORY.imageFolder}/${id}.${STORY.imageType}`;

// 頭像：story.js 的 people 有設定就照設定，沒有就用名字的第一個字
function avatar(name) {
  const person = STORY.people?.[name] || {};
  const node = el("span", "avatar", person.short || Array.from(name || "?")[0]);
  if (person.color) node.style.setProperty("--avatar-bg", person.color);
  if (person.img) {
    node.style.backgroundImage = `url("${person.img}")`;
    node.textContent = "";
  }
  return node;
}

// 一則訊息的外框。手機主人的靠右，左邊留位置給「已讀」；
// 別人的靠左，同一個人連續傳時，只有第一則顯示頭像和名字
function addMsg(from, body, read, time) {
  const mine = from === state.me;
  const row = el("div", mine ? "row mine" : "row theirs");
  if (mine) {
    const line = el("div", "msg-line");
    line.append(el("span", "receipt"), body);
    row.appendChild(line);
    row.dataset.time = time || "";
    if (read) setReceipt(row, read);
  } else {
    if (state.lastFrom !== from) row.append(avatar(from), el("span", "who", from));
    row.appendChild(body);
  }
  state.lastFrom = from;
  addToLog(row);
  return row;
}

// 訊息旁邊的「已讀」，下面是送出的時間
function setReceipt(row, text) {
  const time = row.dataset.time;
  row.querySelector(".receipt").textContent = time ? `${text}\n${time}` : text;
}

// 聊天訊息；kind 是 "bubble"（泡泡）或 "sticker"（貼圖）
// time 是送出的時間：剛送出的訊息自動帶入手機上的時間，history 裡的訊息要自己寫 time 才會顯示
// 寫了 unsent: true 的是已經收回的訊息：泡泡變成「…已收回訊息」，手機主人自己的「已讀」還留著
function renderMsg(line, kind, time) {
  if (!line.unsent) return addMsg(line.from, el("div", kind, line.text), line.read, time);
  const mine = line.from === state.me;
  const body = el("div", "bubble unsent", mine ? "你已收回訊息" : `${line.from}已收回訊息`);
  const row = addMsg(line.from, body, line.read, time);
  if (mine) row.querySelector(".receipt").classList.add("linger");
  return row;
}

// 照片：用 images 清單裡的插圖；圖檔還沒放時，顯示編號和說明
function renderPhoto(line, time) {
  const caption = STORY.images[line.id] || "";
  const photo = el("figure", "photo");
  const img = el("img");
  img.alt = caption;
  img.onload = () => photo.classList.add("loaded");
  img.src = imageUrl(line.id);
  photo.append(el("b", "", line.id), el("span", "", caption), img);
  return addMsg(line.from, photo, line.read, time);
}

// 手機主人最後傳的那一則
function lastMine() {
  const rows = ui.log.querySelectorAll(".row.mine");
  return rows[rows.length - 1] || null;
}

// 已經重新開始了：停在這裡，不要讓舊的那一幕繼續往下播
const halt = () => new Promise(() => {});

// 在輸入框一個字一個字打出來（不送出）；打字時點一下，就一次打完
async function typeDraft(text = "") {
  const token = runToken;
  ui.draft.textContent = "";
  if (REDUCED_MOTION) {
    ui.draft.textContent = text;
    return;
  }
  let hurry = false;
  const speedUp = () => (hurry = true);
  onTap = speedUp;
  for (const ch of text) {
    if (token !== runToken) return halt();
    ui.draft.textContent += ch;
    if (!hurry) await sleep(55);
  }
  if (onTap === speedUp) onTap = null;
}

// 把輸入框裡的字一個一個刪掉；點一下就全部刪掉
async function eraseDraft() {
  const token = runToken;
  let hurry = REDUCED_MOTION;
  const speedUp = () => (hurry = true);
  onTap = speedUp;
  while (ui.draft.textContent && token === runToken) {
    if (hurry) {
      ui.draft.textContent = "";
      break;
    }
    ui.draft.textContent = Array.from(ui.draft.textContent).slice(0, -1).join("");
    await sleep(45);
  }
  if (token !== runToken) return halt();
  if (onTap === speedUp) onTap = null;
}

// 手機主人傳的訊息：先在下方輸入框打出來，再送出
async function typeAndSend(text, read) {
  const inputVisible = ui.draft.getClientRects().length > 0;
  if (inputVisible && !REDUCED_MOTION) {
    const token = runToken;
    await typeDraft(text);
    if (token !== runToken) return;
    await wait(350);
    ui.draft.textContent = "";
  }
  renderMsg({ from: state.me, text, read }, "bubble", ui.clock.textContent);
}

function renderSys(text) {
  state.lastFrom = null;
  addToLog(el("div", "sys", text));
}

// 打開某個聊天室（會清空畫面）；name 是 null 就收起手機
function openChat(name) {
  state.chat = name;
  state.lastFrom = null;
  ui.log.replaceChildren();
  ui.draft.textContent = "";
  ui.chatTitle.textContent = name || "";
  // 停在黑幕、白幕時：手機直接收起或出現，不要滑動，不然幕拿掉時還看得到它在動
  const behind = ui.curtain.classList.contains("up");
  ui.app.classList.toggle("instant", behind);
  ui.app.classList.toggle("phone-on", Boolean(name));
  ui.app.classList.remove("screen-off", "caret-on");
  if (behind) {
    void ui.app.offsetWidth; // 讓上面的變化馬上生效
    ui.app.classList.remove("instant");
  }
  setCaption("", ""); // 換聊天室時，清掉上一段旁白
}

let imageReady = Promise.resolve(); // 現在這張插圖載入好了沒（fadeIn 會先等它）

// 換插圖；圖檔還沒放進資料夾時，顯示灰框和說明
// 回傳的 Promise 會在新圖載入好（或確定載不到）時完成
// framing 是 image 那一行寫的 zoom、x、y：新的插圖一出來就是那個畫面（沒寫就是整張圖）
function showImage(id, framing) {
  if (id === state.image) return; // 同一張圖，不用重新載入
  state.image = id;
  resetCamera(framing); // 換了插圖就是新的畫面，鏡頭不沿用上一張
  const caption = STORY.images[id] || "（images 清單裡還沒寫這張圖的說明）";
  ui.scenePh.replaceChildren(el("b", "", id), el("span", "", caption));
  ui.scene.classList.remove("refocus");
  ui.sceneImg.classList.remove("loaded");
  ui.sceneImg.alt = caption;
  imageReady = new Promise((resolve) => {
    ui.sceneImg.onload = () => {
      ui.sceneImg.classList.add("loaded");
      resolve();
    };
    ui.sceneImg.onerror = () => {
      ui.sceneImg.classList.remove("loaded");
      resolve();
    };
    ui.sceneImg.src = imageUrl(id);
  });
  return imageReady;
}

// 換插圖，先模糊再對焦兩次變清楚（動畫寫在 style.css 的 refocus）
// 動畫播完才會繼續，這段時間點畫面、按空白鍵都沒有反應
async function refocusImage(id, framing) {
  const token = runToken;
  setCaption("", ""); // 不要留著上一句旁白，讓讀者看圖
  await showImage(id, framing); // 等新圖載入好才開始，才不會先閃過清楚的畫面
  if (token !== runToken) return halt();
  ui.scene.classList.remove("refocus");
  void ui.scene.offsetWidth; // 讓動畫重新播一次
  ui.scene.classList.add("refocus");
  // 系統開了「減少動態效果」時沒有動畫，直接往下走；動畫被中斷也算結束
  // （震動也是插圖上的動畫，所以用名字找對焦的那一個）
  await ui.scene.getAnimations().find((a) => a.animationName === "refocus")?.finished.catch(() => {});
  if (token !== runToken) return halt();
}

// 「正在輸入…」出現一下又消失
async function showTyping(line) {
  const row = el("div", "row theirs");
  row.append(avatar(line.from), el("span", "who", `${line.from} 正在輸入…`));
  const dots = el("div", "bubble typing");
  dots.append(el("i"), el("i"), el("i"));
  row.appendChild(dots);
  addToLog(row);
  await wait(line.ms || 2000);
  row.remove();
  state.lastFrom = null;
  await wait(900);
}

// 通知橫幅：手機開著時在手機上方，手機收起來時在畫面右上角
async function showNotify(line) {
  const title = line.chat || line.from;
  const body = line.chat ? `${line.from}：${line.text}` : line.text;
  const host = state.chat ? ui.screen : ui.app;
  if (ui.notify.parentNode !== host) {
    host.appendChild(ui.notify);
    void ui.notify.offsetWidth; // 換了位置，先讓瀏覽器算好，滑入動畫才會播
  }
  ui.notify.replaceChildren(el("strong", "", title), el("span", "", body));
  ui.notify.classList.add("show");
  await wait(2600);
  ui.notify.classList.remove("show");
  await wait(500);
}

// 收回訊息：讀者先按住（或點一下）那則訊息，跳出選單後再按「收回」
// 空白鍵 / Enter 也可以一步一步做完
function unsendMsg(line) {
  const token = runToken;
  const row = [...ui.log.querySelectorAll(".row.mine")]
    .reverse()
    .find((r) => r.querySelector(".bubble")?.textContent === line.text);
  if (!row) {
    reportProblems([`場景 ${state.sceneId} 要收回「${line.text}」，但聊天室裡找不到這則訊息`]);
    return Promise.resolve();
  }
  const bubble = row.querySelector(".bubble");
  centerInLog(row);
  setCaption("", line.hint || "按住那則訊息。");
  bubble.classList.add("pick");

  return new Promise((resolve) => {
    let menu = null;
    let pressTimer = null;
    let done = false;

    const openMenu = () => {
      clearTimeout(pressTimer);
      if (menu || token !== runToken) return;
      bubble.classList.remove("pick");
      menu = el("div", "msg-menu");
      for (const label of ["複製", "轉傳"]) {
        const button = el("button", "", label);
        button.type = "button";
        button.disabled = true; // 這裡只能收回
        menu.appendChild(button);
      }
      const take = el("button", "take", "收回");
      take.type = "button";
      take.addEventListener("click", (e) => {
        e.stopPropagation();
        take.blur();
        takeBack();
      });
      menu.appendChild(take);
      row.appendChild(menu);
      setCaption("", line.pick || "按下「收回」。");
      onKey = takeBack;
    };

    const takeBack = async () => {
      if (!menu || done || token !== runToken) return;
      done = true;
      onKey = null;
      menu.remove();
      bubble.classList.add("vanish");
      await sleep(REDUCED_MOTION ? 0 : 400);
      if (token !== runToken) return;
      bubble.className = "bubble unsent";
      bubble.textContent = "你已收回訊息";
      row.querySelector(".receipt").classList.add("linger"); // 「已讀」還留著
      centerInLog(row);
      await wait(800);
      resolve();
    };

    // 按住超過 0.45 秒就打開選單；直接點一下也可以
    bubble.addEventListener("pointerdown", () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(openMenu, 450);
    });
    bubble.addEventListener("pointerleave", () => clearTimeout(pressTimer));
    bubble.addEventListener("click", openMenu);
    bubble.addEventListener("contextmenu", (e) => {
      e.preventDefault(); // 不要跳出瀏覽器自己的選單
      openMenu();
    });
    onKey = openMenu;
  });
}

// ---------- 背景音樂、環境音 ----------
// 背景音樂（bgm）和環境音（amb）是兩條分開的聲道，可以同時放，例如鋼琴配上深夜房間的聲音。
// 每條聲道有兩台播放器輪流用：換的時候，舊的在一台淡出、新的在另一台淡入。
// 另外還有一條提示音的聲道，收到訊息時響一聲就停。
// iPhone、iPad 的 Safari 不能用程式調音量（Apple 的限制），在那裡聲音會直接開始、直接停止，音量固定是最大。
const musicUrl = (id) => `${STORY.musicFolder}/${id}.${STORY.musicType}`;
const SILENCE = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

// 一條聲道。name 是錯誤訊息裡的名字；list 是 story.js 裡的清單（music 或 ambience）
function makeChannel(name, list) {
  const decks = [0, 1].map(() => ({ el: new Audio(), id: null, timer: 0, unlocked: false }));
  for (const d of decks) {
    d.el.preload = "auto";
    d.el.onerror = () => {
      if (!d.id) return;
      const text = `找不到${name} ${musicUrl(d.id)}（檔名大小寫要完全一樣）`;
      console.warn("[story.js]", text);
      if (DEV) reportProblems([text]);
    };
    d.el.onended = () => {
      if (!d.el.loop) d.id = null; // 只放一次的聲音放完了
    };
  }
  return {
    list,
    decks,
    deck: decks[0], // 現在負責放聲音的那一台
    blocked: null,  // 瀏覽器還不讓它自己播、要等讀者點一下的那一台
  };
}
const bgmChannel = makeChannel("背景音樂", "music");
const ambChannel = makeChannel("環境音", "ambience");
const sfxChannel = makeChannel("提示音");
const channels = [bgmChannel, ambChannel, sfxChannel];

// 讓一台播放器的音量在 ms 毫秒內慢慢變成 to（被下一次淡入淡出打斷時，就不會 resolve）
function fadeTo(d, to, ms) {
  clearInterval(d.timer);
  const from = d.el.volume;
  const start = performance.now();
  return new Promise((resolve) => {
    const step = () => {
      const t = ms > 0 ? Math.min(1, (performance.now() - start) / ms) : 1;
      d.el.volume = t === 1 ? to : Math.min(1, Math.max(0, from + (to - from) * t));
      if (t < 1) return;
      clearInterval(d.timer);
      resolve();
    };
    d.timer = setInterval(step, 30);
    step();
  });
}

// 開始播放；瀏覽器不讓它自己播的話（讀者還沒點過畫面），等讀者下一次點擊再播
function startDeck(ch, d) {
  d.el.play().catch((err) => {
    if (err.name === "NotAllowedError" && d.id) ch.blocked = d;
  });
}

// 淡出後停下來
function stopDeck(ch, d, ms) {
  if (!d.id) return;
  d.id = null;
  if (ch.blocked === d) ch.blocked = null;
  fadeTo(d, 0, ms).then(() => {
    if (!d.id) d.el.pause(); // 淡出途中被拿去放別首的話，就不要停
  });
}

// 在一條聲道上播放；已經在放同一首，就只調音量
// 沒寫 volume 時，用清單裡的 volume（例如 music 的 sad: { volume: 0.3 }、ambience 的 home_night: { volume: 0.5 }），再沒有就是 1
function playTrack(ch, id, { volume, fade = 1500, loop = true } = {}) {
  volume = Math.min(1, Math.max(0, volume ?? STORY[ch.list]?.[id]?.volume ?? 1));
  if (ch.deck.id === id) {
    ch.deck.el.loop = loop;
    fadeTo(ch.deck, volume, fade);
    return;
  }
  const old = ch.deck;
  ch.deck = ch.decks.find((d) => d !== old);
  stopDeck(ch, old, fade);
  stopDeck(ch, ch.deck, 0); // 另一台如果還在淡出上上一首，直接停掉
  ch.deck.id = id;
  ch.deck.el.loop = loop;
  ch.deck.el.src = musicUrl(id);
  ch.deck.el.volume = 0;
  startDeck(ch, ch.deck);
  fadeTo(ch.deck, volume, fade);
}

function stopTrack(ch, fade = 1500) {
  stopDeck(ch, ch.deck, fade);
}

// 提示音：響一聲就停。兩台播放器輪流用，連續收到兩則時，前一聲不會被切掉
// 讀者還沒點過畫面、瀏覽器不讓它出聲時就不響，之後也不會補響
function playSfx(id, volume = 1) {
  const d = (sfxChannel.deck = sfxChannel.decks.find((x) => x !== sfxChannel.deck));
  const url = new URL(musicUrl(id), document.baseURI).href;
  d.id = id;
  d.el.loop = false;
  if (d.el.src !== url) d.el.src = url; // 同一個音檔就不重新載入
  d.el.currentTime = 0;
  d.el.volume = Math.min(1, Math.max(0, volume));
  d.el.play().catch(() => {
    if (d.id === id) d.id = null;
  });
}

// 收到訊息的提示音（story.js 的 messageSound）。手機主人自己傳的不響；那一行寫了 sound: false 也不響
function ding(line) {
  const sound = STORY.messageSound;
  if (!sound?.id || line.sound === false || line.from === state.me) return;
  playSfx(sound.id, sound.volume ?? 1);
}

// 讀者每次點擊、按鍵時：
// 1. iPhone 要在點擊的當下播過一次，之後播放器才能自己播，所以第一次先放一小段無聲
// 2. 之前被瀏覽器擋下來的聲音，現在補播
function onGesture() {
  for (const ch of channels) {
    for (const d of ch.decks) {
      if (d.unlocked) continue;
      d.unlocked = true;
      if (d.id) continue; // 已經有要放的聲音，下面會直接補播
      d.el.src = SILENCE;
      d.el.play().then(() => {
        if (!d.id) d.el.pause();
      }, () => {});
    }
    if (ch.blocked?.id) startDeck(ch, ch.blocked);
    ch.blocked = null;
  }
}
for (const type of ["click", "keydown", "touchend"]) document.addEventListener(type, onGesture, true);

// 切到別的分頁或回到主畫面時，聲音先停；回來再接著放
document.addEventListener("visibilitychange", () => {
  for (const ch of channels) {
    if (document.hidden) for (const d of ch.decks) d.el.pause();
    else if (ch.deck.id) startDeck(ch, ch.deck);
  }
});

// 按下開始後：黑畫面閃過「戴上耳機，效果更佳」（點一下可以跳過）
async function showNotice() {
  ui.notice.classList.add("show");
  await wait(REDUCED_MOTION ? 1800 : 2400);
  ui.notice.classList.remove("show");
  await sleep(REDUCED_MOTION ? 0 : 700);
}

// 全黑畫面上的大字；sub 是下面一行小字（可省略）
async function showCard(text, sub) {
  ui.cardText.textContent = text;
  ui.cardSub.textContent = sub || "";
  ui.cardSub.hidden = !sub;
  ui.cardBtn.hidden = true;
  ui.card.classList.add("show");
  await wait(700);
  await waitTap();
  setCaption("", ""); // 轉場之後，不要再露出轉場前的旁白
  ui.card.classList.remove("show");
  await wait(600);
}

// ---------- 黑幕、白幕 ----------
// 把幕直接放下或收起，不播動畫
function snapCurtain(up, color) {
  ui.curtain.style.transition = "none";
  ui.curtain.classList.toggle("up", up);
  ui.curtain.classList.toggle("white", color === "white");
  void ui.curtain.offsetWidth; // 讓上面的設定馬上生效
  ui.curtain.style.transition = "";
}

// fadeOut：畫面慢慢變成一片黑（或白），停在那裡；fadeIn：再慢慢露出來
// 兩個都會等動畫播完才繼續，這段時間點畫面沒有反應
async function playFade(line) {
  const token = runToken;
  const ms = REDUCED_MOTION ? 0 : line.ms ?? 1000;
  const out = line.to === "out";
  if (!out) {
    if (!ui.curtain.classList.contains("up")) snapCurtain(true, line.color); // 還沒有幕：先直接放下，再淡入
    await Promise.race([imageReady, sleep(3000)]); // 幕後面換的插圖載好了才淡入（最多等 3 秒）
    if (token !== runToken) return halt();
  }
  ui.curtain.style.transitionDuration = `${ms}ms`;
  if (out) {
    setCaption("", ""); // 上一句旁白跟著淡出，不要留在黑幕上
    hidePlace();
    ui.curtain.classList.toggle("white", line.color === "white"); // 黑幕換白幕時，顏色也會慢慢變
  }
  ui.curtain.classList.toggle("up", out);
  await sleep(ms);
  if (token !== runToken) return halt();
}

// ---------- 地點字條 ----------
let placeTimer = 0;

// 黑底白字的地點字條：淡入，停 ms 毫秒，再自己淡出
function showPlace(line) {
  clearTimeout(placeTimer);
  ui.placeText.textContent = line.text;
  ui.placeSub.textContent = line.sub || "";
  ui.placeSub.hidden = !line.sub;
  ui.place.classList.add("show");
  placeTimer = setTimeout(hidePlace, line.ms || 3000);
}
function hidePlace() {
  clearTimeout(placeTimer);
  ui.place.classList.remove("show");
}

// ---------- 運鏡：震動、推近、拉遠、平移 ----------
// 推近、拉遠、平移動的是插圖那一層（#camera），手機和對話框不動；
// 震動是插圖和手機一起震，對話框不動，字才看得清楚。
// state.camera 是鏡頭現在對著哪裡：zoom 是放大幾倍（1 = 整張圖），
// x、y 是要放到畫面正中間的那一點，0～100（x 從圖的左邊到右邊，y 從上面到下面）。
// 那一點太靠近圖的邊、放不到正中間時，就盡量靠近，所以鏡頭怎麼動都不會露出圖的邊緣。
const PAN_TO = { left: { x: 0 }, right: { x: 100 }, up: { y: 0 }, down: { y: 100 } };
const CAMERA_MS = { zoom: 3000, pan: 4000 }; // 推近、拉遠、平移沒寫 ms 時花幾毫秒
// ease 可以寫的名字；也可以直接寫 CSS 的寫法，例如 "linear"。沒寫就用 style.css 的 ease-in-out
const EASE = {
  soft: "cubic-bezier(0.4, 0, 0.1, 1)", // 慢慢起步，前段就移得差不多，最後很長一段慢慢停下來：適合移到人身上
};
let shakes = []; // 正在震的動畫（插圖一個、手機一個）

// 鏡頭現在實際放大幾倍（推近、拉遠到一半時，是這一瞬間的倍數）
function zoomNow() {
  const matrix = getComputedStyle(ui.camera).transform; // "none" 或 "matrix(1.2, 0, 0, 1.2, 0, 0)"
  return matrix === "none" ? 1 : parseFloat(matrix.slice(7));
}

// 圖上的 (x, y) 要出現在畫面正中間時，transform-origin 要放在哪裡（回傳 "30% 40%" 這樣的字）
// 螢幕比例和圖不同時，object-fit: cover 會裁掉圖的一點邊，所以先換算成那一點在畫面上的位置
function originFor({ zoom, x, y }) {
  const w = ui.camera.clientWidth;
  const h = ui.camera.clientHeight;
  const iw = ui.sceneImg.naturalWidth || 16; // 圖還沒載好時，當作 16:9
  const ih = ui.sceneImg.naturalHeight || 9;
  const fit = Math.max(w / iw, h / ih); // object-fit: cover 把圖縮放幾倍
  const px = (w - iw * fit) / 2 + (x / 100) * iw * fit; // 那一點在畫面上的位置（px）
  const py = (h - ih * fit) / 2 + (y / 100) * ih * fit;
  // 以 o 為中心放大 zoom 倍，原本在 p 的東西會跑到 o + (p - o) × zoom；
  // 要讓它跑到正中間 c，o 就是 (p × zoom - c) ÷ (zoom - 1)。
  // 換成百分比後限制在 0～100：超出去的話會露出圖的邊緣，所以那一點只能盡量靠近正中間
  const aim = (p, c, size) => Math.min(100, Math.max(0, ((p * zoom - c) / (zoom - 1) / size) * 100));
  return `${aim(px, w / 2, w)}% ${aim(py, h / 2, h)}%`;
}

// 鏡頭在 ms 毫秒內移到 to（{ zoom, x, y }）；ms 是 0 就直接切過去；ease 是加速減速的方式
function moveCamera(to, ms, ease) {
  const cam = Object.assign(state.camera, to);
  const style = ui.camera.style;
  // 整張圖（zoom 1）時對準哪裡看起來都一樣，transform-origin 就不動，拉遠時才會沿著推近的路退回來
  const origin = cam.zoom > 1 ? originFor(cam) : style.transformOrigin;
  const scale = `scale(${cam.zoom})`;
  // 直接切過去；或是鏡頭還在整張圖（這時候換 transform-origin 看不出來），先直接換好，推近時那一點才會直直移到正中間
  if (!ms || zoomNow() < 1.001) {
    style.transition = "none";
    style.transformOrigin = origin;
    if (!ms) style.transform = scale;
    void ui.camera.offsetWidth; // 讓上面的設定馬上生效
    style.transition = "";
    if (!ms) return;
  }
  style.transitionDuration = `${ms}ms`;
  style.transitionTimingFunction = EASE[ease] || ease || ""; // 寫 "" 就是用回 style.css 的設定
  style.transformOrigin = origin;
  style.transform = scale;
}

// 鏡頭直接回到整張圖（換插圖、重新開始時）；framing 寫了 zoom、x、y 的話，直接切到那個畫面
function resetCamera(framing = {}) {
  moveCamera({ zoom: framing.zoom ?? 1, x: framing.x ?? 50, y: framing.y ?? 50 }, 0);
}

// 視窗大小變了（例如切換全螢幕）：畫面比例不同，同一點在畫面上的位置也不同，鏡頭重新對準
window.addEventListener("resize", () => {
  if (state.camera.zoom > 1) moveCamera({}, 0);
});

// 震動：插圖和手機照同一組亂數一起晃，越晃越小；power 越大晃得越遠
// 插圖同時稍微放大一點點，晃的時候邊緣才不會露出底色
function shakeScreen(power, ms) {
  stopShake();
  if (!ms) return;
  const w = ui.app.clientWidth;
  const h = ui.app.clientHeight;
  const reach = power * 0.7 * (Math.min(h, w * 0.5625) / 100); // 最遠晃幾 px：power × 0.7u（u 的算法和 style.css 一樣）
  const steps = Math.max(4, Math.round(ms / 45)); // 大約每 45 毫秒換一個位置
  const scene = [];
  const phone = [];
  for (let i = 0; i <= steps; i++) {
    const r = reach * (1 - i / steps);
    const x = r * (i % 2 ? 1 : -1) * (0.6 + Math.random() * 0.4); // 左右輪流
    const y = r * (Math.random() * 2 - 1) * 0.6;                    // 上下亂跳，小一點
    const translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    scene.push({ translate, scale: String(1 + (2 * r) / Math.min(w, h)) });
    phone.push({ translate });
  }
  const timing = { duration: ms, easing: "linear" };
  shakes = [ui.scene.animate(scene, timing), ui.phone.animate(phone, timing)];
}

function stopShake() {
  for (const animation of shakes) animation.cancel();
  shakes = [];
}

// 運鏡的一行：鏡頭開始動就回來，下一行馬上開始。
// 寫了 wait: true 就等它動完；wait 寫數字就只等那麼多毫秒，鏡頭繼續動（兩種都是點一下可以不等）
async function playCamera(line) {
  const cam = state.camera;
  const power = line.power ?? 2;
  // 震動沒寫 ms 時：1 是 0.4 秒、2 是 0.55 秒、3 是 0.7 秒
  const ms = REDUCED_MOTION ? 0 : line.ms ?? (line.move === "shake" ? 250 + power * 150 : CAMERA_MS[line.move]);
  if (line.move === "shake") {
    shakeScreen(power, ms);
  } else if (line.move === "pan") {
    // 鏡頭在整張圖時沒有地方可以移：一邊放大到 1.25 倍，一邊往那一邊移
    moveCamera({ zoom: line.zoom ?? (cam.zoom > 1 ? cam.zoom : 1.25), ...PAN_TO[line.to] }, ms, line.ease);
  } else {
    if (DEV && line.zoom === 1 && cam.zoom === 1 && line.ms !== 0) {
      reportProblems([`場景 ${state.sceneId} 的 zoomOut()：鏡頭本來就在整張圖，沒有地方可以拉遠。想從特寫拉遠，前面先寫 zoomIn(1.4, { ms: 0 }) 直接切到特寫`]);
    }
    moveCamera({ zoom: line.zoom, x: line.x ?? cam.x, y: line.y ?? cam.y }, ms, line.ease);
  }
  if (line.wait) await wait(line.wait === true ? ms : Math.min(line.wait, ms));
}

// 每則訊息出現前要等多久（字越多等越久，最多 2.4 秒）
function msgDelay(line) {
  if (line.from === state.me) return 400;
  const length = line.type === "sticker" ? 4 : (line.text || "").length;
  return Math.min(700 + length * 70, 2400);
}

// ===== 6. 判斷條件、播放一行、播放一幕 =====

// when 裡的每一項都和讀者的選擇相同，才算符合
function matches(when) {
  if (!when) return true;
  return Object.entries(when).every(([key, value]) => state.flags[key] === value);
}

// next 寫成清單時，依照讀者的選擇接到不同的幕：從上面開始找，用第一個 when 符合的
// （沒寫 when 的那一項什麼情況都符合，放在最後面當「其他情況」）
function pickNext(next) {
  if (!Array.isArray(next)) return next || null;
  return next.find((option) => matches(option.when))?.next || null;
}

async function playLine(line) {
  if (!matches(line.when)) return;
  switch (line.type) {
    case "narr":
      await showCaption("", line.text);
      break;
    case "talk":
      await showCaption(line.from, line.text);
      break;
    case "msg":
      await wait(msgDelay(line));
      if (line.from === state.me) await typeAndSend(line.text, line.read);
      else renderMsg(line, "bubble");
      ding(line);
      break;
    case "sticker":
      await wait(msgDelay(line));
      renderMsg(line, "sticker", ui.clock.textContent);
      ding(line);
      break;
    case "photo":
      await wait(line.from === state.me ? 400 : 1600);
      renderPhoto(line, ui.clock.textContent);
      ding(line);
      break;
    case "sys":
      await wait(500);
      renderSys(line.text);
      break;
    case "read": {
      await wait(line.ms || 800);
      const row = lastMine();
      if (row) setReceipt(row, line.text);
      break;
    }
    case "typing":
      await showTyping(line);
      break;
    case "draft":
      // 停在黑幕、白幕時看不到打字，直接放進輸入框
      if (ui.curtain.classList.contains("up")) {
        ui.draft.textContent = line.text;
        break;
      }
      await wait(400);
      await typeDraft(line.text);
      await wait(300);
      break;
    case "erase":
      await wait(300);
      await eraseDraft();
      await wait(300);
      break;
    case "unsend":
      await unsendMsg(line);
      break;
    case "notify":
      ding(line); // 和通知一起出現
      await showNotify(line);
      break;
    case "image":
      if (line.refocus) await refocusImage(line.id, line);
      else showImage(line.id, line);
      await wait(500);
      break;
    case "card":
      await showCard(line.text, line.sub);
      break;
    case "clock":
      ui.clock.textContent = line.text;
      await wait(400);
      break;
    case "dim":
      ui.app.classList.add("screen-off");
      await wait(line.ms || 600);
      break;
    case "pause": // 停一下：對話框先收起來，留一段空白（點一下可以不等）
      setCaption("", "");
      await wait(line.ms ?? 1000);
      break;
    case "caret": // 輸入框裡出現閃動的游標（下一次打開聊天室時消失）
      ui.app.classList.add("caret-on");
      break;
    case "bgm": // 不用等，音樂一邊淡入，下一行一邊開始
      if (line.id) playTrack(bgmChannel, line.id, line);
      else stopTrack(bgmChannel, line.fade);
      break;
    case "amb": // 環境音也不用等
      if (line.id) playTrack(ambChannel, line.id, line);
      else stopTrack(ambChannel, line.fade);
      break;
    case "fade":
      await playFade(line);
      break;
    case "place":
      showPlace(line);
      await wait(700); // 等字條淡入再接下一行；字條會自己停一下再淡出
      break;
    case "camera": // 鏡頭一邊動，下一行一邊開始（寫了 wait: true 才等）
      await playCamera(line);
      break;
    default:
      reportProblems([`場景 ${state.sceneId} 有不認得的 type「${line.type}」`]);
  }
}

// 把聊天室裡有這段字的那一則（最後一個符合的）直接捲到中間
function focusOn(text) {
  const node = [...ui.log.children].reverse().find((n) => n.textContent.includes(text));
  if (!node) return;
  const box = ui.log.getBoundingClientRect();
  const item = node.getBoundingClientRect();
  ui.log.scrollTop += item.top - box.top - (box.height - item.height) / 2;
}

// 舊訊息：一打開聊天室就直接顯示，不等待
function renderHistory(line) {
  if (!matches(line.when)) return;
  if (line.type === "msg") renderMsg(line, "bubble", line.time);
  else if (line.type === "sticker") renderMsg(line, "sticker", line.time);
  else if (line.type === "photo") renderPhoto(line, line.time);
  else if (line.type === "sys") renderSys(line.text);
}

// 讀者選完選項後，等待並回傳選了哪一個
function askChoice(scene) {
  const token = runToken;
  const shownAt = performance.now();
  return new Promise((resolve) => {
    ui.choices.replaceChildren();
    if (scene.prompt) ui.choices.appendChild(el("p", "prompt", scene.prompt));
    const visible = scene.choices.filter((c) => matches(c.when));
    visible.forEach((choice, i) => {
      const button = el("button", "choice");
      button.type = "button";
      button.append(el("span", "key", String(i + 1)), el("span", "", choice.label));
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        // 選項剛出現的一瞬間不算：連點兩下時，第二下不要直接選到下一組選項
        if (performance.now() - shownAt < 400) return;
        button.blur(); // 不然之後按空白鍵，會再按到這個按鈕
        ui.choices.classList.remove("show");
        ui.log.style.paddingBottom = "";
        if (token === runToken) resolve(choice);
      });
      ui.choices.appendChild(button);
    });
    ui.choices.classList.add("show");
    // 選項會蓋住聊天室下方，所以先把聊天內容往上推
    if (state.chat) {
      ui.log.style.paddingBottom = `${ui.choices.offsetHeight}px`;
      ui.log.scrollTo({ top: ui.log.scrollHeight });
    }
  });
}

// 播放一整幕，回傳下一幕的編號（沒有下一幕就回傳 null）
async function playScene(id) {
  const scene = STORY.scenes[id];
  if (!scene) {
    reportProblems([`找不到場景「${id}」，檢查 next 有沒有打錯`]);
    return null;
  }
  state.sceneId = id;
  updateDev();
  const token = runToken;

  // 一幕的第一行是 fadeOut、fadeIn 時，要比換聊天室、換插圖先做，新的畫面才會在幕後面換好：
  // fadeOut 讓上一幕的畫面先淡出；fadeIn 先直接變黑（或變白），換好再淡入
  const lines = scene.lines || [];
  const lead = lines[0]?.type === "fade" && matches(lines[0].when) ? lines[0] : null;
  if (lead?.to === "out") {
    await playLine(lead);
    if (token !== runToken) return null;
  } else if (lead && !ui.curtain.classList.contains("up")) {
    snapCurtain(true, lead.color);
  }

  // 換成別人的手機時，聊天室要重新打開，訊息才會換邊
  const me = "me" in scene ? scene.me || ME : state.me;
  const meChanged = me !== state.me;
  state.me = me;
  let opened = false;
  if ("chat" in scene && (scene.chat !== state.chat || meChanged)) {
    openChat(scene.chat);
    opened = true;
  }
  if (scene.image) showImage(scene.image);
  if (scene.bgm) playTrack(bgmChannel, scene.bgm);
  else if (scene.bgm === null) stopTrack(bgmChannel);
  if (scene.amb) playTrack(ambChannel, scene.amb);
  else if (scene.amb === null) stopTrack(ambChannel);
  if (scene.clock) ui.clock.textContent = scene.clock;
  // 舊訊息只在剛打開聊天室時顯示（從上一幕接過來的聊天室，裡面已經有了）
  if (opened && state.chat) {
    instantScroll = true;
    for (const line of scene.history || []) renderHistory(line);
    instantScroll = false;
    if (scene.focus) focusOn(scene.focus);
  }
  for (const line of lead?.to === "out" ? lines.slice(1) : lines) {
    await playLine(line);
    if (token !== runToken) return null; // 中途重新開始了，這一幕不要再播下去
  }

  if (scene.ending) return null; // 結局：播完就顯示結局卡

  if (scene.choices) {
    const choice = await askChoice(scene);
    Object.assign(state.flags, choice.set || {}); // 把選擇記下來
    updateDev();
    if (choice.say) {
      await wait(300);
      await typeAndSend(choice.say);
      await wait(900);
    } else if (choice.sticker) {
      await wait(300);
      renderMsg({ from: state.me, text: choice.sticker }, "sticker", ui.clock.textContent);
      await wait(900);
    }
    return choice.next;
  }
  return pickNext(scene.next);
}

// 從某一幕開始一直播下去
async function run(startId) {
  const token = runToken;
  let id = startId;
  let scene = null;
  while (id && token === runToken) {
    scene = STORY.scenes[id];
    id = await playScene(id);
  }
  if (token !== runToken) return;
  stopTrack(ambChannel); // 結局卡、待續出現時，環境音淡出（背景音樂繼續放）
  if (scene?.ending) showEnding(scene.ending);
  else showEnd();
}

// 沒有下一幕時：顯示「待續」
function showEnd() {
  ui.cardText.textContent = "（待續）";
  ui.cardSub.hidden = true;
  ui.cardBtn.hidden = false;
  ui.card.classList.add("show");
}

// 從某一幕重新開始；keepFlags 為 true 時保留讀者的選擇
function restart(id, keepFlags) {
  runToken++;
  onTap = null;
  onKey = null;
  ui.app.classList.remove("waiting");
  ui.choices.classList.remove("show");
  ui.card.classList.remove("show");
  ui.ending.classList.remove("show");
  ui.notify.classList.remove("show");
  ui.notice.classList.remove("show");
  ui.log.style.paddingBottom = "";
  stopTrack(bgmChannel, 600); // 上一輪的音樂、環境音淡出；新的一幕有寫 bgm、amb 的話會接著放
  stopTrack(ambChannel, 600);
  snapCurtain(false); // 停在黑幕、白幕時重新開始，畫面也要馬上露出來
  hidePlace();
  stopShake();
  resetCamera(); // 鏡頭回到整張圖
  if (!keepFlags) state.flags = {};
  state.me = ME;
  openChat(null);
  setCaption("", "");
  run(id);
}

// ===== 7. 結局卡與隱藏章節 =====
// 看過哪些結局會存在瀏覽器裡（localStorage），關掉再打開也記得。
// 無痕模式之類存不了的時候，就只記到關掉網頁為止。
const SAVE_KEY = "yidu-save";
let save = loadSave();

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch (err) {
    return {};
  }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    /* 存不了就算了，這次還是記得 */
  }
}

const allEndings = () => STORY.endings || {};
const seenEndings = () => (Array.isArray(save.endings) ? save.endings : []).filter((id) => id in allEndings());

// 隱藏章節解鎖了沒：
//   secret.unlock 寫數字：看過的結局數量達到這個數字就解鎖
//   secret.unlock 寫結局清單（例如 ["E2", "E4"]）：看過其中任何一個就解鎖
function secretUnlocked() {
  const secret = STORY.secret;
  if (!secret || !STORY.scenes[secret.start]) return false;
  const unlock = secret.unlock ?? 1;
  const seen = seenEndings();
  if (Array.isArray(unlock)) return unlock.some((id) => seen.includes(id));
  return seen.length >= unlock;
}

// 隱藏章節還沒解鎖時，結局卡上的提示
function unlockHint() {
  const unlock = STORY.secret.unlock ?? 1;
  if (Array.isArray(unlock)) return "有些結局會解鎖隱藏章節";
  return `再看 ${unlock - seenEndings().length} 個結局，就能解鎖隱藏章節`;
}

let retryTo = null; // 結局卡上「再選一次」的按鈕要回到哪一幕

// 從隱藏章節開始；flags 是讀者走過的選擇（隱藏章節會依照它顯示不同內容）
function startSecret(flags) {
  state.flags = { ...flags };
  restart(STORY.secret.start, true);
}

function showEnding(id) {
  const endings = allEndings();
  // 記下看過這個結局，也記下這次的選擇（從開始畫面進隱藏章節時會用到）
  save = { ...save, endings: [...new Set([...seenEndings(), id])], flags: { ...state.flags } };
  writeSave();

  const seen = seenEndings();
  const info = endings[id] || { name: "結局", title: id };
  ui.endingNo.textContent = info.name;
  ui.endingTitle.textContent = info.title;
  // 副標、三行結果、引言：endings 裡有寫才顯示
  ui.endingTagline.textContent = info.tagline || "";
  ui.endingTagline.hidden = !info.tagline;
  ui.endingResults.replaceChildren();
  for (const result of info.results || []) {
    // 「阿哲：有人看見他撐著的樣子」：冒號前面是誰，後面是結果
    const [, who, text] = /^(.+?)[：:](.*)$/.exec(result) || [];
    const item = el("li");
    if (who) item.append(el("b", "", who), el("span", "", text));
    else item.append(el("span", "", result));
    ui.endingResults.appendChild(item);
  }
  ui.endingResults.hidden = !info.results?.length;
  ui.endingQuote.textContent = info.quote || "";
  ui.endingQuote.hidden = !info.quote;
  // 再選一次：endings 裡寫了 retry 才出現
  retryTo = info.retry?.next || null;
  ui.endingRetry.hidden = !retryTo;
  if (retryTo) ui.endingRetry.textContent = info.retry.label || "再選一次";
  ui.endingList.replaceChildren();
  for (const [key, ending] of Object.entries(endings)) {
    const known = seen.includes(key);
    const item = el("li", key === id ? "now" : known ? "seen" : "");
    item.append(el("span", "no", ending.name), el("span", "", known ? ending.title : "？？？"));
    ui.endingList.appendChild(item);
  }

  const secret = STORY.secret;
  const unlocked = secretUnlocked();
  ui.endingUnlock.hidden = !secret;
  if (secret) {
    ui.endingUnlock.textContent = unlocked ? `隱藏章節「${secret.title}」已解鎖` : unlockHint();
    ui.endingSecret.textContent = secret.title;
  }
  ui.endingSecret.hidden = !unlocked;
  ui.ending.classList.add("show");
  updateDev();
}

// 開始畫面：看過幾個結局、隱藏章節的按鈕
function refreshStart() {
  const seen = seenEndings().length;
  ui.startEndings.hidden = seen === 0;
  ui.startEndings.textContent = `已看過的結局：${seen} / ${Object.keys(allEndings()).length}`;
  ui.secretBtn.hidden = !secretUnlocked();
  if (STORY.secret) ui.secretBtn.textContent = STORY.secret.title;
}

// ===== 8. 檢查 story.js 有沒有寫錯 =====
function checkStory() {
  const found = [];
  const scenes = STORY.scenes || {};
  const images = STORY.images || {};
  const music = STORY.music || {};
  const ambience = STORY.ambience || {};
  if (!scenes[STORY.start]) found.push(`start 寫的是「${STORY.start}」，但找不到這一幕`);
  const messageVolume = STORY.messageSound?.volume;
  if (messageVolume !== undefined && !(messageVolume >= 0 && messageVolume <= 1)) {
    found.push(`messageSound 的音量寫了 ${messageVolume}，要在 0 到 1 之間`);
  }
  for (const [listName, list] of [["music", music], ["ambience", ambience]]) {
    for (const [id, sound] of Object.entries(list)) {
      if (sound?.volume !== undefined && !(sound.volume >= 0 && sound.volume <= 1)) {
        found.push(`${listName} 清單裡 ${id} 的音量寫了 ${sound.volume}，要在 0 到 1 之間`);
      }
    }
  }
  if (STORY.secret && !scenes[STORY.secret.start]) {
    found.push(`secret 的 start 寫的是「${STORY.secret.start}」，但找不到這一幕`);
  }
  const unlock = STORY.secret?.unlock;
  if (Array.isArray(unlock)) {
    for (const id of unlock) {
      if (!(id in allEndings())) found.push(`secret 的 unlock 寫了 ${JSON.stringify(id)}，但 endings 清單裡沒有這個結局`);
    }
  } else if (unlock !== undefined && !(unlock >= 0)) {
    found.push(`secret 的 unlock 寫了 ${JSON.stringify(unlock)}，要寫數字（看過幾個結局就解鎖），或結局清單，例如 ["E2", "E4"]`);
  }
  for (const [id, ending] of Object.entries(allEndings())) {
    if (ending.retry && !scenes[ending.retry.next]) {
      found.push(`結局 ${id} 的 retry 要回到「${ending.retry.next}」，但找不到這一幕`);
    }
  }
  if (STORY.textSpeed !== undefined && !(STORY.textSpeed >= 0)) {
    found.push(`textSpeed 寫了 ${JSON.stringify(STORY.textSpeed)}，要寫 0 以上的數字（每個字隔幾毫秒）`);
  }

  for (const [id, scene] of Object.entries(scenes)) {
    const targets = [];
    if (Array.isArray(scene.next)) {
      for (const option of scene.next) {
        if (option.next) targets.push(option.next);
        else found.push(`場景 ${id} 的 next 清單裡，有一項沒有寫 next`);
      }
    } else if (scene.next) targets.push(scene.next);
    for (const choice of scene.choices || []) {
      if (choice.next) targets.push(choice.next);
      else found.push(`場景 ${id} 的選項「${choice.label}」沒有寫 next`);
    }
    for (const target of targets) {
      if (!scenes[target]) found.push(`場景 ${id} 要接到「${target}」，但找不到這一幕`);
    }
    if (scene.ending && !(scene.ending in allEndings())) {
      found.push(`場景 ${id} 是結局 ${scene.ending}，但 endings 清單裡沒有它`);
    }
    if (scene.image && !(scene.image in images)) {
      found.push(`場景 ${id} 用了插圖 ${scene.image}，但 images 清單裡沒有它`);
    }
    if (scene.bgm && !(scene.bgm in music)) {
      found.push(`場景 ${id} 用了背景音樂 ${scene.bgm}，但 music 清單裡沒有它`);
    }
    if (scene.amb && !(scene.amb in ambience)) {
      found.push(`場景 ${id} 用了環境音 ${scene.amb}，但 ambience 清單裡沒有它`);
    }
    for (const line of [...(scene.history || []), ...(scene.lines || [])]) {
      if (!KNOWN_TYPES.includes(line.type)) found.push(`場景 ${id} 有不認得的 type「${line.type}」`);
      if ((line.type === "image" || line.type === "photo") && !(line.id in images)) {
        found.push(`場景 ${id} 用了插圖 ${line.id}，但 images 清單裡沒有它`);
      }
      if (line.type === "bgm" && line.id && !(line.id in music)) {
        found.push(`場景 ${id} 用了背景音樂 ${line.id}，但 music 清單裡沒有它`);
      }
      if (line.type === "amb" && line.id && !(line.id in ambience)) {
        found.push(`場景 ${id} 用了環境音 ${line.id}，但 ambience 清單裡沒有它`);
      }
      if ((line.type === "bgm" || line.type === "amb") && line.volume !== undefined && !(line.volume >= 0 && line.volume <= 1)) {
        const what = line.type === "amb" ? "環境音" : "背景音樂";
        found.push(`場景 ${id} 的${what}音量寫了 ${line.volume}，要在 0 到 1 之間`);
      }
      if (line.type === "fade" && !["in", "out"].includes(line.to)) {
        found.push(`場景 ${id} 的 fade 要寫 to: "in" 或 "out"（用 fadeIn()、fadeOut() 就不用寫）`);
      }
      if (line.type === "fade" && line.color !== undefined && !["black", "white"].includes(line.color)) {
        found.push(`場景 ${id} 的轉場顏色寫了 ${JSON.stringify(line.color)}，只能是 "black" 或 "white"（例如 fadeOut("white", { ms: 2000 })）`);
      }
      if (line.type === "camera" && !["shake", "zoom", "pan"].includes(line.move)) {
        found.push(`場景 ${id} 的運鏡寫錯了，用 shake()、zoomIn()、zoomOut()、pan() 寫就不會錯`);
      }
      if (line.move === "shake" && line.power !== undefined && !(line.power > 0)) {
        found.push(`場景 ${id} 的 shake 寫了 ${JSON.stringify(line.power)}，要寫 1 到 3 的數字（越大震得越大），例如 shake(3)`);
      }
      if (line.move === "pan" && !Object.keys(PAN_TO).includes(line.to)) {
        found.push(`場景 ${id} 的 pan 寫了 ${JSON.stringify(line.to)}，只能是 "left"、"right"、"up"、"down"`);
      }
      if (line.type === "camera" && line.ease !== undefined && !(line.ease in EASE) && !CSS.supports("transition-timing-function", line.ease)) {
        found.push(`場景 ${id} 的運鏡 ease 寫了 ${JSON.stringify(line.ease)}，可以寫 "soft"，或 CSS 的寫法（例如 "linear"）`);
      }
      if (line.type === "camera" && line.wait !== undefined && line.wait !== true && !(line.wait >= 0)) {
        found.push(`場景 ${id} 的運鏡 wait 寫了 ${JSON.stringify(line.wait)}，要寫 true（等鏡頭動完）或毫秒數，例如 wait: 1300`);
      }
      // 運鏡那一行，和換插圖時寫的 zoom、x、y
      const framed = line.type === "camera" || line.type === "image";
      if (framed && line.zoom !== undefined && !(line.zoom >= 1)) {
        found.push(`場景 ${id} 的鏡頭放大 ${JSON.stringify(line.zoom)} 倍，要寫 1 以上的數字（1 是整張圖），例如 zoomIn(1.3)`);
      }
      for (const key of ["x", "y"]) {
        if (framed && line[key] !== undefined && !(line[key] >= 0 && line[key] <= 100)) {
          found.push(`場景 ${id} 的鏡頭位置 ${key} 寫了 ${JSON.stringify(line[key])}，要在 0 到 100 之間`);
        }
      }
      if (line.type === "unsend" && !line.text) found.push(`場景 ${id} 的 unsend 沒有寫要收回哪一句（text）`);
      if (line.type === "pause" && line.ms !== undefined && !(line.ms >= 0)) {
        found.push(`場景 ${id} 的 pause 寫了 ms: ${JSON.stringify(line.ms)}，要寫 0 以上的毫秒數，例如 { type: "pause", ms: 2500 }`);
      }
      if (["msg", "sticker", "photo", "typing"].includes(line.type) && !line.from) {
        found.push(`場景 ${id} 的 ${line.type} 沒有寫 from（誰傳的）`);
      }
      if (["narr", "talk", "msg", "sticker", "sys", "read", "draft", "notify", "card", "clock", "place"].includes(line.type) && !line.text) {
        found.push(`場景 ${id} 的 ${line.type} 沒有寫 text`);
      }
    }
  }
  return found;
}

// 把問題顯示在畫面上方（同時印在 Console）
function reportProblems(list) {
  if (!list.length) return;
  for (const text of list) console.warn("[story.js]", text);
  ui.problems.replaceChildren(el("strong", "", `story.js 有 ${list.length} 個地方要修正`));
  const ul = el("ul");
  for (const text of list) ul.appendChild(el("li", "", text));
  const close = el("button", "", "關閉");
  close.type = "button";
  close.addEventListener("click", () => (ui.problems.hidden = true));
  ui.problems.append(ul, close);
  ui.problems.hidden = false;
}

// ===== 9. 開發者面板（網址加 ?dev 或 #dev）=====
let devInfo = null;

function setupDev() {
  if (devInfo) return; // 已經打開了
  devInfo = el("span", "dev-info");
  const select = el("select");
  select.id = "dev-jump";
  select.setAttribute("aria-label", "跳到場景");
  select.appendChild(new Option("跳到場景…", ""));
  for (const id of Object.keys(STORY.scenes)) select.appendChild(new Option(id, id));
  select.addEventListener("change", () => {
    if (!select.value) return;
    ui.start.classList.add("gone");
    restart(select.value, true); // 跳場景時保留目前的選擇
    select.value = "";
    select.blur(); // 讓鍵盤回到故事上
  });
  const clear = el("button", "", "清除選擇");
  clear.type = "button";
  clear.addEventListener("click", () => {
    clear.blur();
    state.flags = {};
    updateDev();
  });
  const forget = el("button", "", "清除結局紀錄");
  forget.type = "button";
  forget.addEventListener("click", () => {
    forget.blur();
    save = {};
    writeSave();
    refreshStart();
    updateDev();
  });
  ui.dev.append(devInfo, select, clear, forget);
  ui.dev.hidden = false;
  updateDev();
}

function updateDev() {
  if (!devInfo) return;
  const seen = seenEndings().join(",") || "—";
  devInfo.textContent = `場景 ${state.sceneId || "—"}｜選擇 ${JSON.stringify(state.flags)}｜看過的結局 ${seen}`;
}

// ===== 10. 開始 =====
function boot() {
  updateFsButton();
  ui.fsBtn.addEventListener("click", () => {
    ui.fsBtn.blur();
    toggleFullscreen();
  });

  if (typeof STORY === "undefined") {
    // story.js 有語法錯誤時，整個 STORY 都讀不到
    ui.start.firstElementChild.replaceChildren(
      el("h2", "", "story.js 讀不到"),
      el("p", "", "通常是少了逗號、引號或括號。打開瀏覽器的 Console，會顯示錯在第幾行。")
    );
    return;
  }
  document.title = STORY.title;
  reportProblems(checkStory());
  refreshStart();
  if (DEV) setupDev();
  // 頁面開著時才在網址後面加 #dev，也能打開面板
  window.addEventListener("hashchange", () => {
    if (location.hash === "#dev") setupDev();
  });

  // 開始畫面下方的提示：電腦和手機不一樣
  if (TOUCH) {
    ui.startTip.textContent = canFullscreen ? "點一下畫面繼續。開始後會切換成全螢幕。" : "點一下畫面繼續。";
  } else if (!canFullscreen) {
    ui.startTip.textContent = "點擊滑鼠或按空白鍵繼續，按 1、2 選擇。";
  }

  // 按「開始」或「隱藏章節」：切換全螢幕，閃過耳機提示，再進入故事
  let started = false;
  async function begin(go) {
    if (started) return;
    started = true;
    if (canFullscreen) enterFullscreen();
    ui.start.classList.add("gone");
    const token = runToken;
    await showNotice(); // 全螢幕切換的那一下，剛好被黑畫面蓋住
    if (token === runToken) go();
  }
  ui.startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.startBtn.blur(); // 不然之後按空白鍵，會再按一次「開始」
    begin(() => run(STORY.start));
  });
  ui.secretBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.secretBtn.blur();
    begin(() => startSecret(save.flags || {}));
  });
  ui.cardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.cardBtn.blur();
    restart(STORY.start, false);
  });
  ui.endingAgain.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.endingAgain.blur();
    restart(STORY.start, false);
  });
  ui.endingSecret.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.endingSecret.blur();
    startSecret(state.flags); // 帶著這次的選擇進隱藏章節
  });
  ui.endingRetry.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.endingRetry.blur();
    if (retryTo) restart(retryTo, true); // 帶著這次的選擇，回到那一晚的選項
  });
}

boot();
