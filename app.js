'use strict';
const KEY='gymtracker.v1',DEFAULT_GROUP='g-default',WORKOUT_DAYS=['A','B','C']; const ORIGINAL=JSON.parse(JSON.stringify(PROGRAM)); const allEx=Object.values(PROGRAM).flatMap(x=>x.ex);const byId=Object.fromEntries(allEx.map(e=>[e.id,e]));const main=document.getElementById('main');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fresh=()=>({version:1,drafts:{},history:[],mobility:{},timer:null,autoTimer:false,plans:{}});let state=fresh();let warning='';try{const raw=localStorage.getItem(KEY);if(raw){const x=JSON.parse(raw);if(!valid(x))throw Error('Неверный формат');state=x}}catch(e){warning='Не удалось прочитать локальные данные. Проверь настройки браузера или восстанови резервную копию.'}
if(typeof state.autoTimer!=='boolean'){state.autoTimer=false;state.timer=null;}state.plans??={};state.custom??={};
function validExercise(e){return e&&typeof e.id==='string'&&/^[A-Za-z0-9:-]+$/.test(e.id)&&typeof e.name==='string'&&typeof e.plan==='string'&&Number.isInteger(e.sets)&&e.sets>=1&&e.sets<=12&&Number.isFinite(e.rest)&&typeof e.weight==='boolean'}
function validProgram(p){return p&&WORKOUT_DAYS.every(k=>p[k]&&typeof p[k].day==='string'&&Array.isArray(p[k].ex)&&p[k].ex.every(validExercise)&&new Set(p[k].ex.map(e=>e.id)).size===p[k].ex.length&&Array.isArray(p[k].cool)&&p[k].cool.every(x=>Array.isArray(x)&&x.length>=2&&typeof x[0]==='string'&&typeof x[1]==='string'))}
function validSession(s){
 if(!s||!WORKOUT_DAYS.includes(s.day)||!validDate(s.date)||!s.entries||typeof s.entries!=='object'||!Array.isArray(s.cool))return false;
 const ex=s.exerciseSnapshot||ORIGINAL[s.day].ex;
 return Array.isArray(ex)&&ex.every(e=>e&&typeof e.id==='string'&&/^[A-Za-z0-9:-]+$/.test(e.id)&&Array.isArray(s.entries[e.id])&&s.entries[e.id].length>=1&&s.entries[e.id].every(a=>a&&typeof a.done==='boolean'))&&(!s.groupId||typeof s.groupId==='string');
}
function valid(x){
 if(!x||x.version!==1||!x.drafts||typeof x.drafts!=='object'||Array.isArray(x.drafts)||!Array.isArray(x.history)||!x.mobility||typeof x.mobility!=='object'||!x.history.every(s=>validSession(s)&&typeof s.id==='string'&&/^[a-z0-9-]+$/.test(s.id))||!Object.entries(x.drafts).every(([k,v])=>WORKOUT_DAYS.includes(k)&&validSession(v)))return false;
 if(x.groups!==undefined&&(!Array.isArray(x.groups)||!x.groups.length||new Set(x.groups.map(g=>g?.id)).size!==x.groups.length||!x.groups.every(g=>g&&typeof g.id==='string'&&/^g-[a-z0-9-]+$/.test(g.id)&&typeof g.name==='string'&&(g.id===DEFAULT_GROUP&&!g.program||validProgram(g.program))&&(!g.schedule||typeof g.schedule==='object'))))return false;
 if(x.groupDrafts!==undefined&&(!x.groupDrafts||typeof x.groupDrafts!=='object'||Array.isArray(x.groupDrafts)||!Object.entries(x.groupDrafts).every(([k,d])=>validSession(d)&&k===slotKey(sessionGroup(d),d.date,d.day))))return false;
 return true;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));warning=''}catch(e){warning='Данные не удалось сохранить на устройстве. Не закрывай приложение до экспорта резервной копии.'}document.getElementById('storageWarning').textContent=warning}
const weightNum=v=>/^\d+(?:[.,]\d+)?$/.test(String(v).trim())?Number(String(v).trim().replace(',','.')):NaN;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); const fmt=d=>d.split('-').reverse().join('.');
let tab='train',day=({1:'A',3:'B',5:'C'})[new Date().getDay()]||'A',mobDay=today(),mobKind='morning',selected=allEx[0].id,historyId=null,mode='overview',exIndex=0,detail='',groupId=DEFAULT_GROUP,groupOpen=false,programEditing=false,workoutDate=today();
const BASE=Object.values(ORIGINAL).flatMap(x=>x.ex);
const EXTRA=[
{id:'X1',name:'Румынская тяга',unit:'повт.',weight:true,muscles:'Ягодицы · задняя поверхность бедра',tip:'Слегка согни колени, отведи таз назад, веди вес вдоль ног. Остановись до потери контроля поясницы.'},
{id:'X2',name:'Подъём на носки сидя',unit:'повт.',weight:true,muscles:'Камбаловидная мышца',tip:'Сядь устойчиво, поднимай пятки плавно и опускай до комфортной амплитуды.'},
{id:'X3',name:'Tibialis Raise',unit:'повт.',weight:false,muscles:'Передняя поверхность голени',tip:'Опираясь спиной на стену, подними носки, пятки оставь на полу. Опускай медленно.'},
{id:'X4',name:'Ягодичный мост без веса',unit:'повт.',weight:false,muscles:'Ягодицы',tip:'Лёжа на спине, согни колени и подними таз без прогиба поясницы.'},
{id:'X5',name:'Боковая планка',unit:'сек',weight:false,muscles:'Корпус',tip:'Опора на предплечье и стопы или колени. Удерживай корпус ровно, свободно дыши.'}];
const LIB=[...BASE,...EXTRA];
function sessionEx(s){return s.exerciseSnapshot||ORIGINAL[s.day].ex}
function sameExercise(s,id,e=workoutExercise(id)){return sessionGroup(s)===groupId&&sessionEx(s).find(x=>x.id===id)?.name===e?.name}
function applyCustom(){
 const current=programFor(activeGroup());
 for(const k of WORKOUT_DAYS)PROGRAM[k]=current[k];
 for(const key of Object.keys(byId))delete byId[key];
 allEx.splice(0,allEx.length,...Object.values(PROGRAM).flatMap(p=>p.ex));
 for(const e of allEx)byId[e.id]=e;
 if(!allEx.some(e=>e.id===selected))selected=allEx[0]?.id||'';
}
function infoFor(e){return EX_VIS[e.visualId||e.id]||LIB.find(x=>x.id===(e.visualId||e.id)&&x.tip)||customFor()?.[e.id]?.snapshot||(e.tip?e:{muscles:e.muscles||'',tip:'Выполняй контролируемо.'})}
function replacePanel(e){return `<div class="card stack"><h3>Заменить упражнение</h3><small>Замена действует на будущие тренировки. История сохраняется.</small><input placeholder="Поиск в библиотеке" oninput="filterReplacement(this)"><label>Упражнение<select id="replacement" onchange="replacementDefaults()">${LIB.map(x=>`<option value="${x.id}" ${x.id===(e.visualId||e.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>Подходы<input id="replacementSets" inputmode="numeric" type="number" min="1" max="12" value="${e.sets}"></label><label>Повторы / секунды<input id="replacementReps" value="${esc(e.plan.split('×')[1]?.trim()||'10')}"></label><label>Отдых, сек<input id="replacementRest" inputmode="numeric" type="number" min="0" max="600" value="${e.rest}"></label><button class="primary" onclick="replaceExercise()">Сохранить замену</button></div>`}
function replacementDefaults(){const x=LIB.find(z=>z.id===document.getElementById('replacement').value);if(x){document.getElementById('replacementReps').value=x.plan?.split('×')[1]?.trim()||(x.unit==='сек'?'30 с':'10–12');}}
function replaceExercise(){
 const old=currentWorkout().ex[exIndex],d=draft(),x=LIB.find(z=>z.id===document.getElementById('replacement').value),n=Number(document.getElementById('replacementSets').value),r=document.getElementById('replacementReps').value.trim(),rest=Number(document.getElementById('replacementRest').value);
 if(!old||!x||!Number.isInteger(n)||n<1||n>12||!r||r.length>40||!Number.isInteger(rest)||rest<1||rest>600){alert('Проверь подходы, повторы и отдых.');return}
 if(d.entries[old.id].some(a=>a.done)){alert('Сначала сохрани текущую тренировку: в этом упражнении уже есть выполненные подходы.');return}
 if(!PROGRAM[day].ex.some(e=>e.id===old.id)){alert('Упражнение больше не входит в текущий комплекс.');return}
 const info=infoFor(x);customFor()[old.id]={source:x.id,snapshot:{id:x.id,name:x.name,unit:x.unit,weight:x.weight,muscles:info.muscles,tip:info.tip},sets:n,plan:n+' × '+r,rest};
 applyCustom();const e=byId[old.id];
 d.exerciseSnapshot=JSON.parse(JSON.stringify(d.exerciseSnapshot||PROGRAM[day].ex));d.exerciseSnapshot[exIndex]={...e};
 const prev=previous(e.id,e);d.entries[e.id]=Array.from({length:n},(_,i)=>{const a=prev?.entries[e.id]?.[i];return {w:a?.done?a.w:'',r:a?.done?a.r:'',done:false}});
 delete plansFor()[e.id];if(d.notes)delete d.notes[e.id];detail='';save();render()
}
function buildDraft(){
 const p=PROGRAM[day];
 return {groupId,day,date:workoutDate,entries:Object.fromEntries(p.ex.map(e=>{const prev=previous(e.id,e);return [e.id,Array.from({length:e.sets},(_,i)=>{const a=prev?.entries[e.id]?.[i];return {w:a?.done?a.w:'',r:a?.done?a.r:'',done:false}})]})),notes:{},cool:[],comment:'',exerciseSnapshot:JSON.parse(JSON.stringify(p.ex)),coolSnapshot:JSON.parse(JSON.stringify(p.cool))};
}
function previewDraft(){const d=existingDraft();return d&&workoutStarted(d)?d:buildDraft()}
function draft(){let d=existingDraft();if(!d||!workoutStarted(d)){d=buildDraft();state.groupDrafts[workoutKey()]=d;save()}return d}
function navigate(t){tab=t;historyId=null;mode='overview';detail='';mediaManageOpen=false;programEditing=false;groupOpen=false;render();window.scrollTo(0,0)}
function timerForWorkout(){const t=state.timer;if(!t)return null;if((t.groupId||DEFAULT_GROUP)!==groupId||t.day&&t.day!==day||t.date&&t.date!==workoutDate)return null;return t}
function timerHTML(){return `<div id="timerBox" class="timer" ${timerForWorkout()?'':'hidden'} style="${timerForWorkout()?'':'display:none'}"><div><small>ОТДЫХ</small><br><strong id="clock">00:00</strong></div><small>Между подходами</small><button onclick="changeTimer(-15)">−15</button><button onclick="changeTimer(30)">+30</button><button onclick="stopTimer()">Стоп</button></div>`}
function startTimer(sec){state.timer={end:Date.now()+sec*1000,day,groupId,date:workoutDate};save();updateTimer()}function changeTimer(sec){if(timerForWorkout()){state.timer.end=Math.max(Date.now(),state.timer.end+sec*1000);save();updateTimer()}}function stopTimer(){if(timerForWorkout())state.timer=null;save();updateTimer()}
function updateTimer(){const box=document.getElementById('timerBox');if(!box)return;const t=timerForWorkout();box.hidden=!t;box.style.display=t?'flex':'none';if(!t)return;const n=Math.max(0,Math.ceil((state.timer.end-Date.now())/1000));document.getElementById('clock').textContent=n?`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:'Готово';}setInterval(updateTimer,500);
function editSet(id,i,k,v){const s=draft().entries[id][i];s[k]=v;s.done=false;save();updateSetRow(id,i);updateProgress()}
function toggleSet(id,i){
 const e=workoutExercise(id),s=draft().entries[id][i];
 if(!s.done&&(!String(s.r).trim()||!Number.isFinite(Number(s.r))||Number(s.r)<=0||!Number.isInteger(Number(s.r))||(e.weight&&(!String(s.w).trim()||!Number.isFinite(weightNum(s.w))||weightNum(s.w)<0)))){alert('Укажи фактические повторы/секунды и вес. Для собственного веса введи 0.');return}
 const row=document.getElementById(`set-row-${id}-${i}`);
 preserveRowAnchor(row,()=>{if(!s.done&&e.weight)s.w=String(weightNum(s.w));s.done=!s.done;save();updateSetRow(id,i);if(s.done&&state.autoTimer===true)startTimer(e.rest);updateProgress()});
 if(setPad)keepSetVisible();
}
function updateProgress(){
 if(!groupOpen||programEditing)return;
 const d=previewDraft(),sets=Object.values(d.entries).flat(),total=sets.length,n=sets.filter(x=>x.done).length;
 const el=document.getElementById('setProgress');if(el)el.textContent=`${n} из ${total} подходов`;
 const bar=document.getElementById('setBar');if(bar)bar.style.width=total?`${100*n/total}%`:'0%';
 const count=document.getElementById('exerciseSetCount');if(count&&mode==='exercise'){const a=d.entries[currentWorkout().ex[exIndex].id];count.textContent=`${a.filter(x=>x.done).length} из ${a.length}`}
}
function setCheck(arr,i,checked){const j=arr.indexOf(i);if(checked&&j<0)arr.push(i);else if(!checked&&j>=0)arr.splice(j,1);save()}
const STRETCH=[
['грудных','Грудные мышцы','Встань у стены, положи предплечье на опору на комфортной высоте. Медленно поверни корпус от руки. Не тяни плечо через боль.'],
['широчайших','Широчайшие мышцы спины','Положи ладони на устойчивую опору. Отведи таз назад, слегка согни колени, грудную клетку опускай между руками без прогиба поясницы.'],
['поперёк','Задняя дельта','Подними руку перед собой и мягко приведи её к противоположному плечу другой рукой. Не поднимай плечо к уху.'],
['квадрицепса','Передняя поверхность бедра','Держись за опору, согни колено и мягко приблизь пятку к ягодице. Колени рядом, таз нейтрален.'],
['задней поверхности','Задняя поверхность бедра','Ляг на спину, подними бедро, поддерживая его руками или ремнём. Медленно выпрямляй колено до лёгкого натяжения; не вызывай боль по ноге.'],
['подколенных','Задняя поверхность бедра','Ляг на спину, поддержи поднятое бедро руками или ремнём. Плавно разогни колено до комфортного натяжения; не тяни носок на себя через боль.'],
['дыхание','Дыхание','Ляг или сядь удобно. Вдыхай через нос, позволяя нижним рёбрам расшириться, затем спокойно выдыхай. Не задерживай дыхание.'],
['сгибателей','Сгибатели бедра','Опустись на одно колено с мягкой подкладкой. Слегка подкрути таз и перенеси его вперёд без прогиба поясницы.'],
['ягодичных','Ягодичные мышцы','Лёжа на спине, положи лодыжку на противоположное бедро. Мягко подтяни опорное бедро к себе, не дави на колено.'],
['икр','Икроножная и камбаловидная','У стены отведи ногу назад, пятку оставь на полу. Для икроножной держи колено прямым, для камбаловидной слегка согни его.'],
['бицепса','Бицепс','Положи ладонь на стену немного позади корпуса, локоть мягкий. Плавно повернись от руки, без боли в плече.'],
['трицепса','Трицепс','Подними руку, согни локоть за головой. Второй рукой мягко направь локоть, не прогибай поясницу.'],
['кошка','Подвижность позвоночника','На четвереньках расположи кисти под плечами и колени под тазом. Плавно округли и затем мягко разогни спину, не уходя в болезненную амплитуду.'],
['глубокий присед','Тазобедренные и голеностоп','Возьмись за опору и опустись в комфортный присед. Пятки на полу, колени по направлению носков. Не форсируй глубину.'],
['грудного отдела','Грудной отдел позвоночника','Ляг на бок, согни колени. Раскрой верхнюю руку назад, поворачивая грудную клетку, таз оставь устойчивым.'],
['вращения','Голеностоп и плечи','В удобном положении медленно сделай круги стопой в обе стороны, затем круги плечами. Не форсируй амплитуду.'],
['90/90','Ротация тазобедренных','Сядь, согни обе ноги примерно под 90 градусов. Держи корпус устойчивым, мягко наклонись вперёд над передним бедром, без давления на колено.'],
['голубь','Ягодичные и наружные ротаторы','Из положения на четвереньках вынеси одну согнутую ногу вперёд, другую назад. Подложи опору под таз. Если есть дискомфорт в колене, выбери растяжку Figure 4 лёжа.']];
let stretchOpen='';
function checkList(items,arr,fn){return items.map((x,i)=>{const k=fn+i,info=STRETCH.find(z=>x[0].toLowerCase().includes(z[0]));return `<div class="stretch-item"><div class="checkline"><input type="checkbox" aria-label="Отметить ${esc(x[0])}" ${arr.includes(i)?'checked':''} onchange="${fn}(${i},this.checked)"><button class="stretch-link" onclick="stretchOpen=stretchOpen==='${k}'?'':'${k}';render()"><span>${esc(x[0])}<small>${esc(x[1])}</small></span><b>${stretchOpen===k?'−':'›'}</b></button></div>${stretchOpen===k?`<div class="stretch-detail">${localVisual("stretch:"+x[0])}<strong>${esc(info?.[1]||'Техника')}</strong><p>${esc(info?.[2]||'Выполняй плавно в комфортной амплитуде.')}</p><small>Без усиления боли.</small>${fn==='toggleMob'?`<button class="wide" onclick="startMobTimer(${duration(x[1])})">◷ Запустить таймер</button>`:''}</div>`:''}</div>`}).join('')}
function duration(t){const n=Number(t.match(/\d+/)?.[0]||30);return t.includes('мин')?n*60:t.includes('повтор')?60:n}
let mobilityEnd=0,mobilitySeconds=60;
function startMobTimer(n){mobilitySeconds=n;mobilityEnd=Date.now()+n*1000;updateMobTimer()}
function stopMobTimer(){mobilityEnd=0;updateMobTimer()}
function updateMobTimer(){const el=document.getElementById('mobClock');if(!el)return;const n=mobilityEnd?Math.max(0,Math.ceil((mobilityEnd-Date.now())/1000)):mobilitySeconds;el.textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function mobTimerHTML(){return `<div class="card stack"><div class="row between"><small>Таймер мобильности</small><strong id="mobClock" style="font-size:30px">01:00</strong></div><div class="actions">${[30,45,60,120].map(n=>`<button onclick="startMobTimer(${n})">${n} с</button>`).join('')}<button onclick="stopMobTimer()">Стоп</button></div><small>Запускается только вручную. Для односторонних движений запусти отдельно на каждую сторону.</small></div>`}
setInterval(updateMobTimer,250);


function previous(id,e=workoutExercise(id)){return state.history.filter(x=>sameExercise(x,id,e)&&x.date<=workoutDate&&x.entries[id]?.some(a=>a.done)).sort((a,b)=>b.date.localeCompare(a.date)||(b.savedAt||0)-(a.savedAt||0))[0]}
function workoutStarted(d){return d.started===true||Number.isInteger(d.cursor)||Object.values(d.entries).flat().some(a=>a.done)||d.cool.length>0}
function goExercise(i){const p=currentWorkout();if(!p.ex.length)return;const d=draft();exIndex=Math.max(0,Math.min(i,p.ex.length));mode=exIndex>=p.ex.length?'cool':'exercise';detail='';d.started=true;d.cursor=exIndex;save();render();window.scrollTo(0,0)}
function begin(){goExercise(Math.min(existingDraft()?.cursor||0,currentWorkout().ex.length))}
function overview(){mode='overview';detail='';render();window.scrollTo(0,0)}
function workoutMenuHTML(){return `<dialog id="workoutMenu" class="workout-menu" aria-labelledby="workoutMenuTitle"><div class="stack"><div class="row between"><h3 id="workoutMenuTitle">Тренировка ${day}</h3><button class="menu-close" aria-label="Закрыть меню" onclick="closeWorkoutMenu()">×</button></div><p class="muted">Что сделать с текущей тренировкой?</p><button class="primary wide" onclick="continueWorkout()">Продолжить тренировку</button><button class="wide" onclick="finish()">Завершить тренировку и сохранить данные</button><button class="danger wide" onclick="cancelWorkout()">Отменить тренировку</button></div></dialog>`}
function openWorkoutMenu(){dismissSetPad();const el=document.getElementById('workoutMenu');if(el&&!el.open)el.showModal()}
function closeWorkoutMenu(){const el=document.getElementById('workoutMenu');if(el?.open)el.close()}
function continueWorkout(){closeWorkoutMenu();if(mode==='overview')begin()}
function clearWorkoutTimer(){if(timerForWorkout())state.timer=null}
function cancelWorkout(){
 if(!workoutStarted(draft()))return;
 if(!confirm('Отменить тренировку? Введённые данные текущей тренировки будут удалены без сохранения. История и программа не изменятся.'))return;
 closeWorkoutMenu();delete state.groupDrafts[workoutKey()];clearWorkoutTimer();stretchOpen='';save();overview()
}
function addSet(id){const a=draft().entries[id],last=a[a.length-1];a.push({w:last?.w??'',r:last?.r??'',done:false});save();refreshSetRows(id)}
function removeSet(id,i){const a=draft().entries[id];if(i<workoutExercise(id).sets)return;if(a[i].done&&!confirm('Удалить выполненный дополнительный подход?'))return;a.splice(i,1);if(setPad&&setPad.id===id){if(setPad.i===i)dismissSetPad();else if(setPad.i>i)setPad.i--}save();refreshSetRows(id)}
function setPlan(id,v){plansFor()[id]=v;save()}
function progressHeader(){return `<div class="row between"><small>Подходы за тренировку</small><small id="setProgress"></small></div><div class="progress"><span id="setBar"></span></div>`}
function train(){
 if(!groupOpen)return groupChooser();
 if(programEditing)return groupEditorHTML();
 const p=currentWorkout(),d=previewDraft(),started=workoutStarted(d);
 if(mode==='exercise')return exerciseScreen(p,d);if(mode==='cool')return coolScreen(p,d);
 return `${groupTopHTML()}${calendarHTML()}${complexTabs()}<div class="row between group-complex-heading"><h3>Комплекс ${day}</h3><small>${p.ex.length} упр.</small></div>${p.focus?`<p class="muted">${esc(p.focus)}</p>`:''}
 ${draftLinksHTML()}
 ${p.ex.length?`<div class="card group-session">${progressHeader()}</div><button class="primary wide group-start" onclick="begin()">${started?'Продолжить тренировку':'Начать комплекс '+day} →</button>${started?`<button class="wide manage-session" onclick="openWorkoutMenu()">Управление тренировкой</button>${workoutMenuHTML()}`:''}<div class="exercise-list">${p.ex.map((e,i)=>{let a=d.entries[e.id],n=a.filter(x=>x.done).length;return `<button class="exercise-list-item" onclick="goExercise(${i})"><span class="exercise-number">${i+1}</span><span class="exercise-list-text"><strong>${esc(e.name)}</strong><small>${esc(e.plan)} · ${n}/${a.length} выполнено</small></span><span class="${n===a.length?'complete':''}">${n===a.length?'✓':'›'}</span></button>`}).join('')}<button class="exercise-list-item" onclick="goExercise(${p.ex.length})"><span class="exercise-number">↘</span><span class="exercise-list-text"><strong>Заминка</strong><small>${d.cool.length}/${p.cool.length}${p.cool.length?' · без ходьбы':''}</small></span><span>›</span></button></div>${timerHTML()}<p class="muted">Черновик сохраняется автоматически.</p>`:`<div class="card stack"><h3>Пока нет упражнений</h3><p class="muted">Составь этот комплекс из упражнений библиотеки.</p><button class="primary wide" onclick="editGroupProgram()">Добавить упражнения</button></div>`}`;
}
function exerciseScreen(p,d){
 const e=p.ex[exIndex],a=d.entries[e.id],prev=previous(e.id),info=infoFor(e),next=p.ex[exIndex+1],done=a.filter(v=>v.done).length;
 const notePlaceholder=e.name.includes('резинкой')?'Сопротивление резинки, заметки':'Заметки (техника, самочувствие)';
 return `
 <div class="row between workout-top">
  <button class="round" aria-label="К списку упражнений" onclick="overview()">←</button>
  <div class="workout-position"><small>ТРЕНИРОВКА ${day}</small><strong>Упражнение ${exIndex+1} из ${p.ex.length}</strong></div>
  <button class="workout-end" onclick="openWorkoutMenu()">Завершить</button>
 </div>
 ${workoutMenuHTML()}
 ${timerHTML()}
 <div class="workout-hero">
  <div class="visual">${localVisual(e.visualId||e.id,exerciseVisual(e.id))}</div>

 </div>
 <h2 class="exercise-title">${esc(e.name)}</h2>
 <p class="muted center workout-muscles">${esc(info.muscles)}</p>
 <div class="quick workout-quick">${[['tech','▷','Техника'],['hist','◷','История'],['replace','⇄','Заменить'],['notes','✎','Заметки']].map(([key,icon,label])=>`<button aria-expanded="${detail===key}" class="${detail===key?'selected-action':''}" onclick="detail=detail==='${key}'?'':'${key}';render()"><b aria-hidden="true">${uiIcon(({tech:"technique",hist:"history",replace:"replace",notes:"notes"})[key])}</b><span>${label}</span>${key==='notes'&&d.notes?.[e.id]?'<i class="note-dot" aria-hidden="true"></i>':''}</button>`).join('')}</div>
 ${detail==='tech'?`<div class="card"><h3>Техника</h3><p>${esc(info.tip)}</p><p class="muted">Работай в комфортной амплитуде.</p></div>`:detail==='hist'?exerciseHistory(e):detail==='replace'?replacePanel(e):detail==='notes'?`<div class="card stack"><h3>Заметки</h3><textarea rows="3" aria-label="Заметки к упражнению" placeholder="${esc(notePlaceholder)}" oninput="draft().notes??={};draft().notes['${e.id}']=this.value;save()">${esc(d.notes?.[e.id]||'')}</textarea></div>`:''}
 <div class="plan-strip workout-plan">
  <div><small>План</small><strong>${esc(e.plan)}</strong></div>
  ${e.weight?`<label><small>Целевой вес, кг</small><input type="text" inputmode="decimal" autocomplete="off" placeholder="—" value="${esc(plansFor()?.[e.id]??'')}" oninput="setPlan('${e.id}',this.value)"></label>`:''}
  <button class="rest-start" aria-label="Запустить таймер отдыха ${esc(e.restLabel)}" onclick="startTimer(${e.rest})"><small>◷ Отдых</small><strong>${esc(e.restLabel)}</strong></button>
 </div>
 <div class="row between sets-heading"><h3>Подходы</h3><small id="exerciseSetCount">${done} из ${a.length}</small></div>
 <p class="muted previous-set-note">${prev?'Данные от '+fmt(prev.date)+' · измени по факту.':'Введи фактические результаты.'}</p>
 <div class="setrow ${e.weight?'':'noweight'} labels"><small>№</small>${e.weight?'<small>Вес, кг</small>':''}<small>${esc(e.unit)}</small><small>✓</small></div>
 <div id="workoutSetRows">${setRowsHTML(e,a)}</div>
 <button class="add-set" onclick="addSet('${e.id}')">＋ Ещё подход</button>
 ${progressHeader()}
 <div class="workout-nav"><button aria-label="Предыдущее упражнение" onclick="${exIndex?`goExercise(${exIndex-1})`:'overview()'}">‹</button><button class="primary next" onclick="goExercise(${exIndex+1})"><span><small>Далее</small><strong>${next?esc(next.name):'Заминка'}</strong></span><b aria-hidden="true">›</b></button></div>
 ${setPadHTML()}`
}
function exerciseHistory(e){const h=state.history.filter(s=>sameExercise(s,e.id)&&s.entries[e.id]?.some(a=>a.done)).sort((a,b)=>b.date.localeCompare(a.date)||(b.savedAt||0)-(a.savedAt||0));return `<div class="card"><h3>История упражнения</h3>${h.length?h.map(s=>`<div class="history-item"><span><strong>${fmt(s.date)}</strong><br><small>${s.entries[e.id].filter(a=>a.done).map(a=>`${e.weight?esc(a.w)+' кг × ':''}${esc(a.r)} ${e.unit}`).join(' · ')}</small></span></div>`).join(''):'<p class="muted">Пока нет завершённых тренировок.</p>'}</div>`}
function coolScreen(p,d){return `<div class="row between"><button class="round" aria-label="К списку упражнений" onclick="overview()">←</button><small>Сессия ${day} · завершение</small><button class="workout-end" onclick="openWorkoutMenu()">Завершить</button></div>${workoutMenuHTML()}${timerHTML()}<h2>Заминка ${day}</h2>${p.cool.length?'<p class="muted">Без ходьбы · мягкая растяжка</p>':''}<div class="card">${p.cool.length?checkList(p.cool,d.cool,'toggleCool')+'<p class="notice">Не усиливай боль и не растягивай через боль, распространяющуюся по ноге.</p>':'<p class="muted">В этом комплексе заминка не задана.</p>'}</div><div class="card"><label class="field"><small>Самочувствие / заметки тренировки</small><textarea rows="3" oninput="draft().comment=this.value;save()">${esc(d.comment)}</textarea></label></div>${progressHeader()}<div class="workout-nav"><button onclick="goExercise(${p.ex.length-1})">‹‹</button><button class="primary next" onclick="finish()">Завершить и сохранить ✓</button></div>`}

function toggleCool(i,c){setCheck(draft().cool,i,c)}
function finish(){const d=draft();const a=Object.values(d.entries).flat(),n=a.filter(x=>x.done).length;if(!n){alert('Отметь хотя бы один выполненный подход.');return}if(n<a.length&&!confirm(`Выполнено ${n} из ${a.length}. Сохранить неполную тренировку?`))return;state.history.push({...JSON.parse(JSON.stringify(d)),id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),savedAt:Date.now()});closeWorkoutMenu();delete state.groupDrafts[workoutKey()];clearWorkoutTimer();save();navigate('history')}
function mobility(){mobDay=today();const key=mobDay+'-'+mobKind;const arr=state.mobility[key]||[];return `<h2>Ежедневная мобильность</h2>${mobTimerHTML()}<div class="card"><div class="days" style="grid-template-columns:1fr 1fr"><button class="${mobKind==='morning'?'active':''}" onclick="mobKind='morning';stretchOpen='';render()">Утро <small>10 мин</small></button><button class="${mobKind==='evening'?'active':''}" onclick="mobKind='evening';stretchOpen='';render()">Вечер <small>12–15 мин</small></button></div><div class="row between"><strong>Выполнено</strong><span id="mobCount">${arr.length}/${MOB[mobKind].length}</span></div>${checkList(MOB[mobKind],arr,'toggleMob')}</div><p class="notice">В дни зала вечернюю растяжку можно сократить, если она повторяет заминку. Пропускай движения, которые провоцируют симптомы.</p>`}
function toggleMob(i,c){const k=mobDay+'-'+mobKind;state.mobility[k]??=[];setCheck(state.mobility[k],i,c);document.getElementById('mobCount').textContent=`${state.mobility[k].length}/${MOB[mobKind].length}`}
function history(){if(historyId){const s=state.history.find(x=>x.id===historyId);if(!s){historyId=null;return history()}return `<button class="linklike" onclick="historyId=null;render()">‹ Все тренировки</button><h2>${fmt(s.date)} · ${s.day}</h2><p class="muted">${esc(groupName(sessionGroup(s)))}</p>${sessionEx(s).map(e=>`<div class="card"><h3>${esc(e.name)}</h3><p>${s.entries[e.id].map((a,i)=>`${i+1}. ${a.done?`${e.weight?esc(a.w)+' кг × ':''}${esc(a.r)} ${e.unit}`:'Не выполнен'}`).join('<br>')}</p><small>${esc(s.notes?.[e.id]||'')}</small></div>`).join('')}<div class="card"><h3>Заминка</h3><p>${s.cool.length} / ${(s.coolSnapshot||ORIGINAL[s.day].cool).length}</p><p>${esc(s.comment)}</p></div><button class="danger wide" onclick="deleteHistory()">Удалить запись</button>`}return `<h2>История тренировок</h2><p class="muted">${state.history.length} сохранено</p><div class="card">${state.history.length?[...state.history].sort((a,b)=>b.date.localeCompare(a.date)||b.savedAt-a.savedAt).map(s=>`<button class="history-item" onclick="openHistory('${esc(s.id)}')"><span><strong>${fmt(s.date)} · ${s.day}</strong><br><small>${esc(groupName(sessionGroup(s)))} · ${Object.values(s.entries).flat().filter(a=>a.done).length} подходов</small></span><span>›</span></button>`).join(''):'<p class="muted">Здесь появятся завершённые тренировки.</p>'}</div>`}
function openHistory(id){historyId=id;render();window.scrollTo(0,0)}function deleteHistory(){if(confirm('Удалить эту тренировку из истории?')){state.history=state.history.filter(s=>s.id!==historyId);historyId=null;save();render()}}
function progressGroupPicker(){return state.groups.length>1?`<div class="card"><label class="field"><small>Группа тренировок</small><select onchange="selectProgressGroup(this.value)">${state.groups.map(g=>`<option value="${g.id}" ${g.id===groupId?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label></div>`:''}
function selectProgressGroup(id){if(!state.groups.some(g=>g.id===id))return;groupId=id;groupOpen=false;applyCustom();selected=allEx[0]?.id||'';render()}
function progress(){const e=byId[selected]||allEx[0];if(!e)return '<h2>Прогресс</h2>'+progressGroupPicker()+'<div class="card"><p class="muted">В группе пока нет упражнений.</p></div>';const points=state.history.filter(s=>s.day===e.id[0]&&sameExercise(s,e.id,e)).map(s=>({date:s.date,v:Math.max(-1,...s.entries[e.id].filter(a=>a.done).map(a=>e.weight?weightNum(a.w):Number(a.r)))})).filter(x=>Number.isFinite(x.v)&&x.v>=0).sort((a,b)=>a.date.localeCompare(b.date));const unit=e.weight?'кг':e.unit;let chart='<p class="muted">Заверши тренировку, чтобы увидеть прогресс.</p>';if(points.length){const a=points.slice(-20),lo=Math.min(...a.map(x=>x.v)),hi=Math.max(...a.map(x=>x.v)),pad=Math.max(1,(hi-lo)*.1),min=Math.max(0,lo-pad),max=hi+pad;const pos=a.map((x,i)=>[a.length===1?160:36+i*278/(a.length-1),130-(x.v-min)/(max-min)*100]);chart=`<div class="row between"><div><small>Последний результат</small><h2>${a.at(-1).v} ${unit}</h2></div><span class="pill">Лучший ${hi} ${unit}</span></div><svg class="svgchart" viewBox="0 0 330 155" role="img" aria-label="График прогресса"><g stroke="var(--line)" stroke-width="1"><path d="M36 30H314 M36 80H314 M36 130H314"/></g><g fill="var(--muted)" font-size="10"><text x="0" y="34">${max.toFixed(1)}</text><text x="0" y="134">${min.toFixed(1)}</text><text x="36" y="150">${fmt(a[0].date).slice(0,5)}</text><text x="314" y="150" text-anchor="end">${fmt(a.at(-1).date).slice(0,5)}</text></g><polyline points="${pos.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3"/>${pos.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--accent)"/>`).join('')}</svg><p class="muted">Последние ${a.length} сессий · ${e.weight?'максимальный вес':'максимум за подход'}</p>`}return `<h2>Прогресс</h2>${progressGroupPicker()}<div class="card"><label class="field"><small>Упражнение</small><select onchange="selected=this.value;render()">${allEx.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${x.id[0]} · ${esc(x.name)}</option>`).join('')}</select></label></div><div class="card">${chart}</div><div class="card"><h3>Правило прогрессии</h3><p>Когда во всех подходах достиг верхней границы повторов, добавь вес (+2,5 кг на верх, +5 кг на ноги), если сохраняются техника и комфорт. При необходимости используй меньший шаг.</p></div>`}
function settings(){return `<h2>Настройки и данные</h2><div class="card"><label class="checkline"><input type="checkbox" ${state.autoTimer===true?'checked':''} onchange="state.autoTimer=this.checked;save()"><span>Автоматический таймер<small>По умолчанию выключен. Можно запускать вручную.</small></span></label></div><div class="card stack"><h3>Резервная копия</h3><p class="muted">История и черновики хранятся на этом устройстве. Сохраняй копии: очистка данных Safari или удаление приложения может удалить историю.</p><button onclick="exportData()">Экспорт JSON</button><button onclick="document.getElementById('importFile').click()">Восстановить из JSON</button><input id="importFile" type="file" accept=".json,application/json" hidden onchange="importData(this)"></div><div class="card"><h3>Как записывать</h3><p class="muted">Вес гантели — одной гантели; 0 кг для собственного веса без дополнительного отягощения. Для односторонних упражнений — повторы на сторону. Для резинки указывай сопротивление в заметках.</p></div><div class="card"><h3>Установка на iPhone</h3><p>Открой размещённое по HTTPS приложение в Safari → Поделиться → На экран «Домой». После первого успешного кэширования оно работает офлайн.</p><p class="muted" id="offlineStatus">${location.protocol==='file:'?'Локальный просмотр: офлайн-установка требует веб-хостинга.':'Проверка офлайн-режима…'}</p></div><p class="muted">V1.8 · Локальный дневник · Без аккаунта и облачной синхронизации</p>`}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`gym-tracker-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function importData(input){try{const x=JSON.parse(await input.files[0].text());if(!valid(x))throw Error();if(confirm('Заменить текущие локальные данные резервной копией?')){state=x;state.autoTimer??=false;state.plans??={};state.custom??={};groupId=DEFAULT_GROUP;groupOpen=false;programEditing=false;workoutDate=today();day=selectedDayForDate(workoutDate);normalizeGroups();applyCustom();save();render();alert('Резервная копия восстановлена.')}}catch(e){alert('Не удалось открыть резервную копию. Проверь формат файла.')}finally{input.value=''}}
function render(){rememberCalendarScroll();if(setPad)dismissSetPad();main.innerHTML=({train,mob:mobility,history,progress,settings,library})[tab]();document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.getElementById('storageWarning').textContent=warning;document.body.classList.toggle('workout',tab==='train'&&groupOpen&&(mode==='exercise'||mode==='cool'));if(tab==='train'){updateProgress();updateTimer();restoreCalendarScroll()}if(tab==='mob')updateMobTimer();hydrateMedia();if(tab==='settings'&&navigator.serviceWorker&&location.protocol!=='file:'){navigator.serviceWorker.getRegistration().then(r=>{const el=document.getElementById('offlineStatus');if(el)el.textContent=r?.active?'Офлайн-кэш активен.':'Офлайн-кэш пока не активен.'}).catch(()=>{})}}
/* Workout groups. Legacy V1.x storage and finished sessions remain readable. */
function defaultGroup(){return {id:DEFAULT_GROUP,name:'Для мобильности',schedule:{}}}
function groupById(id){return state.groups?.find(g=>g.id===id)||state.groups?.find(g=>g.id===DEFAULT_GROUP)}
function sessionGroup(s){return s.groupId||DEFAULT_GROUP}
function groupName(id){return groupById(id)?.name||'Тренировка'}
function activeGroup(){return groupById(groupId)}
function groupBase(g){return g.program||(g.id===DEFAULT_GROUP?ORIGINAL:{})}
function customFor(g=activeGroup()){return g.id===DEFAULT_GROUP?state.custom:(g.custom??={})}
function plansFor(g=activeGroup()){return g.id===DEFAULT_GROUP?state.plans:(g.plans??={})}
function programFor(g){
 const source=groupBase(g),custom=g.id===DEFAULT_GROUP?state.custom:(g.custom||{});
 return Object.fromEntries(WORKOUT_DAYS.map(k=>{
  const p=source[k]||{day:k,focus:'',ex:[],cool:[]};
  return [k,{...p,ex:p.ex.map(base=>{
   const c=custom?.[base.id],x=LIB.find(z=>z.id===c?.source)||c?.snapshot;
   if(!x)return {...base};
   return {...base,name:x.name,unit:x.unit,weight:x.weight,visualId:x.visualId||x.id,sets:c.sets||base.sets,plan:c.plan||base.plan,rest:c.rest||base.rest,restLabel:(c.rest||base.rest)+' с',muscles:x.muscles,tip:x.tip};
  })}];
 }));
}
function allPrograms(){return state.groups.map(g=>programFor(g))}
function allProgramExercises(){return allPrograms().flatMap(p=>Object.values(p).flatMap(x=>x.ex))}
function allProgramCool(){return allPrograms().flatMap(p=>Object.values(p).flatMap(x=>x.cool))}
function slotKey(gid,date,k){return gid+'|'+date+'|'+k}
function workoutKey(){return slotKey(groupId,workoutDate,day)}
function groupDrafts(gid=groupId){return Object.values(state.groupDrafts).filter(d=>sessionGroup(d)===gid)}
function existingDraft(){return state.groupDrafts[workoutKey()]}
function currentWorkout(){
 const p=PROGRAM[day],d=existingDraft();
 return d&&workoutStarted(d)?{...p,ex:d.exerciseSnapshot||p.ex,cool:d.coolSnapshot||p.cool}:p;
}
function workoutExercise(id){return currentWorkout().ex.find(e=>e.id===id)||byId[id]}
function normalizeGroups(){
 let changed=false;
 if(!Array.isArray(state.groups)){state.groups=[defaultGroup()];changed=true}
 if(!state.groups.some(g=>g.id===DEFAULT_GROUP)){state.groups.unshift(defaultGroup());changed=true}
 for(const g of state.groups){g.schedule??={};if(g.id!==DEFAULT_GROUP){g.custom??={};g.plans??={}}}
 if(!state.groupDrafts){state.groupDrafts={};changed=true}
 for(const [k,d] of Object.entries(state.drafts||{})){
  const key=slotKey(DEFAULT_GROUP,d.date,k);
  if(!state.groupDrafts[key])state.groupDrafts[key]={...d,groupId:DEFAULT_GROUP,coolSnapshot:ORIGINAL[k].cool.map(x=>[...x])};
  delete state.drafts[k];changed=true;
 }
 if(state.timer&&!state.timer.groupId){const old=Object.values(state.groupDrafts).filter(d=>sessionGroup(d)===DEFAULT_GROUP&&workoutStarted(d)&&(!state.timer.day||d.day===state.timer.day)).sort((a,b)=>b.date.localeCompare(a.date))[0];state.timer.groupId=DEFAULT_GROUP;if(old){state.timer.date=old.date;state.timer.day=old.day}changed=true}
 if(changed&&!warning)save();
}
function dateShift(iso,n){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)}
function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function weekStart(iso){const d=new Date(iso+'T12:00:00');return dateShift(iso,-((d.getDay()+6)%7))}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime())&&localDate(new Date(v+'T12:00:00'))===v}
function suggestedDay(iso,g=activeGroup()){
 const open=groupDrafts(g.id).find(d=>d.date===iso&&workoutStarted(d));if(open)return open.day;
 const last=state.history.filter(s=>sessionGroup(s)===g.id&&s.date===iso).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];if(last)return last.day;
 return selectedDayForDate(iso);
}
function selectedDayForDate(iso){return ({1:'A',3:'B',5:'C'})[new Date(iso+'T12:00:00').getDay()]||'A'}
function openGroup(id){
 const g=state.groups.find(x=>x.id===id);if(!g)return;
 groupId=id;groupOpen=true;programEditing=false;mode='overview';detail='';stretchOpen='';workoutDate=today();resetCalendar(workoutDate);day=suggestedDay(workoutDate,g);applyCustom();selected=allEx[0]?.id||'';render();window.scrollTo(0,0)
}
function closeGroup(){groupOpen=false;programEditing=false;mode='overview';detail='';render();window.scrollTo(0,0)}
function chooseDate(date){if(!validDate(date))return;workoutDate=date;day=suggestedDay(date);mode='overview';detail='';stretchOpen='';render()}

function chooseDay(k){
 if(!WORKOUT_DAYS.includes(k))return;
 day=k;mode='overview';detail='';stretchOpen='';
 render();
}
function planDate(date,k){if(!validDate(date)||!WORKOUT_DAYS.includes(k))return;workoutDate=date;resetCalendar(date);day=k;mode='overview';detail='';stretchOpen='';render()}
/* Native, horizontally scrolling date strip; saved workouts alone make calendar marks. */
let calendarStart='',calendarCount=77,calendarScrollDays=null,calendarResetPending=false;
const CALENDAR_BATCH=28;
function resetCalendar(date=workoutDate){calendarStart=dateShift(weekStart(date),-35);calendarCount=77;calendarScrollDays=null;calendarResetPending=true}
function completedByDate(gid=groupId){
 const result=new Map();
 for(const s of state.history){if(sessionGroup(s)!==gid||!WORKOUT_DAYS.includes(s.day))continue;let marks=result.get(s.date);if(!marks){marks=new Set();result.set(s.date,marks)}marks.add(s.day)}
 return result;
}
function calendarCells(start,count){
 const marksByDate=completedByDate(),labels=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
 return Array.from({length:count},(_,i)=>{
  const iso=dateShift(start,i),marks=WORKOUT_DAYS.filter(k=>marksByDate.get(iso)?.has(k)),selectedDate=iso===workoutDate;
  return `<button type="button" class="calendar-day ${selectedDate?'chosen':''} ${marks.length?'completed':''}" aria-pressed="${selectedDate}" aria-label="${fmt(iso)}${marks.length?' · завершено '+marks.join(', '):''}" data-date="${iso}" onclick="chooseDate('${iso}')"><small>${labels[new Date(iso+'T12:00:00').getDay()]}</small><strong>${iso.slice(8,10)}</strong><span class="calendar-dot" aria-hidden="true"></span><b>${marks.join(' · ')||'—'}</b></button>`;
 }).join('');
}
function calendarHTML(){
 if(!calendarStart||workoutDate<calendarStart||workoutDate>dateShift(calendarStart,calendarCount-1))resetCalendar();
 return `<section class="group-calendar" aria-label="Календарь тренировок"><div id="calendarStrip" class="calendar-strip" data-group="${groupId}" data-start="${calendarStart}" onscroll="extendCalendar(this)">${calendarCells(calendarStart,calendarCount)}</div></section>`;
}
function rememberCalendarScroll(){
 if(calendarResetPending)return;
 const el=document.getElementById('calendarStrip');if(el?.clientWidth&&el.dataset.group===groupId&&el.dataset.start===calendarStart)calendarScrollDays=el.scrollLeft/el.clientWidth*7;
}
function restoreCalendarScroll(){
 const el=document.getElementById('calendarStrip');if(!el?.clientWidth)return;
 const days=calendarScrollDays??35;
 el.scrollLeft=days*el.clientWidth/7;calendarResetPending=false;
}
function extendCalendar(el){
 if(calendarResetPending||!el.clientWidth||el.dataset.group!==groupId||el.dataset.start!==calendarStart)return;
 const remaining=el.scrollWidth-el.clientWidth-el.scrollLeft;
 if(el.scrollLeft<el.clientWidth*1.5){
  const oldWidth=el.scrollWidth,oldLeft=el.scrollLeft,start=dateShift(calendarStart,-CALENDAR_BATCH);
  el.insertAdjacentHTML('afterbegin',calendarCells(start,CALENDAR_BATCH));
  calendarStart=start;calendarCount+=CALENDAR_BATCH;el.dataset.start=start;
  el.scrollLeft=oldLeft+el.scrollWidth-oldWidth;
 }else if(remaining<el.clientWidth*1.5){
  el.insertAdjacentHTML('beforeend',calendarCells(dateShift(calendarStart,calendarCount),CALENDAR_BATCH));calendarCount+=CALENDAR_BATCH;
 }
 calendarScrollDays=el.scrollLeft/el.clientWidth*7;
}
function uniqueId(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function emptyProgram(){return Object.fromEntries(WORKOUT_DAYS.map(k=>[k,{day:k,focus:'',ex:[],cool:[]}]))}
function copiedProgram(g){
 const p=programFor(g);return Object.fromEntries(WORKOUT_DAYS.map(k=>[k,{...p[k],ex:p[k].ex.map(e=>({...e,id:uniqueId(k),visualId:e.visualId||e.id})),cool:p[k].cool.map(x=>[...x])}]));
}
function validGroupName(name,exclude=''){const n=String(name||'').trim();if(!n||n.length>80){alert('Введи название группы (до 80 символов).');return ''}if(state.groups.some(g=>g.id!==exclude&&g.name.toLowerCase()===n.toLowerCase())){alert('Группа с таким названием уже существует.');return ''}return n}
function addGroup(name,copyId=''){
 name=validGroupName(name);if(!name)return false;
 const source=state.groups.find(g=>g.id===copyId),g={id:uniqueId('g-'),name,program:source?copiedProgram(source):emptyProgram(),schedule:{},plans:{},custom:{}};
 state.groups.push(g);save();openGroup(g.id);if(!source){day='A';editGroupProgram()}return true;
}
function renameGroup(name){
 const g=activeGroup(),n=validGroupName(name,g.id);if(!n)return false;g.name=n;save();render();return true
}
function showGroupDialog(id){document.getElementById(id)?.showModal()}
function newGroupFromForm(){addGroup(document.getElementById('newGroupName').value,document.getElementById('newGroupTemplate').value)}
function renameGroupFromForm(){renameGroup(document.getElementById('renameGroupName').value)}
function groupChooser(){
 return `<div class="eyebrow">ТВОИ ПРОГРАММЫ · V1.8</div><div class="row between group-list-heading"><h2>Группы тренировок</h2></div><div class="group-cards">${state.groups.map(g=>{const p=programFor(g),n=WORKOUT_DAYS.reduce((n,k)=>n+p[k].ex.length,0),draftCount=groupDrafts(g.id).filter(workoutStarted).length;return `<button class="group-card" onclick="openGroup('${g.id}')"><span class="group-card-icon" aria-hidden="true">${uiIcon('group')}</span><span class="group-card-text"><strong>${esc(g.name)}</strong><small>A · B · C &nbsp; · &nbsp; ${n} упр.${draftCount?' · '+draftCount+' черн.':''}</small></span><b aria-hidden="true">›</b></button>`}).join('')}</div><button class="primary wide" onclick="showGroupDialog('newGroupDialog')">＋ Создать группу</button><dialog class="workout-menu" id="newGroupDialog" aria-labelledby="newGroupTitle"><div class="stack"><div class="row between"><h3 id="newGroupTitle">Новая группа</h3><button class="menu-close" aria-label="Закрыть" onclick="this.closest('dialog').close()">×</button></div><label class="field"><small>Название группы</small><input id="newGroupName" maxlength="80" placeholder="Например, Силовая"></label><label class="field"><small>Программа</small><select id="newGroupTemplate"><option value="">Создать с нуля</option>${state.groups.map(g=>`<option value="${g.id}">Копировать: ${esc(g.name)}</option>`).join('')}</select></label><button class="primary wide" onclick="newGroupFromForm()">Создать</button></div></dialog>`;
}
function groupTopHTML(){return `<div class="row between group-top"><button class="round" aria-label="К группам" onclick="closeGroup()">←</button><h2>${esc(activeGroup().name)}</h2><button class="group-settings" aria-label="Настройки группы" onclick="showGroupDialog('groupSettingsDialog')">${uiIcon('settings')}</button></div><dialog id="groupSettingsDialog" class="workout-menu" aria-labelledby="groupSettingsTitle"><div class="stack"><div class="row between"><h3 id="groupSettingsTitle">Настройки группы</h3><button class="menu-close" aria-label="Закрыть" onclick="this.closest('dialog').close()">×</button></div><label class="field"><small>Название группы</small><input id="renameGroupName" maxlength="80" value="${esc(activeGroup().name)}"></label><button class="primary wide" onclick="renameGroupFromForm()">Сохранить название</button><button class="wide" onclick="editGroupProgram()">Редактировать комплексы A / B / C</button></div></dialog>`}
function complexTabs(){return `<div class="complex-tabs" aria-label="Выбор комплекса">${WORKOUT_DAYS.map(k=>`<button class="${k===day?'current':''}" aria-pressed="${k===day}" onclick="chooseDay('${k}')">${k}</button>`).join('')}</div>`}
function draftLinksHTML(){
 const drafts=groupDrafts().filter(d=>workoutStarted(d)&&(d.date!==workoutDate||d.day!==day)).sort((a,b)=>b.date.localeCompare(a.date));
 return drafts.length?`<details class="group-drafts"><summary>Незавершённые тренировки · ${drafts.length}</summary>${drafts.map(d=>`<button class="exercise-list-item" onclick="planDate('${d.date}','${d.day}')"><span>${fmt(d.date)} · ${d.day}</span><b>›</b></button>`).join('')}</details>`:'';
}
function editGroupProgram(){programEditing=true;mode='overview';detail='';render();window.scrollTo(0,0)}
function closeGroupEditor(){programEditing=false;render();window.scrollTo(0,0)}
function ensureGroupProgram(){const g=activeGroup();g.program??=JSON.parse(JSON.stringify(groupBase(g)));return g.program}
function hasDraftForDay(){return groupDrafts().some(d=>d.day===day&&workoutStarted(d))}
function clearEmptyDrafts(){for(const [key,d] of Object.entries(state.groupDrafts)){if(sessionGroup(d)===groupId&&d.day===day&&!workoutStarted(d))delete state.groupDrafts[key]}}
function appendGroupExercise(source,n,reps,rest){
 if(hasDraftForDay()){alert('Сначала заверши или отмени начатые тренировки этого комплекса.');return false}
 const x=LIB.find(e=>e.id===source);n=Number(n);rest=Number(rest);reps=String(reps||'').trim();
 if(!x||!Number.isInteger(n)||n<1||n>12||!reps||reps.length>40||!Number.isInteger(rest)||rest<1||rest>600){alert('Выбери упражнение и проверь подходы, повторы и отдых.');return false}
 const p=ensureGroupProgram()[day],info=infoFor(x);
 p.ex.push({id:uniqueId(day),visualId:x.visualId||x.id,name:x.name,unit:x.unit||'повт.',weight:!!x.weight,sets:n,plan:n+' × '+reps,rest,restLabel:rest+' с',muscles:info.muscles,tip:info.tip});
 clearEmptyDrafts();applyCustom();save();render();return true;
}
function addGroupExerciseFromForm(){appendGroupExercise(document.getElementById('groupAddSource').value,document.getElementById('groupAddSets').value,document.getElementById('groupAddReps').value,document.getElementById('groupAddRest').value)}
function removeGroupExercise(id){
 if(hasDraftForDay()){alert('Сначала заверши или отмени начатые тренировки этого комплекса.');return}
 if(!PROGRAM[day].ex.some(e=>e.id===id)||!confirm('Убрать упражнение из этого комплекса? Прошлая история останется.'))return;
 const p=ensureGroupProgram()[day];p.ex=p.ex.filter(x=>x.id!==id);delete customFor()[id];delete plansFor()[id];clearEmptyDrafts();applyCustom();save();render()
}
function groupExerciseOptions(q='',v=''){return LIB.filter(e=>e.id===v||[e.name,e.muscles,e.category,e.equipment].join(' ').toLowerCase().includes(q.toLowerCase())).map(e=>`<option value="${esc(e.id)}" ${e.id===v?'selected':''}>${esc(e.name)}</option>`).join('')}
function filterGroupExercises(input){const el=document.getElementById('groupAddSource');el.innerHTML=groupExerciseOptions(input.value,el.value)}
function groupExerciseDefaults(){const x=LIB.find(e=>e.id===document.getElementById('groupAddSource').value);if(!x)return;document.getElementById('groupAddSets').value=x.sets||3;document.getElementById('groupAddReps').value=x.plan?.split('×')[1]?.trim()||(x.unit==='сек'?'30':'10–12');document.getElementById('groupAddRest').value=x.rest||60}
function groupEditorHTML(){
 const p=PROGRAM[day],locked=hasDraftForDay(),first=LIB[0];
 return `<button class="linklike" onclick="closeGroupEditor()">‹ ${esc(activeGroup().name)}</button><h2>Редактирование комплексов</h2>${complexTabs()}<div class="card stack"><h3>Комплекс ${day} · ${p.ex.length} упр.</h3>${locked?'<p class="notice">Для изменения списка сначала заверши или отмени начатые тренировки этого комплекса.</p>':''}${p.ex.length?p.ex.map(e=>`<div class="row between group-edit-item"><span><strong>${esc(e.name)}</strong><small>${esc(e.plan)}</small></span><button class="danger" aria-label="Убрать ${esc(e.name)}" onclick="removeGroupExercise('${e.id}')" ${locked?'disabled':''}>−</button></div>`).join(''):'<p class="muted">Пока нет упражнений.</p>'}</div>${locked?'':`<div class="card stack"><h3>Добавить упражнение</h3><input type="search" placeholder="Поиск по библиотеке" oninput="filterGroupExercises(this)"><label class="field"><small>Упражнение</small><select id="groupAddSource" onchange="groupExerciseDefaults()">${groupExerciseOptions()}</select></label><div class="group-entry-fields"><label class="field"><small>Подходы</small><input id="groupAddSets" type="number" min="1" max="12" value="${first?.sets||3}"></label><label class="field"><small>Повторы / сек</small><input id="groupAddReps" value="${esc(first?.plan?.split('×')[1]?.trim()||'10–12')}"></label><label class="field"><small>Отдых, сек</small><input id="groupAddRest" type="number" min="1" max="600" value="${first?.rest||60}"></label></div><button class="primary wide" onclick="addGroupExerciseFromForm()">＋ Добавить</button></div>`}<button class="wide" onclick="closeGroupEditor()">Готово</button>`;
}

/* A single rounded, line-icon family. */
function uiIcon(name){
 const paths={
  check:'<path d="m5 12 4 4L19 6"/>',right:'<path d="M4 12h15m-6-6 6 6-6 6"/>',down:'<path d="M12 4v15m-6-6 6 6 6-6"/>',backspace:'<path d="M9 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-7-7 7-7Z"/><path d="m12 9 6 6m0-6-6 6"/>',
  technique:'<path d="m9 5 11 7-11 7V5Z"/>',history:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',replace:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',notes:'<path d="m15 4 5 5-11 11H4v-5L15 4Z"/><path d="m13 6 5 5"/>',group:'<path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--card)"/><circle cx="15" cy="17" r="2.5" fill="var(--card)"/>'
 };
 return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.group}</svg>`;
}

/* Inline workout input: own keypad, no native keyboard or separate dialog. */
let setPad=null, padReplace=false;
function setFieldId(id,i,k){return 'actual-'+id+'-'+i+'-'+k}
function shownSetValue(k,v){return k==='w'?String(v??'').replace('.',','):String(v??'')}
function setFieldHTML(e,v,i,k){
 const label=k==='w'?'Вес':e.unit==='сек'?'Секунды':'Повторения';
 return `<input class="actual-field" id="${setFieldId(e.id,i,k)}" type="text" inputmode="none" readonly autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${label} подхода ${i+1}" aria-describedby="padHint" value="${esc(shownSetValue(k,v[k]))}" placeholder="${k==='w'?'кг':esc(e.unit)}" data-set-index="${i}" data-set-key="${k}" onfocus="openSetPad('${e.id}',${i},'${k}')" onclick="openSetPad('${e.id}',${i},'${k}')" onkeydown="setFieldKey(event)">`;
}
function setRowsHTML(e,a){return a.map((v,i)=>`<div id="set-row-${e.id}-${i}" class="setrow ${e.weight?'':'noweight'} ${v.done?'set-complete':''}"><span class="set-num">${i+1}</span>${e.weight?setFieldHTML(e,v,i,'w'):''}${setFieldHTML(e,v,i,'r')}<button id="set-${e.id}-${i}" class="${v.done?'done':''}" aria-label="Отметить подход ${i+1}" aria-pressed="${v.done}" onclick="toggleSet('${e.id}',${i})">${uiIcon('check')}</button></div>${i>=e.sets?`<button class="remove-extra" onclick="removeSet('${e.id}',${i})">Удалить доп. подход ${i+1}</button>`:''}`).join('')}
function setPadHTML(){return `<span id="padHint" class="sr-only">Ввод цифровой клавиатурой GYM. Enter — следующее поле, Escape — скрыть.</span><section id="setKeypad" class="set-keypad" aria-label="Цифровая клавиатура" hidden><div class="keypad-inner"><div class="keypad-toolbar"><button type="button" class="keypad-hide" aria-label="Скрыть клавиатуру" onpointerdown="event.preventDefault()" onclick="dismissSetPad()">${uiIcon('down')}</button><button type="button" id="keypadNext" class="primary keypad-next" onpointerdown="event.preventDefault()" onclick="nextSetField()">ДАЛЕЕ ${uiIcon('right')}</button></div><div class="keypad-grid">${['1','2','3','4','5','6','7','8','9',',','0','del'].map(k=>`<button type="button" ${k===','?'id="keypadDecimal"':''} aria-label="${k==='del'?'Удалить символ':k===','?'Запятая':k}" onpointerdown="event.preventDefault()" onclick="pressSetKey('${k}')">${k==='del'?uiIcon('backspace'):k}</button>`).join('')}</div></div></section>`}
function validPadField(id,i,k){
 const e=mode==='exercise'&&groupOpen?currentWorkout().ex[exIndex]:null;
 return !!(e&&e.id===id&&existingDraft()?.entries[id]?.[i]&&Number.isInteger(i)&&i>=0&&(k==='r'||(k==='w'&&e.weight)))
}
function nextField(p=setPad){
 if(!p||!validPadField(p.id,p.i,p.k))return null;
 const e=workoutExercise(p.id),a=existingDraft().entries[p.id];
 if(p.k==='w')return {id:p.id,i:p.i,k:'r'};
 if(p.i+1<a.length)return {id:p.id,i:p.i+1,k:e.weight?'w':'r'};
 return null;
}
function padElement(){return setPad?document.getElementById(setFieldId(setPad.id,setPad.i,setPad.k)):null}
function updatePadLayout(){
 const pad=document.getElementById('setKeypad');if(!pad||!setPad)return;
 const h=pad.getBoundingClientRect?.().height||310;
 document.body.style?.setProperty('--pad-height',Math.ceil(h)+'px');
}
function syncSetPad(){
 const pad=document.getElementById('setKeypad');if(!pad)return;
 document.querySelectorAll('.actual-field.pad-active').forEach(el=>el.classList.remove('pad-active'));
 document.querySelectorAll('.setrow.pad-current').forEach(el=>el.classList.remove('pad-current'));
 if(!setPad||!validPadField(setPad.id,setPad.i,setPad.k)){pad.hidden=true;document.body.classList.toggle('pad-open',false);return}
 const input=padElement();
 if(!input){pad.hidden=true;document.body.classList.toggle('pad-open',false);return}
 pad.hidden=false;document.body.classList.toggle('pad-open',true);
 input.classList?.add?.('pad-active');input.closest?.('.setrow')?.classList?.add?.('pad-current');
 const next=document.getElementById('keypadNext');
 if(next)next.innerHTML=nextField()?('ДАЛЕЕ '+uiIcon('right')):('ГОТОВО '+uiIcon('check'));
 const decimal=document.getElementById('keypadDecimal');if(decimal)decimal.disabled=setPad.k!=='w';
 updatePadLayout();
}
function keepSetVisible(){
 const input=padElement(),pad=document.getElementById('setKeypad');if(!input||!pad||pad.hidden||!input.getBoundingClientRect)return;
 const rect=(input.closest('.setrow')||input).getBoundingClientRect(),limit=pad.getBoundingClientRect().top-12,top=12;
 const shift=rect.bottom>limit?rect.bottom-limit:rect.top<top?rect.top-top:0;
 if(shift&&typeof window.scrollBy==='function')window.scrollBy(0,shift);
}
function openSetPad(id,i,k){
 if(!validPadField(id,i,k))return;
 const unchanged=setPad&&setPad.id===id&&setPad.i===i&&setPad.k===k;
 if(!unchanged){setPad={id,i,k};padReplace=true}
 syncSetPad();
 const el=padElement();if(el&&document.activeElement!==el)el.focus?.({preventScroll:true});
 keepSetVisible();
}
function dismissSetPad(blur=true){
 const input=padElement();
 setPad=null;padReplace=false;
 const pad=document.getElementById('setKeypad');if(pad)pad.hidden=true;
 document.body.classList.toggle('pad-open',false);
 document.querySelectorAll('.actual-field.pad-active,.setrow.pad-current').forEach(el=>{el.classList.remove('pad-active');el.classList.remove('pad-current')});
 if(blur&&input&&document.activeElement===input)input.blur?.();
}
function pressSetKey(key){
 if(!setPad||!validPadField(setPad.id,setPad.i,setPad.k))return;
 const {id,i,k}=setPad,old=shownSetValue(k,existingDraft().entries[id][i][k]);let value=old;
 if(key==='del'){value=old.slice(0,-1);padReplace=false}
 else if(/^\d$/.test(key)){value=padReplace?key:old+key;padReplace=false}
 else if(key===','&&k==='w'){if(padReplace||!old)value='0,';else if(!old.includes(','))value=old+',';padReplace=false}
 else return;
 if(value!==old)editSet(id,i,k,value);
}
function nextSetField(){
 if(!setPad)return;
 const {id,i,k}=setPad;
 if(validPadField(id,i,k)&&k==='w'){const v=String(existingDraft().entries[id][i].w??'');if(/[.,]$/.test(v))editSet(id,i,k,v.slice(0,-1))}
 const next=nextField();
 if(next)openSetPad(next.id,next.i,next.k);else dismissSetPad();
}
function setFieldKey(event){
 if(event.key==='Enter'){event.preventDefault();nextSetField()}
 else if(event.key==='Escape'){event.preventDefault();dismissSetPad()}
 else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();pressSetKey('del')}
 else if(/^\d$/.test(event.key)||event.key===','||event.key==='.'){event.preventDefault();pressSetKey(event.key==='.'?',':event.key)}
}
function updateSetRow(id,i){
 const s=existingDraft()?.entries[id]?.[i];if(!s)return;
 const b=document.getElementById(`set-${id}-${i}`),row=document.getElementById(`set-row-${id}-${i}`);
 if(b){b.classList.toggle('done',s.done);b.setAttribute('aria-pressed',String(s.done))}
 if(row)row.classList.toggle('set-complete',s.done);
 for(const k of ['w','r']){const field=document.getElementById(setFieldId(id,i,k));if(field)field.value=shownSetValue(k,s[k])}
}
function preserveRowAnchor(el,fn){
 const top=el?.getBoundingClientRect?.().top;fn();
 if(typeof top==='number'&&el?.isConnected&&typeof window.scrollBy==='function'){
  const delta=el.getBoundingClientRect().top-top;if(Math.abs(delta)>1)window.scrollBy(0,delta);
 }
}
function refreshSetRows(id){
 const rows=document.getElementById('workoutSetRows');if(!rows){render();return}
 const e=workoutExercise(id),a=existingDraft().entries[id];preserveRowAnchor(rows,()=>{rows.innerHTML=setRowsHTML(e,a);updateProgress();syncSetPad()});
 if(setPad){padElement()?.focus?.({preventScroll:true});keepSetVisible()}
}


normalizeGroups();applyCustom();
window.addEventListener?.('resize',()=>{if(setPad){updatePadLayout();keepSetVisible()}});
main.addEventListener?.('load',event=>{if(setPad&&event.target?.tagName==='IMG')keepSetVisible()},true);
main.addEventListener?.('focusin',event=>{if(setPad&&event.target?.matches?.('input:not(.actual-field),textarea,select'))dismissSetPad(false)});
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register('./sw.js').then(r=>r.update()).catch(()=>{});}initLibrary();
