'use strict';
const KEY='done_mvp_v05'; // Preserva los datos de la versión anterior
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const makeId=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const pad=n=>String(n).padStart(2,'0');
const dateLocal=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate=s=>new Date(`${s}T12:00:00`);
const today=()=>dateLocal(new Date());
const addDays=(date,n)=>{let d=parseDate(date);d.setDate(d.getDate()+n);return dateLocal(d)};
const dayDistance=date=>Math.round((parseDate(date)-parseDate(today()))/86400000);
const weekday=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const fullWeekday=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const formatDate=date=>parseDate(date).toLocaleDateString('es-CL',{day:'numeric',month:'short'});
const minTime=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
const formatMinutes=n=>n>=60?`${Math.floor(n/60)} h${n%60?' '+n%60+' min':''}`:`${n} min`;
const clean=()=>({version:5,name:'',onboarded:false,tasks:[],events:[],chat:[{role:'bot',text:'¡Hola! 💜 Escríbeme tus pendientes en un mensaje: qué debes entregar, cuándo vence, cuánto tarda y qué falta hacer. Las organizaré y guardaré automáticamente. Si interpreto algún dato mal, puedes editarlo en Tareas.'}]});
function validateState(s){if(!s||!Array.isArray(s.tasks)||!Array.isArray(s.events))throw Error('Formato inválido');return {version:5,name:String(s.name||'').slice(0,40),onboarded:true,tasks:s.tasks.filter(x=>x&&typeof x.title==='string').slice(0,1000).map(t=>({id:String(t.id||makeId()),title:String(t.title).slice(0,120),subject:String(t.subject||'').slice(0,80),due:/^\d{4}-\d{2}-\d{2}$/.test(t.due)?t.due:today(),hours:Math.max(.5,Math.min(1000,Number(t.hours)||1)),priority:Math.max(1,Math.min(3,Number(t.priority)||2)),subs:Array.isArray(t.subs)?t.subs.slice(0,100).map(x=>({id:String(x.id||makeId()),title:String(x.title||'').slice(0,120),done:Boolean(x.done)})):[]})),events:s.events.filter(e=>e&&typeof e.title==='string'&&/^\d{2}:\d{2}$/.test(e.start||'')&&/^\d{2}:\d{2}$/.test(e.end||'')&&minTime(e.end)>minTime(e.start)).slice(0,1500).map(e=>({id:String(e.id||makeId()),title:String(e.title).slice(0,120),dow:Number(e.dow)%7,start:e.start,end:e.end,kind:e.kind==='once'?'once':'weekly',date:String(e.date||today())})),chat:Array.isArray(s.chat)?s.chat.slice(-70).map(m=>({role:m.role==='me'?'me':'bot',text:String(m.text||'').slice(0,1400)})):clean().chat}};
let data;try{data=validateState(JSON.parse(localStorage.getItem(KEY)))}catch{data=clean()}
let view='home',selectedDate=today(),taskFilter='all',weekOffset=0,pendingChat=null;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch{toast('No se pudieron guardar los datos. Revisa el almacenamiento del navegador.');return false}};
function commit(next,success){
  try {localStorage.setItem(KEY,JSON.stringify(next));data=next;return true}
  catch(err){console.error('Error al guardar Done?',err);toast('No se pudo guardar. Revisa los permisos de almacenamiento del navegador.');return false}
}
let toastTimer;function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300)}
function pct(t){return !t.subs.length?0:Math.round(t.subs.filter(s=>s.done).length*100/t.subs.length)}
function completed(t){return t.subs.length>0&&t.subs.every(x=>x.done)}
function pendingTasks(){return data.tasks.filter(t=>!completed(t)).sort((a,b)=>dayDistance(a.due)-dayDistance(b.due)||b.priority-a.priority||b.hours-a.hours)}
function score(t){let days=dayDistance(t.due);return (days<0?100:days===0?65:Math.max(0,45-days*4))+t.priority*9+Math.min(t.hours,20)*2+(100-pct(t))*.12}
function prioritized(){return pendingTasks().sort((a,b)=>score(b)-score(a))}
function eventOccurs(e,date){return e.kind==='weekly'?e.dow===parseDate(date).getDay():e.date===date}
function eventsOn(date){return data.events.filter(e=>eventOccurs(e,date)).sort((a,b)=>minTime(a.start)-minTime(b.start))}
function freeSlots(date){const START=8*60,END=21*60;let occupied=eventsOn(date).map(e=>[Math.max(START,minTime(e.start)),Math.min(END,minTime(e.end))]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);let cursor=START,free=[];for(let [a,b] of occupied){if(a>cursor&&a-cursor>=30)free.push([cursor,a]);cursor=Math.max(cursor,b)}if(END-cursor>=30)free.push([cursor,END]);if(date===today()){const now=new Date(),nowMin=now.getHours()*60+now.getMinutes();free=free.map(([a,b])=>[Math.max(a,nowMin),b]).filter(([a,b])=>b-a>=30)}return free}
function fmtTime(m){return `${pad(Math.floor(m/60))}:${pad(m%60)}`}
function suggestion(date=today()){let tasks=prioritized();if(!tasks.length)return null;let slot=freeSlots(date)[0]||null;return {task:tasks[0],slot,minutes:slot?Math.min(slot[1]-slot[0],Math.max(30,Math.round(tasks[0].hours*60*(1-pct(tasks[0])/100)))):0}}
// Propuestas de estudio sin reservar horarios permanentemente: las clases son los bloques fijos.
function studyBlocks(date){
  const relevant=prioritized().filter(t=>t.due>=date || (date===today() && t.due<date));
  const slots=freeSlots(date);
  const remaining=new Map(relevant.map(t=>[t.id,Math.max(30,Math.ceil(t.hours*60*(1-pct(t)/100)))]));
  const plan=[];
  for(const [start,end] of slots){
    let cursor=start;
    while(end-cursor>=30 && plan.length<5){
      const next=relevant.find(t=>(remaining.get(t.id)||0)>=30);
      if(!next)break;
      const minutes=Math.min(90,end-cursor,remaining.get(next.id));
      if(minutes<30)break;
      plan.push({type:'study',id:next.id,title:next.title,start:cursor,end:cursor+minutes,task:next});
      remaining.set(next.id,remaining.get(next.id)-minutes);
      cursor+=minutes;
    }
    if(plan.length>=5)break;
  }
  return plan;
}
function recommendationWidget(message, mood='happy'){
  return `<div class="widget" role="status"><img class="widget-art" src="${mood==='happy'?'assets/mascot-happy.png':mood==='focus'?'assets/mascot-focus.png':'assets/mascot-sleep.png'}" alt="Mascota de Done?"/><span class="widget-message">${message}</span></div>`;
}
function header(title,action=''){return `<header><h1>${title}</h1>${action}</header>`}
function taskCard(t){let progress=pct(t),done=completed(t);return `<article class="card task" data-task="${escapeHtml(t.id)}"><div class="taskhead"><div class="task-symbol">${done?'⭐':'📦'}</div><div class="grow"><div class="tasktitle">${escapeHtml(t.title)}</div><div class="taskmeta">${escapeHtml(t.subject||'Sin ramo')} · ${formatDate(t.due)} · ${t.hours} h ${dayDistance(t.due)<0&&!done?'· Vencida':''}</div></div><button class="iconbtn" data-action="edit-task" data-id="${escapeHtml(t.id)}" aria-label="Editar tarea">✎</button></div><div class="progress"><div style="width:${progress}%"></div></div><div class="row between sm" style="margin-top:6px"><span>${done?'Completada':'Progreso'}</span><b>${progress}%</b></div><div class="sublist">${t.subs.length?t.subs.map(s=>`<label><input type="checkbox" data-action="sub" data-task="${escapeHtml(t.id)}" data-sub="${escapeHtml(s.id)}" ${s.done?'checked':''}><span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${escapeHtml(s.title)}</span></label>`).join(''):'<span class="muted sm">Añade subtareas para medir el progreso.</span>'}</div></article>`}
function empty(label,desc,action){return `<div class="card empty"><strong>${label}</strong><p class="muted sm">${desc}</p><button class="button" data-action="${action}">Empezar</button></div>`}
function renderHome(){let tasks=prioritized(),sub=data.tasks.flatMap(t=>t.subs),rec=suggestion();return `${header('Hola'+(data.name?', '+escapeHtml(data.name):'')+' ✨','<button class="topbtn" data-view="settings">⚙ Ajustes</button>')}<section class="hero"><h2>Tu día, más ligero 💜</h2><p>Organiza tus entregas y descubre cuándo tienes tiempo para avanzar.</p><button class="button tiny" data-view="chat">Hablar con Done?</button></section><div class="stats"><div class="card"><div class="num">${tasks.length}</div><div class="sm">Pendientes</div></div><div class="card"><div class="num">${data.tasks.filter(completed).length}</div><div class="sm">Listas</div></div><div class="card"><div class="num">${sub.length?Math.round(sub.filter(s=>s.done).length/sub.length*100):0}%</div><div class="sm">Avance</div></div></div><div class="sectionhead"><h2>Recomendación</h2><span class="badge">Por prioridad y horario</span></div>${rec?recommendationWidget(rec.slot?`De ${fmtTime(rec.slot[0])} a ${fmtTime(rec.slot[0]+rec.minutes)} podrías avanzar ${escapeHtml(rec.task.title)}.`:`Prioriza ${escapeHtml(rec.task.title)}. No hay bloques libres de 30 min hoy.`,rec.slot?'happy':'focus'):recommendationWidget('¡Todo al día! Agrega una tarea para comenzar.','sleep')}<div class="sectionhead"><h2>Próximas entregas</h2><button class="button tiny secondary" data-action="new-task">+ Nueva</button></div>${tasks.length?tasks.slice(0,3).map(taskCard).join(''):empty('Sin tareas aún','Agrega tu primera entrega. Tu calendario empieza vacío.','new-task')}<div class="sectionhead"><h2>Hoy en tu horario</h2><button class="button tiny secondary" data-view="calendar">Ver horario</button></div><div class="card">${eventsOn(today()).length?eventsOn(today()).map(e=>`<div class="event"><span>📅</span><div>${escapeHtml(e.title)}<div class="sm muted">${e.start} – ${e.end}</div></div></div>`).join(''):'<div class="muted sm">Todavía no has agregado clases ni compromisos.</div>'}</div>`}
function renderTasks(){const shown=data.tasks.filter(t=>taskFilter==='all'||(taskFilter==='pending'?!completed(t):completed(t))).sort((a,b)=>a.due.localeCompare(b.due));return `${header('✓ Tareas','<button class="topbtn" data-action="new-task">+ Nueva</button>')}<div class="tabs"><button data-filter="all" class="${taskFilter==='all'?'active':''}">Todas</button><button data-filter="pending" class="${taskFilter==='pending'?'active':''}">Pendientes</button><button data-filter="done" class="${taskFilter==='done'?'active':''}">Completadas</button></div>${shown.length?shown.map(taskCard).join(''):empty('No hay tareas aquí','Crea tareas y divide tu trabajo en subtareas para seguir el avance.','new-task')}`}
function renderCalendar(){
  const monday=addDays(today(),-((parseDate(today()).getDay()+6)%7)+weekOffset*7);
  const days=Array.from({length:7},(_,i)=>addDays(monday,i));
  if(!days.includes(selectedDate))selectedDate=days[0];
  const classes=eventsOn(selectedDate);
  const plans=studyBlocks(selectedDate);
  const deadlines=data.tasks.filter(t=>t.due===selectedDate);
  const timeline=[...classes.map(e=>({type:'class',start:minTime(e.start),end:minTime(e.end),event:e})),...plans].sort((a,b)=>a.start-b.start||((a.type==='class')?-1:1));
  const dateTitle=parseDate(selectedDate).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
  return `${header('▦ Horario','<button class="topbtn" data-action="new-event">+ Clase</button>')}
  <div class="tabs"><button data-action="week-prev">‹ Anterior</button><button class="active" aria-live="polite">${formatDate(days[0])} – ${formatDate(days[6])}</button><button data-action="week-next">Siguiente ›</button></div>
  <div class="days">${days.map(d=>`<button class="day ${selectedDate===d?'active':''}" data-date="${d}" aria-label="${d}"><span>${weekday[parseDate(d).getDay()]}</span><strong>${parseDate(d).getDate()}</strong>${(eventsOn(d).length||data.tasks.some(t=>t.due===d&&!completed(t)))?'<i class="daydot" aria-hidden="true"></i>':''}</button>`).join('')}</div>
  <div class="card calendar-card"><div class="row between"><h2>${dateTitle}</h2><span class="badge">08:00–21:00</span></div>
  <div class="calendar-legend"><span><i class="key class-key"></i> Clase / actividad</span><span><i class="key study-key"></i> Estudio sugerido</span></div>
  ${timeline.length?timeline.map(e=>e.type==='class'?`<div class="agenda-entry agenda-class"><div class="agenda-time">${fmtTime(e.start)}<small>${fmtTime(e.end)}</small></div><div class="agenda-desc"><strong>📚 ${escapeHtml(e.event.title)}</strong><small>${e.event.kind==='weekly'?'Clase o actividad semanal':'Actividad de este día'}</small></div><button class="iconbtn" data-action="edit-event" data-id="${escapeHtml(e.event.id)}" aria-label="Editar clase">✎</button></div>`:`<div class="agenda-entry agenda-study"><div class="agenda-time">${fmtTime(e.start)}<small>${fmtTime(e.end)}</small></div><div class="agenda-desc"><strong>✦ ${escapeHtml(e.title)}</strong><small>${formatMinutes(e.end-e.start)} · ${pct(e.task)}% avanzado · Sugerencia</small></div><button class="iconbtn" data-action="edit-task" data-id="${escapeHtml(e.id)}" aria-label="Editar tarea">✎</button></div>`).join(''):'<p class="muted sm">No tienes clases ni sesiones sugeridas en este día. Agrega tu horario y escribe tareas en el chat para organizarte.</p>'}
  <button class="button secondary" data-action="new-event" style="width:100%;margin-top:10px">+ Agregar clase o actividad</button></div>
  <div class="card"><h2>📌 Entregas del día</h2>${deadlines.length?deadlines.map(t=>`<div class="event due-event"><div>📦</div><div class="grow"><strong>${escapeHtml(t.title)}</strong><div class="sm muted">${completed(t)?'Completada':`${t.hours} h estimadas · ${pct(t)}% avanzado`}</div></div><button class="iconbtn" data-action="edit-task" data-id="${escapeHtml(t.id)}" aria-label="Editar entrega">✎</button></div>`).join(''):'<p class="muted sm">No hay entregas con vencimiento este día.</p>'}</div>
  <div class="card"><h2>☀️ Bloques disponibles</h2><p class="muted sm">El horario de estudio se propone automáticamente dentro de tus espacios libres. Puedes editar clases o tareas cuando quieras.</p>${freeSlots(selectedDate).length?freeSlots(selectedDate).map(([a,b])=>`<div class="event free"><span>⏱</span><div class="grow"><b>${fmtTime(a)} – ${fmtTime(b)}</b><div class="sm">${formatMinutes(b-a)} libres (antes de aplicar sugerencias)</div></div></div>`).join(''):'<p class="muted sm">No hay bloques libres de al menos 30 minutos entre las 08:00 y las 21:00.</p>'}</div>
  ${suggestion(selectedDate)?recommendationWidget(`Prioriza ${escapeHtml(suggestion(selectedDate).task.title)} según su fecha de entrega, horas pendientes y progreso.`,'focus'):''}`;
}
function renderChat(){return `${header('💬 Chat Done?','<button class="topbtn" data-action="new-task">+ Tarea</button>')}<div class="chatmessages" id="chatMessages">${data.chat.map(m=>`<div class="bubble ${m.role==='me'?'mine':'bot'}">${escapeHtml(m.text)}</div>`).join('')}</div><div class="composer"><textarea id="chatInput" rows="1" placeholder="Ej: El viernes entrego Taller, necesito 8 horas..."></textarea><button data-action="send-chat" aria-label="Enviar mensaje">➤</button></div><div class="subtle" style="padding:6px">Interpretación con Gemini v2 · los cambios se guardan en este navegador.</div>`}
function renderSettings(){return `${header('⚙ Ajustes')}<div class="card"><h2>Mi espacio</h2><label class="formfield">Nombre<input id="settingName" value="${escapeHtml(data.name)}" maxlength="40" placeholder="Tu nombre"></label><button class="button" data-action="save-name">Guardar nombre</button><p class="muted sm">Los datos se guardan en este navegador. Al usar el chat con IA, se envían el mensaje y las tareas y clases necesarias para interpretarlo.</p></div><div class="card"><h2>Mis datos</h2><div class="column"><button class="button secondary" data-action="export">⬇ Exportar respaldo JSON</button><label class="button secondary" style="text-align:center;cursor:pointer">⬆ Importar respaldo<input id="importFile" type="file" accept=".json,application/json" hidden></label><button class="button ghost" data-action="reset">Restablecer todo</button></div><p class="muted sm">Para mover tus tareas a otro dispositivo, exporta un respaldo e impórtalo allí.</p></div><div class="card"><h2>Acerca del MVP</h2><p class="sm">Done? v2 experimental · Gemini, tareas, progreso y horario semanal. Sin autenticación ni sincronización entre dispositivos.</p></div>`}
function render(){const el=$('#main');$('#app').classList.toggle('chatbg',view==='chat');el.innerHTML=({home:renderHome,tasks:renderTasks,calendar:renderCalendar,chat:renderChat,settings:renderSettings})[view]();$$('#bottomNav button').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false')});if(view==='chat'){let chat=$('#chatMessages');chat.scrollTop=chat.scrollHeight}$('#login').hidden=data.onboarded}
function go(v){view=v;render();$('#main').scrollTop=0}
function openDialog(html){$('#dialog').innerHTML=html;$('#modal').classList.add('open')}
function closeDialog(){pendingChat=null;$('#modal').classList.remove('open');$('#dialog').innerHTML=''}
function taskDialog(task=null,proposal=null){
  let t=task||proposal||{title:'',subject:'',due:addDays(today(),2),hours:2,priority:2,subs:[]};
  openDialog(`<h2>${task?'Editar tarea':'Revisar y guardar tarea'}</h2><form id="taskForm" novalidate>
  <input name="id" type="hidden" value="${escapeHtml(task?.id||'')}">
  <label class="formfield">Nombre de la tarea<input name="title" required maxlength="120" value="${escapeHtml(t.title)}" placeholder="Ej: Entrega Taller"></label>
  <label class="formfield">Ramo (opcional)<input name="subject" maxlength="80" value="${escapeHtml(t.subject)}" placeholder="Ej: Taller"></label>
  <div class="formgrid"><label class="formfield">Fecha de entrega<input name="due" type="date" required value="${escapeHtml(t.due)}"></label>
  <label class="formfield">Tiempo estimado (horas)<input name="hours" type="number" min="0.5" max="1000" step="0.5" required value="${t.hours}"></label></div>
  <label class="formfield">Importancia<select name="priority"><option value="1" ${t.priority===1?'selected':''}>Normal</option><option value="2" ${t.priority===2?'selected':''}>Alta</option><option value="3" ${t.priority===3?'selected':''}>Muy alta</option></select></label>
  <label class="formfield">Subtareas (una por línea)<textarea name="subs" placeholder="Investigar\nPreparar lámina\nRevisar">${escapeHtml(t.subs.map(s=>s.title).join('\n'))}</textarea></label>
  <p class="muted sm">Verifica los datos interpretados. La prioridad también depende del tiempo pendiente y de la fecha de entrega.</p>
  <p id="taskError" role="alert" style="display:none;color:#a62b43;font-size:13px;font-weight:700"></p>
  <div class="dialogactions">${task?'<button class="button ghost" type="button" data-action="delete-task" data-id="'+escapeHtml(task.id)+'">Eliminar</button>':''}
  <button class="button secondary" type="button" data-action="close">Cancelar</button><button class="button" id="saveTaskBtn" type="button" data-action="save-task">Guardar tarea</button></div></form>`);
}
function saveTaskForm(){
 const el=$('#taskForm');if(!el)return;
 const f=new FormData(el), title=String(f.get('title')||'').trim(),due=String(f.get('due')||''),hours=Number(f.get('hours'));
 const error=$('#taskError');const fail=msg=>{error.textContent=msg;error.style.display='block';toast(msg)};
 if(!title)return fail('Escribe un nombre para la tarea.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(parseDate(due).getTime()))return fail('Selecciona una fecha válida.');
 if(!Number.isFinite(hours)||hours<0.5||hours>1000)return fail('Ingresa una duración entre 0,5 y 1000 horas.');
 const id=String(f.get('id')||''),old=data.tasks.find(t=>t.id===id);
 const lines=String(f.get('subs')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const item={id:old?.id||makeId(),title,subject:String(f.get('subject')||'').trim(),due,hours,priority:Number(f.get('priority'))||2,
 subs:lines.map(line=>{let previous=old?.subs.find(s=>s.title===line);return{id:previous?.id||makeId(),title:line,done:previous?.done||false}})};
 const next={...data,tasks:old?data.tasks.map(t=>t.id===old.id?item:t):[...data.tasks,item]};
 if(!commit(next))return;
 closeDialog();go('tasks');toast('✓ Tarea guardada. Ya aparece en tus prioridades.');
}
function eventDialog(e=null){let chosen=e?.date||selectedDate;let dow=e?.dow??parseDate(chosen).getDay();openDialog(`<h2>${e?'Editar':'Agregar'} clase o actividad</h2><form id="eventForm" novalidate><input type="hidden" name="id" value="${escapeHtml(e?.id||'')}"><label class="formfield">Nombre<input name="title" required maxlength="120" value="${escapeHtml(e?.title||'')}"></label><label class="formfield">Repetición<select name="kind"><option value="weekly" ${e?.kind!=='once'?'selected':''}>Todas las semanas</option><option value="once" ${e?.kind==='once'?'selected':''}>Una fecha específica</option></select></label><label class="formfield">Día de la semana<select name="dow">${fullWeekday.map((d,i)=>`<option value="${i}" ${i===dow?'selected':''}>${d}</option>`).join('')}</select></label><label class="formfield">Fecha (para evento único)<input name="date" type="date" value="${escapeHtml(chosen)}"></label><div class="formgrid"><label class="formfield">Desde<input name="start" type="time" required value="${e?.start||'09:00'}"></label><label class="formfield">Hasta<input name="end" type="time" required value="${e?.end||'10:00'}"></label></div><p id="eventError" role="alert" style="color:#a62b43;font-size:13px;font-weight:700"></p><div class="dialogactions">${e?`<button type="button" class="button ghost" data-action="delete-event" data-id="${escapeHtml(e.id)}">Eliminar</button>`:''}<button type="button" class="button secondary" data-action="close">Cancelar</button><button type="button" class="button" data-action="save-event">Guardar horario</button></div></form>`)}
function saveEventForm(){
 const el=$('#eventForm');if(!el)return;const f=new FormData(el);
 const title=String(f.get('title')||'').trim(),start=String(f.get('start')||''),end=String(f.get('end')||''),kind=String(f.get('kind')),date=String(f.get('date')||'');
 const fail=msg=>{const x=$('#eventError');x.textContent=msg;toast(msg)};
 if(!title)return fail('Escribe el nombre de la clase o actividad.');
 if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||minTime(end)<=minTime(start))return fail('La hora de fin debe ser posterior al inicio.');
 if(kind==='once'&&!date)return fail('Elige la fecha del evento.');
 const id=String(f.get('id')||''),old=data.events.find(x=>x.id===id);
 const item={id:old?.id||makeId(),title,kind,dow:Number(f.get('dow')),date,start,end};
 const next={...data,events:old?data.events.map(e=>e.id===old.id?item:e):[...data.events,item]};
 if(!commit(next))return;closeDialog();go('calendar');toast('✓ Horario guardado. Los bloques libres se actualizaron.');
}
function plain(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function parseMessage(text){
 const low=plain(text);let due=addDays(today(),2),dateFound=false;
 let match=text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
 if(match){due=match[0];dateFound=true}
 else if((match=text.match(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(20\d{2}))?\b/))){
  let y=+(match[3]||new Date().getFullYear()),m=+match[2],d=+match[1];if(m>=1&&m<=12&&d>=1&&d<=31){due=`${y}-${pad(m)}-${pad(d)}`;if(!match[3]&&due<today())due=`${y+1}-${pad(m)}-${pad(d)}`;dateFound=true}
 }else if(/\bpasado manana\b/.test(low)){due=addDays(today(),2);dateFound=true}
 else if(/\bmanana\b/.test(low)){due=addDays(today(),1);dateFound=true}
 else if(/\bhoy\b/.test(low)){due=today();dateFound=true}
 else {const day=fullWeekday.find(x=>new RegExp(`\\b${plain(x)}\\b`).test(low));if(day){let target=fullWeekday.indexOf(day),offset=(target-new Date().getDay()+7)%7;due=addDays(today(),offset);dateFound=true}}
 const timeMatch=low.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?\.?|h\b)/);
 const wordHours=low.match(/\b(una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s+horas?\b/);
 const numberWords={un:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,doce:12};
 const hours=timeMatch?Math.max(.5,Math.min(1000,Number(timeMatch[1].replace(',','.')))):wordHours?numberWords[wordHours[1]]:2;
 let title=text.trim();
 const named=text.match(/(?:\b(?:tengo|entrego|presento|rindo|debo entregar|hay que entregar|me toca entregar)\s+(?:una?\s+)?(?:la\s+)?(?:entrega\s+de\s+)?)([\p{L}\d][\p{L}\d ]{2,75}?)(?=\s*(?:[,.!;]|\s+(?:el|para|que|y|me falta|necesito)|$))/iu);
 if(named)title=named[1].trim();
 else title=title.replace(/^(tengo|debo|necesito|hay que|me falta|entregar|hacer)\s+/i,'');
 title=title.replace(/^(una?|el|la|los|las)\s+/i,'');
 title=title.split(/\s+(?:el|para el|antes del|vence|que vence|necesito|me falta|me faltan|debo hacer|debo terminar|tarda|requiere|estimo|calculo)\b|[,.!;\n]/i)[0].trim();
 title=title.replace(/^entrega\s+de\s+/i,'Entrega ').replace(/^entrega\s+/i,'Entrega ');
 if(title.length<3)title=text.split(/[,.!;\n]/)[0].trim().slice(0,70);
 title=title.slice(0,120);
 let segment=text.match(/(?:me faltan?|falta hacer|pendiente[s]?[: ]|subtareas?[: ]|tengo que|debo hacer|debo terminar)\s+(.+?)(?:[.!;\n]|\s+(?:creo que|necesito|estimo|calculo|son|tardare|tardara|requiere)\s+\d|$)/i)?.[1];
 let subs=(segment||'').replace(/^(hacer|terminar|preparar)\s+/i,'').split(/,|\s+y\s+|\s+ademas\s+/i).map(x=>x.trim()).filter(x=>x.length>=2).slice(0,30).map(title=>({id:makeId(),title,done:false}));
 let priority=/\b(urgente|muy importante|prioridad maxima|critico)\b/.test(low)?3:/\b(poco importante|sin apuro|tranquilo)\b/.test(low)?1:2;
 return {title,subject:'',due,hours,priority,subs,dateFound,hoursFound:Boolean(timeMatch||wordHours)};
}
function extractProposals(text){
 // Una entrega por línea o por ';'. También admite varias frases separadas por "además".
 const parts=text.split(/\s*(?:\n+|;|\s+adem[aá]s\s+(?=(?:tengo|debo|entrego|hay que|una? entrega|el viernes|el lunes)\b))\s*/i).map(x=>x.trim()).filter(Boolean);
 return parts.slice(0,8).map(parseMessage);
}
function priorityLine(t){let days=dayDistance(t.due);return `${days<0?'Vencida':days===0?'Hoy':days===1?'Mañana':formatDate(t.due)} · ${t.hours} h · ${t.subs.length} subtareas`}
function batchDialog(items){
 pendingChat=items;
 const proposals=items.map((t,i)=>`<article class="mini-proposal" style="display:block"><strong>${i+1}. ${escapeHtml(t.title)}</strong>
 <label class="formfield">Entrega<input data-batch="title" data-index="${i}" maxlength="120" value="${escapeHtml(t.title)}"></label>
 <div class="formgrid"><label class="formfield">Fecha<input data-batch="due" data-index="${i}" type="date" value="${escapeHtml(t.due)}"></label>
 <label class="formfield">Horas<input data-batch="hours" data-index="${i}" type="number" min="0.5" max="1000" step="0.5" value="${t.hours}"></label></div>
 <label class="formfield">Prioridad<select data-batch="priority" data-index="${i}"><option value="1" ${t.priority===1?'selected':''}>Normal</option><option value="2" ${t.priority===2?'selected':''}>Alta</option><option value="3" ${t.priority===3?'selected':''}>Muy alta</option></select></label>
 <label class="formfield">Subtareas (una por línea)<textarea data-batch="subs" data-index="${i}" rows="2">${escapeHtml(t.subs.map(s=>s.title).join('\n'))}</textarea></label>
 <p class="sm muted">${!t.dateFound?'Fecha no indicada: revisa la sugerencia. ':''}${!t.hoursFound?'Duración no indicada: revisa la estimación.':''}</p></article>`).join('');
 openDialog(`<h2>Organización propuesta</h2><p class="sm muted">Puedes corregir cada tarea antes de guardarlas juntas. Se ordenarán según vencimiento, horas y avance.</p>${proposals}<p id="batchError" role="alert" style="color:#aa354c"></p><div class="dialogactions"><button class="button secondary" type="button" data-action="close">Cancelar</button><button class="button" type="button" data-action="save-batch">Guardar todas</button></div>`);
}

const DONE_API_V2='https://done-api.totoayudante07.workers.dev/interpret-v2';
let sendingToDone=false;
const doneNorm=x=>plain(String(x||'')).trim().replace(/\s+/g,' ');
const doneDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const doneTime=x=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const doneDay=x=>fullWeekday.findIndex(d=>doneNorm(d)===doneNorm(x));
function doneContext(){
 return {tasks:data.tasks.map(t=>({id:t.id,title:t.title,subject:t.subject,due:t.due,hours:t.hours,subs:t.subs.map(q=>({id:q.id,title:q.title,done:q.done}))})),
 classes:data.events.map(e=>({id:e.id,title:e.title,day:fullWeekday[e.dow],date:e.date,start:e.start,end:e.end,recurring:e.kind==='weekly'}))};
}
function doneApply(result,message){
 if(result?.ok!==true||result.version!==2||!Array.isArray(result.proposals))throw Error('Respuesta inválida de Gemini.');
 if(result.needs_clarification)return {reply:result.clarification||'Necesito aclarar qué registro deseas modificar.'};
 if(!result.proposals.length)return {reply:'No identifiqué una operación concreta. Indica la tarea o clase y lo que quieres hacer.'};
 if(result.proposals.length>15)throw Error('Demasiadas operaciones.');
 const next={...data,tasks:data.tasks.map(t=>({...t,subs:t.subs.map(x=>({...x}))})),events:data.events.map(e=>({...e}))};
 const updates=[],seen=new Set(),normal=doneNorm(message);
 const weekly=/\b(todos?|todas?|cada|semanal|semanales|semana|siempre|repetir|repite|recurrente)\b/.test(normal);
 const once=/\b(puntual|solo este|solo esta|una sola vez|no se repite|deja de repetirse)\b/.test(normal);
 for(const op of result.proposals){
  if(!op||!['create','update','complete','delete'].includes(op.action)||!['task','class'].includes(op.entity))throw Error('Operación desconocida.');
  const {action,entity}=op,id=String(op.target_id||'');
  const key=entity+':'+(action==='create'?'new:'+op.title+':'+op.due+':'+op.day:id);
  if(seen.has(key))throw Error('Gemini propuso un cambio duplicado.');
  seen.add(key);
  const collection=entity==='task'?next.tasks:next.events;
  const old=collection.find(x=>x.id===id);
  if(action!=='create'&&(!id||!old))throw Error('No encuentro el registro original. No se guardó nada.');
  if(action==='complete'){
   if(entity!=='task')throw Error('Solo se pueden completar tareas.');
   if(!old.subs.length)old.subs.push({id:makeId(),title:'Tarea completada',done:true});
   old.subs.forEach(x=>x.done=true);
   updates.push('Completé '+old.title);continue;
  }
  if(action==='delete'){
   if(!confirm('¿Eliminar '+old.title+'?'))return {reply:'Eliminación cancelada. No se guardaron cambios.'};
   if(entity==='task')next.tasks=next.tasks.filter(t=>t.id!==id);
   else next.events=next.events.filter(e=>e.id!==id);
   updates.push('Eliminé '+old.title);continue;
  }
  if(entity==='task'){
   if(action==='create'){
    const title=String(op.title||'').trim().slice(0,120),subject=String(op.subject||'').trim().slice(0,80),due=String(op.due||''),hours=Number(op.estimated_hours);
    if(!title||!doneDate(due)||!Number.isFinite(hours)||hours<.5||hours>1000)throw Error('Para crear la tarea necesito título, fecha y horas. No guardé nada.');
    if(next.tasks.some(t=>doneNorm(t.title)===doneNorm(title)&&doneNorm(t.subject)===doneNorm(subject))){throw Error('Ya existe una tarea llamada '+title+'. No creé un duplicado. Si querías modificarla, escribe explícitamente «edita la tarea existente» y vuelve a intentarlo.')}
    next.tasks.push({id:makeId(),title,subject,due,hours,priority:2,subs:(Array.isArray(op.subtasks)?op.subtasks:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,30).map(x=>({id:makeId(),title:x.trim().slice(0,120),done:false}))});
    updates.push('Creé '+title);
   }else{
    if(op.title)old.title=String(op.title).slice(0,120);
    if(op.subject)old.subject=String(op.subject).slice(0,80);
    if(op.due){if(!doneDate(op.due))throw Error('Fecha inválida.');old.due=op.due}
    const h=Number(op.estimated_hours);
    if(Number.isFinite(h)&&h>0)old.hours=Math.max(.5,Math.min(1000,h));
    if(/\b(agrega|agregar|anade|anadir|incluye|incluir)\b/.test(normal)){
     for(const st of (Array.isArray(op.subtasks)?op.subtasks:[])){
      const title=String(st||'').trim().slice(0,120);
      if(title&&!old.subs.some(q=>doneNorm(q.title)===doneNorm(title)))old.subs.push({id:makeId(),title,done:false});
     }
    }
    updates.push('Actualicé '+old.title);
   }
  }else{
   const title=String(op.title||op.subject||'').trim().slice(0,120);
   const day=doneDay(op.day),start=String(op.start||''),end=String(op.end||'');
   if(action==='create'){
    if(!title||day<0||!doneTime(start)||!doneTime(end)||start>=end)throw Error('Necesito día y horario válidos para crear esa clase.');
    const kind=(op.recurring===true||weekly&&!once)?'weekly':'once',date=String(op.date||'');
    if(kind==='once'&&(!doneDate(date)||parseDate(date).getDay()!==day))throw Error('Necesito la fecha exacta de la clase puntual.');
    if(next.events.some(e=>doneNorm(e.title)===doneNorm(title)&&e.kind===kind&&(kind==='weekly'?e.dow===day:e.date===date)&&e.start===start&&e.end===end)){updates.push('La clase '+title+' ya existía');continue}
    next.events.push({id:makeId(),title,kind,dow:day,date:kind==='once'?date:today(),start,end});
    updates.push('Creé '+title);
   }else{
    if(title)old.title=title;
    if(day>=0)old.dow=day;
    if(start)old.start=start;
    if(end)old.end=end;
    if(!doneTime(old.start)||!doneTime(old.end)||old.start>=old.end)throw Error('El nuevo horario es inválido.');
    if(once)old.kind='once';
    else if(weekly||op.recurring===true)old.kind='weekly';
    if(old.kind==='once'){
     const date=String(op.date||old.date||'');
     if(!doneDate(date)||parseDate(date).getDay()!==old.dow)throw Error('La clase puntual necesita fecha que coincida con el día.');
     old.date=date;
    }
    updates.push('Actualicé '+old.title);
   }
  }
 }
 return {next,reply:updates.join('\n')};
}
async function sendChat(){
 const input=$('#chatInput'),txt=input?.value.trim();
 if(!txt||sendingToDone)return;
 sendingToDone=true;
 const msg=txt.slice(0,1400);
 if(!commit({...data,chat:[...data.chat,{role:'me',text:msg}].slice(-70)})){sendingToDone=false;return}
 render();
 toast('Interpretando con Done?...');
 let reply='';
 try{
  const low=plain(msg);
  if(/^(hola|gracias|hey|buenas)[!., ]*$/.test(low))reply='¡Hola! 💜 Puedes pedirme crear, modificar, completar o eliminar tareas y clases.';
  else if(/(?:que|cual)\s+(?:hago|priorizo)|recomien|mis prioridades|tiempo libre/.test(low)){
   const x=suggestion();
   reply=x?'Prioriza '+x.task.title+' ('+formatDate(x.task.due)+').':'No tienes tareas pendientes.';
  }else{
   const res=await fetch(DONE_API_V2,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,context:doneContext()})});
   const payload=await res.json().catch(()=>null);
   if(!res.ok||!payload?.ok)throw Error('Gemini no pudo interpretar el mensaje ('+(payload?.error||res.status)+'). No se guardaron operaciones.');
   const output=doneApply(payload,msg);
   reply=output.reply;
   if(output.next){
    if(!commit({...output.next,chat:[...data.chat,{role:'bot',text:reply}].slice(-70)})){sendingToDone=false;return}
    sendingToDone=false;render();toast('✓ Cambios guardados');return;
   }
  }
 }catch(e){console.error('Done? v2',e);reply=e.message||'Ocurrió un error. No se guardaron operaciones.'}
 commit({...data,chat:[...data.chat,{role:'bot',text:reply}].slice(-70)});
 sendingToDone=false;
 render();
}

function saveBatch(){
 if(!Array.isArray(pendingChat)||!pendingChat.length)return;
 const changes=pendingChat.map((t,i)=>{let get=key=>$(`[data-batch="${key}"][data-index="${i}"]`)?.value;
 const title=String(get('title')||'').trim(),due=String(get('due')||''),hours=Number(get('hours')),
 subs=String(get('subs')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(title=>({id:makeId(),title,done:false}));
 return {id:makeId(),title,due,hours,priority:Number(get('priority'))||2,subject:t.subject||'',subs};});
 if(changes.some(t=>!t.title||!/\d{4}-\d{2}-\d{2}/.test(t.due)||!Number.isFinite(t.hours)||t.hours<.5||t.hours>1000)){
  $('#batchError').textContent='Revisa los títulos, fechas y horas antes de guardar.';return;
 }
 const next={...data,tasks:[...data.tasks,...changes]};
 if(!commit(next))return;
 closeDialog();go('tasks');toast('✓ Pendientes organizados y guardados.');
}
function exportData(){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='done-respaldo.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function handleAction(action,btn){let id=btn.dataset.id;if(action==='save-task')saveTaskForm();if(action==='save-event')saveEventForm();if(action==='save-batch')saveBatch();if(action==='new-task')taskDialog();if(action==='edit-task')taskDialog(data.tasks.find(t=>t.id===id));if(action==='delete-task'){if(confirm('¿Eliminar esta tarea?')){data.tasks=data.tasks.filter(t=>t.id!==id);persist();closeDialog();render();toast('Tarea eliminada')}}if(action==='new-event')eventDialog();if(action==='edit-event')eventDialog(data.events.find(e=>e.id===id));if(action==='delete-event'){if(confirm('¿Eliminar este bloque?')){data.events=data.events.filter(e=>e.id!==id);persist();closeDialog();render();toast('Bloque eliminado')}}if(action==='week-prev'||action==='week-next'){weekOffset+=action==='week-next'?1:-1;selectedDate=addDays(today(),-((parseDate(today()).getDay()+6)%7)+weekOffset*7);render()}if(action==='close')closeDialog();if(action==='send-chat')sendChat();if(action==='save-name'){data.name=$('#settingName').value.trim().slice(0,40);persist();render();toast('Nombre guardado')}if(action==='export')exportData();if(action==='reset'){if(confirm('¿Borrar todos tus datos de Done? Este cambio no se puede deshacer.')){data=clean();data.onboarded=true;persist();go('home');toast('Espacio restablecido')}}}
document.addEventListener('click',e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.view){go(b.dataset.view);return}if(b.dataset.filter){taskFilter=b.dataset.filter;render();return}if(b.dataset.date){selectedDate=b.dataset.date;render();return}if(b.dataset.action)handleAction(b.dataset.action,b)});
document.addEventListener('change',async e=>{let input=e.target;if(input.dataset.action==='sub'){let task=data.tasks.find(t=>t.id===input.dataset.task),sub=task?.subs.find(s=>s.id===input.dataset.sub);if(sub){sub.done=input.checked;persist();render();if(completed(task))toast('⭐ ¡Tarea completada!')}}if(input.id==='importFile'&&input.files?.[0]){try{let raw=await input.files[0].text();data=validateState(JSON.parse(raw));persist();go('home');toast('Respaldo importado')}catch{toast('El archivo no es un respaldo válido de Done?')}}});
document.addEventListener('submit',e=>{if(e.target.id==='taskForm'){e.preventDefault();saveTaskForm()}if(e.target.id==='eventForm'){e.preventDefault();saveEventForm()}});
document.addEventListener('keydown',e=>{if(e.target.id==='chatInput'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}if(e.key==='Escape'&&$('#modal').classList.contains('open'))closeDialog()});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeDialog()});
$('#startBtn').addEventListener('click',()=>{data.name=$('#welcomeName').value.trim().slice(0,40);data.onboarded=true;persist();render()});
render();
