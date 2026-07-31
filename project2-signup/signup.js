/* =========================================================
   전역 상태 (In-memory Array, DB 미사용) ── FR1
   ========================================================= */
let userArr = [];              // { id, name, password, createdAt }
let isCheckedDup = false;      // 중복확인 실시 여부
let duplicateResult = null;    // 중복확인 결과 (true: 중복됨 / false: 사용가능)
let lastCheckedId = null;      // 마지막으로 중복확인을 통과한 아이디 값

const passwordRule = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'"\\|,.<>\/?~]).{8,16}$/;

/* =========================================================
   isNull(str)
   인자: str - 빈 값인지 확인할 문자열
   리턴값: boolean (true: 빈 값 / false: 빈 값 아님)
   ========================================================= */
function isNull(str){
  return !str || str.length <= 0;
}

/* =========================================================
   isEnteredAll()  ── (추가 구현, FR) 필수 입력 체크
   인자: 없음
   리턴값: boolean (true: 이름/아이디/비밀번호/비밀번호확인 모두 입력됨)
   ========================================================= */
function isEnteredAll(){
  const name = document.getElementById('suName').value.trim();
  const id = document.getElementById('suId').value.trim();
  const pw = document.getElementById('suPw').value;
  const pw2 = document.getElementById('suPw2').value;
  return !isNull(name) && !isNull(id) && !isNull(pw) && !isNull(pw2);
}

/* =========================================================
   isIdLengthValid()  ── (추가 구현, FR) 아이디 길이 체크
   인자: 없음 / 리턴값: boolean (true: 아이디 4자 이상)
   ========================================================= */
function isIdLengthValid(){
  const id = document.getElementById('suId').value.trim();
  return id.length >= 4;
}

/* =========================================================
   isDuplicate()  ── FR2) 아이디 중복 체크
   인자: 없음
   리턴값: boolean (true: 이미 사용 중인 아이디 / false: 사용 가능)
   동작: 입력된 아이디 값이 userArr 배열에 이미 존재하는지 some()으로 확인
   ========================================================= */
function isDuplicate(){
  const id = document.getElementById('suId').value.trim();
  return userArr.some(u => u.id === id);
}

/* =========================================================
   paintIdCheck(state)
   인자: state - 'empty' | 'short' | 'dup' | 'ok'
   리턴값: 없음
   동작: 아이디 입력 칸 옆 체크/엑스 마크와 하단 안내문구를 상태별로 표시
   ========================================================= */
function paintIdCheck(state){
  const idEl = document.getElementById('suId');
  const mark = document.getElementById('idMark');
  const msg = document.getElementById('idMsg');

  mark.className = 'mark';
  idEl.classList.remove('valid','invalid');

  if(state === 'empty'){
    msg.className = 'field-msg';
    msg.textContent = '';
  } else if(state === 'short'){
    mark.classList.add('fail');
    idEl.classList.add('invalid');
    msg.className = 'field-msg err';
    msg.textContent = '아이디는 4자 이상이어야 합니다.';
  } else if(state === 'dup'){
    mark.classList.add('fail');
    idEl.classList.add('invalid');
    msg.className = 'field-msg err';
    msg.textContent = '이미 사용 중인 아이디입니다.';
  } else if(state === 'ok'){
    mark.classList.add('ok');
    idEl.classList.add('valid');
    msg.className = 'field-msg ok';
    msg.textContent = '사용 가능한 아이디입니다.';
  }
}

/* =========================================================
   checkDuplicateId()  ── FR2) [중복확인] 버튼 클릭 시 실행
   인자: 없음 / 리턴값: 없음
   동작:
     1. isIdLengthValid()로 아이디 길이(4자 이상)를 먼저 확인합니다.
     2. 통과하면 isDuplicate()로 userArr 배열을 조회합니다.
     3. 결과에 따라 paintIdCheck()로 화면에 표시하고,
        사용 가능할 경우 아이디 입력칸과 중복확인 버튼을 비활성화합니다.
   ========================================================= */
function checkDuplicateId(){
  const idEl = document.getElementById('suId');
  const id = idEl.value.trim();

  if(isNull(id)){
    paintIdCheck('empty');
    return;
  }
  if(!isIdLengthValid()){
    paintIdCheck('short');
    isCheckedDup = false;
    duplicateResult = null;
    return;
  }

  const dup = isDuplicate();
  duplicateResult = dup;

  if(dup){
    paintIdCheck('dup');
    isCheckedDup = false;
    lastCheckedId = null;
  } else {
    paintIdCheck('ok');
    isCheckedDup = true;
    lastCheckedId = id;
    idEl.disabled = true;
    document.getElementById('checkIdBtn').disabled = true;
  }
}

/* =========================================================
   isValidPassword()  ── FR3) 비밀번호 조건 체크
   자체 규칙: 영문 + 숫자 + 특수문자를 모두 포함한 8~16자,
             아이디 문자열 포함 금지, 동일 문자 3연속 금지
   인자: 없음 / 리턴값: boolean
   ========================================================= */
function isValidPassword(){
  const pw = document.getElementById('suPw').value;
  const id = document.getElementById('suId').value.trim();

  if(isNull(pw)) return false;
  if(!passwordRule.test(pw)) return false;                 // 길이 + 조합 규칙
  if(/(.)\1\1/.test(pw)) return false;                       // 동일 문자 3연속 금지
  if(id && pw.toLowerCase().includes(id.toLowerCase())) return false; // 아이디 포함 금지

  return true;
}

/* =========================================================
   paintPasswordCheck(check)
   인자: check - 비밀번호 유효성 검사 결과(boolean)
   리턴값: 없음
   동작: check가 false이면 규칙 안내 문구를 빨간색으로 표시하고,
        true이면 문구를 지웁니다.
   ========================================================= */
function paintPasswordCheck(check){
  const pwEl = document.getElementById('suPw');
  const msg = document.getElementById('pwMsg');
  const pw = pwEl.value;

  if(isNull(pw)){
    pwEl.classList.remove('valid','invalid');
    msg.className = 'field-msg';
    msg.textContent = '';
    return;
  }
  pwEl.classList.toggle('invalid', !check);
  pwEl.classList.toggle('valid', check);
  msg.className = check ? 'field-msg ok' : 'field-msg err';
  msg.textContent = check ? '사용 가능한 비밀번호입니다.' : '영문, 숫자, 특수문자를 포함해 8~16자로 입력하세요. (아이디 포함·3연속 문자 금지)';
}

/* =========================================================
   isPasswordMatch() / paintPasswordMatch()
   비밀번호 확인란 일치 여부를 검사·표시
   ========================================================= */
function isPasswordMatch(){
  const pw = document.getElementById('suPw').value;
  const pw2 = document.getElementById('suPw2').value;
  return pw.length > 0 && pw === pw2;
}
function paintPasswordMatch(){
  const pw2El = document.getElementById('suPw2');
  const msg = document.getElementById('pw2Msg');
  const pw2 = pw2El.value;

  if(isNull(pw2)){
    pw2El.classList.remove('valid','invalid');
    msg.className = 'field-msg';
    msg.textContent = '';
    return;
  }
  const match = isPasswordMatch();
  pw2El.classList.toggle('invalid', !match);
  pw2El.classList.toggle('valid', match);
  msg.className = match ? 'field-msg ok' : 'field-msg err';
  msg.textContent = match ? '' : '비밀번호가 일치하지 않습니다.';
}

/* =========================================================
   togglePasswordVisible(inputId, eyeEl)  ── (추가 구현) FR: 비밀번호 표시 기능
   인자: inputId - 비밀번호 입력창 id, eyeEl - 클릭된 눈 아이콘 엘리먼트
   리턴값: 없음
   동작: 입력 타입을 text ↔ password로 전환하여 비밀번호를 보이거나 숨김
   ========================================================= */
function togglePasswordVisible(inputId, eyeEl){
  const input = document.getElementById(inputId);
  if(input.type === 'password'){
    input.type = 'text';
    eyeEl.textContent = '🙈';
  } else {
    input.type = 'password';
    eyeEl.textContent = '👁';
  }
}

/* =========================================================
   registerUser(name, id, pw)  ── FR1) 배열에 회원 정보 저장
   인자: name, id, pw / 리턴값: 없음
   동작: userArr 배열에 { id, name, password, createdAt } 객체를 push
   ========================================================= */
function registerUser(name, id, pw){
  userArr.push({ id, name, password: pw, createdAt: new Date() });
  console.log('userArr:', userArr); // 콘솔에서 저장 결과 확인 가능
}

/* =========================================================
   showSuccessModal(name) / closeSuccessModal()
   가입 완료 팝업을 열고 닫는 함수 ── (추가 구현) FR: 가입완료 확인 팝업
   ========================================================= */
function showSuccessModal(name){
  document.getElementById('successMsg').textContent = `${name}님 회원가입 완료!`;
  document.getElementById('successModal').classList.add('show');
}
function closeSuccessModal(){
  document.getElementById('successModal').classList.remove('show');
}

/* =========================================================
   resetForm()
   가입 완료 후 폼과 상태를 초기값으로 되돌림
   ========================================================= */
function resetForm(){
  document.getElementById('suName').value = '';
  const idEl = document.getElementById('suId');
  idEl.value = '';
  idEl.disabled = false;
  document.getElementById('checkIdBtn').disabled = false;
  document.getElementById('suPw').value = '';
  document.getElementById('suPw2').value = '';
  ['nameMsg','idMsg','pwMsg','pw2Msg'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'field-msg'; el.textContent = '';
  });
  document.getElementById('idMark').className = 'mark';
  isCheckedDup = false;
  duplicateResult = null;
  lastCheckedId = null;
}

/* =========================================================
   validation(e)  ── [🪪 사원증 발급하기] 버튼 클릭 시 실행되는 메인 함수
   인자: e - 클릭 이벤트 / 리턴값: 없음
   동작:
     1. isEnteredAll(), isIdLengthValid(), isCheckedDup(전역), duplicateResult(전역),
        isValidPassword(), isPasswordMatch() 결과를 각각 확인합니다.
     2. 필수 입력값이 비어있다면 커스텀 경고 모달로 "필수 항목을 모두
        입력해주세요."를 표시하고 종료합니다.
     3. 아이디 중복확인을 아직 실시하지 않았다면 "아이디 중복확인을
        진행해주세요." 경고를 표시하고 종료합니다.
     4. 비밀번호 조건 또는 확인 일치 여부가 맞지 않으면 각 입력창 하단에
        안내 문구를 표시하고 종료합니다.
     5. 모든 조건을 통과하면 registerUser()로 userArr에 저장하고,
        showSuccessModal()로 완료 팝업을 띄운 뒤 resetForm()으로 폼을 초기화합니다.
   ========================================================= */
function validation(e){
  if(e) e.preventDefault();

  const name = document.getElementById('suName').value.trim();
  const id = document.getElementById('suId').value.trim();
  const pw = document.getElementById('suPw').value;

  // 1) 필수 입력 체크
  if(!isEnteredAll()){
    openAlert('필수 항목을 모두 입력해주세요.');
    return;
  }

  // 2) 아이디 중복확인 필수 체크
  if(!isCheckedDup || lastCheckedId !== id){
    openAlert('아이디 중복확인을 진행해주세요.');
    return;
  }

  // 3) 비밀번호 유효성 검사
  const pwValid = isValidPassword();
  paintPasswordCheck(pwValid);
  if(!pwValid){
    return;
  }

  // 4) 비밀번호 확인 일치 검사
  const match = isPasswordMatch();
  paintPasswordMatch();
  if(!match){
    return;
  }

  // 5) 모든 조건 통과 → 회원가입 처리
  registerUser(name, id, pw);
  showSuccessModal(name);
  resetForm();
}

/* =========================================================
   openAlert(msg) / closeAlert() - 공용 경고 모달
   (네이티브 alert() 대신 커스텀 모달을 재사용)
   ========================================================= */
function openAlert(msg){
  let modal = document.getElementById('alertModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'alertModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `<div class="modal-box"><p id="alertMsgText"></p><button class="btn btn-primary" id="alertCloseBtn">확인</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#alertCloseBtn').addEventListener('click', () => modal.classList.remove('show'));
  }
  modal.querySelector('#alertMsgText').textContent = msg;
  modal.classList.add('show');
}

/* =========================================================
   이벤트 바인딩 및 실시간 검증
   ========================================================= */
document.getElementById('checkIdBtn').addEventListener('click', checkDuplicateId);
document.getElementById('submitBtn').addEventListener('click', validation);
document.getElementById('closeModalBtn').addEventListener('click', closeSuccessModal);
document.getElementById('pwEye').addEventListener('click', () => togglePasswordVisible('suPw', document.getElementById('pwEye')));
document.getElementById('pw2Eye').addEventListener('click', () => togglePasswordVisible('suPw2', document.getElementById('pw2Eye')));

document.getElementById('suId').addEventListener('input', () => {
  // 아이디를 다시 수정하면 기존 중복확인 결과 무효화
  isCheckedDup = false;
  duplicateResult = null;
  document.getElementById('idMark').className = 'mark';
  document.getElementById('idMsg').className = 'field-msg';
  document.getElementById('idMsg').textContent = '';
  document.getElementById('suId').classList.remove('valid','invalid');
});
document.getElementById('suPw').addEventListener('input', () => paintPasswordCheck(isValidPassword()));
document.getElementById('suPw2').addEventListener('input', paintPasswordMatch);

/* =========================================================
   [문서 스크린샷용] 데모 상태 로더 (실사용 로직과 무관한 보조 스크립트)
   ========================================================= */
(function demoLoader(){
  const state = new URLSearchParams(location.search).get('demo');
  if(!state) return;

  if(state === 'seed'){
    userArr.push({ id:'abc', name:'테스트', password:'Test1234!', createdAt:new Date() });
  }
  if(state === 'id-ok'){
    document.getElementById('suId').value = 'gayeon';
    checkDuplicateId();
  }
  if(state === 'id-dup'){
    userArr.push({ id:'abc', name:'테스트', password:'Test1234!', createdAt:new Date() });
    document.getElementById('suId').value = 'abc';
    checkDuplicateId();
  }
  if(state === 'id-short'){
    document.getElementById('suId').value = 'aa';
    checkDuplicateId();
  }
  if(state === 'pw-invalid'){
    document.getElementById('suId').value = 'gayeon';
    document.getElementById('suPw').value = '1234';
    paintPasswordCheck(isValidPassword());
  }
  if(state === 'pw-valid'){
    document.getElementById('suId').value = 'gayeon';
    document.getElementById('suPw').value = 'Comento1!';
    document.getElementById('suPw2').value = 'Comento1!';
    paintPasswordCheck(isValidPassword());
    paintPasswordMatch();
  }
  if(state === 'success'){
    showSuccessModal('gayeon');
  }
})();
