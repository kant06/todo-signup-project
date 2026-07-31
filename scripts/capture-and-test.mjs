import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const screenshotDir = path.join(repoRoot, 'reports', 'screenshots');
const chromeEndpoint = process.env.CHROME_ENDPOINT || 'http://127.0.0.1:9223';
const shouldCapture = process.env.CAPTURE_SCREENSHOTS === '1';
const failures = [];
const browserErrors = [];
let screenshotCount = 0;

class CdpClient {
  constructor(url){
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect(){
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once:true });
      this.ws.addEventListener('error', reject, { once:true });
    });

    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if(message.id){
        const pending = this.pending.get(message.id);
        if(!pending) return;
        this.pending.delete(message.id);
        if(message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }

      const listeners = this.listeners.get(message.method) || [];
      listeners.forEach(resolve => resolve(message.params));
      this.listeners.delete(message.method);
    });
  }

  send(method, params = {}){
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  once(method){
    return new Promise(resolve => {
      const listeners = this.listeners.get(method) || [];
      listeners.push(resolve);
      this.listeners.set(method, listeners);
    });
  }

  close(){
    this.ws.close();
  }
}

async function openPage(filePath, width, height){
  const response = await fetch(`${chromeEndpoint}/json/new?about:blank`, { method:'PUT' });
  if(!response.ok) throw new Error(`Chrome target 생성 실패: ${response.status}`);

  const target = await response.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor:1,
    mobile:false
  });

  client.listeners.set('Runtime.exceptionThrown', [
    params => browserErrors.push(params.exceptionDetails.text)
  ]);
  client.listeners.set('Log.entryAdded', [
    params => {
      if(params.entry.level === 'error') browserErrors.push(params.entry.text);
    }
  ]);

  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url:`file://${filePath}` });
  await loaded;
  await evaluate(client, 'document.fonts.ready.then(() => true)');
  return client;
}

async function evaluate(client, expression){
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise:true,
    returnByValue:true
  });
  if(response.exceptionDetails){
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result.value;
}

async function capture(client, filename){
  if(!shouldCapture) return;

  const result = await client.send('Page.captureScreenshot', {
    format:'png',
    fromSurface:true,
    captureBeyondViewport:false
  });
  await writeFile(path.join(screenshotDir, filename), Buffer.from(result.data, 'base64'));
  screenshotCount += 1;
}

function expect(name, condition){
  if(!condition) failures.push(name);
}

const todoPath = path.join(repoRoot, 'project1-todolist', 'todo.html');
const signupPath = path.join(repoRoot, 'project2-signup', 'signup.html');

if(shouldCapture) await mkdir(screenshotDir, { recursive:true });

const todo = await openPage(todoPath, 1000, 820);
await capture(todo, 'todo-01-initial.png');

const todoBeforeEnter = await evaluate(todo, `(() => {
  const form = document.getElementById('taskForm');
  const title = document.getElementById('taskTitle');
  const date = document.getElementById('taskDate');
  const addButton = document.getElementById('addBtn');
  const dateOffset = days => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + days);
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  };
  const fill = (taskTitle, days) => {
    title.value = taskTitle;
    title.dispatchEvent(new Event('input', { bubbles:true }));
    date.value = dateOffset(days);
    date.dispatchEvent(new Event('input', { bubbles:true }));
  };

  fill('사내 시스템 교육 참석', 2);
  addButton.click();
  const countAfterButton = document.querySelectorAll('.ledger-row').length;
  fill('멘토링 세션 준비', 5);
  title.focus();
  return { countAfterButton, formId:form.id };
})()`);
expect('To-Do 추가 버튼 등록', todoBeforeEnter.countAfterButton === 1);

await todo.send('Input.dispatchKeyEvent', {
  type:'keyDown',
  key:'Enter',
  code:'Enter',
  text:'\r',
  unmodifiedText:'\r',
  windowsVirtualKeyCode:13,
  nativeVirtualKeyCode:13
});
await todo.send('Input.dispatchKeyEvent', {
  type:'keyUp',
  key:'Enter',
  code:'Enter',
  windowsVirtualKeyCode:13,
  nativeVirtualKeyCode:13
});

const todoAdded = await evaluate(todo, `(() => {
  const title = document.getElementById('taskTitle');
  const date = document.getElementById('taskDate');
  const dateValue = new Date();
  dateValue.setHours(0, 0, 0, 0);
  dateValue.setDate(dateValue.getDate() + 30);
  title.value = '최종 프로젝트 보고서 작성';
  title.dispatchEvent(new Event('input', { bubbles:true }));
  date.value = [dateValue.getFullYear(), String(dateValue.getMonth() + 1).padStart(2, '0'), String(dateValue.getDate()).padStart(2, '0')].join('-');
  date.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('addBtn').click();
  return {
    count:Number(document.getElementById('taskCount').textContent),
    rowCount:document.querySelectorAll('.ledger-row').length,
    titleValue:title.value,
    dateValue:date.value,
    invalidCount:document.querySelectorAll('.invalid').length,
    messageCount:[document.getElementById('titleMsg'), document.getElementById('dateMsg')]
      .filter(element => element.textContent).length
  };
})()`);
expect('To-Do Enter 등록과 일정 3건 추가', todoAdded.count === 3 && todoAdded.rowCount === 3);
expect('To-Do 추가 후 폼 초기화', todoAdded.titleValue === '' && todoAdded.dateValue === '');
expect('To-Do 추가 후 오류 상태 제거', todoAdded.invalidCount === 0 && todoAdded.messageCount === 0);
await capture(todo, 'todo-02-added.png');

const doneState = await evaluate(todo, `(() => {
  document.querySelectorAll('.done-checkbox')[1].click();
  const updatedCheckbox = document.querySelectorAll('.done-checkbox')[1];
  return {
    checked:updatedCheckbox.checked,
    rowDone:updatedCheckbox.closest('.ledger-row').classList.contains('done'),
    doneRows:document.querySelectorAll('.ledger-row.done').length
  };
})()`);
expect('To-Do 완료 전환', doneState.checked && doneState.rowDone && doneState.doneRows === 1);
await capture(todo, 'todo-03-completed.png');

const deleteState = await evaluate(todo, `(() => {
  document.querySelector('[data-action="delete"]').click();
  return {
    count:Number(document.getElementById('taskCount').textContent),
    rowCount:document.querySelectorAll('.ledger-row').length,
    firstTitle:document.querySelector('.task-title')?.textContent
  };
})()`);
expect('To-Do id별 즉시 삭제', deleteState.count === 2
  && deleteState.rowCount === 2
  && deleteState.firstTitle === '멘토링 세션 준비');
await capture(todo, 'todo-04-deleted.png');

const filterState = await evaluate(todo, `(() => {
  document.getElementById('weekFilter').click();
  return {
    visibleRows:document.querySelectorAll('.ledger-row').length,
    countText:document.getElementById('taskCount').textContent,
    visibleTitle:document.querySelector('.task-title')?.textContent
  };
})()`);
expect('To-Do 7일 필터', filterState.visibleRows === 1
  && filterState.countText === '1'
  && filterState.visibleTitle === '멘토링 세션 준비');
await capture(todo, 'todo-05-week-filter.png');

const todoGlobals = await evaluate(todo, `(() => ({
  taskArr:typeof window.taskArr,
  addTask:typeof window.addTask,
  isWithinWeek:typeof window.isWithinWeek
}))()`);
expect('To-Do 내부 상태와 함수 비공개', Object.values(todoGlobals).every(value => value === 'undefined'));
todo.close();

const todoBoundary = await openPage(todoPath, 1000, 820);
const boundaryState = await evaluate(todoBoundary, `(() => {
  const title = document.getElementById('taskTitle');
  const date = document.getElementById('taskDate');
  const addButton = document.getElementById('addBtn');
  const dateOffset = days => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + days);
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  };
  const add = (taskTitle, days) => {
    title.value = taskTitle;
    title.dispatchEvent(new Event('input', { bubbles:true }));
    date.value = dateOffset(days);
    date.dispatchEvent(new Event('input', { bubbles:true }));
    addButton.click();
  };
  add('오늘 일정', 0);
  add('6일 뒤 일정', 6);
  add('7일 뒤 일정', 7);
  document.getElementById('weekFilter').click();
  return [...document.querySelectorAll('.task-title')].map(element => element.textContent);
})()`);
expect('To-Do 필터 경계값', boundaryState.length === 2
  && boundaryState.includes('오늘 일정')
  && boundaryState.includes('6일 뒤 일정')
  && !boundaryState.includes('7일 뒤 일정'));

const xssState = await evaluate(todoBoundary, `(() => {
  const maliciousTitle = '<img src=x onerror="window.__xssExecuted=true">';
  const title = document.getElementById('taskTitle');
  const date = document.getElementById('taskDate');
  window.__xssExecuted = false;
  document.getElementById('weekFilter').click();
  title.value = maliciousTitle;
  title.dispatchEvent(new Event('input', { bubbles:true }));
  const value = new Date();
  date.value = [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  date.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('addBtn').click();
  const titleElement = [...document.querySelectorAll('.task-title')]
    .find(element => element.textContent === maliciousTitle);
  return {
    renderedAsText:titleElement?.textContent === maliciousTitle,
    childTagCount:titleElement?.querySelectorAll('*').length ?? -1,
    executed:window.__xssExecuted
  };
})()`);
expect('To-Do 제목 HTML 안전 출력', xssState.renderedAsText
  && xssState.childTagCount === 0
  && !xssState.executed);
todoBoundary.close();

const todoError = await openPage(todoPath, 1000, 820);
const emptySubmit = await evaluate(todoError, `(() => {
  const form = document.getElementById('taskForm');
  form.requestSubmit();
  const closeButton = document.getElementById('alertCloseBtn');
  const initialFocus = document.activeElement === closeButton;
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true }));
  const trappedFocus = document.activeElement === closeButton;
  return {
    invalidCount:document.querySelectorAll('input.invalid').length,
    messages:[document.getElementById('titleMsg').textContent, document.getElementById('dateMsg').textContent],
    initialFocus,
    trappedFocus
  };
})()`);
expect('To-Do 필수값별 오류', emptySubmit.invalidCount === 2
  && emptySubmit.messages.every(Boolean));
expect('To-Do 경고 모달 초점 관리', emptySubmit.initialFocus
  && emptySubmit.trappedFocus);
await capture(todoError, 'todo-06-required-error.png');
const todoAlertClosed = await evaluate(todoError, `(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  return {
    closed:!document.getElementById('alertModal').classList.contains('show'),
    returnedFocus:document.activeElement === document.getElementById('taskTitle')
  };
})()`);
expect('To-Do 경고 모달 닫기와 초점 복귀', todoAlertClosed.closed && todoAlertClosed.returnedFocus);
todoError.close();

const signupInitial = await openPage(signupPath, 720, 920);
await capture(signupInitial, 'signup-01-initial.png');
const requiredSignup = await evaluate(signupInitial, `(() => {
  const name = document.getElementById('suName');
  document.getElementById('signupForm').requestSubmit();
  const messageIds = ['nameMsg', 'idMsg', 'pwMsg', 'pw2Msg'];
  const alertClose = document.getElementById('alertCloseBtn');
  const initialFocus = document.activeElement === alertClose;
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true }));
  const trappedFocus = document.activeElement === alertClose;
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  return {
    invalidCount:document.querySelectorAll('input.invalid').length,
    allMessages:messageIds.every(id => document.getElementById(id).textContent.length > 0),
    initialFocus,
    trappedFocus,
    closed:!document.getElementById('alertModal').classList.contains('show'),
    returnedFocus:document.activeElement === name
  };
})()`);
expect('회원가입 빈 필드별 입력 차단', requiredSignup.invalidCount === 4 && requiredSignup.allMessages);
expect('회원가입 경고 모달 초점 관리', requiredSignup.initialFocus
  && requiredSignup.trappedFocus
  && requiredSignup.closed
  && requiredSignup.returnedFocus);
signupInitial.close();

const signupAvailable = await openPage(signupPath, 720, 920);
const availableState = await evaluate(signupAvailable, `(() => {
  const id = document.getElementById('suId');
  id.value = 'NewHire1';
  id.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('checkIdBtn').click();
  return {
    valid:id.classList.contains('valid'),
    message:document.getElementById('idMsg').textContent,
    editable:!id.disabled
  };
})()`);
expect('회원가입 사용 가능 아이디', availableState.valid && availableState.message.includes('사용 가능한'));
expect('회원가입 중복확인 후 수정 가능', availableState.editable);
await capture(signupAvailable, 'signup-02-id-available.png');

const invalidated = await evaluate(signupAvailable, `(() => {
  const setInput = (id, value) => {
    const input = document.getElementById(id);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles:true }));
  };
  setInput('suId', 'NewHire2');
  setInput('suName', '김신입');
  setInput('suPw', 'Comento1!');
  setInput('suPw2', 'Comento1!');
  document.getElementById('signupForm').requestSubmit();
  return {
    alertOpen:document.getElementById('alertModal').classList.contains('show'),
    alertMessage:document.getElementById('alertMsg').textContent,
    idResult:document.getElementById('idMsg').textContent
  };
})()`);
expect('회원가입 아이디 수정 시 확인 무효화', invalidated.alertOpen
  && invalidated.alertMessage.includes('중복확인')
  && invalidated.idResult === '');
signupAvailable.close();

const signupFormat = await openPage(signupPath, 720, 920);
const formatState = await evaluate(signupFormat, `(() => {
  const id = document.getElementById('suId');
  const checkButton = document.getElementById('checkIdBtn');
  const check = value => {
    id.value = value;
    id.dispatchEvent(new Event('input', { bubbles:true }));
    checkButton.click();
    return {
      invalid:id.classList.contains('invalid'),
      message:document.getElementById('idMsg').textContent
    };
  };
  return {
    tooShort:check('abc'),
    tooLong:check('abcdefghijklm'),
    korean:check('가나다라')
  };
})()`);
expect('회원가입 아이디 길이 검사', formatState.tooShort.invalid
  && formatState.tooShort.message.includes('4~12자')
  && formatState.tooLong.invalid
  && formatState.tooLong.message.includes('4~12자'));
expect('회원가입 아이디 문자 검사', formatState.korean.invalid
  && formatState.korean.message.includes('영문과 숫자'));
await capture(signupFormat, 'signup-03-id-format-error.png');
signupFormat.close();

const signupPassword = await openPage(signupPath, 720, 920);
const passwordCases = await evaluate(signupPassword, `(() => {
  const id = document.getElementById('suId');
  const password = document.getElementById('suPw');
  id.value = 'gayeon';
  id.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('checkIdBtn').click();
  const check = value => {
    password.value = value;
    password.dispatchEvent(new Event('input', { bubbles:true }));
    return {
      invalid:password.classList.contains('invalid'),
      valid:password.classList.contains('valid'),
      message:document.getElementById('pwMsg').textContent
    };
  };
  return {
    missingLetter:check('1234567!'),
    missingNumber:check('Password!'),
    missingSpecial:check('Password1'),
    repeated:check('Comen111!'),
    containsId:check('Gayeon1!'),
    tooLong:check('Comento12345678!A'),
    valid:check('Comento1!'),
    tooShort:check('1234')
  };
})()`);
expect('회원가입 비밀번호 길이 검사', passwordCases.tooShort.invalid
  && passwordCases.tooShort.message.includes('8~16자')
  && passwordCases.tooLong.invalid
  && passwordCases.tooLong.message.includes('8~16자'));
expect('회원가입 비밀번호 구성 규칙', passwordCases.missingLetter.message.includes('영문')
  && passwordCases.missingNumber.message.includes('숫자')
  && passwordCases.missingSpecial.message.includes('특수문자'));
expect('회원가입 비밀번호 추가 규칙', passwordCases.repeated.message.includes('3번')
  && passwordCases.containsId.message.includes('아이디')
  && passwordCases.valid.valid);
await capture(signupPassword, 'signup-04-password-invalid.png');

const mismatchState = await evaluate(signupPassword, `(() => {
  const password = document.getElementById('suPw');
  const confirmation = document.getElementById('suPw2');
  password.value = 'Comento1!';
  password.dispatchEvent(new Event('input', { bubbles:true }));
  confirmation.value = 'Comento2!';
  confirmation.dispatchEvent(new Event('input', { bubbles:true }));
  return {
    invalid:confirmation.classList.contains('invalid'),
    message:document.getElementById('pw2Msg').textContent
  };
})()`);
expect('회원가입 비밀번호 불일치', mismatchState.invalid && mismatchState.message.includes('일치하지'));
await capture(signupPassword, 'signup-05-password-mismatch.png');

const revalidationState = await evaluate(signupPassword, `(() => {
  const password = document.getElementById('suPw');
  const confirmation = document.getElementById('suPw2');
  confirmation.value = 'Comento1!';
  confirmation.dispatchEvent(new Event('input', { bubbles:true }));
  const initiallyValid = confirmation.classList.contains('valid');
  password.value = 'Comento2!';
  password.dispatchEvent(new Event('input', { bubbles:true }));
  return {
    initiallyValid,
    invalidAfterOriginalChanged:confirmation.classList.contains('invalid'),
    message:document.getElementById('pw2Msg').textContent
  };
})()`);
expect('회원가입 원 비밀번호 변경 시 확인란 재검사', revalidationState.initiallyValid
  && revalidationState.invalidAfterOriginalChanged
  && revalidationState.message.includes('일치하지'));

const validPasswordState = await evaluate(signupPassword, `(() => {
  const password = document.getElementById('suPw');
  const confirmation = document.getElementById('suPw2');
  password.value = 'Comento1!';
  password.dispatchEvent(new Event('input', { bubbles:true }));
  confirmation.value = 'Comento1!';
  confirmation.dispatchEvent(new Event('input', { bubbles:true }));
  return {
    passwordValid:password.classList.contains('valid'),
    confirmationValid:confirmation.classList.contains('valid')
  };
})()`);
expect('회원가입 비밀번호 성공 표시', validPasswordState.passwordValid && validPasswordState.confirmationValid);
await capture(signupPassword, 'signup-06-password-valid.png');

const visibilityState = await evaluate(signupPassword, `(() => {
  const password = document.getElementById('suPw');
  const button = document.getElementById('pwEye');
  button.click();
  const shown = password.type === 'text'
    && button.getAttribute('aria-label').includes('숨기기')
    && button.getAttribute('aria-pressed') === 'true';
  button.click();
  return {
    shown,
    hidden:password.type === 'password'
      && button.getAttribute('aria-pressed') === 'false'
  };
})()`);
expect('회원가입 비밀번호 표시 상태 동기화', visibilityState.shown && visibilityState.hidden);

const signupGlobals = await evaluate(signupPassword, `(() => ({
  userArr:typeof window.userArr,
  validation:typeof window.validation,
  isValidPassword:typeof window.isValidPassword
}))()`);
expect('회원가입 내부 상태와 함수 비공개', Object.values(signupGlobals).every(value => value === 'undefined'));
signupPassword.close();

const signupSuccess = await openPage(signupPath, 720, 920);
const successState = await evaluate(signupSuccess, `(() => {
  const setInput = (id, value) => {
    const input = document.getElementById(id);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles:true }));
  };
  setInput('suName', '김가연');
  setInput('suId', 'Gayeon');
  document.getElementById('checkIdBtn').click();
  setInput('suPw', 'Comento1!');
  setInput('suPw2', 'Comento1!');
  document.getElementById('pwEye').click();
  document.getElementById('signupForm').requestSubmit();
  const successClose = document.getElementById('closeModalBtn');
  return {
    modal:document.getElementById('successModal').classList.contains('show'),
    successMessage:document.getElementById('successMsg').textContent,
    reset:['suName', 'suId', 'suPw', 'suPw2'].every(id => document.getElementById(id).value === ''),
    passwordType:document.getElementById('suPw').type,
    styledInputs:document.querySelectorAll('input.valid, input.invalid').length,
    messageCount:['nameMsg', 'idMsg', 'pwMsg', 'pw2Msg']
      .filter(id => document.getElementById(id).textContent).length,
    eyePressed:document.getElementById('pwEye').getAttribute('aria-pressed'),
    focusOnModal:document.activeElement === successClose
  };
})()`);
expect('회원가입 배열 저장과 완료 모달', successState.modal
  && successState.successMessage.includes('김가연님 회원가입 완료'));
expect('회원가입 성공 후 전체 상태 초기화', successState.reset
  && successState.passwordType === 'password'
  && successState.styledInputs === 0
  && successState.messageCount === 0
  && successState.eyePressed === 'false');
expect('회원가입 완료 모달 초점 이동', successState.focusOnModal);
await capture(signupSuccess, 'signup-07-success.png');

const duplicateState = await evaluate(signupSuccess, `(() => {
  document.getElementById('closeModalBtn').click();
  const returnedFocus = document.activeElement === document.getElementById('suName');
  const id = document.getElementById('suId');
  id.value = 'gAyEoN';
  id.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('checkIdBtn').click();
  return {
    message:document.getElementById('idMsg').textContent,
    invalid:id.classList.contains('invalid'),
    returnedFocus
  };
})()`);
expect('회원가입 배열 저장 후 대소문자 무관 중복', duplicateState.message.includes('이미 사용 중')
  && duplicateState.invalid);
expect('회원가입 완료 모달 초점 복귀', duplicateState.returnedFocus);
await capture(signupSuccess, 'signup-08-id-duplicate.png');
signupSuccess.close();

const todoMobile = await openPage(todoPath, 360, 800);
const todoMobileLayout = await evaluate(todoMobile, `(() => ({
  viewport:innerWidth,
  pageWidth:document.documentElement.scrollWidth,
  formWidth:document.getElementById('taskForm').getBoundingClientRect().width
}))()`);
expect('To-Do 모바일 가로 넘침 없음',
  todoMobileLayout.pageWidth <= todoMobileLayout.viewport
  && todoMobileLayout.formWidth <= todoMobileLayout.viewport);
await capture(todoMobile, 'todo-07-mobile.png');
todoMobile.close();

const signupMobile = await openPage(signupPath, 360, 800);
const signupMobileLayout = await evaluate(signupMobile, `(() => {
  const id = document.getElementById('suId');
  id.value = '가나다라';
  id.dispatchEvent(new Event('input', { bubbles:true }));
  document.getElementById('checkIdBtn').click();
  return {
    viewport:innerWidth,
    pageWidth:document.documentElement.scrollWidth,
    formWidth:document.getElementById('signupForm').getBoundingClientRect().width
  };
})()`);
expect('회원가입 모바일 가로 넘침 없음',
  signupMobileLayout.pageWidth <= signupMobileLayout.viewport
  && signupMobileLayout.formWidth <= signupMobileLayout.viewport);
await capture(signupMobile, 'signup-09-mobile.png');
signupMobile.close();

if(browserErrors.length){
  failures.push(`브라우저 오류: ${browserErrors.join(' | ')}`);
}

const result = {
  status:failures.length ? 'FAIL' : 'PASS',
  screenshotDir:shouldCapture ? screenshotDir : null,
  screenshotCount,
  failures
};

console.log(JSON.stringify(result, null, 2));
if(failures.length) process.exitCode = 1;
