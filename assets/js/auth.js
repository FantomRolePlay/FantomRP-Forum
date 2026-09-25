const KEY='fantomrp_accounts_v3', OLD_KEYS=['fantomrp_accounts_v2','fantomrp_accounts_v1'];
const SESSION='fantomrp_session_v3', OLD_SESSIONS=['fantomrp_session_v2','fantomrp_session_v1'];
const TOPICS='fantomrp_topics_v3';
const ROLES=['Форумный администратор "Infinity"','Форумный администратор "Eclips"'];
const AUTO_MESSAGES=['Здравствуйте! Сейчас займусь вами.','Здравствуйте! Ваша тема принята в работу.','Пожалуйста, ожидайте ответа администрации.','Спасибо за обращение. Информация проверяется.'];

// Supabase realtime
const SUPABASE_URL='https://dkkfxdtnvehixpszagss.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_gRLeNc_a0ev9LK5hOb8Ppw_XpXTt7sK';
let supa=null, cloudReady=false;
function initSupabase(){
  try{
    if(!window.supabase||!window.supabase.createClient)return false;
    supa=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
    cloudReady=true;
    return true;
  }catch(e){console.error('Supabase init failed',e);return false}
}
async function cloudUpsertTopics(list){
  if(!cloudReady||!supa)return;
  try{
    const rows=list.map(t=>({id:String(t.id),payload:t,updated_at:t._updatedAt||new Date().toISOString()}));
    if(rows.length) await supa.from('forum_topics').upsert(rows,{onConflict:'id'});
  }catch(e){console.error('Supabase topic sync failed',e)}
}
async function cloudDeleteTopic(id){
  if(!cloudReady||!supa)return;
  try{await supa.from('forum_topics').delete().eq('id',String(id))}catch(e){console.error('Supabase delete failed',e)}
}
function applyCloudTopics(rows){
  const local=getTopics(); const map=new Map(local.map(t=>[String(t.id),t]));
  (rows||[]).forEach(r=>{const incoming=r.payload||r; const id=String(incoming.id||r.id); const old=map.get(id); const ni=new Date(incoming._updatedAt||r.updated_at||0).getTime(); const oi=new Date(old?._updatedAt||0).getTime(); if(!old||ni>=oi)map.set(id,incoming)});
  const merged=[...map.values()];
  localStorage.setItem(TOPICS,JSON.stringify(merged));
  renderTopicList(); renderTopic(); renderAdminPanel();
  return merged;
}
async function initRealtime(){
  if(!initSupabase())return;
  try{
    const {data,error}=await supa.from('forum_topics').select('id,payload,updated_at').order('updated_at',{ascending:true});
    if(error)throw error;
    const local=getTopics();
    if((data||[]).length===0 && local.length){await cloudUpsertTopics(local)}
    else applyCloudTopics(data||[]);
    supa.channel('fantomrp-topics-realtime').on('postgres_changes',{event:'*',schema:'public',table:'forum_topics'},payload=>{
      if(payload.eventType==='DELETE'){
        const id=String(payload.old?.id||''); const next=getTopics().filter(t=>String(t.id)!==id); localStorage.setItem(TOPICS,JSON.stringify(next));
      }else{
        const row=payload.new||{}; const incoming=row.payload; if(incoming){const next=getTopics().filter(t=>String(t.id)!==String(incoming.id)); next.push(incoming); localStorage.setItem(TOPICS,JSON.stringify(next));}
      }
      renderTopicList();renderTopic();renderAdminPanel();
    }).subscribe();
  }catch(e){console.error('Supabase realtime setup failed',e)}
}

function safeParse(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'');return v??fallback}catch{return fallback}}
function normalize(a){return (Array.isArray(a)?a:[]).filter(x=>x&&x.login).map(x=>({...x,login:String(x.login),email:String(x.email||'').toLowerCase(),password:String(x.password||''),nickname:String(x.nickname||x.login),avatar:String(x.avatar||''),role:x.role||'Пользователь',banned:!!x.banned}))}
function accounts(){let a=normalize(safeParse(KEY,[]));if(!a.length){for(const k of OLD_KEYS){const old=normalize(safeParse(k,[]));if(old.length){a=old;break}}}return a}
function saveAccounts(a){localStorage.setItem(KEY,JSON.stringify(a))}
function currentUser(){let login=localStorage.getItem(SESSION);if(!login){for(const k of OLD_SESSIONS){login=localStorage.getItem(k);if(login)break}}return accounts().find(x=>x.login.toLowerCase()===String(login||'').toLowerCase())||null}
function getTopics(){return safeParse(TOPICS,[])}
function saveTopics(x){try{const now=new Date().toISOString();x.forEach(t=>t._updatedAt=now);localStorage.setItem(TOPICS,JSON.stringify(x));cloudUpsertTopics(x);return true}catch(e){alert('Не удалось сохранить данные. Возможно, файлы слишком большие.');return false}}
function initials(s){return (s||'?').slice(0,1).toUpperCase()}
function isLeader(u=currentUser()){return !!u&&u.login.toLowerCase()==='rostislavangel'&&u.role==='Руководитель Проекта'}
function isForumAdmin(u=currentUser()){return !!u&&(isLeader(u)||ROLES.includes(u.role))}
function canCreate(section){const u=currentUser();return !!u&&(isForumAdmin(u)||['support','complaints'].includes(section))}
function topicServer(t){return String(t&&t.server||'infinity').toLowerCase()}
function adminCanManageTopic(t){const u=currentUser();if(!u||!isForumAdmin(u))return false;if(isLeader(u)||t.section==='support')return true;return (u.role.includes('Infinity')&&topicServer(t)==='infinity')||(u.role.includes('Eclips')&&topicServer(t)==='eclips')}
function canReply(t){return adminCanManageTopic(t)}
function ensureLeader(){let a=accounts(),u=a.find(x=>x.login.toLowerCase()==='rostislavangel');if(!u){u={login:'RostislavAngel',email:'',password:'',nickname:'RostislavAngel',role:'Руководитель Проекта',avatar:''};a.push(u)}else{u.role='Руководитель Проекта';u.nickname=u.nickname||u.login}saveAccounts(a)}
function updateHeader(){document.querySelectorAll('[data-auth]').forEach(x=>x.remove());const box=document.querySelector('.auth');if(!box)return;const u=currentUser();if(u){const base=location.pathname.includes('/pages/')?'':'pages/';const admin=isLeader(u)?`<a class="adminLink" data-auth href="${base}admin.html">Админ-панель</a>`:'';box.innerHTML=`${admin}<a class="profile" data-auth href="${base}profile.html"><div class="avatar">${u.avatar?`<img src="${esc(u.avatar)}">`:initials(u.nickname||u.login)}</div><span class="user">${esc(u.nickname||u.login)}</span></a><span class="logout" data-auth onclick="logout()">Выйти</span>`}}
function logout(){localStorage.removeItem(SESSION);window.location.href=location.pathname.includes('/pages/')?'../index.html':'index.html'}
function registerForm(){
  const f=document.getElementById("registerForm");
  if(!f)return;
  f.addEventListener("submit",function(e){
    e.preventDefault();
    try{
      const loginEl=document.getElementById("regLogin"), emailEl=document.getElementById("regEmail"), pEl=document.getElementById("regPassword"), p2El=document.getElementById("regPassword2");
      const login=(loginEl?.value||"").trim(), email=(emailEl?.value||"").trim().toLowerCase(), p=pEl?.value||"", p2=p2El?.value||"";
      const msg=document.getElementById("msg"), fail=m=>{if(msg)msg.textContent=m};
      if(login.length<3)return fail("Логин должен содержать минимум 3 символа.");
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Введите корректный email.");
      if(p.length<6)return fail("Пароль минимум 6 символов.");
      if(p!==p2)return fail("Пароли не совпадают.");
      let a=accounts();
      if(a.some(x=>String(x.login||"").toLowerCase()===login.toLowerCase()))return fail("Такой логин уже зарегистрирован.");
      if(a.some(x=>String(x.email||"").toLowerCase()===email))return fail("Этот email уже зарегистрирован.");
      a.push({login,email,password:p,nickname:login,avatar:"",role:"Пользователь",created:new Date().toISOString()});
      saveAccounts(a);
      localStorage.setItem(SESSION,login);
      window.location.replace("../index.html");
    }catch(err){console.error(err);const msg=document.getElementById("msg");if(msg)msg.textContent="Ошибка регистрации. Откройте страницу заново (Ctrl+F5).";}
  });
}
function loginForm(){
  const f=document.getElementById("loginForm");
  if(!f)return;
  f.addEventListener("submit",function(e){
    e.preventDefault();
    try{
      const login=(document.getElementById("loginField")?.value||"").trim().toLowerCase();
      const p=document.getElementById("passwordField")?.value||"";
      const msg=document.getElementById("msg");
      const u=accounts().find(x=>(String(x.login||"").toLowerCase()===login||String(x.email||"").toLowerCase()===login)&&String(x.password||"")===p);
      if(!u){if(msg)msg.textContent="Неверный логин/email или пароль.";return;}
      localStorage.setItem(SESSION,u.login);
      window.location.replace("../index.html");
    }catch(err){console.error(err);const msg=document.getElementById("msg");if(msg)msg.textContent="Ошибка входа. Откройте страницу заново (Ctrl+F5).";}
  });
}
function resetLocalAccounts(){if(!confirm('Удалить локальные аккаунты, роли, темы и текущую сессию этого браузера?'))return;[KEY,...OLD_KEYS,SESSION,...OLD_SESSIONS,TOPICS].forEach(k=>localStorage.removeItem(k));location.href='register.html'}
function profileForm(){const f=document.getElementById('profileForm');if(!f)return;const u=currentUser();if(!u)return location.href='login.html';f.nickname.value=u.nickname||u.login;f.avatar.value=u.avatar&&u.avatar.startsWith('http')?u.avatar:'';const file=document.getElementById('avatarFile'),preview=document.getElementById('formAvatar'),top=document.getElementById('previewAvatar');function draw(src){const html=src?`<img src="${esc(src)}">`:initials(f.nickname.value||u.login);preview.innerHTML=html;top.innerHTML=html}draw(u.avatar||'');file&&file.addEventListener('change',()=>{const blob=file.files&&file.files[0];if(!blob)return;if(blob.size>3*1024*1024){file.value='';return alert('Аватар должен быть меньше 3 МБ.')}const r=new FileReader();r.onload=()=>{f.dataset.avatar=r.result;draw(r.result)};r.readAsDataURL(blob)});document.getElementById('removeAvatar')?.addEventListener('click',()=>{f.dataset.avatar='';f.avatar.value='';file.value='';draw('')});f.nickname.addEventListener('input',()=>{document.getElementById('previewName').textContent=f.nickname.value.trim()||u.login;draw(f.dataset.avatar||u.avatar||'')});f.addEventListener('submit',e=>{e.preventDefault();let a=accounts(),x=a.find(z=>z.login===u.login);x.nickname=f.nickname.value.trim()||x.login;x.avatar=f.dataset.avatar!==undefined?f.dataset.avatar:f.avatar.value.trim();saveAccounts(a);document.getElementById('msg').textContent='Профиль сохранён.';setTimeout(()=>location.reload(),400)})}
function adminPanel(){const root=document.getElementById('adminPanel');if(!root)return;const u=currentUser();if(!isLeader(u)){root.innerHTML='';return}let a=accounts().filter(x=>x.login.toLowerCase()!=='rostislavangel');root.innerHTML=`<div class="adminBox"><h2>Управление ролями</h2>${a.map(x=>`<div class="userRow"><div><b>${esc(x.nickname||x.login)}</b><small>${esc(x.login)} · ${esc(x.role||'Пользователь')}</small></div><select data-role="${esc(x.login)}"><option value="Пользователь">Пользователь</option>${ROLES.map(r=>`<option ${x.role===r?'selected':''}>${r}</option>`).join('')}</select><button class="btn orange" onclick="setRole('${String(x.login).replace(/'/g,"\\'")}')">Сохранить</button></div>`).join('')}</div>`}
function setRole(login){if(!isLeader())return;const sel=document.querySelector(`[data-role="${CSS.escape(login)}"]`),a=accounts(),u=a.find(x=>x.login===login);if(u&&sel){u.role=sel.value;saveAccounts(a);adminPanel()}}
function readFile(file,cb,max=4*1024*1024){if(!file)return cb(null);if(file.size>max)return alert('Файл должен быть меньше 4 МБ.');const r=new FileReader();r.onload=()=>cb({name:file.name,type:file.type,data:r.result});r.readAsDataURL(file)}
function createTopicForm(){
  const f=document.getElementById('topicForm');
  if(!f)return;
  const params=new URLSearchParams(location.search);
  const type=params.get('type')||'';
  const complaintTypes=['players','leaders','admins','amnesty','leader','moderator'];
  const section=complaintTypes.includes(type)?'complaints':'support';
  f.dataset.section=section;
  f.dataset.topicType=section==='complaints'?type:'';
  if(!canCreate(section)){f.innerHTML='<div class="notice">Для создания тем нужно войти в аккаунт.</div>';return}
  if(currentUser().banned){f.innerHTML='<div class="notice">Ваш аккаунт заблокирован на форуме. Создание новых тем недоступно.</div>';return}
  f.addEventListener('submit',e=>{
    e.preventDefault();
    const title=f.title.value.trim(),body=f.body.value.trim();
    if(!title||!body)return;
    readFile(f.attachment?.files?.[0],attachment=>{
      let t=getTopics();
      const topic={id:Date.now(),section,topicType:f.dataset.topicType||'',server:(f.dataset.server||new URLSearchParams(location.search).get('server')||'infinity').toLowerCase(),title,body,attachment,author:currentUser().nickname||currentUser().login,login:currentUser().login,replies:[],status:'open',acceptedBy:null,created:new Date().toISOString()};
      t.push(topic);
      if(saveTopics(t))location.href=`topic.html?id=${topic.id}`;
    });
  });
}
function acceptTopic(id){const a=getTopics(),t=a.find(x=>x.id==id);if(!t||!adminCanManageTopic(t))return;if(!t)return;t.status='accepted';t.acceptedBy={login:currentUser().login,nickname:currentUser().nickname||currentUser().login,role:currentUser().role,at:new Date().toISOString()};saveTopics(a);renderTopic()}
function closeTopic(id){const a=getTopics(),t=a.find(x=>x.id==id);if(!t||!adminCanManageTopic(t))return;if(!t)return;t.status='closed';t.closedBy={login:currentUser().login,nickname:currentUser().nickname||currentUser().login,role:currentUser().role,at:new Date().toISOString()};saveTopics(a);renderTopic()}
function reopenTopic(id){const a=getTopics(),t=a.find(x=>x.id==id);if(!t||!adminCanManageTopic(t))return;if(!t)return;t.status='open';t.closedBy=null;saveTopics(a);renderTopic()}
function deleteTopic(id){if(!isLeader())return;const a=getTopics();const t=a.find(x=>x.id==id);if(!t)return;if(!confirm('Удалить эту тему без возможности восстановления?'))return;saveTopics(a.filter(x=>x.id!=id));cloudDeleteTopic(id);renderAdminPanel();}
function postReply(topicId,body,attachment,source='manual'){const a=getTopics(),t=a.find(x=>x.id==topicId);if(!t||!canReply(t))return false;if(!t||t.status==='closed')return false;t.replies.push({id:Date.now()+Math.random(),author:currentUser().nickname||currentUser().login,login:currentUser().login,role:currentUser().role,body,attachment,source,created:new Date().toISOString()});return saveTopics(a)}
function sendAutoMessage(topicId,text){const t=getTopics().find(x=>x.id==topicId);if(!t||!canReply(t)||!text.trim())return;postReply(topicId,text.trim(),null,'auto');renderTopic()}
function renderAutoPanel(t){if(!canReply(t))return '';return `<div class="autoPanel"><div class="autoPanelHead"><div><b>Панель быстрых сообщений</b><small>Отправить готовый ответ или написать свой</small></div></div><div class="autoBtns">${AUTO_MESSAGES.map(m=>`<button class="btn autoBtn" onclick="sendAutoMessage(${t.id},'${m.replace(/'/g,"\\'")}')">${esc(m)}</button>`).join('')}</div><div class="autoCustom"><textarea id="autoText" class="input" rows="3" placeholder="Своё сообщение..."></textarea><button class="btn orange" onclick="sendAutoMessage(${t.id},document.getElementById('autoText').value)">Отправить</button></div></div>`}
function renderAttachment(a){if(!a)return '';if((a.type||'').startsWith('image/'))return `<div class="attachment"><a href="${esc(a.data)}" target="_blank"><img src="${esc(a.data)}" alt="${esc(a.name)}"></a><small>${esc(a.name)}</small></div>`;return `<div class="attachment file"><a href="${esc(a.data)}" download="${esc(a.name)}">📎 ${esc(a.name)}</a></div>`}
function renderAdminTopics(){
  const root=document.getElementById('adminTopics');
  if(!root)return;
  if(!isLeader()){root.innerHTML='';return}
  const ts=getTopics();
  if(!ts.length){root.innerHTML='<div class="empty"><strong>Тем пока нет</strong><small>Новые темы появятся здесь автоматически.</small></div>';return}
  const groups={support:'Поддержка',complaints:'Жалобы и заявления'},order=['complaints','support'];
  let html='';
  order.forEach(sec=>{const list=ts.filter(t=>t.section===sec);if(!list.length)return;html+=`<section class="adminCategory"><div class="adminCategoryHead"><h2>${groups[sec]}</h2><span>${list.length} тем</span></div>${list.map(t=>{const kind=t.section==='support'?'Поддержка':(t.topicType&&['amnesty','leader','moderator'].includes(t.topicType)?'Заявление':t.topicType?'Жалоба':'Обращение');const status=t.status==='closed'?'Закрыта':t.status==='accepted'?'Принята':'Открыта';const close=t.status==='closed'?`<button class="btn" onclick="reopenTopicFromAdmin(${t.id})">Открыть</button>`:`<button class="btn" onclick="closeTopicFromAdmin(${t.id})">Закрыть</button>`;return `<div class="adminTopicRow"><div><div><span class="topicKind ${kind==='Заявление'?'application':kind==='Жалоба'?'complaint':'supportKind'}">${kind}</span> <b>${esc(t.title)}</b></div><small>${esc(t.author)} · ${status} · ${t.replies.length} ответов</small></div><div class="adminTopicActions"><a class="btn" href="topic.html?id=${encodeURIComponent(t.id)}">Открыть</a>${t.status!=='accepted'&&t.status!=='closed'?`<button class="btn orange" onclick="acceptTopicFromAdmin(${t.id})">Принять</button>`:''}${close}<button class="btn danger" onclick="deleteTopic(${t.id})">Удалить</button></div></div>`}).join('')}</section>`});
  root.innerHTML=html;
}
function adminEscLogin(login){return String(login).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function findAdminUser(q){const term=(q||'').trim().toLowerCase();if(!term)return null;return accounts().find(x=>String(x.login).toLowerCase()===term||String(x.nickname||'').toLowerCase()===term)||null}
function renderAdminRoles(){
  const root=document.getElementById('adminRoles');if(!root)return;if(!isLeader()){root.innerHTML='';return}
  root.innerHTML=`<div class="adminBox"><h2>Управление ролями</h2><p class="muted">Введите логин пользователя и найдите его.</p><div class="adminSearch"><input id="roleSearch" class="input" placeholder="Логин пользователя"><button class="btn orange" onclick="searchAdminRoleUser()">Найти</button></div><div id="roleSearchResult"></div></div>`;
}
function searchAdminRoleUser(){if(!isLeader())return;const root=document.getElementById('roleSearchResult'),u=findAdminUser(document.getElementById('roleSearch')?.value);if(!root)return;if(!u||u.login.toLowerCase()==='rostislavangel'){root.innerHTML='<div class="notice">Пользователь не найден.</div>';return}const has=ROLES.includes(u.role);root.innerHTML=`<div class="adminUserCard"><div><b>${esc(u.nickname||u.login)}</b><small>@${esc(u.login)} · ${esc(u.role||'Пользователь')}</small></div><button class="btn orange" onclick="openRoleModal('${adminEscLogin(u.login)}')">${has?'Забрать роль':'Выдать роль'}</button></div>`}
function openRoleModal(login){if(!isLeader())return;const u=accounts().find(x=>x.login===login);if(!u)return;const old=document.getElementById('roleModal');if(old)old.remove();document.body.insertAdjacentHTML('beforeend',`<div class="adminModal" id="roleModal"><div class="adminModalBox"><button class="modalClose" onclick="document.getElementById('roleModal').remove()">×</button><h2>${ROLES.includes(u.role)?'Забрать роль':'Выдать роль'}</h2><p class="muted">${esc(u.nickname||u.login)} · @${esc(u.login)}</p>${ROLES.includes(u.role)?`<button class="btn danger fullBtn" onclick="removeAdminRole('${adminEscLogin(u.login)}');document.getElementById('roleModal').remove()">Забрать роль «${esc(u.role)}»</button>`:ROLES.map(r=>`<button class="btn rolePick" onclick="giveAdminRole('${adminEscLogin(u.login)}','${adminEscLogin(r)}');document.getElementById('roleModal').remove()">${esc(r)}</button>`).join('')}</div></div>`)}
function giveAdminRole(login,role){if(!isLeader()||!ROLES.includes(role))return;const a=accounts(),u=a.find(x=>x.login===login);if(!u)return;u.role=role;saveAccounts(a);renderAdminRoles();document.getElementById('roleSearch').value=login;searchAdminRoleUser()}
function removeAdminRole(login){if(!isLeader())return;const a=accounts(),u=a.find(x=>x.login===login);if(!u)return;u.role='Пользователь';saveAccounts(a);renderAdminRoles();document.getElementById('roleSearch').value=login;searchAdminRoleUser()}
function renderAdminBans(){
  const root=document.getElementById('adminBans');if(!root)return;if(!isLeader()){root.innerHTML='';return}
  root.innerHTML=`<div class="adminBox"><h2>Блокировка форума</h2><p class="muted">Введите логин пользователя и найдите его.</p><div class="adminSearch"><input id="banSearch" class="input" placeholder="Логин пользователя"><button class="btn orange" onclick="searchAdminBanUser()">Найти</button></div><div id="banSearchResult"></div></div>`;
}
function searchAdminBanUser(){if(!isLeader())return;const root=document.getElementById('banSearchResult'),u=findAdminUser(document.getElementById('banSearch')?.value);if(!root)return;if(!u||u.login.toLowerCase()==='rostislavangel'){root.innerHTML='<div class="notice">Пользователь не найден.</div>';return}root.innerHTML=`<div class="adminUserCard"><div><b>${esc(u.nickname||u.login)}</b><small>@${esc(u.login)} · ${u.banned?'Доступ заблокирован':'Доступ разрешён'}</small></div><button class="btn ${u.banned?'orange':'danger'}" onclick="${u.banned?`unbanForumUser('${adminEscLogin(u.login)}')`:`banForumUser('${adminEscLogin(u.login)}')`};searchAdminBanUser()">${u.banned?'Разблокировать доступ':'Заблокировать доступ'}</button></div>`}
function banForumUser(login){if(!isLeader())return;const a=accounts(),u=a.find(x=>x.login===login);if(!u)return;if(!confirm('Заблокировать '+(u.nickname||u.login)+' на форуме?'))return;u.banned=true;saveAccounts(a)}
function unbanForumUser(login){if(!isLeader())return;const a=accounts(),u=a.find(x=>x.login===login);if(!u)return;u.banned=false;saveAccounts(a)}
function adminTab(name){if(!isLeader())return;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===name));const map={topics:'adminTopics',roles:'adminRoles',bans:'adminBans'};Object.keys(map).forEach(k=>{const el=document.getElementById(map[k]);if(el)el.style.display=k===name?'block':'none'})}
function renderAdminPanel(){renderAdminTopics();renderAdminRoles();renderAdminBans()}
function acceptTopicFromAdmin(id){acceptTopic(id);renderAdminPanel()}
function closeTopicFromAdmin(id){closeTopic(id);renderAdminPanel()}
function reopenTopicFromAdmin(id){reopenTopic(id);renderAdminPanel()}
function renderTopic(){const root=document.getElementById('topicView');if(!root)return;const id=new URLSearchParams(location.search).get('id'),t=getTopics().find(x=>String(x.id)===String(id));if(!t)return root.innerHTML='<div class="notice">Тема не найдена.</div>';const status=t.status==='closed'?'<span class="topicStatus closed">Закрыта</span>':t.status==='accepted'?'<span class="topicStatus accepted">Принята</span>':'<span class="topicStatus open">Открыта</span>';const accepted=t.acceptedBy?`<div class="acceptedInfo">✓ Тему принял <b>${esc(t.acceptedBy.nickname)}</b> · ${esc(t.acceptedBy.role)}</div>`:'';const controls=adminCanManageTopic(t)?`<div class="topicControls">${t.status==='closed'?`<button class="btn" onclick="reopenTopic(${t.id})">Открыть тему</button>`:`<button class="btn orange" onclick="acceptTopic(${t.id})">✓ Принять тему</button><button class="btn" onclick="closeTopic(${t.id})">Закрыть тему</button>`}</div>`:'';const posts=t.replies.map(r=>`<div class="post reply"><div class="postAuthor"><b>${esc(r.author)}</b><span>${esc(r.role||'Пользователь')}</span></div><p>${esc(r.body).replace(/\n/g,'<br>')}</p>${renderAttachment(r.attachment)}</div>`).join('');root.innerHTML=`<div class="topicToolbar"><a href="javascript:history.back()">← Назад</a>${status}</div><article class="topicCard"><div class="topicMeta"><span class="topicKind ${t.topicType&&['amnesty','leader','moderator'].includes(t.topicType)?'application':'complaint'}">${t.topicType&&['amnesty','leader','moderator'].includes(t.topicType)?'Заявление':t.topicType?'Жалоба':'Обращение'}</span> · ${new Date(t.created).toLocaleString('ru-RU')}</div><div class="topicTitleRow"><h1>${esc(t.title)}</h1>${controls}</div>${accepted}<div class="post firstPost"><div class="postAuthor"><b>${esc(t.author)}</b><span>Автор темы</span></div><p>${esc(t.body).replace(/\n/g,'<br>')}</p>${renderAttachment(t.attachment)}</div>${posts}</article>${renderAutoPanel(t)}${canReply(t)&&t.status!=='closed'?`<form id="replyForm" class="form wide"><h3>Ответить</h3><textarea class="input" name="body" rows="5" placeholder="Ваш ответ"></textarea><label class="fileBtn attachLabel">📎 Прикрепить файл<input type="file" id="replyFile" accept="image/*,.pdf,.txt,.doc,.docx"></label><div id="replyFileName" class="fileName"></div><button class="btn orange">Ответить</button></form>`:(t.status==='closed'?'<div class="notice">Тема закрыта. Новые сообщения недоступны.</div>':'<div class="notice">Отвечать в темах могут только форумные администраторы и Руководитель Проекта.</div>')}`;const rf=document.getElementById('replyForm');if(rf)rf.addEventListener('submit',e=>{e.preventDefault();const body=rf.body.value.trim();if(!body)return;readFile(document.getElementById('replyFile')?.files?.[0],a=>{if(postReply(t.id,body,a))renderTopic()})});document.getElementById('replyFile')?.addEventListener('change',e=>{document.getElementById('replyFileName').textContent=e.target.files[0]?.name||''})}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function renderTopicList(){
  document.querySelectorAll('[data-topic-list]').forEach(function(root){
    const section=root.dataset.topicList;
    const pageServer=String(root.dataset.server||new URLSearchParams(location.search).get('server')||'').toLowerCase();
    const ts=getTopics().filter(function(x){
      if(x.section!==section)return false;
      if(section==='complaints') return topicServer(x)=== (pageServer||'infinity');
      return true;
    });
    if(!ts.length){
      root.innerHTML='<div class="empty"><strong>Обращений пока нет</strong><small>Создайте первое обращение в этом разделе.</small></div>';
      return;
    }
    root.innerHTML=ts.map(function(t){
      const kind=t.section==='support'?'Поддержка':(t.topicType&&['amnesty','leader','moderator'].includes(t.topicType)?'Заявление':(t.topicType?'Жалоба':'Обращение'));
      const cls=kind==='Заявление'?'application':(kind==='Жалоба'?'complaint':'supportKind');
      const st=t.status==='closed'?' · 🔒':(t.status==='accepted'?' · ✓':'');
      const n=t.replies.length;
      const word=n===1?'ответ':(n>=2&&n<=4?'ответа':'ответов');
      return '<a class="topicRow" href="topic.html?id='+encodeURIComponent(t.id)+'"><div><div class="topicRowTop"><span class="topicKind '+cls+'">'+kind+'</span><b>'+esc(t.title)+st+'</b></div><small>'+esc(t.author)+' · '+n+' '+word+'</small></div><span>›</span></a>';
    }).join('');
  });
}
document.addEventListener('DOMContentLoaded',()=>{ensureLeader();updateHeader();registerForm();loginForm();profileForm();adminPanel();createTopicForm();renderTopic();renderTopicList();renderAdminPanel();if(document.getElementById('adminTopics')&&isLeader())adminTab('topics');const r=document.getElementById('resetLocal');if(r)r.addEventListener('click',resetLocalAccounts);initRealtime()});

window.addEventListener("error",e=>console.error("FantomRP error:",e.error||e.message));
