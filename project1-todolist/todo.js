/* =========================================================
   전역 상태 (In-memory Array, DB 미사용)
   ========================================================= */
let taskArr = [];   // { id, title, date, done }
let taskSeq = 1;

/* =========================================================
   isNull(str)
   인자: str - 빈 값인지 확인할 문자열
   리턴값: boolean (true: 빈 값 / false: 빈 값 아님)
   동작: str의 길이가 0이면 true, 아니면 false 반환
   ========================================================= */
function isNull(str){
  return !str || str.length <= 0;
}

/* =========================================================
   isEnteredAll()
   인자: 없음
   리턴값: boolean (true: 제목/날짜 모두 입력됨 / false: 미입력 값 존재)
   동작: 일정 제목(#taskTitle), 날짜(#taskDate) 입력값을 가져와
        하나라도 비어있으면 false를 반환
   ========================================================= */
function isEnteredAll(){
  const title = document.getElementById('taskTitle').value.trim();
  const date = document.getElementById('taskDate').value;
  return !isNull(title) && !isNull(date);
}

/* =========================================================
   paintFieldCheck()
   인자: 없음 / 리턴값: 없음
   동작: 제목/날짜 입력값이 비어있는 항목에 한해 빨간 테두리와
        "입력해주세요" 문구를 표시. 값이 채워지면 문구를 지움
   ========================================================= */
function paintFieldCheck(){
  const titleEl = document.getElementById('taskTitle');
  const dateEl = document.getElementById('taskDate');
  const titleMsg = document.getElementById('titleMsg');
  const dateMsg = document.getElementById('dateMsg');

  const titleEmpty = isNull(titleEl.value.trim());
  const dateEmpty = isNull(dateEl.value);

  titleEl.classList.toggle('invalid', titleEmpty);
  titleMsg.textContent = titleEmpty ? '일정 제목을 입력하세요.' : '';
  dateEl.classList.toggle('invalid', dateEmpty);
  dateMsg.textContent = dateEmpty ? '날짜를 선택하세요.' : '';
}

/* =========================================================
   openAlert(msg) / closeAlert()
   인자: msg - 표시할 경고 문구 / 리턴값: 없음
   동작: 화면 중앙에 커스텀 경고 모달을 열고/닫음
   ========================================================= */
function openAlert(msg){
  document.getElementById('alertMsg').textContent = msg;
  document.getElementById('alertModal').classList.add('show');
}
function closeAlert(){
  document.getElementById('alertModal').classList.remove('show');
}

/* =========================================================
   addTask(e)  ── FR1) 일정을 추가할 수 있어야 합니다
   인자: e - [+ 추가] 버튼 클릭 이벤트
   리턴값: 없음
   동작:
     1. isEnteredAll()로 제목/날짜가 모두 입력되었는지 확인합니다.
     2. 하나라도 비어있다면 paintFieldCheck()로 빈 칸을 표시하고,
        openAlert()로 "필수 항목을 모두 입력해주세요." 경고창을 띄운 뒤 종료합니다.
     3. 모두 입력되었다면 taskArr 배열에 { id, title, date, done:false }
        객체를 추가하고, 입력창을 초기화한 뒤 renderTasks()를 호출합니다.
   ========================================================= */
function addTask(e){
  if(e) e.preventDefault();
  paintFieldCheck();

  if(!isEnteredAll()){
    openAlert('필수 항목을 모두 입력해주세요.');
    return;
  }

  const title = document.getElementById('taskTitle').value.trim();
  const date = document.getElementById('taskDate').value;

  taskArr.push({ id: taskSeq++, title, date, done:false });

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDate').value = '';
  paintFieldCheck();
  renderTasks();
}

/* =========================================================
   deleteTask(id)  ── FR2) 일정을 삭제할 수 있어야 합니다
   인자: id - 삭제할 일정의 고유 id
   리턴값: 없음
   동작: taskArr 배열에서 해당 id를 제외한 나머지 항목만 남기고(filter),
        renderTasks()를 호출하여 화면을 갱신합니다.
   ========================================================= */
function deleteTask(id){
  taskArr = taskArr.filter(t => t.id !== id);
  renderTasks();
}

/* =========================================================
   toggleDone(id)  ── (추가 구현) 일정 완료 처리
   인자: id - 완료 상태를 전환할 일정의 id / 리턴값: 없음
   동작: 해당 id를 가진 일정 객체의 done 값을 반전시킵니다.
   ========================================================= */
function toggleDone(id){
  const t = taskArr.find(t => t.id === id);
  if(t) t.done = !t.done;
  renderTasks();
}

/* =========================================================
   formatDate(d) / escapeHtml(str) - 보조 함수
   ========================================================= */
function formatDate(d){
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   isWithinWeek(dateStr)  ── (추가 구현) FR5) 오늘부터 일주일간의 일정만 보기
   인자: dateStr - 'YYYY-MM-DD' 형식의 일정 날짜
   리턴값: boolean (true: 오늘 ~ 오늘+6일 범위 안에 있음)
   ========================================================= */
function isWithinWeek(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0,0,0,0);
  const weekLater = new Date(today);
  weekLater.setDate(today.getDate() + 6);
  return d >= today && d <= weekLater;
}

/* =========================================================
   renderTasks()
   인자: 없음 / 리턴값: 없음
   동작: taskArr 배열의 현재 상태를 #taskList DOM에 다시 그립니다.
        addTask/deleteTask/toggleDone 실행 직후 항상 호출되어
        화면과 데이터 상태를 동기화합니다.
   ========================================================= */
function renderTasks(){
  const listEl = document.getElementById('taskList');
  const emptyEl = document.getElementById('taskEmpty');
  const weekOnly = document.getElementById('weekFilter').checked;

  const visible = weekOnly ? taskArr.filter(t => isWithinWeek(t.date)) : taskArr;
  document.getElementById('taskCount').textContent = visible.length;

  listEl.innerHTML = '';
  if(visible.length === 0){
    emptyEl.style.display = 'block';
    emptyEl.querySelector('.empty-text').textContent = weekOnly
      ? '이번 주(오늘~7일) 안에 등록된 일정이 없습니다.'
      : '아직 등록된 일정이 없습니다. 위에서 첫 일정을 추가해보세요.';
    return;
  }
  emptyEl.style.display = 'none';

  visible.forEach((t, idx) => {
    const row = document.createElement('div');
    row.className = 'ledger-row' + (t.done ? ' done' : '');
    row.innerHTML = `
      <span class="ledger-no">No.${String(idx+1).padStart(3,'0')}</span>
      <span class="task-title">${escapeHtml(t.title)}</span>
      <span class="task-date">${formatDate(t.date)}</span>
      <span><input type="checkbox" class="done-checkbox" ${t.done ? 'checked' : ''} onchange="toggleDone(${t.id})"></span>
      <span><button class="btn-danger" onclick="deleteTask(${t.id})">삭제</button></span>
    `;
    listEl.appendChild(row);
  });
}

/* =========================================================
   초기화
   ========================================================= */
document.getElementById('weekFilter').addEventListener('change', renderTasks);
document.getElementById('addBtn').addEventListener('click', addTask);
document.getElementById('taskTitle').addEventListener('input', paintFieldCheck);
document.getElementById('taskDate').addEventListener('input', paintFieldCheck);
renderTasks();

/* =========================================================
   [문서 스크린샷용] 데모 상태 로더
   URL 뒤에 ?demo=state 를 붙이면 문서에 들어갈 화면 캡처를 위해
   미리 정의된 상태를 자동으로 재현합니다. 실제 서비스 로직과 무관한
   보조 스크립트이며, 최종 사용자 흐름에는 영향을 주지 않습니다.
   ========================================================= */
(function demoLoader(){
  const state = new URLSearchParams(location.search).get('demo');
  if(!state) return;
  if(state === 'filled'){
    document.getElementById('taskTitle').value = '사내 시스템 교육 참석';
    document.getElementById('taskDate').value = '2026-08-05';
  }
  if(state === 'list'){
    taskArr = [
      { id:1, title:'사내 시스템 교육 참석', date:'2026-08-05', done:false },
      { id:2, title:'멘토링 세션 준비', date:'2026-08-06', done:true },
      { id:3, title:'최종 프로젝트 보고서 작성', date:'2026-08-07', done:false },
    ];
    renderTasks();
  }
  if(state === 'alert'){
    openAlert('필수 항목을 모두 입력해주세요.');
  }
})();
