(() => {
  "use strict";

  const RULES = Object.freeze({
    TITLE_MAX_LENGTH: 60,
    WEEK_DAYS: 7
  });

  const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
  });

  const elements = {
    form:document.getElementById('taskForm'),
    title:document.getElementById('taskTitle'),
    date:document.getElementById('taskDate'),
    titleMessage:document.getElementById('titleMsg'),
    dateMessage:document.getElementById('dateMsg'),
    weekFilter:document.getElementById('weekFilter'),
    taskCount:document.getElementById('taskCount'),
    taskList:document.getElementById('taskList'),
    emptyState:document.getElementById('taskEmpty'),
    alertModal:document.getElementById('alertModal'),
    alertMessage:document.getElementById('alertMsg'),
    alertCloseButton:document.getElementById('alertCloseBtn')
  };

  const state = {
    tasks:[],
    nextTaskId:1,
    lastFocusedElement:null
  };

  function validateTaskInput({ title, date }){
    const errors = {};

    if(!title){
      errors.title = '일정 제목을 입력하세요.';
    } else if(title.length > RULES.TITLE_MAX_LENGTH){
      errors.title = `일정 제목은 ${RULES.TITLE_MAX_LENGTH}자 이하로 입력하세요.`;
    }
    if(!date) errors.date = '날짜를 선택하세요.';

    return { valid:Object.keys(errors).length === 0, errors };
  }

  function parseLocalDate(dateStr){
    const date = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isWithinWeek(dateStr, referenceDate = new Date()){
    const date = parseLocalDate(dateStr);
    if(!date) return false;

    const firstDay = new Date(referenceDate);
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(firstDay);
    lastDay.setDate(firstDay.getDate() + RULES.WEEK_DAYS - 1);
    return date >= firstDay && date <= lastDay;
  }

  const taskService = {
    add({ title, date }){
      const task = {
        id:state.nextTaskId++,
        title,
        date,
        done:false
      };
      state.tasks.push(task);
      return task;
    },

    delete(id){
      const previousLength = state.tasks.length;
      state.tasks = state.tasks.filter(task => task.id !== id);
      return state.tasks.length !== previousLength;
    },

    toggleDone(id){
      const task = state.tasks.find(item => item.id === id);
      if(!task) return false;
      task.done = !task.done;
      return true;
    },

    getVisible(weekOnly){
      const tasks = weekOnly
        ? state.tasks.filter(task => isWithinWeek(task.date))
        : state.tasks;
      return [...tasks];
    }
  };

  function setFieldError(input, messageElement, message = ''){
    const hasError = Boolean(message);
    input.classList.toggle('invalid', hasError);
    if(hasError) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    messageElement.textContent = message;
  }

  function formatDate(dateStr){
    const date = parseLocalDate(dateStr);
    return date ? DATE_FORMATTER.format(date) : dateStr;
  }

  function createTaskRow(task, index){
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.classList.toggle('done', task.done);

    const number = document.createElement('span');
    number.className = 'ledger-no';
    number.textContent = `No.${String(index + 1).padStart(3, '0')}`;

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const date = document.createElement('span');
    date.className = 'task-date';
    date.textContent = formatDate(task.date);

    const doneCell = document.createElement('span');
    doneCell.className = 'task-done';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'done-checkbox';
    checkbox.dataset.action = 'toggle';
    checkbox.dataset.taskId = String(task.id);
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `${task.title} 완료 처리`);
    doneCell.appendChild(checkbox);

    const deleteCell = document.createElement('span');
    deleteCell.className = 'task-delete';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn-danger';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.taskId = String(task.id);
    deleteButton.setAttribute('aria-label', `${task.title} 삭제`);
    deleteButton.textContent = '삭제';
    deleteCell.appendChild(deleteButton);

    row.append(number, title, date, doneCell, deleteCell);
    return row;
  }

  const taskView = {
    renderValidation(result){
      setFieldError(elements.title, elements.titleMessage, result.errors.title);
      setFieldError(elements.date, elements.dateMessage, result.errors.date);
    },

    clearFieldValidation(fieldName){
      if(fieldName === 'title') setFieldError(elements.title, elements.titleMessage);
      if(fieldName === 'date') setFieldError(elements.date, elements.dateMessage);
    },

    resetForm(){
      elements.form.reset();
      this.clearFieldValidation('title');
      this.clearFieldValidation('date');
      elements.title.focus();
    },

    renderTasks(tasks, weekOnly){
      elements.taskCount.textContent = String(tasks.length);
      elements.taskList.replaceChildren();

      const hasTasks = tasks.length > 0;
      elements.emptyState.style.display = hasTasks ? 'none' : 'block';
      elements.emptyState.querySelector('.empty-text').textContent = weekOnly
        ? '이번 주(오늘~7일) 안에 등록된 일정이 없습니다.'
        : '아직 등록된 일정이 없습니다. 위에서 첫 일정을 추가해보세요.';
      if(!hasTasks) return;

      const fragment = document.createDocumentFragment();
      tasks.forEach((task, index) => fragment.appendChild(createTaskRow(task, index)));
      elements.taskList.appendChild(fragment);
    },

    openAlert(message, returnFocus){
      state.lastFocusedElement = returnFocus || document.activeElement;
      elements.alertMessage.textContent = message;
      elements.alertModal.classList.add('show');
      elements.alertModal.setAttribute('aria-hidden', 'false');
      elements.alertCloseButton.focus();
    },

    closeAlert(){
      elements.alertModal.classList.remove('show');
      elements.alertModal.setAttribute('aria-hidden', 'true');
      state.lastFocusedElement?.focus();
    },

    trapModalFocus(event){
      if(event.key !== 'Tab' || !elements.alertModal.classList.contains('show')) return;
      event.preventDefault();
      elements.alertCloseButton.focus();
    }
  };

  function renderCurrentTasks(){
    const weekOnly = elements.weekFilter.checked;
    taskView.renderTasks(taskService.getVisible(weekOnly), weekOnly);
  }

  const taskController = {
    handleSubmit(event){
      event.preventDefault();
      const input = {
        title:elements.title.value.trim(),
        date:elements.date.value
      };
      const result = validateTaskInput(input);
      taskView.renderValidation(result);

      if(!result.valid){
        const firstInvalidField = result.errors.title ? elements.title : elements.date;
        taskView.openAlert('필수 항목을 모두 입력해주세요.', firstInvalidField);
        return;
      }

      taskService.add(input);
      taskView.resetForm();
      renderCurrentTasks();
    },

    handleListChange(event){
      if(!(event.target instanceof HTMLInputElement)) return;
      if(event.target.dataset.action !== 'toggle') return;
      taskService.toggleDone(Number(event.target.dataset.taskId));
      renderCurrentTasks();
    },

    handleListClick(event){
      if(!(event.target instanceof Element)) return;
      const button = event.target.closest('[data-action="delete"]');
      if(!(button instanceof HTMLButtonElement)) return;
      taskService.delete(Number(button.dataset.taskId));
      renderCurrentTasks();
    },

    handleModalClick(event){
      if(event.target === elements.alertModal) taskView.closeAlert();
    },

    handleDocumentKeydown(event){
      if(event.key === 'Escape' && elements.alertModal.classList.contains('show')){
        taskView.closeAlert();
        return;
      }
      taskView.trapModalFocus(event);
    }
  };

  function init(){
    elements.title.maxLength = RULES.TITLE_MAX_LENGTH;
    elements.form.addEventListener('submit', event => taskController.handleSubmit(event));
    elements.weekFilter.addEventListener('change', renderCurrentTasks);
    elements.alertCloseButton.addEventListener('click', () => taskView.closeAlert());
    elements.title.addEventListener('input', () => taskView.clearFieldValidation('title'));
    elements.date.addEventListener('input', () => taskView.clearFieldValidation('date'));
    elements.taskList.addEventListener('change', event => taskController.handleListChange(event));
    elements.taskList.addEventListener('click', event => taskController.handleListClick(event));
    elements.alertModal.addEventListener('click', event => taskController.handleModalClick(event));
    document.addEventListener('keydown', event => taskController.handleDocumentKeydown(event));
    renderCurrentTasks();
  }

  init();
})();
