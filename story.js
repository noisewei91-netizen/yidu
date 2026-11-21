/* ================================================================
 * story.js ——《已讀》的劇情資料
 *
 * 這個檔案只放「內容」，不放程式。改劇情、加新的一幕，只要改這裡。
 * （給學過 C++ 的你：{ } 很像 struct，[ ] 很像陣列/vector，
 *   每一項後面要加逗號，字串要用 " " 包起來。）
 *
 * ---------------------------------------------------------------
 * 每一幕（scene）可以寫的東西：
 *
 *   "場景編號": {
 *     chat:    "聊天室名稱",  打開這個聊天室（畫面會清空）
 *                             寫 null = 收起手機；不寫 = 沿用上一幕
 *     me:      "阿哲",        換成誰的手機：這個人的訊息靠右、在輸入框打字
 *                             （不寫 = 沿用上一幕；一開始是 "你"）
 *     image:   "I01",        換插圖（對應 img/I01.jpg，還沒畫好會顯示灰框）
 *     bgm:     "night",      這一幕開始時播放背景音樂（寫 null = 停止；不寫 = 沿用上一幕）
 *     amb:     "home_night", 這一幕開始時播放環境音（寫 null = 停止；不寫 = 沿用上一幕）
 *     clock:   "22:47",      手機左上角的時間
 *     history: [ ... ],      聊天室裡「早就在」的舊訊息，打開聊天室時直接顯示
 *     lines:   [ ... ],      依序播放的每一行
 *     prompt:  "你要怎麼回？", 選項上方的提示（可省略）
 *     choices: [ ... ],      選項（有選項就不用寫 next）
 *     next:    "下一幕編號",  沒有選項時，播完自動接到這一幕（也可以依選擇接到不同的幕，見最下面）
 *     ending:  "E1",         這一幕是結局：播完顯示結局卡（對應下面的 endings）
 *     focus:   "已讀 4",     打開聊天室後，把有這段字的那一則捲到中間（可省略）
 *   },                       ← 別忘了逗號
 *
 * 每一行（line）的 type：
 *
 *   narr     旁白，顯示在插圖下方，字會一個一個出來（速度是下面 STORY 裡的 textSpeed）
 *            打字時點一下，整句直接出來；字全部出來 0.5 秒後，再點一下才繼續
 *            { type: "narr", text: "晚上十點四十七分。" }
 *   talk     當面說的話（不是傳訊息），和 narr 一樣一個字一個字出來
 *            { type: "talk", from: "阿哲", text: "我怕我講不好。" }
 *   msg      聊天訊息，會自動一則一則跳出；手機主人（平常是 "你"）的會靠右
 *            { type: "msg", from: "凱文", text: "又已讀不回" }
 *            自己的訊息可以加 read，直接顯示已讀（寫在 history 裡最常用）
 *            { type: "msg", from: "你", text: "你也太快了吧。", read: "已讀" }
 *            history 裡的訊息再加 time，已讀下面就會顯示這個時間
 *            （剛送出的訊息會自動帶入手機上的時間）
 *            { type: "msg", from: "你", text: "真的，每次都這樣。", read: "已讀 3", time: "22:52" }
 *            別人傳來的訊息會響提示音（下面 STORY 裡的 messageSound）；這一則不想響就加 sound: false
 *            { type: "msg", from: "凱文", text: "@阿哲", sound: false }
 *            （貼圖、照片、通知也一樣；history 裡的舊訊息不會響）
 *            history 裡的訊息加 unsent: true，就是已經收回的訊息：泡泡變成「你已收回訊息」，已讀還留著
 *            { type: "msg", from: "你", text: "真的，每次都這樣。", read: "已讀 3", unsent: true }
 *   sticker  貼圖（用表情符號代替）
 *            { type: "sticker", from: "凱文", text: "😂" }
 *   photo    照片，圖片用 images 清單裡的編號
 *            { type: "photo", from: "阿哲", id: "I03" }
 *   sys      聊天室中間的灰色小字，例如日期
 *            { type: "sys", text: "今天" }
 *   read     自己最後一則訊息旁邊出現（或更新）已讀；ms 是等多久才出現（預設 800）
 *            { type: "read", text: "已讀 2" }
 *            { type: "read", text: "已讀 3", ms: 1600 }
 *   typing   「正在輸入…」出現 ms 毫秒後消失
 *            { type: "typing", from: "阿哲", ms: 2500 }
 *   draft    在輸入框打字，但不送出（字會留在輸入框）
 *            { type: "draft", text: "我外婆住院了。" }
 *   erase    把輸入框裡的字一個一個刪掉
 *            { type: "erase" }
 *   unsend   收回訊息：讀者要自己按住那則訊息，再按「收回」
 *            hint 是按之前的旁白，pick 是選單跳出來之後的旁白
 *            { type: "unsend", text: "真的，每次都這樣。", hint: "…", pick: "…" }
 *   notify   通知橫幅；寫 chat 代表是群組的通知，不寫就是私訊
 *            手機收起來時，通知會出現在畫面右上角
 *            { type: "notify", chat: "第三組報告群組", from: "凱文", text: "..." }
 *   image    播到一半換插圖
 *            { type: "image", id: "I03" }
 *            加 refocus 會先模糊，再對焦兩次變清楚（像揉完眼睛）；動畫播完才能繼續，點畫面也跳不過
 *            { type: "image", id: "I02", refocus: true }
 *            加 zoom、x、y，新的插圖一出來就是特寫（見下面的 camera）
 *            { type: "image", id: "I13", zoom: 1.4, x: 50, y: 30 }
 *   card    全黑畫面上的大字，用來轉場；sub 是下面的小字（可省略）
 *            { type: "card", text: "兩週後" }
 *   clock    播到一半改手機上的時間
 *            { type: "clock", text: "22:52" }
 *   dim      手機螢幕慢慢暗下去（下一次打開聊天室會恢復）；ms 是暗下去後停多久（預設 600）
 *            { type: "dim" }
 *   pause    停一下：對話框先收起來，等 ms 毫秒再接下一行（預設 1000；點一下可以不等）
 *            用在劇本裡的（停頓），或結局最後「停留 2～3 秒」
 *            { type: "pause", ms: 2500 }
 *   caret    輸入框裡出現閃動的游標；輸入框空著時，只剩游標在閃（下一次打開聊天室時消失）
 *            { type: "caret" }
 *   bgm      背景音樂：直接寫成 bgm("編號")，像呼叫函式一樣（編號要先寫進下面的 music 清單）
 *            bgm("night")                    播放，會一直重複；換歌時舊的淡出、新的淡入
 *            bgm("night", { volume: 0.5 })   音量 0～1（不寫就用 music 清單裡的音量）；正在放的同一首再寫一次，只會調音量
 *            bgm("night", { fade: 3000 })    淡入淡出幾毫秒（預設 1500；寫 0 就直接切換）
 *            bgm("ending", { loop: false })  只放一次，不重複
 *            stopBgm()                       停止；也可以寫 stopBgm({ fade: 4000 })
 *            依選擇播放：bgm("rain", { when: { choice1: "A" } })
 *            音樂一邊淡入，下一行就會開始，不用等
 *   amb      環境音：和背景音樂分開的另一條聲道，兩個可以同時放（編號要先寫進下面的 ambience 清單）
 *            amb("home_night")               寫法和 bgm 一樣，volume、fade、loop、when 都能用
 *            stopAmb()                       停止；也可以寫 stopAmb({ fade: 3500 })
 *            換地點時，把 stopAmb() 寫在 fadeOut() 前面、amb(...) 寫在 fadeIn() 前面，聲音就會跟著畫面淡出淡入
 *            結局卡出現時，環境音會自己淡出
 *   fade     黑幕、白幕轉場：直接寫成函式
 *            fadeOut()                       畫面慢慢變黑，停在黑幕（換插圖、換聊天室都在幕後面進行）
 *            fadeOut("white")                變成白幕
 *            fadeIn()                        從黑幕（或白幕）慢慢露出畫面；前面沒有幕的話，從黑幕淡入
 *            fadeIn("white")                 前面沒有幕的話，從白幕淡入
 *            fadeOut("black", { ms: 2000 })  淡入淡出幾毫秒（預設 1000）；fadeIn 也一樣
 *            兩個都會等動畫播完才接下一行，點畫面也跳不過
 *            幕只蓋住插圖和手機：停在黑幕時寫 narr、talk，字會出現在黑幕上
 *            fadeOut("black", { ms: 0 })     直接變黑，不淡出（例如轉場大字前先停在黑幕）
 *            一幕的第一行寫 fadeOut()：上一幕的畫面先淡出，才換這一幕的 chat、image
 *              （接在選項後面的那一幕最好用，因為選項那一幕沒辦法在最後寫 fadeOut）
 *            一幕的第一行寫 fadeIn()：先直接變黑，chat、image 在幕後面換好再淡入
 *            fadeIn 會等幕後面換的插圖載好才淡入（最多等 3 秒）
 *   place    地點字條：黑底白字，從左上角淡入，停一下再自己淡出（下一行不用等它消失）
 *            place("市立醫院　三樓走廊")
 *            place("市立醫院", { sub: "晚上 11:40", ms: 4000 })   sub 是下面的小字；ms 是停多久（預設 3000）
 *   camera   運鏡：直接寫成函式。推近、拉遠、平移只動插圖，手機和對話框不動；換插圖時鏡頭會回到整張圖
 *            這幾行都不用等，鏡頭一邊動，下一行就開始：寫在一句話前面，就會一邊出字一邊動
 *            每一個都可以再加這些設定（都可以不寫）：
 *              ms: 3000        花幾毫秒；寫 0 就直接切過去
 *              wait: true      等鏡頭動完才接下一行（點一下可以不等）
 *              wait: 1300      只等 1.3 秒就接下一行，鏡頭繼續慢慢停下來：台詞和鏡頭疊在一起，比較不生硬
 *              ease: "soft"    前段就移得差不多，最後很長一段慢慢停穩，適合移到人身上（不寫是前後對稱的 ease-in-out）
 *            shake()                         震動：衝擊、驚嚇、生氣、撞到東西（插圖和手機一起震，對話框不動）
 *            shake(1)  shake(2)  shake(3)    數字越大震得越大、越久，情緒越激烈（不寫就是 2）
 *            zoomIn()                        慢慢推近到 1.2 倍：走進角色的內心、這句話很重要、角色正在下決心
 *            zoomIn(1.4, { x: 30, y: 40 })   推近到 1.4 倍，把圖上的那一點移到畫面正中間（x：左 0～右 100；y：上 0～下 100）
 *                                            用眼睛估就好：臉在圖的左邊三分之一、上面四分之一，就寫 x: 33, y: 25
 *                                            那一點太靠近圖的邊時，只能盡量靠近中間（不會露出圖的邊緣）；放越大，越移得到中間
 *                                            已經推近時再寫一次，鏡頭會移到另一點，例如從一個人的臉移到另一個人（見序幕 P-1）
 *                                            不寫 x、y 就沿用上一次對準的地方（換插圖後是正中間）
 *            zoomIn(1.3, { ms: 6000 })       花 6 秒推近（預設 3000）
 *            zoomOut()                       慢慢拉遠回到整張圖：讓情緒冷下來、顯得孤單、看清整個場景
 *            pan("right")                    鏡頭往右移：介紹新場景、跟著角色的視線、表示時間在流逝
 *            pan("left")  pan("up")  pan("down")
 *            pan("right", { ms: 8000 })      花 8 秒移過去（預設 4000）
 *            pan("right", { zoom: 1.4 })     放大 1.4 倍再移，越大移得越遠（鏡頭在整張圖時，預設一邊放大到 1.25 倍一邊移）
 *            從特寫拉遠、從最左邊移到最右邊：先用 ms: 0 直接切到起點，再慢慢動
 *              zoomIn(1.5, { x: 60, y: 55, ms: 0 }),  zoomOut({ ms: 5000 }),
 *              pan("left", { ms: 0 }),  pan("right", { ms: 8000 }),
 *            直接切的那一行寫在 fadeIn() 前面（還停在黑幕時），讀者才不會看到畫面跳一下；
 *            沒有黑幕、直接換插圖的話，改在 image 那一行寫 zoom、x、y（見上面的 image）
 *
 * 選項（choices）：
 *
 *   { label: "按鈕上的字",
 *     say: "選完後你送出的訊息",   ← 可省略；要送貼圖就改寫 sticker: "👋"
 *     set: { choice1: "A" },      ← 把讀者的選擇記下來
 *     next: "2A-1" }
 *
 * 依選擇顯示不同內容：在任何一行或選項後面加 when，
 * 只有條件符合時才會出現。例如：
 *
 *   { type: "msg", from: "你", text: "明天見。", when: { hello: "text" } }
 *
 * 依選擇接到不同的幕：next 寫成清單，從上面開始找，接到第一個 when 符合的那一幕；
 * when 裡寫好幾項，就要每一項都符合。沒寫 when 的那一項放最後，代表其他情況（見隱藏章節 Z-5）：
 *
 *   next: [
 *     { when: { choice1: "B", choice2: "一起扛下" }, next: "T-1" },
 *     { next: "Z-6" },
 *   ],
 *
 * 標著「Claude 補寫」的地方是劇本裡沒有、為了接起來補上的句子，可以自己改掉。
 * ================================================================ */

// ---------------------------------------------------------------
// 背景音樂：在 lines 裡寫 bgm("night")、stopBgm()，就像呼叫函式一樣。
// 這兩個函式只是幫你做出 { type: "bgm", id: "night", ... } 這一行，真正負責播放的是 engine.js。
// options 是 { volume: 0.5, fade: 3000 } 這樣的設定，可以不寫。
// （...options 的意思是「把 options 裡的每一項攤開放進來」）
// ---------------------------------------------------------------
function bgm(id, options) {
  return { type: "bgm", id, ...options };
}
function stopBgm(options) {
  return { type: "bgm", id: null, ...options };
}

// 環境音：和背景音樂一樣，只是放在另一條聲道，所以可以一邊放鋼琴、一邊放房間的聲音
function amb(id, options) {
  return { type: "amb", id, ...options };
}
function stopAmb(options) {
  return { type: "amb", id: null, ...options };
}

// ---------------------------------------------------------------
// 轉場：fadeOut() 讓畫面慢慢變黑，停在黑幕；在幕後面換好插圖、聊天室之後，再 fadeIn() 慢慢露出來。
// color 寫 "white" 就是白幕；options 是 { ms: 2000 }（淡入淡出幾毫秒），兩個都可以不寫。
//   fadeOut(),
//   { type: "image", id: "I05" },
//   fadeIn(),
// ---------------------------------------------------------------
function fadeOut(color, options) {
  return { type: "fade", to: "out", color, ...options };
}
function fadeIn(color, options) {
  return { type: "fade", to: "in", color, ...options };
}

// 地點字條：黑底白字，自己淡入、停一下、再淡出。options 可以寫 sub（下面一行小字）和 ms（停多久）
//   place("市立醫院", { sub: "晚上 11:40" })
function place(text, options) {
  return { type: "place", text, ...options };
}

// ---------------------------------------------------------------
// 運鏡：讓插圖像攝影機一樣動。這幾行都不用等，鏡頭一邊動，下一行就開始，
// 所以寫在一句話前面，就會一邊出字一邊推近：
//   zoomIn(1.3, { x: 30, y: 40 }),
//   { type: "talk", from: "阿哲", text: "我怕我講不好。" },
// options 都可以不寫：ms 是花幾毫秒（寫 0 就直接切過去），wait: true 是等鏡頭動完才接下一行
// （寫數字就只等那麼多毫秒），ease: "soft" 是最後慢慢停穩。
// ---------------------------------------------------------------

// 震動：power 是 1～3，數字越大震得越大、越久（不寫就是 2）
function shake(power, options) {
  return { type: "camera", move: "shake", power, ...options };
}

// 慢慢推近：zoom 是放大幾倍；options 的 x、y 是要移到畫面正中間的那一點（0～100）
function zoomIn(zoom = 1.2, options) {
  return { type: "camera", move: "zoom", zoom, ...options };
}

// 拉遠：慢慢退回整張圖
function zoomOut(options) {
  return { type: "camera", move: "zoom", zoom: 1, ...options };
}

// 平移：to 是 "left"、"right"、"up"、"down"，鏡頭往那一邊移過去
function pan(to, options) {
  return { type: "camera", move: "pan", to, ...options };
}

// ---------------------------------------------------------------
// 會在好幾幕重複出現的舊訊息，寫在這裡一次，下面用 ...名字 放進 history。
// （...PROLOGUE_DM 的意思是「把這個陣列裡的每一項攤開放進來」）
// ---------------------------------------------------------------

// 序幕那天晚上，阿哲的私訊。和 P-2 的內容一樣；改了 P-2 記得改這裡。
// 換成阿哲的手機時（me: "阿哲"）也能直接用，左右會自動對調。
const PROLOGUE_DM = [
  { type: "sys", text: "兩週前" },
  { type: "msg", from: "阿哲", text: "📄 第四部分大綱.pdf", read: "已讀" },
  { type: "msg", from: "阿哲", text: "第四部分的大綱先給你們。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "我明天再補完整。", read: "已讀" },
  { type: "msg", from: "你", text: "你也太快了吧。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "沒有啦，怕之後來不及。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "明天見。", read: "已讀" },
  { type: "sticker", from: "你", text: "👋", read: "已讀", when: { hello: "sticker" } },
  { type: "msg", from: "你", text: "明天見。", read: "已讀", when: { hello: "text" } },
];

// 第一幕的群組對話。和 1-2、1-3 的內容一樣；改了那兩幕記得改這裡。
const GROUP_NIGHT = [
  { type: "msg", from: "雨晴", text: "簡報差不多好了，只剩第四部分。" },
  { type: "msg", from: "雨晴", text: "@阿哲 你那邊可以了嗎？" },
  { type: "sys", text: "已讀 4" },
  { type: "msg", from: "凱文", text: "有人可以回一下嗎？" },
  { type: "msg", from: "凱文", text: "我不想明天上台才發現少一大段。" },
  { type: "msg", from: "凱文", text: "明天還有數學考試" },
  { type: "msg", from: "凱文", text: "真的不能再拖了。" },
  { type: "msg", from: "凱文", text: "@阿哲" },
  { type: "msg", from: "小美", text: "他今天好像又在睡覺。" },
  { type: "msg", from: "凱文", text: "……真的不知道要怎麼講。" },
  { type: "msg", from: "凱文", text: "@你 你說對不對？你也等很久了吧。" },
];

// 第二幕 B，那天晚上你和阿哲的私訊。和 2B-1、2B-2 的內容一樣；改了那兩幕記得改這裡。
// 兩邊的訊息都寫了「已讀」：你的手機只會顯示你的已讀，換成阿哲的手機時就換成顯示阿哲的已讀
const B_NIGHT_DM = [
  { type: "msg", from: "你", text: "你還好嗎？", read: "已讀" },
  { type: "msg", from: "阿哲", text: "沒事。", read: "已讀" },
  { type: "msg", from: "你", text: "第四部分寫到哪了？需要幫忙嗎？", read: "已讀" },
  { type: "photo", from: "阿哲", id: "I03", read: "已讀" },
  { type: "msg", from: "阿哲", text: "我外婆前天住院了。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "我這幾天晚上都在醫院。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "第四部分真的只寫了一半。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "不要跟群組說，拜託。", read: "已讀" },
];

// 第二幕 A，阿哲傳來的三則私訊。和 2A-2 的內容一樣；改了 2A-2 記得改這裡
const A_NIGHT_DM = [
  { type: "msg", from: "阿哲", text: "第四部分我會弄完。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "對不起，這次是我的問題。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "我家裡出了點事。", read: "已讀" },
];

// 第二幕 A，你在群組說的那句話（在 2A-3 收回了）和後面兩則回應。和 2A-1 的內容一樣
const A_NIGHT_GROUP = [
  { type: "msg", from: "你", text: "真的，每次都這樣。", read: "已讀 3", time: "22:52", unsent: true },
  { type: "msg", from: "凱文", text: "看吧，連你都這樣覺得。" },
  { type: "msg", from: "小美", text: "那明天真的要完蛋了。" },
];

// 結局一，那天凌晨你和阿哲一起趕報告。和 E1-2 的內容一樣；改了 E1-2 記得改這裡
const E1_NIGHT_DM = [
  { type: "msg", from: "阿哲", text: "這段我改好了。", read: "已讀" },
  { type: "msg", from: "你", text: "收到，圖表我補上了。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "最後一段也整理好了。", read: "已讀" },
  { type: "msg", from: "你", text: "好，我來接。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "謝謝。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "真的。", read: "已讀" },
];

// 結局一，那天凌晨你在群組說明之後的回應。和 E1-3 的內容一樣；改了 E1-3 記得改這裡
const E1_NIGHT_GROUP = [
  { type: "msg", from: "你", text: "第四部分我跟阿哲在處理，他家裡有點事，明天會好。", read: "已讀 4" },
  { type: "msg", from: "雨晴", text: "好，需要幫忙跟我說。" },
  { type: "msg", from: "凱文", text: "……" },
  { type: "msg", from: "凱文", text: "喔，那結論那頁我再順一下。" },
  { type: "msg", from: "小美", text: "我幫忙檢查格式好了。" },
];

// 結局一，報告那天傍晚阿哲傳來的私訊。和 E1-6 的內容一樣；改了 E1-6 記得改這裡
const E1_EVENING_DM = [
  { type: "msg", from: "阿哲", text: "外婆今天可以吃東西了。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "醫生說狀況穩定很多。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "昨天謝謝你在群組幫我講，也謝謝你沒講太多。", read: "已讀" },
  { type: "msg", from: "你", text: "太好了。報告那部分也謝謝你。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "下次不要再搞到凌晨了。", read: "已讀" },
  { type: "msg", from: "你", text: "你也是。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "嗯。", read: "已讀" },
];

// 真結局，天快亮時你和阿哲的私訊。和 T-2 的內容一樣；改了 T-2 記得改這裡
const T_DAWN_DM = [
  { type: "msg", from: "你", text: "圖表我補好了，你看看有沒有問題。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "收到了。", read: "已讀" },
  { type: "msg", from: "你", text: "先休息吧，剩下的明天再說。", read: "已讀" },
  { type: "msg", from: "阿哲", text: "好。", read: "已讀" },
];

// 真結局，報告那天早上群組裡的訊息。和 T-4 的內容一樣；改了 T-4 記得改這裡
// 第一則是 Claude 補寫：凱文說「第四部分收到」，所以阿哲天亮前把檔案傳到群組
const T_MORNING_GROUP = [
  { type: "msg", from: "阿哲", text: "📄 第四部分.pptx", read: "已讀 4" },
  { type: "msg", from: "雨晴", text: "昨天辛苦了！簡報我有幫忙檢查。" },
  { type: "msg", from: "凱文", text: "第四部分收到，結論頁我改好了。" },
  { type: "msg", from: "小美", text: "今天報告加油！" },
];

const GROUP ="第三組報告群組（5）"; // 你、雨晴、凱文、小美、阿哲

// 醫院的環境音還沒有音檔，先借用 home_night。
// 之後放了 audio/hospital.mp3：在下面的 ambience 清單加上 hospital，再把這裡改成 "hospital" 就好
const HOSPITAL_AMB = "home_night";

const STORY = {
  title: "已讀",
  start: "P-1", // 從哪一幕開始

  // 旁白、當面說的話一個字一個字出來：每個字隔幾毫秒（越小越快；寫 0 就整句直接出現）
  textSpeed: 50,

  // 插圖放在 img 資料夾，檔名是「編號.jpg」，例如 img/I01.jpg
  imageFolder: "img",
  imageType: "jpg",

  // 插圖清單：還沒畫好時，畫面會顯示這裡的說明
  images: {
    I01: "深夜房間，檯燈、桌上資料、手機亮起",
    I02: "同一房間，時鐘 11:21，揉眼睛的手",
    I03: "深夜醫院走廊長椅，點滴架影子",
    I04: "左右分割：你的書桌、醫院長椅上的阿哲",
    I05: "早上教室，阿哲捏著講稿",
    I06: "從教室後方看講台，四人報告",
    I07: "黃昏的房間，和 I01 同構圖",
    I08: "關燈的房間",
    I09: "阿哲帶著報告進教室，眼睛全是血絲",
    I10: "阿哲低頭收東西，沒看鏡頭",
    I11: "走廊上，阿哲側身說話",
    I12: "阿哲的空座位",
    I13: "講台投影片只有標題",
    I14: "深夜病房，病床身影、點滴架、阿哲和筆電",
    I15: "外婆的手搭在阿哲手上",
    I16: "病房窗外天色泛白",
    I17: "白天教室分組，阿哲手機殼貼著合照貼紙",
    black: "黑色背景（沒有插圖）",
    I00: "夜色街景",
    I18: "學校走廊",
  },

  // 背景音樂放在 audio 資料夾，檔名是「編號.mp3」，例如 audio/night.mp3
  musicFolder: "audio",
  musicType: "mp3",

  // 背景音樂清單：寫法和下面的 ambience 一樣，編號 → { volume, note }
  //   volume 是這首平常的音量（0～1），劇情裡寫 bgm("sad", { volume: 0.1 }) 可以臨時改；
  //          只寫 bgm("sad") 就回到這裡的音量
  //   note   是說明（給自己看的，記得這首用在哪裡）
  // 每個音檔本身的大小聲差很多（sad、happyendding 比 calm 大聲很多），
  // 所以量過之後各自抓了音量，讓每一首聽起來差不多大聲；聽起來不對就直接改這裡
  // 放好音檔後照這樣加一行，就能在劇情裡寫 bgm("night")：
  //   night: { volume: 0.8, note: "深夜的房間：很輕的鋼琴" },
  music: {
    calm: { volume: 0.8, note: "主題音樂・薩提 Gymnopédie No. 1：序幕到第二幕；結局二從隔天早上、結局三從凌晨開始" },
    saving: { volume: 0.5, note: "有人接住了：結局一整段、結局三的幾天後、真結局的天亮到早上（T-1～T-4）（音檔最後有 5 秒幾乎沒聲音，重複時會停一下）" },
    sad: { volume: 0.3, note: "結局四：隔天早上看到空位開始" },
    // 編號裡有 - 要加引號；用的時候寫 bgm("bgm-hospital")。音檔本身很小聲，開到 1 還是比其他首小聲
    "bgm-hospital": { volume: 1, note: "阿哲的那一晚・蕭邦前奏曲 Op. 28 No. 4 的前 48 秒：2B-1 醫院的照片、隱藏章節" },
    happyendding: { volume: 0.25, note: "真結局「天亮以後」（T-5 開始播放）" }, // 和音檔 audio/happyendding.mp3 同名
  },

  // 環境音清單：音檔一樣放在 audio 資料夾，例如 audio/home_night.mp3
  // volume 是這個環境音平常的音量（0～1），劇情裡寫 amb("home_night", { volume: 0.3 }) 可以臨時改
  // 現在的音量是量過每個音檔有多大聲之後抓的，讓環境音比背景音樂小聲；聽起來不對就直接改這裡
  ambience: {
    home_night: { volume: 0.5, note: "房間・晚上（醫院也先用這個）" },
    home_day: { volume: 0.6, note: "房間・白天、傍晚" },
    classroom: { volume: 0.8, note: "教室・安靜：放學後、報告中" },
    classroom_noisy: { volume: 0.2, note: "教室・吵：上課前、下課、午休（音檔本身很大聲，所以音量調得很小）" },
  },

  // 收到訊息的提示音（audio/received.mp3）：別人傳來的訊息、貼圖、照片，還有通知出現時響一聲
  // volume 是音量 0～1；不要提示音就改成 messageSound: null
  messageSound: { id: "received", volume: 0.6 },

  // 聊天頭像：short 是圓圈裡的字，color 是底色。
  // 之後有頭像圖片，可以加上 img: "img/avatar-azhe.jpg"
  people: {
    你: { short: "你", color: "#8a6a3a" },
    阿哲: { short: "哲", color: "#3f6f6a" },
    雨晴: { short: "晴", color: "#5d5590" },
    凱文: { short: "凱", color: "#8a4f43" },
    小美: { short: "美", color: "#8a4a6a" },
  },

  // 四個結局和隱藏章節的真結局：結局卡上顯示的內容
  //   name、title  「結局一」「一起上台」
  //   tagline      標題下面的一句話（可省略）
  //   results      三行結果，冒號前面是誰（可省略）
  //   quote        最後那句話（可省略）
  //   retry        結局卡上多一個按鈕：label 是按鈕上的字，按下去帶著這次的選擇回到 next 那一幕（可省略）
  endings: {
    E1: {
      name: "結局一",
      title: "一起上台",
      tagline: "有人願意一起承擔。",
      results: [
        "阿哲：有人看見他撐著的樣子",
        "群組：酸話停了，開始有人幫忙",
        "你：少睡了三個小時，但不再只有一個人努力",
      ],
      quote: "「這一次，已讀不是沉默。」",
    },
    E2: {
      name: "結局二",
      title: "差一步",
      tagline: "關心是真的，但距離還在。",
      results: [
        "阿哲：被關心了，但仍然獨自完成工作",
        "群組：誤會沒有真正消失",
        "你：睡飽了，卻開始想那晚還能做些什麼",
      ],
      quote: "「有時候，我們說了加油，卻不知道對方究竟需要什麼。」",
      retry: { label: "想看看多做一步會怎樣嗎？", next: "2B-R" }, // 回到 23:21 的選項
    },
    E3: {
      name: "結局三",
      title: "修補",
      tagline: "傷害被看見，關係才有機會重新開始。",
      results: [
        "阿哲：被傷過，也被接住了",
        "群組：有人開始改變說話方式",
        "你：知道了話說出口，就收不回",
      ],
      quote: "「道歉不是讓事情恢復原狀，而是承認它曾經不一樣。」",
    },
    E4: {
      name: "結局四",
      title: "沉默",
      tagline: "有些訊息，永遠停在了已讀。",
      results: [
        "阿哲：一個人撐過了那一晚",
        "群組：報告少了一個人的聲音",
        "你：一則不知道還能不能回的訊息",
      ],
      quote: "「你已經看見了。只是沒有回答。」",
      retry: { label: "回到那一晚，再選一次", next: "2A-R" }, // 回到收回訊息之後的選項
    },
    // 只有 B 路線＋一起扛下（結局一）再進隱藏章節，才看得到（見 Z-5 的 next）
    TRUE: {
      name: "TRUE ENDING",
      title: "天亮以後",
      tagline: "有些訊息，終於不再只是已讀。",
      results: [
        "阿哲：終於知道自己可以開口求助",
        "群組：開始學著一起承擔，而不是互相責怪",
        "你：明白了關心不只是詢問，也可以是實際的陪伴",
      ],
      quote: "「原來，訊息的另一端，不一定只有沉默。」",
    },
  },

  // 隱藏章節：unlock 是解鎖的條件
  //   寫數字，例如 1：看過幾個結局就解鎖（現在是看過任何一個結局就解鎖；想要看完四個結局才解鎖，就改成 4）
  //   寫結局清單，例如 ["E2", "E4"]：看過其中任何一個就解鎖
  //   （修訂版劇本原本只讓差一步、沉默解鎖；真結局要從結局一進來，所以改成任何一個結局都能解鎖）
  secret: { start: "Z-1", title: "阿哲的那一晚", unlock: 1 },

  scenes: {
    // ================= 序幕：兩週前 =================
    "P-1": {
      chat: null,
      image: "I17",
      bgm: "calm", // 主題音樂：從「兩週前」的大字開始，跨過「兩週後」，一直放到第二幕（2A-2、2B-1 停下來）
      lines: [
        fadeOut("black", { ms: 0 }), // 先停在黑幕：「兩週前」大字結束後，教室才不會先露出來
        { type: "card", text: "兩週前" },
        fadeOut("white"),
        amb("classroom"), // 放學後的教室，安靜到聽得見電風扇；寫在 fadeIn 前面，聲音和畫面一起淡入
        fadeIn(),
        place("教室", { sub: "兩週前下午 5:10" }),
        { type: "narr", text: "白天，教室裡的電風扇吱呀作響。" },
        // 每個人說話前，鏡頭先把他的臉移到畫面正中間，讀者才認得誰是誰。
        // x、y 是臉在 I17 上的位置；站得越後面、臉越小，就放越大，三張臉在畫面上才差不多大
        // ease: "soft" 讓鏡頭前段就移得差不多、最後慢慢停穩；wait: 1300 是鏡頭快停的時候就出台詞，不用等它完全停住
        zoomIn(1.5, { x: 57, y: 51, ms: 3000, ease: "soft", wait: 1500 }), // 雨晴：戴眼鏡、坐在筆電前
        { type: "talk", from: "雨晴", text: "報告分四部分，誰要哪一塊？" },
        zoomIn(1.8, { x: 37.5, y: 28, ms: 3000, ease: "soft", wait: 1300 }), // 凱文：左邊穿紅色帽 T
        { type: "talk", from: "凱文", text: "我做結論，最簡單。" },
        zoomIn(1.9, { x: 77, y: 34, ms: 3200, ease: "soft", wait: 1500 }), // 阿哲：右邊抱著筆記本（靠近圖的邊，只能盡量靠近中間）
        { type: "narr", text: "阿哲把筆記本翻到空白頁。" },
        { type: "talk", from: "阿哲", text: "第四部分給我吧，我整理資料比較快。" },
        zoomOut({ ms: 3000, ease: "soft", wait: 1500 }), // 最後一個人說完了，退回整張圖（最後一段和淡出疊在一起）
        stopAmb(), // 和畫面一起淡出
        fadeOut(),
      ],
      next: "P-2",
    },

    "P-2": {
      chat: "阿哲",
      image: "I00",
      clock: "21:08",
      amb: "home_night",
      lines: [
        fadeIn(),
        place("當天晚上", { sub: "兩週前晚上 9:08" }), 
        { type: "narr", text: "那天晚上，你收到阿哲傳來的檔案。" },
        { type: "msg", from: "阿哲", text: "📄 第四部分大綱.pdf" },
        { type: "msg", from: "阿哲", sound: false, text: "第四部分的大綱先給你們。" },
        { type: "msg", from: "阿哲", sound: false, text: "我明天再補完整。" },
        { type: "msg", from: "你",  text: "你也太快了吧。" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "沒有啦，怕之後來不及。" },
        { type: "msg", from: "阿哲", sound: false, text: "明天見。" },  
      ],
      // 這個選擇不影響劇情，只是讓讀者先熟悉怎麼操作
      prompt: "你沒有多想——",
      choices: [
        { label: "只回了一個貼圖", sticker: "👋", set: { hello: "sticker" }, next: "P-3" },
        { label: "回：「明天見。」", say: "明天見。", set: { hello: "text" }, next: "P-3" },
      ],
    },

    "P-3": {
      lines: [
        { type: "read", text: "已讀" },
        { type: "narr", text: "畫面停在「明天見」。" },
        stopAmb({ fade: 3500 }),
        fadeOut("black", { ms: 3500 }), // 先變黑再出大字；停在黑幕，1-1 在幕後面收起手機、換插圖後才 fadeIn
        { type: "card", text: "兩週後" },
      ],
      next: "1-1",
    },

    // ================= 第一幕：晚上十點四十七分 =================
    "1-1": {
      chat: null,
      image: "I01",
      clock: "22:47",
      amb: "home_night",
      lines: [
        fadeIn(),
        place("房間", { sub: "報告前一天晚上 10:47" }),
        { type: "narr", text: "晚上十點四十七分。" },
        { type: "narr", text: "明天第一節就是報告。" },
        { type: "narr", text: "你已經連續兩晚熬夜整理資料。桌上的咖啡早就冷了，第四部分卻還是空著。" },
        { type: "narr", text: "群組跳出訊息。" },
      ],
      next: "1-2",
    },

    "1-2": {
      chat: GROUP,
      clock: "22:47",
      lines: [
        { type: "msg", from: "雨晴",  text: "簡報差不多好了，只剩第四部分。" },
        { type: "msg", from: "雨晴", sound: false, text: "@阿哲 你那邊可以了嗎？" },
        { type: "sys", text: "已讀 4" },
        { type: "narr", text: "訊息顯示已讀。" },
        { type: "narr", text: "過了幾分鐘。" },
        { type: "clock", text: "22:51" },
        { type: "msg", from: "凱文", text: "有人可以回一下嗎？" },
        { type: "msg", from: "凱文", sound: false, text: "我不想明天上台才發現少一大段。" },
        { type: "msg", from: "凱文",sound: false,text: "明天還有數學考試" },
        { type: "msg", from: "凱文",sound: false, text: "真的不能再拖了。" },
        { type: "msg", from: "凱文",sound: false, text: "@阿哲" },
        { type: "msg", from: "小美", text: "他今天好像又在睡覺。" },
        { type: "msg", from: "凱文", text: "……真的不知道要怎麼講。" },
        { type: "narr", text: "你突然想起，這幾天阿哲似乎都比平常早離開教室。" },
        { type: "narr", text: "上星期，他甚至在下課鐘響後，接到一通電話便匆匆離開。。" },
      ],
      next: "1-3",
    },

    "1-3": {
      lines: [
        { type: "narr", text: "你看著那幾行字。" },
        { type: "narr", text: "你知道凱文講得太過分，但你也知道，他們確實需要阿哲負責的部分。" },
        { type: "narr", text: "然後，凱文點名了你。" },
        { type: "msg", from: "凱文", text: "@你 你說對不對？你也等很久了吧。" },
        { type: "narr", text: "你的手指停在輸入框。" },
        { type: "narr", text: "這時候，你可以選擇兩條路。" },
      ],
      next: "1-4",
    },

    // 第一次選擇。寫了 chat、history、amb 和 bgm，所以用開發者面板直接跳到這裡時，群組、環境音和音樂也會出現；
    // 從 1-3（或隱藏章節「回到故事」的 Z-9）接過來時聊天室沒換，就不會重複顯示，環境音和音樂也不會從頭放。
    "1-4": {
      chat: GROUP,
      image: "I01",
      clock: "22:51",
      amb: "home_night",
      bgm: "calm",
      history: GROUP_NIGHT,
      prompt: "你會怎麼做？",
      choices: [
        {
          label: "「真的，每次都這樣。」",
          set: { choice1: "A" },
          next: "2A-1",
        },
        {
          label: "私訊阿哲：「你還好嗎？」",
          set: { choice1: "B" },
          next: "2B-1",
        },
      ],
    },

    // ================= 第二幕 A：送出之後 =================
    "2A-1": {
      clock: "22:52",
      lines: [
        { type: "narr", text: "你打下那句話。" },
        { type: "msg", from: "你", text: "真的，每次都這樣。" },
        { type: "narr", text: "訊息送出。" },
        { type: "read", text: "已讀 1" },
        { type: "msg", from: "凱文", text: "看吧，連你都這樣覺得。" },
        { type: "read", text: "已讀 2" },
        { type: "msg", from: "小美", text: "那明天真的要完蛋了。" },
        { type: "read", text: "已讀 3", ms: 1600 },
        { type: "narr", text: "雨晴沒有再說話。" },
        { type: "narr", text: "你本來以為，自己只是表達不滿。" },
        { type: "narr", text: "直到幾分鐘後，阿哲傳來私訊。" },
        { type: "clock", text: "22:58" },
        { type: "notify", from: "阿哲", text: "第四部分我會弄完。" },
      ],
      next: "2A-2",
    },

    "2A-2": {
      chat: "阿哲",
      history: [...PROLOGUE_DM, { type: "sys", text: "今天" }],
      lines: [
        { type: "msg", from: "阿哲", text: "第四部分我會弄完。", sound: false }, // 2A-1 的通知已經響過了
        { type: "msg",sound: false, from: "阿哲", text: "對不起，這次是我的問題。" },
        { type: "narr", text: "你盯著螢幕。" },
        { type: "narr", text: "接著又跳出一則。" },
        stopBgm(),
        zoomIn(1.25, { x: 46, y: 54, ms: 6000 }), // 音樂停下來，鏡頭慢慢推向桌上的報告：這句話很重要
        { type: "msg", from: "阿哲", text: "我家裡出了點事。" },
        { type: "narr", text: "你想回他，卻不知道該說什麼。" },
        { type: "narr", text: "因為你的那句話還留在群組裡。" },
      ],
      next: "2A-3",
    },

    // 互動：收回訊息
    // 劇本寫「已讀 5／五個人看過」，但群組扣掉你只有 4 個人，
    // 而且「不知道阿哲是不是其中之一」要成立，數字就得小於 4，所以改成 3。
    // （凱文、小美有回，雨晴沒說話；阿哲其實只看了通知，見隱藏章節 Z-3）
    "2A-3": {
      chat: GROUP,
      clock: "23:01",
      history: [
        ...GROUP_NIGHT,
        { type: "msg", from: "你", text: "真的，每次都這樣。", read: "已讀 3", time: "22:52" },
        { type: "msg", from: "凱文", text: "看吧，連你都這樣覺得。" },
        { type: "msg", from: "小美", text: "那明天真的要完蛋了。" },
      ],
      lines: [
        {
          type: "unsend",
          text: "真的，每次都這樣。",
          hint: "你點開它，長按。",
          pick: "「複製」、「轉傳」、「收回」。你的手指停在「收回」。",
        },
        { type: "narr", text: "那句「真的，每次都這樣」消失了。" },
        { type: "narr", text: "但畫面上仍然留著：「已讀 3」。" },
        { type: "narr", text: "三個人看過。" },
        { type: "narr", text: "你不知道其中有誰會記得，也不知道阿哲是不是其中之一。" },
        { type: "narr", text: "你只能決定下一步。" },
      ],
      next: "2A-4",
    },

    // 第二次選擇（A 路線）。寫了 chat、history，所以用開發者面板直接跳到這裡，
    // 或從結局四的「回到那一晚，再選一次」（2A-R）接過來時，群組也會出現（那句話已經收回了）；
    // 從 2A-3 接過來時聊天室沒換，就不會重複顯示。
    "2A-4": {
      chat: GROUP,
      image: "I01",
      clock: "23:01",
      amb: "home_night",
      history: [...GROUP_NIGHT, ...A_NIGHT_GROUP],
      // choice2 記下第二次選擇：隱藏章節 Z-5 看它決定要不要走真結局
      choices: [
        { label: "公開道歉，並提出實際的補救方式", set: { choice2: "道歉" }, next: "E3-1" },
        { label: "把手機蓋起來，暫時不再回覆", set: { choice2: "不回" }, next: "E4-1" },
      ],
    },

    // 結局四的「回到那一晚，再選一次」：在黑幕後面把群組準備好，再淡入回到第二次選擇（2A-4）
    "2A-R": {
      chat: GROUP,
      image: "I01",
      clock: "23:01",
      amb: "home_night",
      history: [...GROUP_NIGHT, ...A_NIGHT_GROUP],
      lines: [
        fadeOut("black", { ms: 0 }), // 先停在黑幕，下一行的鏡頭才能在幕後面切好
        zoomIn(1.25, { x: 46, y: 54, ms: 0 }), // 和 2A-2 推近之後的畫面一樣
        fadeIn(),
      ],
      next: "2A-4",
    },

    // ================= 第二幕 B：沒事 =================
    "2B-1": {
      chat: "阿哲",
      clock: "22:52",
      // 打開私訊時，序幕的對話已經在裡面；你在序幕回了什麼，這裡就顯示什麼
      history: [...PROLOGUE_DM, { type: "sys", text: "今天" }],
      lines: [
        { type: "narr", text: "你點開和阿哲的私訊。" },
        { type: "msg", from: "你", text: "你還好嗎？" },
        { type: "read", text: "已讀" },
        { type: "narr", text: "已讀。" },
        { type: "typing", from: "阿哲", ms: 2600 },
        { type: "narr", text: "「正在輸入……」消失。" },
        { type: "clock", text: "22:58" },
        { type: "typing", from: "阿哲", ms: 2200 },
        { type: "narr", text: "又出現。又消失。" },
        { type: "clock", text: "23:06" },
        { type: "narr", text: "最後，阿哲只回了兩個字。" },
        { type: "msg", from: "阿哲", text: "沒事。" },
        { type: "narr", text: "你看著那兩個字。" },
        { type: "msg", from: "你", text: "第四部分寫到哪了？需要幫忙嗎？" },
        { type: "read", text: "已讀" },
        stopBgm(), // 音樂停下來，只剩房間的聲音，等他回（和 2A-2「我家裡出了點事」之前一樣）
        { type: "narr", text: "過了一會兒，一張照片傳了過來。" },
        { type: "clock", text: "23:14" },
        { type: "photo", from: "阿哲", id: "I03" },
        // 醫院的照片：換成隱藏章節裡阿哲在病房的那首，慢慢淡入。之後玩到隱藏章節，會聽出是同一個晚上
        bgm("bgm-hospital", { fade: 4000 }),
        { type: "image", id: "I03" },
        { type: "narr", text: "醫院走廊的長椅、白色的牆。" },
      ],
      next: "2B-2",
    },

    "2B-2": {
      lines: [
        { type: "msg", from: "阿哲", text: "我外婆前天住院了。" },
        { type: "msg",sound: false, from: "阿哲", text: "我這幾天晚上都在醫院。" },
        { type: "msg", from: "阿哲", text: "第四部分真的只寫了一半。" },
        { type: "narr", text: "接著，他又傳了一句。" },
        { type: "msg", from: "阿哲", text: "不要跟群組說，拜託。" },
        { type: "clock", text: "23:21" },
        { type: "image", id: "I02", refocus: true },
        { type: "narr", text: "你看著桌上的報告，揉了揉眼睛。" },
        { type: "narr", text: "你不是不想幫他。" },
        { type: "narr", text: "只是也已經很累了。" },
        { type: "narr", text: "而且，你突然不知道該怎麼做，才不會讓事情變得更糟。" },
      ],
      next: "2B-3",
    },

    // 第二次選擇（B 路線）。和 2A-4 一樣：直接跳過來，或從結局二的「想看看多做一步會怎樣嗎？」（2B-R）
    // 接過來時，私訊和 2B-1 換上的 bgm-hospital 也會出現；從 2B-2 接過來時聊天室沒換，就不會重複顯示，音樂也不會從頭放。
    "2B-3": {
      chat: "阿哲",
      image: "I02",
      clock: "23:21",
      amb: "home_night",
      bgm: "bgm-hospital",
      history: [...PROLOGUE_DM, { type: "sys", text: "今天" }, ...B_NIGHT_DM],
      prompt: "你可以選擇：",
      // choice2 記下第二次選擇：選了「一起扛下」，之後進隱藏章節會走真結局（見 Z-5）
      choices: [
        { label: "先安慰他，讓他知道有人關心", set: { choice2: "安慰" }, next: "E2-1" },
        { label: "詢問他真正需要什麼，再決定怎麼分工", set: { choice2: "一起扛下" }, next: "E1-1" },
      ],
    },

    // 結局二的「想看看多做一步會怎樣嗎？」：在黑幕後面把私訊準備好，再淡入回到第二次選擇（2B-3）
    "2B-R": {
      chat: "阿哲",
      image: "I02",
      clock: "23:21",
      amb: "home_night",
      bgm: "bgm-hospital",
      history: [...PROLOGUE_DM, { type: "sys", text: "今天" }, ...B_NIGHT_DM],
      lines: [fadeIn()],
      next: "2B-3",
    },

    // ================= 第三幕：四種結局 =================
    // 照《已讀》四個結局・修訂版劇本：每個結局分四段，最後都換成阿哲的手機（me: "阿哲"），
    // 停 2～3 秒、不配旁白，再出現結局卡。最後那一頁的背景是黑的（插圖 black）。
    // 左上角的字條「阿哲的手機」是 Claude 補寫：劇本沒有，加上去讓讀者知道換人了，不要的話刪掉那一行就好。
    // 接在選項後面的第一幕都寫了 chat、image、amb，用開發者面板直接跳過來也看得到聊天室和插圖；
    // 從選項接過來時聊天室、插圖都沒換，就不會重新顯示。
    // 配樂：每個結局都有自己的音樂，一直放到結局卡（結局卡出現時，背景音樂繼續放、環境音淡出）。
    // 結局一 saving；結局二 calm；結局三 calm → saving；結局四 sad。音樂從哪一幕開始，那一幕寫了 bgm。

    // ---------- 結局一｜一起上台 ----------
    // E1｜凌晨 00:40：先只看左右分割的插圖（手機開著會蓋住右邊的阿哲），再打開私訊
    "E1-1": {
      chat: null,
      image: "I01",
      clock: "00:40",
      amb: "home_night",
      bgm: "saving", // 結局一：一起趕報告的那一晚開始，換成溫暖的 saving，一直放到結局卡（在黑幕後面換歌）
      lines: [
        fadeOut(), // 接在選項後面：私訊先淡出，才換成左右分割的插圖
        fadeIn(),
        place("房間・醫院", { sub: "報告當天凌晨 12:40" }),
        { type: "pause", ms: 2200 },
      ],
      next: "E1-2",
    },

    "E1-2": {
      chat: "阿哲",
      clock: "00:40",
      // 過了午夜，前一晚的私訊變成「昨天」
      history: [...PROLOGUE_DM, { type: "sys", text: "昨天" }, ...B_NIGHT_DM, { type: "sys", text: "今天" }],
      lines: [
        { type: "narr", text: "你開始一起和阿哲完成簡報。" },
        { type: "narr", text: "在兩個人的力量下，工作進展得很順利。" },
        { type: "msg", from: "阿哲", text: "這段我改好了。" },
        { type: "msg", from: "你", text: "收到，圖表我補上了。" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "最後一段也整理好了。" },
        { type: "msg", from: "你", text: "好，我來接。" },
        { type: "read", text: "已讀" },
        { type: "typing", from: "阿哲", ms: 1800 }, // 劇本：（停頓）
        { type: "msg", from: "阿哲", text: "謝謝。" },
        { type: "msg", from: "阿哲", sound: false, text: "真的。" },
        { type: "clock", text: "01:15" },
        { type: "narr", text: "十二點四十分。" },
        { type: "narr", text: "一點十五分。" },
        { type: "narr", text: "你們沒有再討論誰該負責哪一部分，只是把各自還能完成的事，一件一件做完。" },
      ],
      next: "E1-3",
    },

    // 切到群組
    "E1-3": {
      chat: GROUP,
      clock: "01:18",
      history: [{ type: "sys", text: "昨天" }, ...GROUP_NIGHT, { type: "sys", text: "今天" }],
      lines: [
        { type: "narr", text: "你打開群組" },
        { type: "narr", text: "不只你們，隊友也都還在忙著" },
        { type: "msg", from: "你", text: "第四部分我跟阿哲在處理，他家裡有點事，明天會好。" },
        { type: "read", text: "已讀 4", ms: 1600 },
        { type: "msg", from: "雨晴", text: "好，需要幫忙跟我說。" },
        { type: "msg", from: "凱文", text: "……" },
        { type: "msg", from: "凱文", sound: false, text: "喔，那結論那頁我再順一下。" },
        { type: "msg", from: "小美", text: "我幫忙檢查格式好了。" },
        { type: "narr", text: "沒有人追問阿哲家裡發生了什麼。凱文也沒有道歉。但至少，群組裡終於一起做事了。" },
        { type: "dim", ms: 2000 }, // 劇本：文件的進度條填滿，手機螢幕暗下
        stopAmb(),
        fadeOut(),
      ],
      next: "E1-4",
    },

    // E2｜早上 07:35
    "E1-4": {
      chat: null,
      image: "I05",
      amb: "classroom_noisy", // 第一節上課前，同學陸續進來
      lines: [
        fadeIn(),
        place("教室", { sub: "隔天早上 7:35" }),
        { type: "talk", from: "阿哲", text: "這是？" },
        { type: "talk", from: "你", text: "昨天補的圖表。" },
        { type: "talk", from: "阿哲", text: "可是我有幾個地方還沒背熟。" },
        { type: "talk", from: "你", text: "你寫的那段最清楚，照你寫的講就好。" },
        { type: "narr", text: "阿哲看著講稿，沒有馬上回答。" },
        { type: "talk", from: "阿哲", text: "嗯。謝謝。" },
        { type: "narr", text: "你突然發現，他並不是不在乎這份報告。他只是沒有辦法同時照顧好所有事情。而你也一樣。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E1-5",
    },

    // E3｜上台
    "E1-5": {
      image: "I06",
      amb: "classroom", // 報告中，教室安靜到聽得見投影機的風扇
      lines: [
        fadeIn(),
        bgm("saving", { volume: 0.25, fade: 3000 }), // 輪到第四部分，教室安靜下來：音樂先壓低
        zoomIn(1.3, { x: 30, y: 26, ms: 4000 }), // 講到最後一部分：鏡頭慢慢推向阿哲
        { type: "talk", from: "阿哲", text: "那麼，接下來是我們最後一部分……" },
        { type: "narr", text: "短暫停頓。他低頭看了一眼講稿，繼續說下去。" },
        zoomOut({ ms: 5000 }), // 他把它說完了，鏡頭退回整個教室
        bgm("saving", { fade: 5000 }), // 和鏡頭一起，音樂回到原本的音量（不寫 volume 就是 music 清單裡的音量）
        { type: "narr", text: "沒有特別精彩的結尾，也不是所有人都滿意的報告" },
        { type: "narr", text: "只是這一次，第四部分終於有人站在台上，把它說完了。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E1-6",
    },

    // E4｜那天傍晚：和 E1 同一張桌子、同一個角度，只是天還亮著
    "E1-6": {
      chat: "阿哲",
      image: "I07",
      clock: "17:48",
      amb: "home_day", // 傍晚的房間
      history: [
        ...PROLOGUE_DM,
        { type: "sys", text: "昨天" },
        ...B_NIGHT_DM,
        { type: "sys", text: "今天" },
        ...E1_NIGHT_DM,
      ],
      lines: [
        fadeIn(),
        place("房間", { sub: "隔天傍晚 5:48" }),
        { type: "msg", from: "阿哲", text: "外婆今天可以吃東西了。" },
        { type: "msg", from: "阿哲", sound: false, text: "醫生說狀況穩定很多。" },
        { type: "msg", from: "阿哲", sound: false, text: "昨天謝謝你在群組幫我講，也謝謝你沒講太多。" },
        { type: "msg", from: "你", text: "太好了。報告那部分也謝謝你。" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "下次不要再搞到凌晨了。" },
        { type: "msg", from: "你", text: "你也是。" },
        { type: "read", text: "已讀" },
        { type: "typing", from: "阿哲", ms: 1800 }, // 劇本：（停頓）
        { type: "msg", from: "阿哲", text: "嗯。" },
        { type: "narr", text: "那天晚上，你終於沒有等到凌晨才睡。" },
        stopAmb(), // 最後一頁（阿哲的手機）沒有環境音
      ],
      next: "E1-7",
    },

    // 最後畫面｜阿哲的手機：同一段對話，換成阿哲的手機，他的訊息在右邊
    "E1-7": {
      me: "阿哲",
      chat: "你",
      image: "black",
      clock: "17:52",
      history: [
        ...PROLOGUE_DM,
        { type: "sys", text: "昨天" },
        ...B_NIGHT_DM,
        { type: "sys", text: "今天" },
        ...E1_NIGHT_DM,
        { type: "msg", from: "阿哲", text: "外婆今天可以吃東西了。", read: "已讀" },
        { type: "msg", from: "阿哲", text: "醫生說狀況穩定很多。", read: "已讀" },
        { type: "msg", from: "阿哲", text: "昨天謝謝你在群組幫我講，也謝謝你沒講太多。", read: "已讀" },
        { type: "msg", from: "你", text: "太好了。報告那部分也謝謝你。" },
        { type: "msg", from: "阿哲", text: "下次不要再搞到凌晨了。", read: "已讀" },
        { type: "msg", from: "你", text: "你也是。" },
        { type: "msg", from: "阿哲", text: "嗯。", read: "已讀" },
      ],
      lines: [
        fadeOut(), // 第一行是 fadeOut：你的手機先淡出，才換成阿哲的手機
        fadeIn(),
        place("阿哲的手機"),
        { type: "pause", ms: 2500 },
      ],
      ending: "E1",
    },

    // ---------- 結局二｜差一步 ----------
    // E1｜晚上 23:21：接著 2B-3 的私訊
    "E2-1": {
      chat: "阿哲",
      image: "I02",
      clock: "23:21",
      amb: "home_night",
      history: [...PROLOGUE_DM, { type: "sys", text: "今天" }, ...B_NIGHT_DM],
      lines: [
        { type: "msg", from: "你", text: "辛苦了，你先顧好外婆，加油！" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "嗯，謝謝。" },
        { type: "narr", text: "你已經連續兩個晚上沒睡好。如果現在接手第四部分，今晚大概又不用睡了。" },
        stopBgm({ fade: 1200 }), // 檯燈關掉，音樂也跟著停：阿哲「正在輸入」又消失的那一下，房間是安靜的
        { type: "image", id: "I08" }, // 你關掉檯燈，房間陷入黑暗
        { type: "pause", ms: 900 },
        { type: "typing", from: "阿哲", ms: 2600 }, // 手機螢幕短暫亮起：阿哲正在輸入……然後消失，沒有新的訊息
        { type: "dim", ms: 1200 },
        { type: "narr", text: "你告訴自己，至少已經關心過他了。你翻了個身。這次，你很快就睡著了。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E2-2",
    },

    // E2｜隔天早上
    "E2-2": {
      chat: null,
      image: "I05",
      amb: "classroom_noisy", // 上課前
      bgm: "calm", // 結局二：隔天早上，主題音樂回來，一直放到結局卡。日子回到原本的樣子，只是隔著一點距離
      lines: [
        fadeIn(),
        place("教室", { sub: "隔天早上 7:50" }),
        { type: "talk", from: "凱文", text: "終於喔。等一下記得講清楚，不然我們前面都白做了。" },
        { type: "talk", from: "阿哲", text: "知道。" },
        { type: "narr", text: "你走到他旁邊。" },
        { type: "talk", from: "你", text: "昨天有睡嗎？" },
        { type: "talk", from: "阿哲", text: "還好。" },
        { type: "talk", from: "你", text: "第四部分完成了？" },
        { type: "talk", from: "阿哲", text: "嗯，弄好了。" },
        { type: "narr", text: "他把講稿收進資料夾。" },
        { type: "talk", from: "阿哲", text: "謝謝你昨天有問我。" },
        { type: "narr", text: "他沒有怪你，甚至還說了謝謝。但你看著那些密密麻麻的刪改痕跡，突然不知道該怎麼接話。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E2-3",
    },

    // E3｜報告
    "E2-3": {
      image: "I06",
      amb: "classroom", // 報告中，教室安靜下來
      lines: [
        fadeIn(),
        { type: "talk", from: "阿哲", text: "這裡主要是……" },
        { type: "narr", text: "他翻了一下講稿。" },
        { type: "talk", from: "凱文", text: "（小聲）下一頁。" },
        { type: "talk", from: "阿哲", text: "啊，對。" },
        zoomIn(1.4, { x: 30, y: 26, ms: 6000 }), // 劇本：台下的你看著阿哲
        { type: "narr", text: "報告最後還是完成了，沒有人因此失去分數。可是你知道，那一晚並沒有因為你說了加油，就變得比較容易。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E2-4",
    },

    // E4｜幾天後
    "E2-4": {
      image: "I11",
      amb: "classroom_noisy", // 下課
      lines: [
        fadeIn(),
        place("走廊", { sub: "幾天後的下課時間" }),
        { type: "talk", from: "你", text: "欸，阿哲。你外婆最近怎麼樣？" },
        { type: "talk", from: "阿哲", text: "好多了，謝謝。" },
        { type: "talk", from: "你", text: "那就好。" },
        { type: "pause", ms: 1500 }, // 劇本：（短暫沉默。）
        { type: "talk", from: "阿哲", text: "那我先回教室了。" },
        { type: "narr", text: "你原本想再問些什麼，卻發現你們之間好像沒有以前那麼自然了。不是因為他生氣，只是那個晚上，你們都各自撐過去了。" },
        stopAmb(),
      ],
      next: "E2-5",
    },

    // 最後畫面｜阿哲的手機：對話還停在那一晚，輸入框裡還留著一句沒送出的話，游標在後面閃
    "E2-5": {
      me: "阿哲",
      chat: "你",
      image: "black",
      clock: "10:12",
      history: [
        ...PROLOGUE_DM,
        { type: "sys", text: "幾天前" },
        ...B_NIGHT_DM,
        { type: "msg", from: "你", text: "辛苦了，你先顧好外婆，加油！" },
        { type: "msg", from: "阿哲", text: "嗯，謝謝。", read: "已讀" },
      ],
      lines: [
        fadeOut(),
        { type: "draft", text: "我可能需要幫忙。" }, // 在黑幕後面，所以幕拿掉時字已經在輸入框裡
        { type: "caret" },
        fadeIn(),
        place("阿哲的手機"),
        { type: "pause", ms: 3000 },
      ],
      ending: "E2",
    },

    // ---------- 結局三｜修補 ----------
    // E1｜晚上 23:34：接著 2A-4 的群組。那句話在 2A-3 已經收回了，
    // 所以劇本「長按訊息、跳出收回、手指停在上面」那一段不演，只留旁白
    "E3-1": {
      chat: GROUP,
      image: "I01",
      clock: "23:34",
      amb: "home_night",
      history: [...GROUP_NIGHT, ...A_NIGHT_GROUP],
      lines: [
        { type: "narr", text: "收回訊息，不代表沒有人看過。而且這一次，你也不想假裝什麼都沒發生。" },
        { type: "msg", from: "你", text: "剛剛那句是我說錯了。" },
        { type: "msg", from: "你", text: "阿哲有他的狀況，第四部分我一起處理。" },
        { type: "msg", from: "你", text: "前面那樣說他不公平。" },
        { type: "read", text: "已讀 3" },
        { type: "read", text: "已讀 4", ms: 1800 }, // 這一次，阿哲也看了
        { type: "msg", from: "雨晴", text: "好，我也可以幫忙。" },
        { type: "msg", from: "凱文", text: "你幹嘛突然這樣？" },
        { type: "narr", text: "你沒有回覆。" },
        { type: "narr", text: "訊息送出去之後，你才發現自己一直握著手機。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E3-2",
    },

    // E2｜凌晨：阿哲私訊傳來
    // 插圖還是 I01，鏡頭也還停在 2A-2 推近的地方：桌上的報告，剛好是「你在整理第四部分的資料」
    "E3-2": {
      chat: "阿哲",
      image: "I01",
      clock: "00:50",
      amb: "home_night",
      bgm: "saving", // 結局三：道歉那一段（E3-1）沒有音樂；阿哲傳來檔案，音樂才回來
      history: [...PROLOGUE_DM, { type: "sys", text: "昨天" }, ...A_NIGHT_DM, { type: "sys", text: "今天" }],
      lines: [
        fadeIn(),
        place("房間", { sub: "報告當天凌晨 12:50" }),
        { type: "msg", from: "阿哲", text: "📄 第四部分.docx" }, // Claude 補寫：他說要把寫好的部分傳過來，所以先傳一個檔案
        { type: "msg", from: "阿哲", sound: false, text: "我把目前寫好的部分傳給你。剩下的我明天再補。" },
        { type: "msg", from: "你", text: "好。先休息吧。" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "嗯。" },
        // 劇本：文件逐漸完成。群組裡，雨晴在修改簡報，凱文也傳了一份結論頁（兩個檔名是 Claude 補寫）
        { type: "clock", text: "01:26" },
        { type: "notify", chat: GROUP, from: "雨晴", text: "📄 簡報_修改版.pptx" },
        { type: "clock", text: "01:58" },
        { type: "notify", chat: GROUP, from: "凱文", text: "📄 結論頁.pptx" },
        { type: "narr", text: "你們沒有突然變成感情很好的小組。只是這一次，沒有人再拿阿哲沒回訊息這件事開玩笑。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E3-3",
    },

    // E3｜隔天報告後
    "E3-3": {
      chat: null,
      image: "I10",
      amb: "classroom_noisy", // 報告剛結束，同學開始收拾東西
      lines: [
        fadeIn(),
        place("教室", { sub: "隔天早上 9:00" }),
        { type: "talk", from: "你", text: "阿哲。" },
        { type: "narr", text: "阿哲停下。" },
        { type: "talk", from: "你", text: "昨天……對不起。" },
        { type: "talk", from: "阿哲", text: "嗯。謝謝你後來在群組那樣說。" },
        { type: "talk", from: "你", text: "前面那句真的不應該。" },
        { type: "talk", from: "阿哲", text: "……可是我還是看到了。" },
        { type: "narr", text: "他低頭整理書包。" },
        { type: "talk", from: "阿哲", text: "群組那時候一直問，我其實都有看到。只是在醫院，不知道要怎麼回。" },
        { type: "pause", ms: 1500 }, // 劇本：（停頓。）
        { type: "talk", from: "你", text: "還是對不起。" },
        { type: "talk", from: "阿哲", text: "嗯。" },
        { type: "narr", text: "你沒有再急著解釋。現在重要的不是讓他相信你不是故意的，而是承認，他確實被那句話傷到了。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E3-4",
    },

    // E4｜幾天後
    "E3-4": {
      image: "I12",
      amb: "classroom_noisy", // 午休
      bgm: "saving", // 幾天後，兩人笑了一下：在黑幕後面換成 saving，一直放到結局卡
      lines: [
        fadeIn(),
        place("教室", { sub: "幾天後的午休" }),
        { type: "talk", from: "阿哲", text: "這是上次的資料，你要不要留著？" },
        { type: "talk", from: "你", text: "好，謝啦。" },
        { type: "talk", from: "阿哲", text: "下次分組不要再拖到最後一天了。" },
        { type: "talk", from: "你", text: "知道啦。" },
        { type: "talk", from: "阿哲", text: "你上次也差不多吧。" },
        { type: "talk", from: "你", text: "……好啦。" },
        { type: "narr", text: "兩人短暫笑了一下。" },
        { type: "narr", text: "你們沒有立刻變回以前的樣子。但至少，這一次，你們願意繼續說話了。" },
        stopAmb(),
      ],
      next: "E3-5",
    },

    // 最後畫面｜阿哲的手機：小組群組。往上滑還看得到那一晚：收回的那句話、下面的道歉都還在
    // focus 先把「你已收回訊息」捲到中間，阿哲傳出新訊息時，畫面往下捲過那一晚，停在最下面
    "E3-5": {
      me: "阿哲",
      chat: GROUP,
      image: "black",
      clock: "13:05",
      history: [
        { type: "sys", text: "幾天前" },
        ...GROUP_NIGHT,
        ...A_NIGHT_GROUP,
        { type: "msg", from: "你", text: "剛剛那句是我說錯了。" },
        { type: "msg", from: "你", text: "阿哲有他的狀況，第四部分我一起處理。" },
        { type: "msg", from: "你", text: "前面那樣說他不公平。" },
        { type: "msg", from: "雨晴", text: "好，我也可以幫忙。" },
        { type: "msg", from: "凱文", text: "你幹嘛突然這樣？" },
        { type: "msg", from: "雨晴", text: "📄 簡報_修改版.pptx" },
        { type: "msg", from: "凱文", text: "📄 結論頁.pptx" },
        { type: "sys", text: "今天" },
      ],
      focus: "已收回訊息",
      lines: [
        fadeOut(),
        fadeIn(),
        place("阿哲的手機"),
        { type: "pause", ms: 2000 },
        { type: "msg", from: "阿哲", text: "我把上次的檔案放上去了。" },
        { type: "read", text: "已讀 4", ms: 1600 },
        { type: "pause", ms: 2500 },
      ],
      ending: "E3",
    },

    // ---------- 結局四｜沉默 ----------
    // E1｜晚上 23:18：接著 2A-4。修訂版劇本在這裡讓阿哲私訊「我家裡出事了……」，
    // 但他在 2A-2 已經傳過三則私訊，所以不重傳：打開私訊再看一次那三則，群組的訊息從通知一直跳出來
    "E4-1": {
      chat: "阿哲",
      image: "I01",
      clock: "23:18",
      amb: "home_night",
      history: [...PROLOGUE_DM, { type: "sys", text: "今天" }, ...A_NIGHT_DM],
      lines: [
        { type: "narr", text: "他沒有在群組回。他只傳給了你。" },
        { type: "notify", chat: GROUP, from: "凱文", text: "所以到底要不要處理？" },
        { type: "notify", chat: GROUP, from: "雨晴", text: "大家先睡吧，明天再說。" },
        { type: "narr", text: "剛才那句話已經被很多人看見。現在道歉，好像很奇怪；解釋，又不知道從哪裡開始。" },
      ],
      next: "E4-2",
    },

    // 你把手機翻面（手機收起來）。房間安靜下來
    "E4-2": {
      chat: null,
      image: "I01",
      lines: [
        stopAmb({ fade: 3000 }),
        { type: "pause", ms: 2500 },
        fadeOut("black", { ms: 1500 }),
      ],
      next: "E4-3",
    },

    // E2｜隔天早上
    "E4-3": {
      image: "I12",
      lines: [
        zoomIn(1.4, { x: 52, y: 45, ms: 0 }), // 還停在黑幕：先切到空桌子的特寫
        zoomOut({ ms: 5000 }), // 一邊淡入一邊慢慢拉遠：位子是空的（點到下一張圖之前，差不多拉完）
        // 結局四：把手機翻過去之後一直沒有音樂；看到空位，sad 才慢慢進來，一直放到結局卡
        bgm("sad", { fade: 4000 }),
        amb("classroom_noisy"), // 上課前
        fadeIn(),
        place("教室", { sub: "隔天早上 8:10" }),
        { type: "talk", from: "凱文", text: "看吧，我就說他會請假。" },
        { type: "talk", from: "雨晴", text: "先不要講了。他凌晨有把檔案傳上來。" },
        // 報告進行到第四部分。劇本：投影片上有阿哲寫的內容，只是很簡略，幾行條列
        // （I13 現在只有標題，換成有幾行條列的版本會更貼）
        { type: "image", id: "I13" },
        amb("classroom"), // 報告中，教室安靜下來
        { type: "talk", from: "老師", text: "這部分誰要講？" },
        { type: "narr", text: "沒有人回答。雨晴拿起遙控器，照著投影片唸了一遍。" },
        { type: "narr", text: "投影片上有阿哲寫的字。但台上沒有人能替他說。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E4-4",
    },

    // E3｜午休
    // 劇本寫在走廊窗邊，但唯一的走廊圖 I11 裡有阿哲（他今天沒來），所以先借用空座位 I12；
    // 之後有不含阿哲的走廊圖，把 image 換掉、地點字條改成「走廊」就好
    "E4-4": {
      image: "I18",
      amb: "classroom_noisy", // 午休
      lines: [
        fadeIn(),
        place("走廊", { sub: "隔天中午 12:35" }),
        zoomIn(1.3, { x: 50, y: 40, ms: 9000 }), // 雨晴說話時，鏡頭慢慢推向空座位
        { type: "talk", from: "雨晴", text: "聽說阿哲外婆住院了。他這幾天晚上都在醫院。" },
        { type: "pause", ms: 1400 }, // 劇本：（停頓。）
        { type: "talk", from: "雨晴", text: "你跟他比較熟，要不要問問看？" },
        { type: "narr", text: "你沒有回答。雨晴離開。" },
      ],
      next: "E4-5",
    },

    // 你點開和阿哲的私訊：最後一則下面，沒有任何回覆
    "E4-5": {
      chat: "阿哲",
      image: "I12",
      clock: "12:41",
      history: [...PROLOGUE_DM, { type: "sys", text: "昨天" }, ...A_NIGHT_DM],
      lines: [
        { type: "narr", text: "你其實有看到，也有想過要回。只是最後，你選擇了把手機翻過去。" },
        stopAmb(),
        fadeOut(),
      ],
      next: "E4-6",
    },

    // E4｜晚上：和 E4-1 同一個角度
    "E4-6": {
      chat: "阿哲",
      image: "I01",
      clock: "22:47",
      amb: "home_night",
      history: [...PROLOGUE_DM, { type: "sys", text: "昨天" }, ...A_NIGHT_DM],
      lines: [
        zoomIn(1.25, { x: 46, y: 54, ms: 0 }), // 還停在黑幕：切到和 E4-1 一樣的畫面（2A-2 推近的位置）
        fadeIn(),
        place("房間", { sub: "隔天晚上 10:47" }),
        { type: "caret" }, // 你打開阿哲的對話框
        { type: "draft", text: "昨天……" },
        { type: "pause", ms: 1200 }, // 劇本：（停頓。刪掉。）
        { type: "erase" },
        { type: "draft", text: "你還好嗎？" },
        { type: "pause", ms: 1600 }, // 劇本：（停頓。沒有送出。）
        { type: "narr", text: "你不知道現在說這些，還來不來得及。你盯著輸入框很久。" },
        { type: "dim", ms: 2400 }, // 手機螢幕自己暗了
        // 劇本把這句寫在「畫面」裡；只看畫面分不出你有沒有把手機翻過去，所以改成旁白
        { type: "narr", text: "這一次，你沒有把它翻過去。" },
        stopAmb(),
      ],
      next: "E4-7",
    },

    // 最後畫面｜阿哲的手機：他的訊息都已讀，下面沒有新訊息，也沒有「正在輸入」
    "E4-7": {
      me: "阿哲",
      chat: "你",
      image: "black",
      clock: "22:50",
      history: [...PROLOGUE_DM, { type: "sys", text: "昨天" }, ...A_NIGHT_DM],
      lines: [
        fadeOut(),
        fadeIn(),
        place("阿哲的手機"),
        { type: "pause", ms: 3000 },
      ],
      ending: "E4",
    },

    // ================= 隱藏章節：阿哲的那一晚 =================
    // 這一章換成阿哲的手機（me: "阿哲"），旁白用「我」。
    // Z-3、Z-4 用 when 依照讀者第一次的選擇（choice1），顯示不同內容。
    // Z-5 之後依照讀者的兩個選擇分開：B 路線＋一起扛下走真結局（T-1 → T-7），其他照原本的結尾（Z-6 → Z-8）。
    "Z-1": {
      chat: null,
      me: "阿哲",
      image: "I14",
      clock: "22:47",
      bgm:"bgm-hospital",
      lines: [
        bgm("bgm-hospital", { volume: 0.2 }),
        fadeOut("black", { ms: 0 }), // 先停在黑幕：大字結束後，病房才不會先露出來
        { type: "card", text: "隱藏章節", sub: "阿哲的那一晚" },
        amb(HOSPITAL_AMB), // 大字結束後才開始，和病房一起淡入
        fadeIn(),
        place("醫院病房", { sub: "報告前一天晚上 10:47" }),
        // 劇本寫「凌晨十二點零三分」，但你的訊息是十點五十二分傳的，
        // 所以改成和第一幕同一個時間
        { type: "narr", text: "晚上十點四十七分。" },
        { type: "narr", text: "外婆睡著了。" },
        { type: "narr", text: "護理師說，晚上最好有人陪著。" },
        { type: "narr", text: "媽媽還在上大夜班。" },
        { type: "narr", text: "我把筆電放在膝蓋上，打開第四部分。" },
        { type: "narr", text: "只剩一半。" },
        { type: "narr", text: "群組又跳出通知。" },
      ],
      next: "Z-2",
    },

    // 阿哲手機上的群組：和第一幕是同一段對話
    // （劇本這裡寫的是舊版台詞「你寫好了嗎？」「又已讀不回」，
    //   為了和第一幕「同一個畫面」，改用第一幕的台詞）
    "Z-2": {
      chat: GROUP,
      lines: [
        { type: "msg", from: "雨晴", text: "簡報差不多好了，只剩第四部分。" },
        { type: "msg",sound: false, from: "雨晴", text: "@阿哲 你那邊可以了嗎？" },
        { type: "narr", text: "我不知道怎麼回答。" },
        { type: "narr", text: "我打下：" },
        { type: "draft", text: "我外婆住院了。" },
        { type: "narr", text: "看了幾秒。" },
        { type: "erase" },
        { type: "narr", text: "刪掉。" },
        { type: "clock", text: "22:51" },
        { type: "narr", text: "凱文的訊息跳出來。" },
        bgm("bgm-hospital", { volume: 1 }),
        { type: "msg", from: "凱文", text: "有人可以回一下嗎？" },
        { type: "msg", sound: false,from: "凱文", text: "我不想明天上台才發現少一大段。" },
        { type: "msg", sound: false, from: "凱文", text: "明天還有數學考試" },
        { type: "msg", sound: false, from: "凱文", text: "真的不能再拖了。" },
        { type: "msg", sound: false, from: "凱文", text: "@阿哲" },
        { type: "narr", text: "我想解釋。" },
        { type: "narr", text: "可是如果現在才說，會不會聽起來像在找藉口？" },
        { type: "narr", text: "我又打了一次。" },
        { type: "draft", text: "我外婆住院了。" },
        { type: "erase" },
        { type: "narr", text: "刪掉。" },
        { type: "msg", from: "小美", text: "他今天好像又在睡覺。" },
        { type: "msg", from: "凱文", text: "……真的不知道要怎麼講。" },
        { type: "msg",sound: false, from: "凱文", text: "@你 你說對不對？你也等很久了吧。" },
      ],
      next: "Z-3",
    },

    // 手機放下了，通知出現在畫面右上角。
    // A 路線：阿哲只看到通知、沒有點開群組，所以那句話是「已讀 3」，不是 4。
    "Z-3": {
      chat: null,
      clock: "22:52",
      lines: [
        { type: "narr", text: "手機震了一下。" },
        { type: "notify", from: "你", text: "你還好嗎？", when: { choice1: "B" } },
        { type: "notify", chat: GROUP, from: "你", text: "真的，每次都這樣。", when: { choice1: "A" } },
        { type: "narr", text: "是你的私訊。", when: { choice1: "B" } },
        // ↓ A 路線的三句是 Claude 補寫
        { type: "narr", text: "是群組。", when: { choice1: "A" } },
        { type: "narr", text: "我沒有點開，只看著通知上的那一行字。", when: { choice1: "A" } },
        { type: "narr", text: "連你也這樣覺得。", when: { choice1: "A" } },
      ],
      next: "Z-4",
    },

    // 阿哲和你的私訊
    "Z-4": {
      chat: "你",
      clock: "22:52",
      history: [
        ...PROLOGUE_DM,
        { type: "sys", text: "今天" },
        { type: "msg", from: "你", text: "你還好嗎？", when: { choice1: "B" } },
      ],
      lines: [
        stopBgm({ fade: 4000 }),
        { type: "narr", text: "我看著那句話很久。", when: { choice1: "B" } },
        { type: "narr", text: "這幾天，好像沒有人問過我這個問題。", when: { choice1: "B" } },
        // ↓ Claude 補寫（A 路線）
        { type: "narr", text: "我打開和你的私訊。", when: { choice1: "A" } },
        { type: "narr", text: "上一次說話，是兩週前的「明天見」。", when: { choice1: "A" } },

        { type: "narr", text: "我想說的事情很多。" },
        { type: "narr", text: "想說我已經三天沒有好好睡覺，想說我很怕外婆突然又不舒服，也想說我知道自己沒有把報告做好。" },

        // B 路線：你在第二幕看到的兩次「正在輸入……」，就是這裡（Claude 補寫的兩句草稿）
        { type: "draft", text: "我這幾天都在醫院", when: { choice1: "B" } },
        { type: "erase", when: { choice1: "B" } },
        { type: "clock", text: "22:58", when: { choice1: "B" } },
        { type: "draft", text: "其實我外婆", when: { choice1: "B" } },
        { type: "erase", when: { choice1: "B" } },
        { type: "clock", text: "23:06", when: { choice1: "B" } },
        { type: "narr", text: "但最後，我只傳了：", when: { choice1: "B" } },
        { type: "msg", from: "阿哲", text: "沒事。", when: { choice1: "B" } },
        { type: "read", text: "已讀", when: { choice1: "B" } },
        { type: "narr", text: "我不想讓別人擔心。", when: { choice1: "B" } },
        { type: "narr", text: "也不想讓自己看起來像是在求別人原諒。", when: { choice1: "B" } },

        // A 路線：你在第二幕收到的那三則私訊（旁白是 Claude 補寫）
        { type: "clock", text: "22:58", when: { choice1: "A" } },
        { type: "narr", text: "但最後，我只傳了：", when: { choice1: "A" } },
        { type: "msg", from: "阿哲", text: "第四部分我會弄完。", when: { choice1: "A" } },
        { type: "read", text: "已讀", when: { choice1: "A" } },
        { type: "msg", from: "阿哲", text: "對不起，這次是我的問題。", when: { choice1: "A" } },
        { type: "read", text: "已讀", when: { choice1: "A" } },
        { type: "narr", text: "想了很久，我又多傳了一句。", when: { choice1: "A" } },
        { type: "msg", from: "阿哲", text: "我家裡出了點事。", when: { choice1: "A" } },
        { type: "read", text: "已讀", when: { choice1: "A" } },
        { type: "narr", text: "已讀。", when: { choice1: "A" } },
        { type: "narr", text: "你沒有回。", when: { choice1: "A" } },
        { type: "narr", text: "也好。我本來就不想讓別人擔心。", when: { choice1: "A" } },
      ],
      next: "Z-5",
    },

    "Z-5": {
      chat: null,
      lines: [
        { type: "narr", text: "病床上的外婆動了一下。" },
        { type: "image", id: "I15" },
        { type: "narr", text: "她伸手碰了碰我的手。" },
        { type: "talk", from: "外婆", text: "阿哲，你閣未睏喔？明仔載毋是欲報告？" },
        { type: "talk", from: "阿哲", text: "我寫好了啦，你緊睏。" },
        { type: "narr", text: "我知道自己還沒寫好。" },
        { type: "narr", text: "我只是希望她能安心睡覺。" },
        stopAmb({ fade: 2000 }),
        fadeOut("black", { ms: 2000 }), // 慢一點，像一整夜過去
      ],
      // B 路線＋一起扛下（結局一）：那一晚有人陪他做完，天亮時走真結局；其他選擇照原本的天亮和結尾
      next: [
        { when: { choice1: "B", choice2: "一起扛下" }, next: "T-1" },
        { next: "Z-6" },
      ],
    },

    "Z-6": {
      image: "I16",
      amb: HOSPITAL_AMB,
      lines: [
        pan("left", { ms: 0 }), // 還停在黑幕（Z-5 最後淡出了）：鏡頭先停在左邊的外婆
        pan("right", { ms: 15000 }), // 淡入時開始，慢慢移到阿哲和窗邊：一整夜過去，天快亮了
        fadeIn("black", { ms: 2000 }),
        place("醫院病房", { sub: "報告當天清晨 5:30" }),
        { type: "narr", text: "窗外開始泛白。" },
        stopAmb(),
        bgm("saving", { volume: 0.3}),
        fadeOut(),
      ],
      next: "Z-7",
    },

    // 畫面切回讀者的手機：原本的群組對話重新出現
    "Z-7": {
      chat: GROUP,
      me: "你",
      image: "I04",
      clock: "22:51",
      amb: "home_night", // 回到你的房間，那天晚上
      history: GROUP_NIGHT,
      focus: "已讀 4", // 把「已讀 4」捲到看得見的地方（手機橫放時螢幕很矮）
      lines: [
        fadeIn(),
        { type: "narr", text: "你第一次看見的「已讀」，與現在看見的「已讀」，是同一個畫面。" },
        { type: "narr", text: "只是這次，你知道了螢幕另一端發生的事情。" },
        stopAmb({ fade: 2500 }),
        fadeOut("black", { ms: 2500 }), // 劇本：畫面漸暗
        { type: "card", text: "「已讀」的另一邊，也有人醒著。" },
        stopBgm(), 
      ],
      next: "Z-8",
    },

    // 畫面漸暗之後：停在黑幕上，最後只留下兩個選項
    "Z-8": {
      chat: null,
      choices: [
        { label: "重新閱讀", next: "P-1" },
        { label: "回到故事", next: "Z-9" }, // 回到第一次選擇的那一刻
      ],
    },

    // 「回到故事」：在黑幕後面把群組準備好，再淡入回到第一次選擇（1-4）。主題音樂 calm 也和畫面一起回來
    "Z-9": {
      chat: GROUP,
      image: "I01",
      clock: "22:51",
      amb: "home_night",
      bgm: "calm",
      history: GROUP_NIGHT,
      lines: [fadeIn()],
      next: "1-4",
    },

    // ================= 真結局：天亮以後 =================
    // 隱藏章節限定・B 路線＋一起扛下。從 Z-5 接過來（見 Z-5 的 next）。
    // 劇本寫在「畫面」裡、插圖看得出來的動作（重新打開筆電、沒有立刻回覆、拿起手機）都用插圖、停頓、打字表現，不另外寫旁白；
    // 插圖看不出來的（媽媽來接班、阿哲笑了一下），照這一章的寫法改成阿哲說的「我」。

    // Z5｜天快亮了：和 Z-6 同一個畫面，只是第四部分已經寫完了
    // T-1～T-4 還是阿哲的手機。每一幕都寫了 me、image，用開發者面板直接跳過來也對（和上一幕一樣時什麼都不會變）
    "T-1": {
      me: "阿哲",
      image: "I16",
      amb: HOSPITAL_AMB,
      // 配樂：真結局從這裡開始反轉，saving 分兩段慢慢出來，一直放到 T-4（T-5 再換成 happyendding）
      lines: [
        pan("left", { ms: 0 }), // 還停在黑幕（Z-5 最後淡出了）：鏡頭先停在左邊的外婆
        pan("right", { ms: 12000 }), // 淡入時開始，慢慢移到阿哲和窗邊
        bgm("saving", { volume: 0.15, fade: 8000 }), // 1. 天亮了：花 8 秒從沒聲音淡入到很小聲
        fadeIn("black", { ms: 2000 }),
        place("醫院病房", { sub: "報告當天清晨 5:30" }),
        { type: "narr", text: "天快亮了。" },
        { type: "narr", text: "我終於把最後一頁傳了出去。" },
        { type: "narr", text: "手機震動。" },
        bgm("saving", { fade: 6000 }), // 2. 你的訊息傳來，他不是一個人：花 6 秒變大聲，回到 music 清單裡的音量
        { type: "notify", from: "你", text: "圖表我補好了，你看看有沒有問題。" },
      ],
      next: "T-2",
    },

    // 阿哲手機上和你的私訊：那一晚一起趕報告的訊息都還在上面
    "T-2": {
      me: "阿哲",
      chat: "你",
      image: "I16",
      clock: "05:36",
      history: [...PROLOGUE_DM, { type: "sys", text: "昨天" }, ...B_NIGHT_DM, { type: "sys", text: "今天" }, ...E1_NIGHT_DM],
      lines: [
        { type: "msg", from: "你", text: "圖表我補好了，你看看有沒有問題。", sound: false }, // T-1 的通知已經響過了
        { type: "msg", from: "阿哲", text: "收到了。" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "你", text: "先休息吧，剩下的明天再說。" },
        // 劇本：阿哲看著訊息。這次沒有立刻回覆。過了一會兒，他打字：
        { type: "caret" },
        { type: "pause", ms: 2500 },
        { type: "msg", from: "阿哲", text: "好。" },
        { type: "read", text: "已讀" },
        { type: "narr", text: "「已讀」的另一邊，也有人醒著。" },
        stopAmb({ fade: 2500 }),
        fadeOut("black", { ms: 2500 }), // 劇本：畫面慢慢淡出
      ],
      next: "T-3",
    },

    // Z6｜早晨的訊息：和 Z-5 同一張外婆的手。那天晚上他說「我寫好了啦」是騙外婆的，這一次是真的
    // （劇本是「病房的窗簾透進一點陽光」；之後有早晨病房的圖，把 image 換掉就好）
    "T-3": {
      me: "阿哲",
      chat: null,
      image: "I15",
      amb: HOSPITAL_AMB,
      lines: [
        fadeIn("black", { ms: 2000 }),
        place("醫院病房", { sub: "報告當天早上 6:40" }),
        { type: "narr", text: "早上六點四十分。" },
        { type: "narr", text: "病房的窗簾透進一點陽光。" },
        { type: "narr", text: "媽媽剛來接替我陪外婆。" }, // 劇本：媽媽剛接替他來陪外婆
        { type: "talk", from: "外婆", text: "阿哲，你今仔日毋是欲去學校？" },
        { type: "talk", from: "阿哲", text: "嗯，等一下就去。" },
        { type: "talk", from: "外婆", text: "報告有準備好無？" },
        { type: "talk", from: "阿哲", text: "有啦。" },
        { type: "talk", from: "外婆", text: "那就好，莫閣熬甲遮暗。" },
        { type: "narr", text: "我笑了一下。" }, // 劇本：阿哲笑了一下
      ],
      next: "T-4",
    },

    // 他拿起手機，打開群組
    "T-4": {
      me: "阿哲",
      chat: GROUP,
      image: "I15",
      clock: "06:42",
      history: [
        { type: "sys", text: "昨天" },
        ...GROUP_NIGHT,
        { type: "sys", text: "今天" },
        ...E1_NIGHT_GROUP,
        { type: "msg", from: "阿哲", text: "📄 第四部分.pptx", read: "已讀 4" }, // Claude 補寫（見 T_MORNING_GROUP）
      ],
      lines: [
        // 打開群組時訊息已經在那裡了，所以不響
        { type: "msg", from: "雨晴", text: "昨天辛苦了！簡報我有幫忙檢查。", sound: false },
        { type: "msg", from: "凱文", text: "第四部分收到，結論頁我改好了。", sound: false },
        { type: "msg", from: "小美", text: "今天報告加油！", sound: false },
        { type: "narr", text: "我原本以為，大家只會記得我沒有完成的那一部分。" },
        { type: "narr", text: "但原來，有些人還是願意等我把話說完。" },
        stopBgm({ fade: 2000 }),
        stopAmb(),
        fadeOut("black", { ms: 2000 }),
      ],
      next: "T-5",
    },

    // Z7｜不只是完成報告：幾天後放學，換回你的手機
    "T-5": {
      me: "你",
      chat: "阿哲",
      image: "I18",
      clock: "16:52",
      bgm: "happyendding",
      amb: "classroom", // 放學後，安靜下來的學校
      history: [
        ...PROLOGUE_DM,
        { type: "sys", text: "幾天前" },
        ...B_NIGHT_DM,
        ...E1_NIGHT_DM,
        ...T_DAWN_DM,
        ...E1_EVENING_DM,
        { type: "sys", text: "今天" },
      ],
      lines: [
        fadeIn(),
        place("走廊", { sub: "幾天後的放學時間" }),
        { type: "msg", from: "阿哲", text: "欸" },
        { type: "msg", from: "阿哲", sound: false, text: "那天晚上，我本來想叫你們不用管我" },
        { type: "msg", from: "你", text: "為什麼？" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "覺得很麻煩你們" },
        { type: "msg", from: "你", text: "是有點麻煩啦" },
        { type: "msg", from: "你", text: "但分組本來就是一起做的吧" },
        { type: "read", text: "已讀" },
        // 劇本：「對方正在輸入…」出現，消失，又出現
        { type: "typing", from: "阿哲", ms: 2000 },
        { type: "typing", from: "阿哲", ms: 1600 },
        { type: "msg", from: "阿哲", text: "謝謝" },
        { type: "msg", from: "阿哲", sound: false, text: "下次換我幫你" },
        { type: "msg", from: "你", text: "那你先準時交東西再說" },
        { type: "read", text: "已讀" },
        { type: "msg", from: "阿哲", text: "好啦" },
        { type: "pause", ms: 2000 }, // 劇本：停兩秒，淡出
        { type: "dim" }, // 手機螢幕逐漸暗下
        stopAmb(),
        fadeOut(),
      ],
      next: "T-6",
    },

    // 旁白出現在黑幕上，說完才淡入夕陽裡的教室。
    // 借用序幕那張教室（I17）：故事從這個教室、這個時間的光開始，也在這裡結束
    "T-6": {
      chat: null,
      image: "I17",
      lines: [
        fadeOut("black", { ms: 0 }), // T-5 已經淡出了，這行是讓開發者面板直接跳過來時，旁白也在黑幕上
        { type: "narr", text: "有些事情沒有完全改變。" },
        { type: "narr", text: "外婆還需要休養，報告也不會因為一次合作就變得完美。" },
        { type: "narr", text: "凱文還是有點急性子。" },
        { type: "narr", text: "而我們，也還是會有不知道怎麼開口的時候。" },
        { type: "narr", text: "但至少，那天晚上之後。" },
        { type: "narr", text: "阿哲知道了，有些話可以說出口。" },
        { type: "narr", text: "而你也知道，有些訊息值得多等一下。" },
        zoomIn(1.5, { x: 77, y: 34, ms: 0 }), // 還停在黑幕：先切到阿哲（和序幕 P-1 他說話時同一個位置）
        zoomOut({ ms: 5000, ease: "soft" }), // 一邊淡入一邊拉遠，看見整個教室
        amb("classroom"),
        fadeIn(),
        { type: "pause", ms: 2500 }, // 劇本：窗外的夕陽照進教室
      ],
      next: "T-7",
    },

    // 最後畫面｜阿哲的手機：和四個結局一樣換成阿哲的手機，往上滑還看得到第一幕那一晚。
    // focus 先把雨晴那句「@阿哲 你那邊可以了嗎？」和下面的「已讀 4」捲到中間：那一晚他看了沒回，
    // 這一次雨晴問他，他回了，「已讀 4」出現在他自己的訊息旁邊。已讀出現後停兩秒，再出現結局卡
    "T-7": {
      me: "阿哲",
      chat: GROUP,
      image: "I17",
      clock: "17:05",
      history: [
        { type: "sys", text: "幾天前" },
        ...GROUP_NIGHT,
        ...E1_NIGHT_GROUP,
        ...T_MORNING_GROUP,
        { type: "sys", text: "今天" },
      ],
      focus: "你那邊可以了嗎",
      lines: [
        place("阿哲的手機"),
        { type: "pause", ms: 1500 },
        { type: "msg", from: "雨晴", text: "下次要不要一起吃午餐？" },
        { type: "msg", from: "阿哲", text: "好啊。" },
        { type: "read", text: "已讀 4", ms: 1600 },
        { type: "pause", ms: 2000 },
      ],
      ending: "TRUE",
    },
  },
};
