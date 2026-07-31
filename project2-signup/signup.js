(() => {
  "use strict";

  const RULES = Object.freeze({
    ID_MIN_LENGTH:4,
    ID_MAX_LENGTH:12,
    PASSWORD_MIN_LENGTH:8,
    PASSWORD_MAX_LENGTH:16
  });

  const PATTERNS = Object.freeze({
    ID:/^[A-Za-z0-9]+$/,
    LETTER:/[A-Za-z]/,
    NUMBER:/\d/,
    SPECIAL:/[!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>/?~]/,
    ALLOWED_PASSWORD:/^[A-Za-z\d!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>/?~]+$/,
    REPEATED_CHARACTER:/(.)\1\1/
  });

  const elements = {
    form:document.getElementById('signupForm'),
    name:document.getElementById('suName'),
    nameMessage:document.getElementById('nameMsg'),
    id:document.getElementById('suId'),
    idMark:document.getElementById('idMark'),
    idMessage:document.getElementById('idMsg'),
    checkIdButton:document.getElementById('checkIdBtn'),
    password:document.getElementById('suPw'),
    passwordMessage:document.getElementById('pwMsg'),
    passwordConfirm:document.getElementById('suPw2'),
    passwordConfirmMessage:document.getElementById('pw2Msg'),
    passwordEye:document.getElementById('pwEye'),
    passwordConfirmEye:document.getElementById('pw2Eye'),
    successModal:document.getElementById('successModal'),
    successMessage:document.getElementById('successMsg'),
    successCloseButton:document.getElementById('closeModalBtn'),
    alertModal:document.getElementById('alertModal'),
    alertMessage:document.getElementById('alertMsg'),
    alertCloseButton:document.getElementById('alertCloseBtn')
  };

  const state = {
    users:[],
    verifiedId:null,
    lastFocusedElement:null
  };

  function normalizeId(id){
    return id.trim().toLowerCase();
  }

  function validateRequiredFields({ name, id, password, passwordConfirm }){
    const errors = {};
    if(!name) errors.name = '성명을 입력하세요.';
    if(!id) errors.id = '아이디를 입력하세요.';
    if(!password) errors.password = '비밀번호를 입력하세요.';
    if(!passwordConfirm) errors.passwordConfirm = '비밀번호를 다시 입력하세요.';
    return { valid:Object.keys(errors).length === 0, errors };
  }

  function validateId(id){
    if(!id){
      return { valid:false, code:'empty', message:'아이디를 입력하세요.' };
    }
    if(id.length < RULES.ID_MIN_LENGTH || id.length > RULES.ID_MAX_LENGTH){
      return {
        valid:false,
        code:'length',
        message:`아이디는 ${RULES.ID_MIN_LENGTH}~${RULES.ID_MAX_LENGTH}자로 입력하세요.`
      };
    }
    if(!PATTERNS.ID.test(id)){
      return { valid:false, code:'characters', message:'아이디는 영문과 숫자만 사용할 수 있습니다.' };
    }
    return { valid:true, code:'valid', message:'' };
  }

  function isDuplicate(users, id){
    const normalizedId = normalizeId(id);
    return users.some(user => normalizeId(user.id) === normalizedId);
  }

  function validatePassword(password, id){
    if(!password){
      return { valid:false, code:'empty', message:'비밀번호를 입력하세요.' };
    }
    if(password.length < RULES.PASSWORD_MIN_LENGTH || password.length > RULES.PASSWORD_MAX_LENGTH){
      return {
        valid:false,
        code:'length',
        message:`비밀번호는 ${RULES.PASSWORD_MIN_LENGTH}~${RULES.PASSWORD_MAX_LENGTH}자로 입력하세요.`
      };
    }
    if(!PATTERNS.ALLOWED_PASSWORD.test(password)){
      return { valid:false, code:'characters', message:'비밀번호는 영문, 숫자, 허용된 특수문자만 사용할 수 있습니다.' };
    }
    if(!PATTERNS.LETTER.test(password)){
      return { valid:false, code:'letter', message:'비밀번호에 영문을 포함하세요.' };
    }
    if(!PATTERNS.NUMBER.test(password)){
      return { valid:false, code:'number', message:'비밀번호에 숫자를 포함하세요.' };
    }
    if(!PATTERNS.SPECIAL.test(password)){
      return { valid:false, code:'special', message:'비밀번호에 특수문자를 포함하세요.' };
    }
    if(validateId(id).valid && password.toLowerCase().includes(normalizeId(id))){
      return { valid:false, code:'contains-id', message:'비밀번호에 아이디를 포함할 수 없습니다.' };
    }
    if(PATTERNS.REPEATED_CHARACTER.test(password)){
      return { valid:false, code:'repeated', message:'같은 문자를 3번 연속 사용할 수 없습니다.' };
    }
    return { valid:true, code:'valid', message:'사용 가능한 비밀번호입니다.' };
  }

  function validatePasswordMatch(password, passwordConfirm){
    if(!passwordConfirm){
      return { valid:false, code:'empty', message:'비밀번호를 다시 입력하세요.' };
    }
    if(password !== passwordConfirm){
      return { valid:false, code:'mismatch', message:'비밀번호가 일치하지 않습니다.' };
    }
    return { valid:true, code:'valid', message:'' };
  }

  const userService = {
    checkIdAvailability(id){
      state.verifiedId = null;
      const validation = validateId(id);
      if(!validation.valid) return { ...validation, status:'invalid' };
      if(isDuplicate(state.users, id)){
        return { valid:false, code:'duplicate', status:'duplicate', message:'이미 사용 중인 아이디입니다.' };
      }
      state.verifiedId = normalizeId(id);
      return { valid:true, code:'available', status:'available', message:'사용 가능한 아이디입니다.' };
    },

    invalidateVerifiedId(){
      state.verifiedId = null;
    },

    isVerified(id){
      return state.verifiedId === normalizeId(id);
    },

    register({ name, id, password }){
      const user = { id, name, password, createdAt:new Date() };
      state.users.push(user);
      console.info('회원가입 저장 완료:', {
        id:user.id,
        name:user.name,
        createdAt:user.createdAt
      });
      return user;
    }
  };

  function setFieldState(input, messageElement, status = 'neutral', message = ''){
    input.classList.remove('valid', 'invalid');
    messageElement.className = 'field-msg';

    if(status === 'valid'){
      input.classList.add('valid');
      input.removeAttribute('aria-invalid');
      messageElement.classList.add('ok');
    } else if(status === 'invalid'){
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      messageElement.classList.add('err');
    } else {
      input.removeAttribute('aria-invalid');
    }
    messageElement.textContent = message;
  }

  function getFocusableElements(modal){
    return [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  }

  const signupView = {
    renderRequiredErrors(errors){
      setFieldState(
        elements.name,
        elements.nameMessage,
        errors.name ? 'invalid' : 'neutral',
        errors.name || ''
      );

      if(errors.id){
        this.renderIdResult({ status:'invalid', message:errors.id });
      }
      if(errors.password){
        setFieldState(elements.password, elements.passwordMessage, 'invalid', errors.password);
      }
      if(errors.passwordConfirm){
        setFieldState(elements.passwordConfirm, elements.passwordConfirmMessage, 'invalid', errors.passwordConfirm);
      }
    },

    renderIdResult(result){
      elements.idMark.className = 'mark';
      if(result.status === 'available'){
        elements.idMark.classList.add('ok');
        setFieldState(elements.id, elements.idMessage, 'valid', result.message);
      } else {
        elements.idMark.classList.add('fail');
        setFieldState(elements.id, elements.idMessage, 'invalid', result.message);
      }
    },

    clearIdResult(){
      elements.idMark.className = 'mark';
      setFieldState(elements.id, elements.idMessage);
    },

    renderPasswordResult(result){
      setFieldState(
        elements.password,
        elements.passwordMessage,
        result.valid ? 'valid' : 'invalid',
        result.message
      );
    },

    clearPasswordResult(){
      setFieldState(elements.password, elements.passwordMessage);
    },

    renderPasswordMatch(result){
      setFieldState(
        elements.passwordConfirm,
        elements.passwordConfirmMessage,
        result.valid ? 'valid' : 'invalid',
        result.message
      );
    },

    clearPasswordMatch(){
      setFieldState(elements.passwordConfirm, elements.passwordConfirmMessage);
    },

    clearNameResult(){
      setFieldState(elements.name, elements.nameMessage);
    },

    setPasswordVisibility(input, button, visible, fieldName){
      input.type = visible ? 'text' : 'password';
      button.textContent = visible ? '🙈' : '👁';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', `${fieldName} ${visible ? '숨기기' : '표시'}`);
      button.title = `${fieldName} ${visible ? '숨기기' : '표시'}`;
    },

    resetForm(){
      elements.form.reset();
      this.clearNameResult();
      this.clearIdResult();
      this.clearPasswordResult();
      this.clearPasswordMatch();
      this.setPasswordVisibility(elements.password, elements.passwordEye, false, '비밀번호');
      this.setPasswordVisibility(elements.passwordConfirm, elements.passwordConfirmEye, false, '비밀번호 확인');
      userService.invalidateVerifiedId();
    },

    openModal(modal, focusTarget, returnFocus){
      state.lastFocusedElement = returnFocus || document.activeElement;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      focusTarget.focus();
    },

    closeModal(modal, fallbackFocus){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      const returnFocus = state.lastFocusedElement || fallbackFocus;
      state.lastFocusedElement = null;
      returnFocus?.focus();
    },

    openAlert(message, returnFocus){
      elements.alertMessage.textContent = message;
      this.openModal(elements.alertModal, elements.alertCloseButton, returnFocus);
    },

    showSuccess(name){
      elements.successMessage.textContent = `${name}님 회원가입 완료!`;
      this.openModal(elements.successModal, elements.successCloseButton, elements.name);
    },

    trapModalFocus(event, modal){
      if(event.key !== 'Tab') return;
      const focusableElements = getFocusableElements(modal);
      if(focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if(focusableElements.length === 1){
        event.preventDefault();
        first.focus();
      } else if(event.shiftKey && document.activeElement === first){
        event.preventDefault();
        last.focus();
      } else if(!event.shiftKey && document.activeElement === last){
        event.preventDefault();
        first.focus();
      }
    }
  };

  function readFormData(){
    return {
      name:elements.name.value.trim(),
      id:elements.id.value.trim(),
      password:elements.password.value,
      passwordConfirm:elements.passwordConfirm.value
    };
  }

  const signupController = {
    handleIdCheck(){
      signupView.renderIdResult(userService.checkIdAvailability(elements.id.value.trim()));
    },

    handleIdInput(){
      userService.invalidateVerifiedId();
      signupView.clearIdResult();
      if(elements.password.value){
        signupView.renderPasswordResult(validatePassword(elements.password.value, elements.id.value.trim()));
      }
    },

    handlePasswordInput(){
      const password = elements.password.value;
      if(password) signupView.renderPasswordResult(validatePassword(password, elements.id.value.trim()));
      else signupView.clearPasswordResult();

      if(elements.passwordConfirm.value){
        signupView.renderPasswordMatch(validatePasswordMatch(password, elements.passwordConfirm.value));
      }
    },

    handlePasswordConfirmInput(){
      const passwordConfirm = elements.passwordConfirm.value;
      if(passwordConfirm){
        signupView.renderPasswordMatch(validatePasswordMatch(elements.password.value, passwordConfirm));
      } else {
        signupView.clearPasswordMatch();
      }
    },

    handlePasswordToggle(input, button, fieldName){
      signupView.setPasswordVisibility(input, button, input.type === 'password', fieldName);
    },

    handleSubmit(event){
      event.preventDefault();
      const formData = readFormData();
      const requiredResult = validateRequiredFields(formData);
      signupView.renderRequiredErrors(requiredResult.errors);

      if(!requiredResult.valid){
        const firstInvalidField = ['name', 'id', 'password', 'passwordConfirm']
          .find(fieldName => requiredResult.errors[fieldName]);
        const fieldElements = {
          name:elements.name,
          id:elements.id,
          password:elements.password,
          passwordConfirm:elements.passwordConfirm
        };
        signupView.openAlert('필수 항목을 모두 입력해주세요.', fieldElements[firstInvalidField]);
        return;
      }

      const idResult = validateId(formData.id);
      if(!idResult.valid){
        signupView.renderIdResult({ ...idResult, status:'invalid' });
        elements.id.focus();
        return;
      }
      if(!userService.isVerified(formData.id)){
        signupView.openAlert('아이디 중복확인을 진행해주세요.', elements.checkIdButton);
        return;
      }

      const passwordResult = validatePassword(formData.password, formData.id);
      signupView.renderPasswordResult(passwordResult);
      if(!passwordResult.valid){
        elements.password.focus();
        return;
      }

      const matchResult = validatePasswordMatch(formData.password, formData.passwordConfirm);
      signupView.renderPasswordMatch(matchResult);
      if(!matchResult.valid){
        elements.passwordConfirm.focus();
        return;
      }

      userService.register(formData);
      signupView.resetForm();
      signupView.showSuccess(formData.name);
    },

    handleModalClick(event){
      if(event.target === elements.alertModal){
        signupView.closeModal(elements.alertModal, elements.name);
      } else if(event.target === elements.successModal){
        signupView.closeModal(elements.successModal, elements.name);
      }
    },

    handleDocumentKeydown(event){
      const alertOpen = elements.alertModal.classList.contains('show');
      const successOpen = elements.successModal.classList.contains('show');

      if(event.key === 'Escape'){
        if(alertOpen) signupView.closeModal(elements.alertModal, elements.name);
        else if(successOpen) signupView.closeModal(elements.successModal, elements.name);
        return;
      }
      if(alertOpen) signupView.trapModalFocus(event, elements.alertModal);
      else if(successOpen) signupView.trapModalFocus(event, elements.successModal);
    }
  };

  function init(){
    elements.id.minLength = RULES.ID_MIN_LENGTH;
    elements.id.maxLength = RULES.ID_MAX_LENGTH;
    elements.password.minLength = RULES.PASSWORD_MIN_LENGTH;
    elements.password.maxLength = RULES.PASSWORD_MAX_LENGTH;
    elements.passwordConfirm.minLength = RULES.PASSWORD_MIN_LENGTH;
    elements.passwordConfirm.maxLength = RULES.PASSWORD_MAX_LENGTH;

    elements.form.addEventListener('submit', event => signupController.handleSubmit(event));
    elements.checkIdButton.addEventListener('click', () => signupController.handleIdCheck());
    elements.name.addEventListener('input', () => signupView.clearNameResult());
    elements.id.addEventListener('input', () => signupController.handleIdInput());
    elements.password.addEventListener('input', () => signupController.handlePasswordInput());
    elements.passwordConfirm.addEventListener('input', () => signupController.handlePasswordConfirmInput());
    elements.passwordEye.addEventListener('click', () => {
      signupController.handlePasswordToggle(elements.password, elements.passwordEye, '비밀번호');
    });
    elements.passwordConfirmEye.addEventListener('click', () => {
      signupController.handlePasswordToggle(elements.passwordConfirm, elements.passwordConfirmEye, '비밀번호 확인');
    });
    elements.alertCloseButton.addEventListener('click', () => signupView.closeModal(elements.alertModal, elements.name));
    elements.successCloseButton.addEventListener('click', () => signupView.closeModal(elements.successModal, elements.name));
    elements.alertModal.addEventListener('click', event => signupController.handleModalClick(event));
    elements.successModal.addEventListener('click', event => signupController.handleModalClick(event));
    document.addEventListener('keydown', event => signupController.handleDocumentKeydown(event));
  }

  init();
})();
