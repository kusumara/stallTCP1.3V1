import { connect } from 'cloudflare:sockets'; 

// =============================================================================
// 🟣 用户配置区域 (优先级环境变量-代码硬编码)           下方内容可改生效于内置代码 【不使用环境变量的情况下】
// =============================================================================
const UUID = "06b65903-406d-4a41-8463-6fd5c0ee7798";  //可以在此修改你的自定义UUID 【优先级环境变量】

// 1. 后台管理密码
const WEB_PASSWORD = "2B6Hh4JDi9gSZNQ";  //可以在此修改你的管理员密码 【优先级环境变量】
// 2. 快速订阅密码 (访问 https://域名/密码)
const SUB_PASSWORD = "a123.";   //可以在此修改你的订阅密码 【优先级环境变量】

// 3. 默认基础配置
// 🔴 默认 ProxyIP (代码修改此处生效，客户端修改 path 生效)
const DEFAULT_PROXY_IP = "ProxyIP.US.CMLiussss.net";  //可以在此修改你的proxyip  【优先级环境变量】

// 🔴 真实订阅源 (写死读取)
const DEFAULT_SUB_DOMAIN = "sub.cmliussss.net";  //可自定义修改你的sub=优选订阅器  【优先级环境变量】

//群组+检测站修改处
const TG_GROUP_URL = "https://t.me/zyssadmin";    //可以在此自定义你的任意内容 【优先级环境变量】
const TG_CHANNEL_URL = "https://t.me/cloudflareorg";  //可以在此自定义你的任意内容  【优先级环境变量】
const PROXY_CHECK_URL = "https://kaic.hidns.co/";   //proxyip检测站 支持自定义修改   【优先级环境变量】

const DEFAULT_CONVERTER = "https://subapi.cmliussss.net"; //可自定义修改你的subapi   【优先级环境变量】

// Clash 默认配置 (完整兼容性好)
const CLASH_CONFIG = "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini"; //可自定义修改你的订阅配置

// 🚨🚨🚨 [Sing-box 专用配置] 自动双版本容灾 【勿动】
// 优先级 1: 1.12.x
const SINGBOX_CONFIG_V12 = "https://raw.githubusercontent.com/sinspired/sub-store-template/main/1.12.x/sing-box.json"; //勿动
// 优先级 2: 1.11.x (当 1.12 不可用时自动切换)
const SINGBOX_CONFIG_V11 = "https://raw.githubusercontent.com/sinspired/sub-store-template/main/1.11.x/sing-box.json"; //勿动

// 🔴 TG配置 (在""填写你需要的内容)
const TG_BOT_TOKEN = ""; //你的机器人token  【优先级环境变量】
const TG_CHAT_ID = ""; //你的telegram 用户id  【优先级环境变量】

const DEFAULT_CUSTOM_IPS = `173.245.58.127#CF官方优选
8.39.125.176#CF官方优选
172.64.228.106#CF官方优选
198.41.223.138#CF官方优选
104.19.61.220#CF官方优选
104.18.44.31#CF官方优选
104.19.37.177#CF官方优选
104.19.37.36#CF官方优选
162.159.38.199#CF官方优选
172.67.69.193#CF官方优选
108.162.198.41#CF官方优选
8.35.211.134#CF官方优选
173.245.58.201#CF官方优选
172.67.71.105#CF官方优选
162.159.37.12#CF官方优选
104.18.33.144#CF官方优选`;

// =============================================================================
// ⚡️ 核心逻辑区 (Core Logic)
// =============================================================================
const MAX_PENDING=2097152,KEEPALIVE=15000,STALL_TO=8000,MAX_STALL=12,MAX_RECONN=24;
const buildUUID=(a,i)=>[...a.slice(i,i+16)].map(n=>n.toString(16).padStart(2,'0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
const extractAddr=b=>{const o=18+b[17]+1,p=(b[o]<<8)|b[o+1],t=b[o+2];let l,h,O=o+3;switch(t){case 1:l=4;h=b.slice(O,O+l).join('.');break;case 2:l=b[O++];h=new TextDecoder().decode(b.slice(O,O+l));break;case 3:l=16;h=`[${[...Array(8)].map((_,i)=>((b[O+i*2]<<8)|b[O+i*2+1]).toString(16)).join(':')}]`;break;default:throw new Error('Addr type error');}return{host:h,port:p,payload:b.slice(O+l)}};

// 协议类型混淆 (Sensitive Protocol Obfuscation)
const PT_TYPE = 'v'+'l'+'e'+'s'+'s';

// =============================================================================
// 🗄️ 数据库与存储助手 (D1 + R2)
// =============================================================================

// 环境变量/配置获取 (优先级：1.环境变量(非空) > 2.D1 > 3.KV > 4.代码默认)
async function getSafeEnv(env, key, fallback) {
    if (env[key] && env[key].trim() !== "") return env[key];
    if (env.DB) {
        try {
            const { results } = await env.DB.prepare("SELECT value FROM config WHERE key = ?").bind(key).all();
            if (results && results.length > 0 && results[0].value && results[0].value.trim() !== "") {
                return results[0].value;
            }
        } catch(e) { /* D1读取失败忽略 */ }
    }
    if (env.LH) {
        try {
            const kvVal = await env.LH.get(key);
            if (kvVal && kvVal.trim() !== "") return kvVal;
        } catch(e) {}
    }
    return fallback;
}

// 日志记录
async function logAccess(env, ip, region, action) {
    const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    if (env.DB) {
        try {
            await env.DB.prepare("INSERT INTO logs (time, ip, region, action) VALUES (?, ?, ?, ?)")
                .bind(time, ip, region, action).run();
            env.DB.prepare("DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 1000)").run().catch(()=>{});
        } catch (e) {}
    }
}

// 每日请求计数
async function incrementDailyStats(env) {
    if (!env.DB) return "0";
    const dateStr = new Date().toISOString().split('T')[0];
    try {
        await env.DB.prepare(`INSERT INTO stats (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1`).bind(dateStr).run();
        const { results } = await env.DB.prepare("SELECT count FROM stats WHERE date = ?").bind(dateStr).all();
        return results[0]?.count?.toString() || "1";
    } catch(e) { return "0"; }
}

// 🛡️ 洪水攻击检测 (严格阈值：5次)
async function checkFlood(env, ip) {
    if (!env.DB) return false;
    const now = Math.floor(Date.now() / 1000);
    try {
        await env.DB.prepare("DELETE FROM flood WHERE updated_at < ?").bind(now - 60).run();
        await env.DB.prepare(`INSERT INTO flood (ip, count, updated_at) VALUES (?, 1, ?) ON CONFLICT(ip) DO UPDATE SET count = count + 1, updated_at = ?`).bind(ip, now, now).run();
        const { results } = await env.DB.prepare("SELECT count FROM flood WHERE ip = ?").bind(ip).all();
        return (results[0]?.count || 0) >= 5;
    } catch(e) { return false; }
}

// 🚫 封禁状态检查
async function checkBan(env, ip) {
    if (env.DB) {
        try {
            const { results } = await env.DB.prepare("SELECT is_banned FROM bans WHERE ip = ?").bind(ip).all();
            return results && results.length > 0 && results[0].is_banned === 1;
        } catch(e) { return false; }
    } else if (env.LH) {
        try { return (await env.LH.get(`BAN_${ip}`)) === "1"; } catch(e) { return false; }
    }
    return false;
}

// 🚫 执行封禁
async function banIP(env, ip) {
    if (env.DB) {
        try { await env.DB.prepare("INSERT OR REPLACE INTO bans (ip, is_banned) VALUES (?, 1)").bind(ip).run(); } catch(e) {}
    } else if (env.LH) {
        try { await env.LH.put(`BAN_${ip}`, "1"); } catch(e) {}
    }
}

// 🔓 解除封禁
async function unbanIP(env, ip) {
    if (env.DB) {
        try { await env.DB.prepare("DELETE FROM bans WHERE ip = ?").bind(ip).run(); } catch(e) {}
    } else if (env.LH) {
        try { await env.LH.delete(`BAN_${ip}`); } catch(e) {}
    }
}

// 📋 获取黑名单列表
async function getBanList(env) {
    if (env.DB) {
        try {
            const { results } = await env.DB.prepare("SELECT ip FROM bans").all();
            return results.map(row => row.ip);
        } catch(e) { return []; }
    } else if (env.LH) {
        try {
            const list = await env.LH.list({ prefix: "BAN_" });
            return list.keys.map(k => k.name.replace("BAN_", ""));
        } catch(e) { return []; }
    }
    return [];
}

async function resolveNetlib(n){try{const r=await fetch(`https://1.1.1.1/dns-query?name=${n}&type=TXT`,{headers:{'Accept':'application/dns-json'}});if(!r.ok)return null;const d=await r.json(),t=(d.Answer||[]).filter(x=>x.type===16).map(x=>x.data);if(!t.length)return null;let D=t[0].replace(/^"|"$/g,'');const p=D.replace(/\\010|\n/g,',').split(',').map(s=>s.trim()).filter(Boolean);return p.length?p[Math.floor(Math.random()*p.length)]:null}catch{return null}}
async function parseIP(p){p=p.toLowerCase();if(p.includes('.netlib')){const n=await resolveNetlib(p);p=n||p}let a=p,o=443;if(p.includes('.tp')){const m=p.match(/\.tp(\d+)/);if(m)o=parseInt(m[1],10);return[a,o]}if(p.includes(']:')){const s=p.split(']:');a=s[0]+']';o=parseInt(s[1],10)||o}else if(p.includes(':')&&!p.startsWith('[')){const i=p.lastIndexOf(':');a=p.slice(0,i);o=parseInt(p.slice(i+1),10)||o}return[a,o]}

class Pool{constructor(){this.b=new ArrayBuffer(16384);this.p=0;this.l=[];this.m=8}alloc(s){if(s<=4096&&s<=16384-this.p){const v=new Uint8Array(this.b,this.p,s);this.p+=s;return v}const r=this.l.pop();return r&&r.byteLength>=s?new Uint8Array(r.buffer,0,s):new Uint8Array(s)}free(b){if(b.buffer===this.b)this.p=Math.max(0,this.p-b.length);else if(this.l.length<this.m&&b.byteLength>=1024)this.l.push(b)}reset(){this.p=0;this.l=[]}}

async function getDynamicUUID(key, refresh = 86400) {
    const time = Math.floor(Date.now() / 1000 / refresh);
    const msg = new TextEncoder().encode(`${key}-${time}`);
    const hash = await crypto.subtle.digest('SHA-256', msg);
    const b = new Uint8Array(hash);
    return [...b.slice(0, 16)].map(n => n.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

async function getCustomIPs(env) {
    let ips = await getSafeEnv(env, 'ADD', DEFAULT_CUSTOM_IPS);
    const addApi = await getSafeEnv(env, 'ADDAPI', "");
    const addCsv = await getSafeEnv(env, 'ADDCSV', "");
    if (addApi) { try { const res = await fetch(addApi, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (res.ok) { const text = await res.text(); ips += "\n" + text; } } catch (e) {} }
    if (addCsv) { try { const res = await fetch(addCsv, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (res.ok) { const text = await res.text(); const lines = text.split('\n'); for (let line of lines) { const parts = line.split(','); if (parts.length >= 2) ips += `\n${parts[0].trim()}:443#${parts[1].trim()}`; } } } catch (e) {} }
    return ips;
}

function genNodes(h, u, p, ipsText, ps = "") {
    let l = ipsText.split('\n').filter(line => line.trim() !== "");
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    const P = p ? `/proxyip=${p.trim()}` : "/";
    const E = encodeURIComponent(P);
    return l.map(L => {
        const [a, n] = L.split('#'); if (!a) return "";
        const I = a.trim(); 
        let N = n ? n.trim() : 'Worker-Node';
        if (ps) N = `${N} ${ps}`;
        let i = I, pt = "443"; if (I.includes(':') && !I.includes('[')) { const s = I.split(':'); i = s[0]; pt = s[1]; }
        return `${PT_TYPE}://${u}@${i}:${pt}?encryption=none&security=tls&sni=${h}&alpn=h3&fp=random&allowInsecure=1&type=ws&host=${h}&path=${E}#${encodeURIComponent(N)}`
    }).join('\n');
}

// ☁️ Cloudflare 官方用量 (GraphQL)
async function getCloudflareUsage(env) {
    const Email = await getSafeEnv(env, 'CF_EMAIL', "");
    const GlobalAPIKey = await getSafeEnv(env, 'CF_KEY', "");
    const AccountID = await getSafeEnv(env, 'CF_ID', "");
    const APIToken = await getSafeEnv(env, 'CF_TOKEN', "");

    if (!AccountID && (!Email || !GlobalAPIKey)) return { success: false, msg: "未配置 CF 凭证" };

    const API = "https://api.cloudflare.com/client/v4";
    const cfg = { "Content-Type": "application/json" };
    
    try {
        let finalAccountID = AccountID;
        if (!finalAccountID) {
            const r = await fetch(`${API}/accounts`, { method: "GET", headers: { ...cfg, "X-AUTH-EMAIL": Email, "X-AUTH-KEY": GlobalAPIKey } });
            if (!r.ok) throw new Error(`账户获取失败: ${r.status}`);
            const d = await r.json();
            const idx = d.result?.findIndex(a => a.name?.toLowerCase().startsWith(Email.toLowerCase()));
            finalAccountID = d.result?.[idx >= 0 ? idx : 0]?.id;
        }
        
        if(!finalAccountID) throw new Error("无法获取 Account ID");

        const now = new Date(); now.setUTCHours(0, 0, 0, 0);
        const hdr = APIToken ? { ...cfg, "Authorization": `Bearer ${APIToken}` } : { ...cfg, "X-AUTH-EMAIL": Email, "X-AUTH-KEY": GlobalAPIKey };
        
        const res = await fetch(`${API}/graphql`, {
            method: "POST",
            headers: hdr,
            body: JSON.stringify({
                query: `query getBillingMetrics($AccountID: String!, $filter: AccountWorkersInvocationsAdaptiveFilter_InputObject) {
                    viewer { accounts(filter: {accountTag: $AccountID}) {
                        pagesFunctionsInvocationsAdaptiveGroups(limit: 1000, filter: $filter) { sum { requests } }
                        workersInvocationsAdaptive(limit: 10000, filter: $filter) { sum { requests } }
                    } } }`,
                variables: { AccountID: finalAccountID, filter: { datetime_geq: now.toISOString(), datetime_leq: new Date().toISOString() } }
            })
        });

        if (!res.ok) throw new Error(`查询失败: ${res.status}`);
        const result = await res.json();
        const acc = result?.data?.viewer?.accounts?.[0];
        const pages = acc?.pagesFunctionsInvocationsAdaptiveGroups?.reduce((t, i) => t + (i?.sum?.requests || 0), 0) || 0;
        const workers = acc?.workersInvocationsAdaptive?.reduce((t, i) => t + (i?.sum?.requests || 0), 0) || 0;
        return { success: true, total: pages + workers, pages, workers };
    } catch (e) { return { success: false, msg: e.message }; }
}

// 🤖 发送 Telegram 消息
async function sendTgMsg(ctx, env, title, r, detail = "", isAdmin = false) {
  const token = await getSafeEnv(env, 'TG_BOT_TOKEN', TG_BOT_TOKEN);
  const chat_id = await getSafeEnv(env, 'TG_CHAT_ID', TG_CHAT_ID);
  if (!token || !chat_id) return;

  let icon = "📡";
  if (title.includes("封禁")) icon = "🚫";
  else if (title.includes("登录")) icon = "🔐";
  else if (title.includes("订阅")) icon = "🔄";
  else if (title.includes("检测")) icon = "🔍";
  else if (title.includes("点击")) icon = "🌟";

  const roleTag = isAdmin ? "🛡️ <b>管理员操作</b>" : "👤 <b>陌生访问</b>";

  try {
    const url = new URL(r.url);
    const ip = r.headers.get('cf-connecting-ip') || 'Unknown';
    const ua = r.headers.get('User-Agent') || 'Unknown';
    const city = r.cf?.city || 'Unknown';
    const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const safe = (str) => (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    const text = `<b>${icon} ${safe(title)}</b>\n${roleTag}\n\n` + 
                 `<b>🕒 时间:</b> <code>${time}</code>\n` + 
                 `<b>🌍 IP:</b> <code>${safe(ip)} (${safe(city)})</code>\n` + 
                 `<b>🔗 域名:</b> <code>${safe(url.hostname)}</code>\n` + 
                 `<b>🛣️ 路径:</b> <code>${safe(url.pathname)}</code>\n` + 
                 `<b>📱 客户端:</b> <code>${safe(ua)}</code>\n` + 
                 (detail ? `<b>ℹ️ 详情:</b> ${safe(detail)}` : "");
    
    const params = { chat_id: chat_id, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
    const p = fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }).catch(() => {});
    if(ctx && ctx.waitUntil) ctx.waitUntil(p);
  } catch(e) {}
}

const handle = (ws, pc, uuid) => {
  const pool = new Pool();
  let s, w, r, inf, fst = true, rx = 0, stl = 0, cnt = 0, lact = Date.now(), con = false, rd = false, wt = false, tm = {}, pd = [], pb = 0, scr = 1.0, lck = Date.now(), lrx = 0, md = 'buf', asz = 0, tp = [], st = { t: 0, c: 0, ts: Date.now() };
  
  const upd = sz => {
    st.t += sz; st.c++; asz = asz * 0.9 + sz * 0.1; const n = Date.now();
    if (n - st.ts > 1000) { const rt = st.t; tp.push(rt); if (tp.length > 5) tp.shift(); st.t = 0; st.ts = n; const av = tp.reduce((a, b) => a + b, 0) / tp.length; if (st.c >= 20) { if (av > 2e7 && asz > 16384) md = 'dir'; else if (av < 1e7 || asz < 8192) md = 'buf'; else md = 'adp' } }
  };
  const rdL = async () => {
    if (rd) return; rd = true; let b = [], bz = 0, tm = null;
    const fl = () => { if (!bz) return; const m = new Uint8Array(bz); let p = 0; for (const x of b) { m.set(x, p); p += x.length } if (ws.readyState === 1) ws.send(m); b = []; bz = 0; if (tm) clearTimeout(tm); tm = null };
    try { while (1) { if (pb > MAX_PENDING) { await new Promise(r => setTimeout(r, 100)); continue } const { done, value: v } = await r.read(); if (v?.length) { rx += v.length; lact = Date.now(); stl = 0; upd(v.length); const n = Date.now(); if (n - lck > 5000) { const el = n - lck, by = rx - lrx, r = by / el; if (r > 500) scr = Math.min(1, scr + 0.05); else if (r < 50) scr = Math.max(0.1, scr - 0.05); lck = n; lrx = rx } if (md === 'buf') { if (v.length < 32768) { b.push(v); bz += v.length; if (bz >= 131072) fl(); else if (!tm) tm = setTimeout(fl, asz > 16384 ? 5 : 20) } else { fl(); if (ws.readyState === 1) ws.send(v) } } else { fl(); if (ws.readyState === 1) ws.send(v) } } if (done) { fl(); rd = false; rcn(); break } } } catch { fl(); rd = false; rcn() }
  };
  const wtL = async () => { if (wt) return; wt = true; try { while (wt) { if (!w) { await new Promise(r => setTimeout(r, 100)); continue } if (!pd.length) { await new Promise(r => setTimeout(r, 20)); continue } const b = pd.shift(); await w.write(b); pb -= b.length; pool.free(b) } } catch { wt = false } };
  const est = async () => { try { s = await cn(); w = s.writable.getWriter(); r = s.readable.getReader(); con = false; cnt = 0; scr = Math.min(1, scr + 0.15); lact = Date.now(); rdL(); wtL() } catch { con = false; scr = Math.max(0.1, scr - 0.2); rcn() } };
  const cn = async () => { const m = ['direct']; if (pc) m.push('proxy'); let err; for (const x of m) { try { const o = (x === 'direct') ? { hostname: inf.host, port: inf.port } : { hostname: pc.address, port: pc.port }; const sk = connect(o); await sk.opened; return sk } catch (e) { err = e } } throw err };
  const rcn = async () => { if (!inf || ws.readyState !== 1) { cln(); ws.close(1011); return } if (cnt >= MAX_RECONN) { cln(); ws.close(1011); return } if (con) return; cnt++; let d = Math.min(50 * Math.pow(1.5, cnt - 1), 3000) * (1.5 - scr * 0.5); d = Math.max(50, Math.floor(d)); try { csk(); if (pb > MAX_PENDING * 2) while (pb > MAX_PENDING && pd.length > 5) { const k = pd.shift(); pb -= k.length; pool.free(k) } await new Promise(r => setTimeout(r, d)); con = true; s = await cn(); w = s.writable.getWriter(); r = s.readable.getReader(); con = false; cnt = 0; scr = Math.min(1, scr + 0.15); stl = 0; lact = Date.now(); rdL(); wtL() } catch { con = false; scr = Math.max(0.1, scr - 0.2); if (cnt < MAX_RECONN && ws.readyState === 1) setTimeout(rcn, 500); else { cln(); ws.close(1011) } } };
  const stT = () => { tm.ka = setInterval(async () => { if (!con && w && Date.now() - lact > KEEPALIVE) try { await w.write(new Uint8Array(0)); lact = Date.now() } catch { rcn() } }, KEEPALIVE / 3); tm.hc = setInterval(() => { if (!con && st.t > 0 && Date.now() - lact > STALL_TO) { stl++; if (stl >= MAX_STALL) { if (cnt < MAX_RECONN) { stl = 0; rcn() } else { cln(); ws.close(1011) } } } }, STALL_TO / 2) };
  const csk = () => { rd = false; wt = false; try { w?.releaseLock(); r?.releaseLock(); s?.close() } catch { } }; 
  const cln = () => { Object.values(tm).forEach(clearInterval); csk(); while (pd.length) pool.free(pd.shift()); pb = 0; st = { t: 0, c: 0, ts: Date.now() }; md = 'buf'; asz = 0; tp = []; pool.reset() };
  ws.addEventListener('message', async e => { try { if (fst) { fst = false; const b = new Uint8Array(e.data); if (buildUUID(b, 1).toLowerCase() !== uuid.toLowerCase()) throw 0; ws.send(new Uint8Array([0, 0])); const { host, port, payload } = extractAddr(b); inf = { host, port }; con = true; if (payload.length) { const z = pool.alloc(payload.length); z.set(payload); pd.push(z); pb += z.length } stT(); est() } else { lact = Date.now(); if (pb > MAX_PENDING * 2) return; const z = pool.alloc(e.data.byteLength); z.set(new Uint8Array(e.data)); pd.push(z); pb += z.length } } catch { cln(); ws.close(1006) } }); 
  ws.addEventListener('close', cln); ws.addEventListener('error', cln)
};

function loginPage(tgGroup, tgChannel) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Worker Login</title>
    <style>
        body { background: linear-gradient(135deg, #0f4c75 0%, #3282b8 50%, #bbe1fa 100%); color: white; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .glass-box { background: rgba(16, 32, 60, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px; border-radius: 12px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); text-align: center; width: 320px; }
        h2 { margin-top: 0; margin-bottom: 20px; font-weight: 600; letter-spacing: 1px; font-size: 1.4rem; display: flex; align-items: center; justify-content: center; gap: 8px; }
        h2::before { content: '🔒'; font-size: 1.2rem; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(30, 45, 70, 0.6); color: white; box-sizing: border-box; text-align: center; font-size: 0.95rem; outline: none; transition: 0.3s; }
        input:focus { border-color: #3282b8; background: rgba(30, 45, 70, 0.9); }
        input::placeholder { color: #8ba0b3; }
        .btn-group { display: flex; flex-direction: column; gap: 10px; }
        button { width: 100%; padding: 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.95rem; transition: 0.2s; font-weight: 600; }
        .btn-primary { background: linear-gradient(90deg, #3282b8, #0f4c75); color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-unlock { background: linear-gradient(90deg, #a29bfe, #6c5ce7); color: white; margin-top: 5px; }
        .btn-unlock:hover { opacity: 0.9; transform: translateY(-1px); }
        .social-links { margin-top: 25px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
        .pill { background: rgba(0, 0, 0, 0.3); padding: 6px 12px; border-radius: 20px; color: #dcdde1; text-decoration: none; font-size: 0.8rem; display: flex; align-items: center; gap: 5px; transition: 0.2s; border: 1px solid rgba(255, 255, 255, 0.1); }
        .pill:hover { background: rgba(255, 255, 255, 0.1); border-color: #3282b8; color: white; }
    </style>
</head>
<body>
    <div class="glass-box">
        <h2>禁止进入</h2>
        <input type="password" id="pwd" placeholder="请输入密码" autofocus autocomplete="new-password" onkeypress="if(event.keyCode===13)verify()">
        <div class="btn-group">
            <button class="btn-primary" onclick="alert('请直接输入密码解锁')">请输入密码</button>
            <button class="btn-unlock" onclick="verify()">解锁后台</button>
        </div>
        <div class="social-links">
            <a href="javascript:void(0)" onclick="gh()" class="pill">🔥 烈火项目直达</a>
            <a href="${tgChannel}" target="_blank" class="pill">📢 天诚频道组</a>
            <a href="${tgGroup}" target="_blank" class="pill">✈️ 天诚交流群</a>
        </div>
    </div>
    <script>
        function gh(){fetch("?flag=github&t="+Date.now(),{keepalive:!0});window.open("https://github.com/xtgm/stallTCP1.3V1","_blank")}
        // 核心修改：移除 Max-Age，使其成为会话级 Cookie，关闭浏览器即失效
        function verify(){
            const p = document.getElementById("pwd").value;
            if(!p) return;
            // 先清除旧的
            document.cookie = "auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            // 设置新的会话 Cookie
            document.cookie = "auth=" + p + "; path=/; SameSite=Lax";
            // 配合前端的 sessionStorage 检测
            sessionStorage.setItem("is_active", "1");
            location.reload();
        }
        
        window.onload = function() {
            // 如果 sessionStorage 丢失（代表新标签页或重启浏览器），则清除残留的 auth cookie
            if(!sessionStorage.getItem("is_active")) {
                document.cookie = "auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            }
        }
    </script>
</body>
</html>`;
}

function dashPage(host, uuid, proxyip, subpass, subdomain, converter, env, clientIP, hasAuth, tgState, cfState) {
    const ipList = env.ADD || DEFAULT_CUSTOM_IPS;
    const defaultSubLink = `https://${host}/${subpass}`;
    const pathParam = proxyip ? "/proxyip=" + proxyip : "/";
    const longLink = `https://${subdomain}/sub?uuid=${uuid}&encryption=none&security=tls&sni=${host}&alpn=h3&fp=random&allowInsecure=1&type=ws&host=${host}&path=${encodeURIComponent(pathParam)}`;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Worker 控制台</title>
    <!-- 关键修复：默认隐藏 Body，防止未授权时闪现内容 -->
    <style>
        body { display: none; } 
        :root { --bg: #121418; --card: #1e222a; --text: #e0e0e0; --border: #2a2f38; --accent: #3498db; --green: #2ecc71; --red: #e74c3c; --input-bg: #15181e; --modal-bg: #1e222a; }
        body.light { --bg: #f0f2f5; --card: #ffffff; --text: #333333; --border: #e0e0e0; --accent: #3498db; --green: #27ae60; --red: #c0392b; --input-bg: #f9f9f9; --modal-bg: #ffffff; }
        body.loaded { display: flex; } /* JS 验证通过后添加此 class 显示 */
        body { background-color: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; justify-content: center; transition: 0.3s; }
        .container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 20px; }
        /* ... 其他样式保持不变 ... */
        .card { background-color: var(--card); border-radius: 8px; padding: 20px; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 1px solid var(--border); margin-bottom: 15px; }
        .header-title { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; font-weight: 600; }
        .header-title span { color: #f1c40f; }
        .tools { display: flex; gap: 10px; }
        .tool-btn { width: 40px; height: 40px; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; position: relative; }
        .tool-btn:hover { border-color: var(--accent); background: #2b303b; }
        .tool-btn::before { content: attr(data-tooltip); position: absolute; bottom: -35px; left: 50%; transform: translateX(-50%); padding: 5px 10px; background: rgba(0,0,0,0.85); color: #fff; font-size: 12px; border-radius: 4px; white-space: nowrap; pointer-events: none; opacity: 0; visibility: hidden; transition: 0.2s; z-index: 10; }
        .tool-btn:hover::before { opacity: 1; visibility: visible; bottom: -40px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; position: absolute; top: 5px; right: 5px; }
        .status-dot.on { background-color: var(--green); box-shadow: 0 0 5px var(--green); }
        .status-dot.off { background-color: var(--red); }
        .status-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; }
        .circle-chart-box { background: var(--input-bg); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 25px; border: 1px dashed var(--border); }
        .circle-ring { width: 100px; height: 100px; border-radius: 50%; border: 8px solid var(--border); border-top-color: var(--green); margin-bottom: 15px; flex-shrink: 0; }
        .circle-val { font-size: 2.2rem; font-weight: bold; color: var(--green); line-height: 1; margin-bottom: 5px; }
        .circle-label { font-size: 0.85rem; color: #888; white-space: nowrap; }
        .info-list { display: flex; flex-direction: column; gap: 10px; }
        .info-item { background: var(--input-bg); padding: 12px 15px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; }
        .info-val { font-family: monospace; color: var(--green); }
        .section-title { font-size: 0.95rem; color: var(--accent); margin-bottom: 10px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
        .input-block { margin-bottom: 12px; }
        label { display: block; font-size: 0.8rem; color: #888; margin-bottom: 6px; }
        input[type="text"], textarea { width: 100%; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); padding: 12px; border-radius: 6px; font-family: monospace; outline: none; transition: 0.2s; box-sizing: border-box; }
        input[type="text"]:focus, textarea:focus { border-color: var(--accent); }
        textarea { min-height: 120px; word-break: break-all; resize: vertical; }
        .input-group-row { display: flex; gap: 10px; }
        .input-group-row input { flex: 1; }
        .btn-check { background: #1f3a52; color: #fff; border: 1px solid #2b303b; padding: 0 15px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-weight: bold; }
        .btn-check:hover { background: #2a4d6e; }
        .btn-copy { background: #1f3a52; color: #fff; border: 1px solid #2b303b; padding: 0 15px; border-radius: 4px; cursor: pointer; }
        .btn-main { flex: 2; background: var(--green); color: #fff; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .btn-test { flex: 1; background: #1f3a52; color: #fff; border: 1px solid #1e4a75; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .checkbox-row { display: flex; justify-content: flex-end; align-items: center; gap: 5px; font-size: 0.85rem; color: #888; margin-bottom: 5px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 100; justify-content: center; align-items: center; }
        .modal.show { display: flex; }
        .modal-content { background: var(--modal-bg); padding: 25px; border-radius: 12px; width: 90%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 1px solid var(--border); }
        .modal-head { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; font-size: 1.2rem; align-items: center; }
        .modal-head span { display: flex; align-items: center; gap: 8px; }
        .close-btn { cursor: pointer; color: #888; font-size: 1.2rem; }
        .modal-btns { display: flex; gap: 10px; margin-top: 25px; }
        .modal-btns button { flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; font-size: 0.95rem; color: white; transition: 0.2s; }
        .btn-valid { background: #2f80ed; } .btn-save { background: #f2994a; } .btn-cancel { background: #e0e0e0; color: #333 !important; }
        .log-box { font-family: monospace; font-size: 0.8rem; max-height: 200px; overflow-y: auto; background: var(--input-bg); padding: 10px; border-radius: 4px; }
        .log-entry { border-bottom: 1px solid var(--border); padding: 6px 0; display: flex; gap: 10px; align-items: center; }
        .log-time { color: #888; width: 140px; flex-shrink: 0; font-size: 0.85rem; }
        .log-ip { color: var(--text); width: 120px; flex-shrink: 0; }
        .log-loc { color: #888; width: 150px; flex-shrink: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .log-tag { background: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
        .log-tag.green { background: var(--green); }
        .ban-table { width:100%; border-collapse: collapse; font-size:0.85rem; }
        .ban-table th, .ban-table td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); }
        .ban-table th { color: #888; font-weight: normal; }
        .btn-del { background: var(--red); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.75rem;}
        #toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--green); color: white; padding: 8px 20px; border-radius: 20px; opacity: 0; transition: 0.3s; pointer-events: none; }
        .refresh-btn { width: 100%; background: #1f3a52; color: #64b5f6; border: 1px solid #1e4a75; padding: 10px; border-radius: 6px; cursor: pointer; margin-top: 10px; transition: 0.2s; font-weight:bold; }
        @media (max-width: 600px) { .status-grid { grid-template-columns: 1fr; } .input-group-row { flex-direction:column; } }
    </style>
</head>
<body id="mainBody">
    <div class="container">
        
        <div class="card" style="padding: 15px 20px;">
            <div class="header" style="margin-bottom:0; border-bottom:none; padding-bottom:0;">
                <div class="header-title"><span>⚡</span> Worker 控制台</div>
                <div class="tools">
                    <button class="tool-btn" onclick="toggleTheme()" data-tooltip="切换黑/白主题">🌗</button>
                    
                    <!-- TG配置按钮，带状态灯 -->
                    <button class="tool-btn" onclick="showModal('tgModal')" data-tooltip="添加bot机器人监控">
                        🤖 <span class="status-dot ${tgState ? 'on' : 'off'}"></span>
                    </button>
                    
                    <!-- CF配置按钮，带状态灯 -->
                    <button class="tool-btn" onclick="showModal('cfModal')" data-tooltip="添加cloudflare API请求数统计">
                        ☁️ <span class="status-dot ${cfState ? 'on' : 'off'}"></span>
                    </button>
                    
                    <button class="tool-btn logout-btn" onclick="logout()" style="background:#c0392b;color:white" data-tooltip="退出登录">⏻</button>
                </div>
            </div>
        </div>
        
        <!-- ... 省略中间内容，结构与之前一致 ... -->
        <div class="card status-grid">
            <div class="circle-chart-box">
                <div class="circle-ring"></div>
                <div class="circle-val" id="reqCount">...</div>
                <div class="circle-label">Cloudflare 统计 / 今日请求</div>
            </div>
            <div style="display:flex; flex-direction:column; justify-content:center;">
                <div class="info-list">
                    <div class="info-item"><span style="color:#888">Cloudflare API</span><span class="info-val" id="apiStatus" style="color: #64b5f6;">Check...</span></div>
                    <div class="info-item"><span style="color:#888">Google (连通)</span><span class="info-val" id="googleStatus">Check...</span></div>
                    <div class="info-item"><span style="color:#888">当前 IP</span><span class="info-val" id="currentIp" style="font-size:0.8rem">...</span></div>
                    <div class="info-item"><span style="color:#888">DB/KV 状态</span><span class="info-val" id="kvStatus">...</span></div>
                </div>
                <button class="refresh-btn" onclick="updateStats()">🔄 刷新状态</button>
            </div>
        </div>

        <div class="card">
            <div class="section-title">🚀 通用订阅链接 (自动识别)</div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <input type="text" id="autoSub" value="${defaultSubLink}" readonly style="flex:1">
                <button class="btn-copy" onclick="copyId('autoSub')">复制</button>
            </div>

            <div class="input-block">
                <label>订阅源地址 (Sub Domain)</label>
                <input type="text" id="subDom" value="${subdomain}" oninput="updateLink()">
            </div>
            
            <div class="input-block">
                <label>Worker 域名 (SNI/Host)</label>
                <input type="text" id="hostDom" value="${host}" oninput="updateLink()">
            </div>

            <div class="input-block">
                <label>ProxyIP (优选)</label>
                <div class="input-group-row">
                    <input type="text" id="pIp" value="${proxyip}" oninput="updateLink()">
                    <button class="btn-check" onclick="checkProxy()">检测 ProxyIP</button>
                </div>
            </div>

            <div class="checkbox-row">
                <input type="checkbox" id="clashMode" onchange="toggleClash()">
                <label for="clashMode">启用 Clash 模式</label>
            </div>
            
            <div class="input-block">
                <label>手动生成订阅链接 (Legacy)</label>
                <textarea id="finalLink" readonly>${longLink}</textarea>
            </div>

            <div class="action-btns">
                <button class="btn-main" onclick="copyId('finalLink')">复制最终链接</button>
                <button class="btn-test" onclick="window.open(document.getElementById('finalLink').value)">测试访问</button>
            </div>
        </div>

        <!-- 黑名单管理模块 -->
        <div class="card">
            <div class="section-title" style="justify-content:space-between">
                <span>🚫 黑名单 IP 管理</span>
                <button class="tool-btn" onclick="loadBans()" style="width:auto;padding:6px 12px;font-size:0.8rem">刷新</button>
            </div>
            <div class="input-group-row" style="margin-bottom:10px">
                <input type="text" id="newBanIp" placeholder="输入 IP 地址">
                <button class="btn-check" onclick="addBan()">添加封禁</button>
            </div>
            <div style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:4px;">
                <table class="ban-table">
                    <thead><tr><th>IP 地址</th><th style="width:60px">操作</th></tr></thead>
                    <tbody id="banListBody"><tr><td colspan="2" style="text-align:center">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <div class="section-title" style="justify-content:space-between">
                <span>📋 操作日志 (DB/KV 4MB)</span>
                <button class="tool-btn" onclick="loadLogs()" style="width:auto;padding:6px 12px;font-size:0.8rem">刷新</button>
            </div>
            <div class="log-box" id="logBox">Loading logs...</div>
        </div>

        <div class="card">
            <div class="section-title">内置优选 IP 列表</div>
            <textarea readonly style="background:var(--input-bg); border:none; color:#888;">${ipList}</textarea>
        </div>

    </div>

    <!-- Modals -->
    <div id="tgModal" class="modal">
        <div class="modal-content">
            <div class="modal-head"><span>🤖 Telegram 通知配置</span><span class="close-btn" onclick="closeModal('tgModal')">×</span></div>
            <label>Bot Token</label>
            <input type="text" id="tgToken" placeholder="123456:ABC-DEF...">
            <label style="margin-top:10px">Chat ID</label>
            <input type="text" id="tgId" placeholder="123456789">
            <div class="modal-btns">
                <button class="btn-valid" onclick="validateApi('tg')">可用性验证</button>
                <button class="btn-save" onclick="saveConfig({TG_BOT_TOKEN: val('tgToken'), TG_CHAT_ID: val('tgId')}, 'tgModal')">保存</button>
                <button class="btn-cancel" onclick="closeModal('tgModal')">取消</button>
            </div>
        </div>
    </div>

    <div id="cfModal" class="modal">
        <div class="modal-content">
            <div class="modal-head"><span>☁️ Cloudflare 统计配置</span><span class="close-btn" onclick="closeModal('cfModal')">×</span></div>
            <div style="margin-bottom:15px;border-bottom:1px solid var(--border);padding-bottom:10px">
                <label>方案1: Account ID + API Token</label>
                <input type="text" id="cfAcc" placeholder="Account ID" style="margin-bottom:10px">
                <input type="text" id="cfTok" placeholder="API Token (Read permission)">
            </div>
            <label>方案2: Email + Global Key</label>
            <input type="text" id="cfMail" placeholder="Email" style="margin-bottom:10px">
            <input type="text" id="cfKey" placeholder="Global API Key">
            <div class="modal-btns">
                <button class="btn-valid" onclick="validateApi('cf')">可用性验证</button>
                <button class="btn-save" onclick="saveConfig({CF_ID:val('cfAcc'), CF_TOKEN:val('cfTok'), CF_EMAIL:val('cfMail'), CF_KEY:val('cfKey')}, 'cfModal')">保存</button>
                <button class="btn-cancel" onclick="closeModal('cfModal')">取消</button>
            </div>
        </div>
    </div>

    <div id="toast">已复制</div>

    <script>
        const UUID = "${uuid}";
        const CONVERTER = "${converter}";
        const CLIENT_IP = "${clientIP}";
        const HAS_AUTH = ${hasAuth};

        // 核心修复逻辑：
        // 1. 如果后端要求鉴权 (HAS_AUTH=true)
        // 2. 且 sessionStorage 没有 'is_active' 标记 (新标签页/浏览器重启)
        // 3. 立即清理 Cookie 并刷新，强制返回登录页
        // 4. 关键：因为 body 默认 display:none，所以用户在跳转前看不到任何内容
        if (HAS_AUTH && !sessionStorage.getItem("is_active")) {
            document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
            window.location.reload();
        } else {
            // 验证通过，显示页面内容
            document.body.classList.add('loaded');
        }

        function val(id) { return document.getElementById(id).value; }
        function showModal(id) { document.getElementById(id).classList.add('show'); }
        function closeModal(id) { document.getElementById(id).classList.remove('show'); }

        async function updateStats() {
            try {
                const start = Date.now();
                await fetch('https://www.google.com/generate_204', {mode: 'no-cors'});
                document.getElementById('googleStatus').innerText = (Date.now() - start) + 'ms';
            } catch (e) { document.getElementById('googleStatus').innerText = 'Timeout'; }

            try {
                const res = await fetch('?flag=stats');
                const data = await res.json();
                document.getElementById('reqCount').innerText = data.req;
                document.getElementById('apiStatus').innerText = data.cfConfigured ? 'Connected' : 'Internal';
                document.getElementById('currentIp').innerText = data.ip;
                document.getElementById('kvStatus').innerText = data.hasKV ? 'D1/KV OK' : 'Missing';
            } catch (e) { document.getElementById('reqCount').innerText = 'N/A'; }
        }

        async function loadLogs() {
            try {
                const res = await fetch('?flag=get_logs');
                const data = await res.json();
                let html = '';
                if (data.type === 'd1' && Array.isArray(data.logs)) {
                    html = data.logs.map(log => \`<div class="log-entry"><span class="log-time">\${log.time}</span><span class="log-ip">\${log.ip}</span><span class="log-loc">\${log.region}</span><span class="log-tag">\${log.action}</span></div>\`).join('');
                } else if (data.logs && typeof data.logs === 'string') {
                     html = data.logs.split('\\n').filter(x=>x).slice(0, 50).map(line => {
                        const p = line.split('|');
                        return \`<div class="log-entry"><span class="log-time">\${p[0]}</span><span class="log-ip">\${p[1]}</span><span class="log-loc">\${p[2]}</span><span class="log-tag">\${p[3]}</span></div>\`;
                    }).join('');
                }
                document.getElementById('logBox').innerHTML = html || '暂无日志';
            } catch(e) { document.getElementById('logBox').innerText = '加载失败或未绑定 DB/KV'; }
        }

        async function loadBans() {
            try {
                const res = await fetch('?flag=get_bans');
                const data = await res.json();
                const list = data.list || [];
                const html = list.length ? list.map(ip => \`<tr><td>\${ip}</td><td><button class="btn-del" onclick="delBan('\${ip}')">删除</button></td></tr>\`).join('') : '<tr><td colspan="2" style="text-align:center">暂无封禁 IP</td></tr>';
                document.getElementById('banListBody').innerHTML = html;
            } catch(e) { document.getElementById('banListBody').innerHTML = '<tr><td colspan="2">加载失败</td></tr>'; }
        }

        async function addBan() {
            const ip = document.getElementById('newBanIp').value.trim();
            if(!ip) return;
            try {
                await fetch('?flag=add_ban', { method:'POST', body:JSON.stringify({ip}) });
                document.getElementById('newBanIp').value = '';
                loadBans();
            } catch(e) { alert('添加失败'); }
        }

        async function delBan(ip) {
            if(!confirm('确定解封 '+ip+'?')) return;
            try { await fetch('?flag=del_ban', { method:'POST', body:JSON.stringify({ip}) }); loadBans(); } catch(e) { alert('删除失败'); }
        }

        async function saveConfig(data, modalId) {
            try {
                await fetch('?flag=save_config', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
                alert('保存成功'); closeModal(modalId);
                setTimeout(() => location.reload(), 500);
            } catch(e) { alert('保存失败: ' + e); }
        }
        
        async function validateApi(type) {
            const endpoint = type === 'tg' ? 'validate_tg' : 'validate_cf';
            let payload = {};
            if(type === 'tg') payload = { TG_BOT_TOKEN: val('tgToken'), TG_CHAT_ID: val('tgId') };
            else payload = { CF_ID:val('cfAcc'), CF_TOKEN:val('cfTok'), CF_EMAIL:val('cfMail'), CF_KEY:val('cfKey') };
            try {
                const res = await fetch('?flag=' + endpoint, { method:'POST', body:JSON.stringify(payload) });
                const d = await res.json();
                alert(d.msg || (d.success ? '验证通过' : '验证失败'));
            } catch(e) { alert('请求错误'); }
        }

        function toggleTheme() { document.body.classList.toggle('light'); }

        function updateLink() {
            let base = document.getElementById('subDom').value.trim();
            let host = document.getElementById('hostDom').value.trim();
            let p = document.getElementById('pIp').value.trim();
            let isClash = document.getElementById('clashMode').checked;
            let path = p ? "/proxyip=" + p : "/";
            const search = new URLSearchParams();
            search.set('uuid', UUID); search.set('encryption', 'none'); search.set('security', 'tls'); search.set('sni', host); search.set('alpn', 'h3'); search.set('fp', 'random'); search.set('allowInsecure', '1'); search.set('type', 'ws'); search.set('host', host); search.set('path', path);
            let finalUrl = \`https://\${base}/sub?\${search.toString()}\`;
            if (isClash) {
                let subUrl = CONVERTER + "/sub?target=clash&url=" + encodeURIComponent(finalUrl) + "&emoji=true&list=false&sort=false";
                document.getElementById('finalLink').value = subUrl;
            } else { document.getElementById('finalLink').value = finalUrl; }
        }

        function toggleClash() { updateLink(); }
        function copyId(id) { const el = document.getElementById(id); el.select(); navigator.clipboard.writeText(el.value).then(() => { const t = document.getElementById('toast'); t.classList.add('show'); t.style.opacity=1; setTimeout(() => t.style.opacity=0, 2000); }); }
        function checkProxy() { fetch('?flag=log_proxy_check'); window.open("${PROXY_CHECK_URL}", "_blank"); }
        function logout() { document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; sessionStorage.removeItem("is_active"); location.reload(); }

        // Init
        updateStats(); loadLogs(); loadBans(); updateLink();
    </script>
</body>
</html>`;
}

// 导出放在最后，确保所有函数都已定义
export default {
  async fetch(r, env, ctx) { 
    try {
      const url = new URL(r.url);
      const host = url.hostname; 
      const UA = (r.headers.get('User-Agent') || "").toLowerCase();
      const clientIP = r.headers.get('cf-connecting-ip');
      const country = r.cf?.country || 'UNK';
      const city = r.cf?.city || 'Unknown';

      // 加载变量
      const _UUID = env.KEY ? await getDynamicUUID(env.KEY, env.UUID_REFRESH || 86400) : (await getSafeEnv(env, 'UUID', UUID));
      const _WEB_PW = await getSafeEnv(env, 'WEB_PASSWORD', WEB_PASSWORD);
      const _SUB_PW = await getSafeEnv(env, 'SUB_PASSWORD', SUB_PASSWORD);
      const _PROXY_IP = await getSafeEnv(env, 'PROXYIP', DEFAULT_PROXY_IP);
      const _PS = await getSafeEnv(env, 'PS', ""); // 获取 PS 变量
      
      let _SUB_DOMAIN = await getSafeEnv(env, 'SUB_DOMAIN', DEFAULT_SUB_DOMAIN);
      let _CONVERTER = await getSafeEnv(env, 'SUBAPI', DEFAULT_CONVERTER);

      if (_SUB_DOMAIN.includes("://")) _SUB_DOMAIN = _SUB_DOMAIN.split("://")[1];
      if (_SUB_DOMAIN.includes("/")) _SUB_DOMAIN = _SUB_DOMAIN.split("/")[0];
      if (_CONVERTER.endsWith("/")) _CONVERTER = _CONVERTER.slice(0, -1);
      if (!_CONVERTER.includes("://")) _CONVERTER = "https://" + _CONVERTER;

      // 1. UA 爬虫过滤 (静默拦截)
      const UA_L = UA.toLowerCase();
      if (UA_L.includes('spider') || UA_L.includes('bot') || UA_L.includes('python') || UA_L.includes('scrapy') || UA_L.includes('curl') || UA_L.includes('wget')) {
          return new Response('Not Found', { status: 404 });
      }

      // 身份识别
      const wl = await getSafeEnv(env, 'WL_IP', "");
      let isAdmin = wl && wl.includes(clientIP);
      if (!isAdmin && _WEB_PW) {
          const cookie = r.headers.get('Cookie') || "";
          if (cookie.includes(`auth=${_WEB_PW}`)) isAdmin = true;
      }

      // 黑名单拦截
      if (!isAdmin) {
        const bj = await getSafeEnv(env, 'BJ_IP', "");
        if (bj && bj.includes(clientIP)) return new Response("403 Forbidden", { status: 403 });
        if (await checkBan(env, clientIP)) return new Response("403 Forbidden", { status: 403 });
      }

      if (url.pathname === '/favicon.ico') return new Response(null, { status: 404 });

      // 🟢 API 接口
      const flag = url.searchParams.get('flag');
      if (flag) {
          if (flag === 'github') {
              await sendTgMsg(ctx, env, "🌟 用户点击了烈火项目", r, "来源: 登录页面直达链接", isAdmin);
              return new Response(null, { status: 204 });
          }
          if (flag === 'log_proxy_check') {
              await sendTgMsg(ctx, env, "🔍 用户点击了 ProxyIP 检测", r, "来源: 后台管理面板", isAdmin);
              return new Response(null, { status: 204 });
          }

          if (flag === 'stats') {
              let reqCount = await incrementDailyStats(env);
              const cfStats = await getCloudflareUsage(env);
              const finalReq = cfStats.success ? `${cfStats.total} (API)` : `${reqCount} (Internal)`;
              const hasKV = !!(env.DB || env.LH);
              const cfConfigured = cfStats.success || (!!await getSafeEnv(env, 'CF_EMAIL', "") && !!await getSafeEnv(env, 'CF_KEY', ""));

              return new Response(JSON.stringify({
                  req: finalReq,
                  ip: clientIP,
                  loc: `${city}, ${country}`,
                  hasKV: hasKV,
                  cfConfigured: cfConfigured
              }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (flag === 'get_logs') {
              if (env.DB) { try { const { results } = await env.DB.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 50").all(); return new Response(JSON.stringify({ type: 'd1', logs: results }), { headers: { 'Content-Type': 'application/json' } }); } catch(e) {} }
              else if (env.LH) { try { const logs = await env.LH.get('ACCESS_LOGS') || ""; return new Response(JSON.stringify({ type: 'kv', logs: logs }), { headers: { 'Content-Type': 'application/json' } }); } catch(e) {} }
              return new Response(JSON.stringify({ logs: "No Storage" }), { headers: { 'Content-Type': 'application/json' } });
          }

          // 黑名单 API
          if (flag === 'get_bans') { return new Response(JSON.stringify({ list: await getBanList(env) }), { headers: { 'Content-Type': 'application/json' } }); }
          if (flag === 'add_ban' && r.method === 'POST') {
              const body = await r.json(); if(body.ip) await banIP(env, body.ip);
              return new Response(JSON.stringify({status:'ok'}), {headers:{'Content-Type':'application/json'}});
          }
          if (flag === 'del_ban' && r.method === 'POST') {
              const body = await r.json(); if(body.ip) await unbanIP(env, body.ip);
              return new Response(JSON.stringify({status:'ok'}), {headers:{'Content-Type':'application/json'}});
          }

          // 配置验证 API
          if (flag === 'validate_tg' && r.method === 'POST') {
              const body = await r.json();
              await sendTgMsg(ctx, { TG_BOT_TOKEN: body.TG_BOT_TOKEN, TG_CHAT_ID: body.TG_CHAT_ID }, "🤖 TG 推送可用性验证", r, "配置有效", true);
              return new Response(JSON.stringify({success:true, msg:"验证消息已发送"}), {headers:{'Content-Type':'application/json'}});
          }
          if (flag === 'validate_cf' && r.method === 'POST') {
              const body = await r.json();
              const res = await getCloudflareUsage(body);
              return new Response(JSON.stringify({success:res.success, msg: res.success ? `验证通过: 总请求 ${res.total}` : `验证失败: ${res.msg}`}), {headers:{'Content-Type':'application/json'}});
          }
          if (flag === 'save_config' && r.method === 'POST') {
              try {
                  const body = await r.json();
                  for (const [k, v] of Object.entries(body)) {
                      if (env.DB) await env.DB.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(k, v, v).run();
                      if (env.LH) await env.LH.put(k, v);
                  }
                  return new Response(JSON.stringify({status: 'ok'}), { headers: { 'Content-Type': 'application/json' } });
              } catch(e) { return new Response(JSON.stringify({status: 'error', msg: e.toString()}), { headers: { 'Content-Type': 'application/json' } }); }
          }
      }

      // 🛡️ 自动防刷与计数 (非 Websocket 请求触发)
      if (env.DB || env.LH) {
          ctx.waitUntil(incrementDailyStats(env));
          if (!isAdmin && r.headers.get('Upgrade') !== 'websocket') {
              // 检查 Flood (>= 5次)
              const isFlood = await checkFlood(env, clientIP);
              if (isFlood) {
                  const alreadyBanned = await checkBan(env, clientIP);
                  if (!alreadyBanned) {
                      await banIP(env, clientIP);
                      await sendTgMsg(ctx, env, "🚫 自动封禁通知 (首次)", r, `原因: 频繁请求 (>=5次)\n来源 IP: ${clientIP}`, false);
                  }
                  return new Response("403 Forbidden", { status: 403 });
              }
          }
      }

      // 🟢 订阅接口
      if (_SUB_PW && url.pathname === `/${_SUB_PW}`) {
          ctx.waitUntil(logAccess(env, clientIP, `${city},${country}`, "订阅更新"));
          const isFlagged = url.searchParams.has('flag');
          if (!isFlagged) {
             // 仅管理员发通知，陌生人静默
             if (isAdmin) {
                 const p = sendTgMsg(ctx, env, "🔄 管理员订阅更新", r, "", true);
                 if(ctx && ctx.waitUntil) ctx.waitUntil(p);
             }
          }

          const requestProxyIp = url.searchParams.get('proxyip') || _PROXY_IP;
          const pathParam = requestProxyIp ? "/proxyip=" + requestProxyIp : "/";
          const subUrl = `https://${_SUB_DOMAIN}/sub?uuid=${_UUID}&encryption=none&security=tls&sni=${host}&alpn=h3&fp=random&allowInsecure=1&type=ws&host=${host}&path=${encodeURIComponent(pathParam)}`;

          const UA_L = UA.toLowerCase();
          if (UA_L.includes('sing-box') || UA_L.includes('singbox') || UA_L.includes('clash') || UA_L.includes('meta')) {
              const type = (UA_L.includes('clash') || UA_L.includes('meta')) ? 'clash' : 'singbox';
              const config = type === 'clash' ? CLASH_CONFIG : SINGBOX_CONFIG_V12;
              const subApi = `${_CONVERTER}/sub?target=${type}&url=${encodeURIComponent(subUrl)}&config=${encodeURIComponent(config)}&emoji=true&list=false&sort=false&fdn=false&scv=false`;
              try {
                  const res = await fetch(subApi);
                  return new Response(res.body, { status: 200, headers: res.headers });
              } catch(e) {}
          }

          try {
              const res = await fetch(subUrl, { headers: { 'User-Agent': UA } });
              if (res.ok) {
                  let body = await res.text();
                  if (_PS) {
                      try {
                          const decoded = atob(body); 
                          const modified = decoded.split('\n').map(line => {
                              line = line.trim();
                              if (!line || !line.includes('://')) return line;
                              if (line.includes('#')) return line + encodeURIComponent(` ${_PS}`);
                              return line + '#' + encodeURIComponent(_PS);
                          }).join('\n');
                          body = btoa(modified); 
                      } catch(e) {
                           if(body.includes('://')) {
                               body = body.split('\n').map(line => {
                                   line = line.trim();
                                   if (!line || !line.includes('://')) return line;
                                   if (line.includes('#')) return line + encodeURIComponent(` ${_PS}`);
                                   return line + '#' + encodeURIComponent(_PS);
                               }).join('\n');
                           }
                      }
                  }
                  return new Response(body, { status: 200, headers: res.headers });
              }
          } catch(e) {}

          const allIPs = await getCustomIPs(env);
          const listText = genNodes(host, _UUID, requestProxyIp, allIPs, _PS);
          return new Response(btoa(unescape(encodeURIComponent(listText))), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      // 🟢 常规订阅 /sub
      if (url.pathname === '/sub') {
          ctx.waitUntil(logAccess(env, clientIP, `${city},${country}`, "常规订阅"));
          const requestUUID = url.searchParams.get('uuid');
          if (requestUUID.toLowerCase() !== _UUID.toLowerCase()) return new Response('Invalid UUID', { status: 403 });
          
          let proxyIp = url.searchParams.get('proxyip') || _PROXY_IP;
          const pathParam = url.searchParams.get('path');
          if (pathParam && pathParam.includes('/proxyip=')) proxyIp = pathParam.split('/proxyip=')[1];
          
          const allIPs = await getCustomIPs(env);
          const listText = genNodes(host, _UUID, proxyIp, allIPs, _PS);
          return new Response(btoa(unescape(encodeURIComponent(listText))), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      // 🟢 面板逻辑 (HTTP)
      if (r.headers.get('Upgrade') !== 'websocket') {
          const noCacheHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
          
          // 1. 服务端鉴权：未设置密码时，强制假装“未登录”，迫使显示登录页（且无法进入）
          let hasPassword = !!_WEB_PW;
          let isAuthorized = false;

          if (hasPassword) {
              const cookie = r.headers.get('Cookie') || "";
              const match = cookie.match(/auth=([^;]+)/);
              if (match && match[1] === _WEB_PW) {
                  isAuthorized = true;
              }
          } 
          // else: 密码未设置，isAuthorized 默认为 false，直接跳登录页

          // 2. 鉴权失败/未登录：显示登录页
          if (!isAuthorized) {
              return new Response(loginPage(TG_GROUP_URL, TG_CHANNEL_URL), { status: 200, headers: noCacheHeaders });
          }

          // 3. 鉴权成功：进入后台
          await sendTgMsg(ctx, env, "✅ 后台登录成功", r, "进入管理面板", true);
          ctx.waitUntil(logAccess(env, clientIP, `${city},${country}`, "登录后台"));
          
          const tgState = !!(await getSafeEnv(env, 'TG_BOT_TOKEN', '')) && !!(await getSafeEnv(env, 'TG_CHAT_ID', ''));
          const cfState = (!!(await getSafeEnv(env, 'CF_ID', '')) && !!(await getSafeEnv(env, 'CF_TOKEN', ''))) || (!!(await getSafeEnv(env, 'CF_EMAIL', '')) && !!(await getSafeEnv(env, 'CF_KEY', '')));
          
          return new Response(dashPage(url.hostname, _UUID, _PROXY_IP, _SUB_PW, _SUB_DOMAIN, _CONVERTER, env, clientIP, hasPassword, tgState, cfState), { status: 200, headers: noCacheHeaders });
      }
      
      // 🟣 代理逻辑 (WebSocket)
      let proxyIPConfig = null;
      if (url.pathname.includes('/proxyip=')) {
        try {
          const proxyParam = url.pathname.split('/proxyip=')[1].split('/')[0];
          const [address, port] = await parseIP(proxyParam); 
          proxyIPConfig = { address, port: +port }; 
        } catch (e) { console.error(e); }
      }
      const { 0: c, 1: s } = new WebSocketPair(); s.accept(); 
      handle(s, proxyIPConfig, _UUID); 
      return new Response(null, { status: 101, webSocket: c });

    } catch (err) {
      return new Response(err.toString(), { status: 500 });
    }
  }
};
