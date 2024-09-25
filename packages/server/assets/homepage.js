const queryParams = new URLSearchParams(window.location.search);

const BACKUP_SERVER_IP = document.querySelector('#SERVER_IP')?.value;
const BACKUP_SERVER_PORT = document.querySelector('#SERVER_PORT')?.value;


const downloading = [];
const tab = +(queryParams.get('tab') || 0);


const search_bar = document.querySelector('.search-bar');

let selectedCounter = '';
let timer;

let isSearching = false;
let isClosingModal = false;
let isBuilderModal = false;


document.querySelectorAll(`a`).forEach(r => {
  if (!r.href.includes(`?tab=${tab}`)) return;

  r.classList.add('active');
});


function getSizeOfElement(div) {
  const [oldOpacity, oldPosition] = [
    div.style.opacity,
    div.style.position,
  ];

  div.style.opacity = 0;
  div.style.position = 'fixed';
  document.body.appendChild(div);

  const size = div.getBoundingClientRect();
  const styles = window.getComputedStyle(div);

  size.width = size.width + +(styles.paddingLeft.replace('px', '')) + +(styles.paddingRight.replace('px', '')) + +(styles.marginLeft.replace('px', '')) + +(styles.marginRight.replace('px', ''));
  size.height = size.height + +(styles.paddingTop.replace('px', '')) + +(styles.paddingBottom.replace('px', '')) + +(styles.marginTop.replace('px', '')) + +(styles.marginBottom.replace('px', ''));

  div.style.opacity = oldOpacity;
  div.style.position = oldPosition;

  document.body.removeChild(div);

  return size;
};

function startDownload(element) {
  const children = element.children[0];
  const previousImage = element.children[1];

  const id = element.attributes.l?.value;
  const isDownloading = downloading.includes(id);

  if (isDownloading == false) {
    const childrenSize = children.getBoundingClientRect();
    children.style.width = childrenSize.width;


    const loadingDiv = previousImage || document.createElement('img');
    if (!previousImage) loadingDiv.src = 'https://cdn-icons-png.flaticon.com/128/39/39979.png';
    loadingDiv.style.width = 0;
    loadingDiv.style.opacity = 0;

    element.appendChild(loadingDiv);


    setTimeout(() => {
      element.classList.add('disable');
      children.style.opacity = 0;
      children.style.width = 0;

      setTimeout(() => {
        loadingDiv.style.opacity = 1;
        loadingDiv.style.width = loadingDiv.style.height = childrenSize.height;
      }, 100);
    }, 10);
  };
};

function endDownload(element, id, text) {
  const span = element.children[0];
  const image = element.children[1];

  const isDownloading = downloading.includes(id);

  if (isDownloading == true) {
    const testSpan = document.createElement('span');
    testSpan.innerText = text;
    span.innerText = text;

    const spanSize = getSizeOfElement(testSpan);


    image.style.opacity = 0;
    image.style.width = 0;
    image.style.height = 0;


    setTimeout(() => {
      span.style.opacity = 1;
      span.style.width = spanSize.width;
    }, 100);


    const index = downloading.indexOf(id);
    if (index == -1) return;

    downloading.splice(index, 1);
  };
}

async function downloadCounter(element, id, update) {
  if (downloading.includes(id)) return;

  downloading.push(id);

  const folderName = element.attributes.l?.value;
  const name = element.attributes.n?.value;
  const author = element.attributes.a?.value;

  const url = new URL(`http://${window.location.host}/api/counters/download/${folderName}`);
  url.searchParams.append('name', `${name} by ${author}`);
  if (update == true) url.searchParams.append('update', 'true');

  const download = await fetch(url);
  const json = await download.json();

  if (json.error != null) {
    if (typeof json.error == 'object') {
      try {
        json.error = JSON.stringify(json.error);
      } catch (error) { }
    };

    displayNotification({
      element: element.parentElement.parentElement,
      text: `Error while downloading: ${json.error}`,
      classes: ['red'],
      delay: 3000,
    });

    setTimeout(() => {
      endDownload(element, id, 'Download');
      element.classList.remove('disable');
    }, 101);
    return;
  };


  let text = `PP Counter downloaded: ${name} by ${author}`;
  if (update == true) text = `PP Counter updated: ${name} by ${author}`;

  displayNotification({
    element: element.parentElement.parentElement,
    text: text,
    classes: ['green'],
    delay: 3000,
  });

  endDownload(element, id, 'Downloaded');
};

function tabSwitch(element) {
  document.querySelector(`.tabs>.tab-item:nth-child(${+tab + 1})`)?.classList.remove('active');

  switch (element.innerText.toLowerCase()) {
    case 'installed':
      tab = 0;
      break;
    case 'pp counters':
      tab = 1;
      break;
  };

  history.pushState(null, null, `/?tab=${tab}`)

  localStorage.setItem('tab', tab);
  element.classList.add('active');
};

function displayNotification({ element, text, classes, delay }) {
  const div = document.createElement('div');
  const size = div.getBoundingClientRect();
  div.classList.add('notification');
  div.classList.add('hidden');
  if (Array.isArray(classes)) div.classList.add(...classes);

  const targetRect = element.getBoundingClientRect();
  const bodyRect = document.querySelector('main').getBoundingClientRect();
  const leftOffset = targetRect.left - bodyRect.left;
  const topOffset = targetRect.top - bodyRect.top;
  const rightOffset = bodyRect.right - targetRect.right;
  const bottomOffset = bodyRect.bottom - targetRect.bottom;

  const divSize = getSizeOfElement(div);

  div.style.left = leftOffset;
  div.style.bottom = bottomOffset - divSize.height - 5;

  div.innerText = text;


  document.querySelector('main').appendChild(div);
  setTimeout(() => {
    div.classList.remove('hidden');
  }, 10);

  setTimeout(() => {
    div.classList.add('hidden');

    setTimeout(() => {
      document.querySelector('main').removeChild(div);
    }, 310);
  }, delay);
};

function copyText(element) {
  navigator.clipboard.writeText(element.attributes.nfv.value).then(() => {
    displayNotification({
      element,
      text: `${element.attributes.nft.value} copied`,
      classes: ['green'],
      delay: 700,
    });
  });
}

async function deleteCounter(element) {
  const folderName = decodeURI(element.attributes.n?.value || '');

  let isDelete = confirm(`Do you want to delete?: ${folderName}`);
  if (isDelete != true) return;


  const download = await fetch(`/api/counters/delete/${folderName}`);
  const json = await download.json();

  if (json.error != null) {
    if (typeof json.error == 'object') {
      try {
        json.error = JSON.stringify(json.error);
      } catch (error) { };
    };

    displayNotification({
      element: element.parentElement.parentElement.parentElement,
      text: `Error while downloading: ${json.error}`,
      classes: ['red'],
      delay: 3000,
    });

    endDownload(element, `delete-${folderName}`, 'Error');
    element.classList.remove('disable');
    return;
  };

  displayNotification({
    element: element.parentElement.parentElement.parentElement,
    text: `PP Counter deleted: ${folderName}`,
    classes: ['green'],
    delay: 3000,
  });

  endDownload(element, `delete-${folderName}`, 'Deleted');

  const results = document.querySelector('.results');
  results.removeChild(element.parentElement.parentElement.parentElement);

  if (results.innerHTML.trim() != '') return;

  results.innerHTML = `<div class="no-results">
  No counters<br /><a href="/?tab=1">Go here to get one 👉</a>
  </div>`;
};

async function openCounter(element) {
  const folderName = decodeURI(element.attributes.n?.value || '');

  const download = await fetch(`/api/counters/open/${folderName}`);
  const json = await download.json();


  let success_text = `PP Counter Opened: ${folderName}`;
  let target = element.parentElement.parentElement.parentElement;


  if (folderName == 'tosu.exe') {
    success_text = 'Tosu folder opened'
    target = element.parentElement;
  }
  else if (folderName == 'static.exe') {
    success_text = 'Static folder opened'
    target = element;
  };


  if (json.error != null) {
    if (typeof json.error == 'object') {
      try {
        json.error = JSON.stringify(json.error);
      } catch (error) { };
    };

    displayNotification({
      element: target,
      text: `Error while opening: ${json.error}`,
      classes: ['red'],
      delay: 3000,
    });

    return;
  };

  displayNotification({
    element: target,
    text: success_text,
    classes: ['green'],
    delay: 3000,
  });
};

function handleInput() {
  clearTimeout(timer);

  timer = setTimeout(() => {
    startSearch();
  }, 600);
};

function handleKeyDown(event) {
  if (event.keyCode === 13) {
    startSearch(event);
  };
}

async function startSearch(search) {
  if (isSearching == true) return;
  search_bar.classList.add('disable');
  isSearching = true;

  try {
    const request = await fetch(`/api/counters/search/${search_bar.value}?tab=${tab}`);
    const response = await request.text();

    document.querySelector('.results').innerHTML = response;
  } catch (error) {
    console.error(error);
    displayNotification({
      element: search,
      text: `Error while search: ${error.name}`,
      classes: ['red'],
      delay: 3000,
    });
  };

  search_bar.classList.remove('disable');
  isSearching = false;
};

async function saveSettings(element) {
  if (downloading.includes('save-settings')) return;
  downloading.push('save-settings');

  let redirect = false;

  const DEBUG_LOG = document.querySelector('#DEBUG_LOG');
  const CALCULATE_PP = document.querySelector('#CALCULATE_PP');
  const ENABLE_KEY_OVERLAY = document.querySelector('#ENABLE_KEY_OVERLAY');
  const ENABLE_GOSU_OVERLAY = document.querySelector('#ENABLE_GOSU_OVERLAY');
  const POLL_RATE = document.querySelector('#POLL_RATE');
  const PRECISE_DATA_POLL_RATE = document.querySelector('#PRECISE_DATA_POLL_RATE');
  const SERVER_IP = document.querySelector('#SERVER_IP');
  const SERVER_PORT = document.querySelector('#SERVER_PORT');
  const STATIC_FOLDER_PATH = document.querySelector('#STATIC_FOLDER_PATH');
  const ENABLE_AUTOUPDATE = document.querySelector('#ENABLE_AUTOUPDATE');
  const OPEN_DASHBOARD_ON_STARTUP = document.querySelector('#OPEN_DASHBOARD_ON_STARTUP');
  const SHOW_MP_COMMANDS = document.querySelector('#SHOW_MP_COMMANDS');
  const ALLOWED_IPS = document.querySelector('#ALLOWED_IPS');

  if (BACKUP_SERVER_IP != SERVER_IP.value || BACKUP_SERVER_PORT != SERVER_PORT.value)
    redirect = true;


  const download = await fetch(`/api/settingsSave`, {
    method: 'POST',
    body: JSON.stringify({
      DEBUG_LOG: DEBUG_LOG.checked,
      ENABLE_AUTOUPDATE: ENABLE_AUTOUPDATE.checked,
      OPEN_DASHBOARD_ON_STARTUP: OPEN_DASHBOARD_ON_STARTUP.checked,
      CALCULATE_PP: CALCULATE_PP.checked,
      SHOW_MP_COMMANDS: SHOW_MP_COMMANDS.checked,
      ENABLE_KEY_OVERLAY: ENABLE_KEY_OVERLAY.checked,
      ENABLE_GOSU_OVERLAY: ENABLE_GOSU_OVERLAY.checked,
      POLL_RATE: POLL_RATE.value,
      PRECISE_DATA_POLL_RATE: PRECISE_DATA_POLL_RATE.value,
      SERVER_IP: SERVER_IP.value,
      SERVER_PORT: SERVER_PORT.value,
      ALLOWED_IPS: ALLOWED_IPS.value,
      STATIC_FOLDER_PATH: STATIC_FOLDER_PATH.value,
    }),
  });
  const json = await download.json();

  if (json.error != null) {
    if (typeof json.error == 'object') {
      try {
        json.error = JSON.stringify(json.error);
      } catch (error) { };
    };

    displayNotification({
      element: element.parentElement.parentElement.parentElement,
      text: `Error while opening: ${json.error}`,
      classes: ['red'],
      delay: 3000,
    });

    setTimeout(() => {
      endDownload(element, 'save-settings', 'Save settings');
      element.classList.remove('disable');
    }, 300);
    return;
  };

  displayNotification({
    element: element.parentElement.parentElement.parentElement,
    text: `Config has been saved`,
    classes: ['green'],
    delay: 3000,
  });

  if (redirect == true) {
    const ip = SERVER_IP.value == '0.0.0.0' ? 'localhost' : SERVER_IP.value;

    setTimeout(() => {
      window.location.href = `http://${ip}:${SERVER_PORT.value}${window.location.pathname}${window.location.search}`
    }, 300);

    element.classList.remove('disable');
    return;
  };

  setTimeout(() => {
    endDownload(element, 'save-settings', 'Saved');
    element.classList.remove('disable');
  }, 300);
};

function displayModal({ content, classes }) {
  const div = document.createElement('div');
  if (Array.isArray(classes)) div.classList.add(...classes);

  div.classList.add('modal');
  div.classList.add('hidden');

  document.body.style.overflow = 'hidden';

  const wrapper = document.createElement('div');
  wrapper.classList.add('m-content');
  wrapper.innerHTML = content;

  div.appendChild(wrapper);

  document.body.appendChild(div);

  setTimeout(() => {
    div.classList.remove('hidden');
  }, 10);
};

function closeModal(event) {
  const block = document.querySelector('.m-content');
  if (!block || isClosingModal) return;


  // Check if the clicked element is not inside the block
  if (!block.contains(event?.target) || event == null) {
    if (isBuilderModal == true) {
      const modal = document.querySelector('.modal');
      modal.classList.add('-expand');

      setTimeout(() => {

        modal.classList.remove('-expand');
      }, 150);
      return;
    };


    isClosingModal = true;
    document.body.style.overflow = '';


    const modal = document.querySelector('.modal');
    modal.classList.add('hidden');

    setTimeout(() => {
      document.body.removeChild(modal);
      isClosingModal = false;
    }, 601);
  };
};


async function loadCounterSettings(element) {
  const folderName = decodeURI(element.attributes.n?.value || '');

  const download = await fetch(`/api/counters/settings/${folderName}`);
  const json = await download.json();

  if (json.error != null) {
    if (typeof json.error == 'object') {
      try {
        json.error = JSON.stringify(json.error);
      } catch (error) { };
    };

    displayNotification({
      element: document.querySelector('.tab-item.active'),
      text: `Error while loading settings: ${json.error}`,
      classes: ['red'],
      delay: 3000,
    });

    return;
  };


  displayModal({ content: json.result });
};

async function updateCounterSettings(element) {
  if (downloading.includes('update-settings')) return;
  downloading.push('update-settings');

  const result = [];
  const folderName = decodeURI(element.attributes.n?.value || '');

  document.querySelectorAll('[ucs]').forEach((value, key) => {
    const type = value.attributes.getNamedItem('t').value;
    const obj = {
      uniqueID: value.id,
      value: value.value,
    };

    if (type == 'checkbox') obj.value = value.checked;

    result.push(obj);
  });

  if (result.length == 0) {
    displayNotification({
      element: element,
      text: `Nothing to save`,
      classes: ['yellow'],
      delay: 3000,
    });


    setTimeout(() => {
      endDownload(element, 'update-settings', 'Update settings');
      element.classList.remove('disable');
    }, 300);
    return;
  };

  const request = await fetch(`/api/counters/settings/${folderName}`, {
    method: "POST",
    body: JSON.stringify(result),
  });
  const json = await request.json();

  if (json.error != null) {
    if (typeof json.error == 'object') {
      try {
        json.error = JSON.stringify(json.error);
      } catch (error) { };
    };

    displayNotification({
      element: element,
      text: `Error while saving: ${json.error}`,
      classes: ['red'],
      delay: 3000,
    });

    setTimeout(() => {
      endDownload(element, 'save-settings', 'Save settings');
      element.classList.remove('disable');
    }, 300);
    return;
  };


  displayNotification({
    element: element,
    text: `Settings updated: ${folderName}`,
    classes: ['green'],
    delay: 3000,
  });

  // const iframe = document.querySelector(`iframe[n="${folderName}"]`);
  // const url = iframe.src;

  // iframe.src = '';

  setTimeout(() => {
    endDownload(element, 'update-settings', 'Update settings');
    element.classList.remove('disable');
    // iframe.src = url;

    // closeModal();
  }, 300);
};

async function startUpdate(element) {
  if (downloading.includes('updating-tosu')) return;
  downloading.push('updating-tosu');
  element.classList.add('loadong');

  try {
    const request = await fetch(`/api/runUpdates`, { method: "GET" });
    const json = await request.json();

    if (json.error != null) {
      if (typeof json.error == 'object') {
        try {
          json.error = JSON.stringify(json.error);
        } catch (error) { };
      };

      displayNotification({
        element: element,
        text: `Error while updating: ${json.error}`,
        classes: ['red'],
        delay: 3000,
      });

      element.classList.remove('loadong');
      return;
    };


    displayNotification({
      element: element,
      text: `Update finished`,
      classes: ['green'],
      delay: 3000,
    });


    const find = downloading.indexOf('updating-tosu');
    if (find >= -1) downloading.splice(find, 1);

    element.classList.remove('loadong');
    element.classList.add('fold');

    setTimeout(() => {
      document.body.removeChild(element);
    }, 400);
  } catch (error) {
    console.log(error);
    displayNotification({
      element: element,
      text: `Error while updating: ${error.name}`,
      classes: ['red'],
      delay: 3000,
    });
  };
};


// {/* <div class="si flexer">
//   <div>
//     <h4>Unique id</h4>
//     <p>it's shouldn't repeat</p>
//   </div>
//   <input type="text" id="{ID}_unique_id" value="{VALUE}">
// </div> */}
const optionHTML = `
<div id="{ID}" class="sbi">
  <div class="si flexer">
    <div{as}>
      <h4>Unique ID</h4>
    </div>
    <input type="text" class="{class}" id="{ID}___uniqueID" value="{UNIQUEID_VALUE}" {ADDON}>
  </div>
  <div class="si flexer">
    <div{as}>
      <h4>Type</h4>
    </div>
    <select class="{class}" id="{ID}___type">
      <option {text_SELECTED} value="text">Text</option>
      <option {textarea_SELECTED} value="textarea">Text area</option>
      <option {number_SELECTED} value="number">Number</option>
      <option {color_SELECTED} value="color">Color</option>
      <option {checkbox_SELECTED} value="checkbox">Toggle</option>
      <option {options_SELECTED} value="options">Dropdown select</option>
      <option {password_SELECTED} value="password">Password/Secret value</option>
    </select>
  </div>
  <div class="si flexer">
    <div{as}>
      <h4>Title</h4>
    </div>
    <input type="text" class="{class}" id="{ID}___title" value="{TITLE_VALUE}">
  </div>
  <div class="si flexer">
    <div{as}>
      <h4>Description</h4>
      <p></p>
    </div>
    <input type="text" class="{class}" id="{ID}___description" value="{DESCRIPTION_VALUE}">
  </div>
  <div class="si flexer" {OPTIONS}>
    <div{as}>
      <h4>Options</h4>
      <p>List of options separated by comma</p>
    </div>
    <input type="text" class="{class}" id="{ID}___options" value="{OPTIONS_VALUE}">
  </div>
  <div class="si flexer">
    <div{as}>
      <h4>Default value</h4>
    </div>
    <input type="text" class="{class}" id="{ID}___value" value="{VALUE}">
  </div>
  {BUTTONS}
</div>
`

async function startBuilderModal(element) {
  const folderName = decodeURI(element.attributes.n?.value || '');

  let html = '';
  let json = '';

  selectedCounter = folderName;

  try {
    const download = await fetch(`${window.location.origin}/${folderName}/settings.json`);
    json = await download.json();
  } catch (error) { };


  const header = `<h2 class="ms-title"><span>Settings Builder</span><span>«${folderName}»</span></h2>`;
  const buttons = `<div class="ms-btns flexer si-btn">
        <button class="button update-x2-settings-button flexer" n="${folderName}"><span>Update settings</span></button>
        <button class="button cancel-button flexer"><span>Cancel</span></button>
    </div>`;


  const new_item = optionHTML
    .replace(/{BUTTONS}/gm, '')
    .replace(/{class}/gm, '')
    .replace(/{as}/gm, '')
    .replace(/{ID}/gm, 'new')
    .replace("{UNIQUEID_VALUE}", '')
    .replace("{TITLE_VALUE}", '')
    .replace("{DESCRIPTION_VALUE}", '')
    .replace("{OPTIONS}", 'style="display:none;"')
    .replace("{OPTIONS_VALUE}", '')
    .replace("{VALUE}", '')
    .replace("{ADDON}", `onchange="sanitize(this);"`)
    .replace(/{text_SELECTED}/gm, '')
    .replace(/{number_SELECTED}/gm, '')
    .replace(/{color_SELECTED}/gm, '')
    .replace(/{checkbox_SELECTED}/gm, '')
    .replace(/{options_SELECTED}/gm, '')
    .replace(/{password_SELECTED}/gm, '')
    .replace(/{textarea_SELECTED}/gm, '');

  if (json.error == null) {
    for (let i = 0; i < json.length; i++) {
      const option = json[i];

      html += optionHTML
        .replace(/{BUTTONS}/gm, `
        <div class="oab flexer">
          <button did="${option.uniqueID}" class="button remove-option-button flexer"><span>Remove option</span></button>
        </div>`)
        .replace(/{class}/gm, 'OPTION')
        .replace(/{as}/gm, ' style="width: 10em"')
        .replace(/{ID}/gm, option.uniqueID)
        .replace("{UNIQUEID_VALUE}", option.uniqueID)
        .replace("{TITLE_VALUE}", option.title)
        .replace("{DESCRIPTION_VALUE}", option.description)
        .replace("{OPTIONS}", option.type == 'options' ? '' : 'style="display:none;"')
        .replace("{OPTIONS_VALUE}", Array.isArray(option.options) ? option.options.join(',') : option.options)
        .replace("{VALUE}", option.value)
        .replace("{ADDON}", `onchange="renamer(this)"`)
        .replace(/{text_SELECTED}/gm, option.type == 'text' ? `selected="selected"` : '')
        .replace(/{number_SELECTED}/gm, option.type == 'number' ? `selected="selected"` : '')
        .replace(/{color_SELECTED}/gm, option.type == 'color' ? `selected="selected"` : '')
        .replace(/{checkbox_SELECTED}/gm, option.type == 'checkbox' ? `selected="selected"` : '')
        .replace(/{options_SELECTED}/gm, option.type == 'options' ? `selected="selected"` : '')
        .replace(/{password_SELECTED}/gm, option.type == 'password' ? `selected="selected"` : '')
        .replace(/{textarea_SELECTED}/gm, option.type == 'textarea' ? `selected="selected"` : '');

      // if (i != json.length - 1)
      //   html += '\n<hr class="modal-space">\n'
    };
  };


  const scroll = `
  <div class="m-scroll">
    <div class="new-item" style="position: sticky; top: 0; z-index: 1;">
      ${new_item}
      <div class="ms-btns flexer si-btn">
        <button class="button add-option-button flexer" n="${folderName}"><span>Add new option</span></button>
      </div>
    </div>
    ${html}
  </div>`;

  isBuilderModal = true;
  displayModal({ content: `${header}${scroll}${buttons}` });
  return;
};


async function builderNewOption(element) {
  const content = document.querySelector('.m-scroll');
  if (!content) {
    return;
  };

  if (downloading.includes('add-option')) return;
  downloading.push('add-option');

  const button_text = element.innerText;
  startDownload(element);


  const uniqueID = document.getElementById('new___uniqueID');
  const type = document.getElementById('new___type');
  const title = document.getElementById('new___title');
  const description = document.getElementById('new___description');
  const options = document.getElementById('new___options');
  const default_value = document.getElementById('new___value');

  const payload = {
    setting: {
      uniqueID: (uniqueID.value || '').replace(/[^a-z0-9]/gim, ''),
      type: type.value,
      title: title.value,
      description: description.value,
      options: options.value,
      value: default_value.value,
    },
    value: default_value.value,
  };


  try {
    if (payload.setting.title == '') {
      displayNotification({
        element: element,
        text: `Specify title`,
        classes: ['red'],
        delay: 3000,
      });
      return;
    };

    if (payload.value == '' && (payload.setting.type != 'password' && payload.setting.type != 'textarea')) {
      displayNotification({
        element: element,
        text: `Specify default value`,
        classes: ['red'],
        delay: 3000,
      });
      return;
    };

    if (payload.setting.type == 'options') {
      const toArray = (payload.setting.options || '')
        .split(',')
        .filter(r => r);

      if (toArray.length <= 1) {
        displayNotification({
          element: element,
          text: `Specify at least two options to choose`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };
    };

    let isExists = document.querySelector(`#${payload.setting.uniqueID}___uniqueID`);
    if (isExists) {
      displayNotification({
        element: element,
        text: `Option with this title already exists`,
        classes: ['red'],
        delay: 3000,
      });
      return;
    };

    const html = optionHTML
      .replace(/{BUTTONS}/gm, `
        <div class="oab flexer">
          <button did="${payload.setting.uniqueID}" class="button remove-option-button flexer"><span>Remove option</span></button>
        </div>`)
      .replace(/{class}/gm, 'OPTION')
      .replace(/{as}/gm, ' style="width: 10em"')
      .replace(/{ID}/gm, payload.setting.uniqueID)
      .replace("{UNIQUEID_VALUE}", payload.setting.uniqueID)
      .replace("{TITLE_VALUE}", payload.setting.title)
      .replace("{DESCRIPTION_VALUE}", payload.setting.description)
      .replace("{OPTIONS}", payload.setting.type == 'options' ? '' : 'style="display:none;"')
      .replace("{OPTIONS_VALUE}", Array.isArray(payload.setting.options) ? payload.setting.options.join(',') : payload.setting.options)
      .replace("{VALUE}", payload.value)
      .replace("{ADDON}", `onchange="renamer(this)"`)
      .replace(/{text_SELECTED}/gm, payload.setting.type == 'text' ? `selected="selected"` : '')
      .replace(/{number_SELECTED}/gm, payload.setting.type == 'number' ? `selected="selected"` : '')
      .replace(/{color_SELECTED}/gm, payload.setting.type == 'color' ? `selected="selected"` : '')
      .replace(/{password_SELECTED}/gm, payload.setting.type == 'password' ? `selected="selected"` : '')
      .replace(/{checkbox_SELECTED}/gm, payload.setting.type == 'checkbox' ? `selected="selected"` : '')
      .replace(/{options_SELECTED}/gm, payload.setting.type == 'options' ? `selected="selected"` : '')
      .replace(/{textarea_SELECTED}/gm, payload.setting.type == 'textarea' ? `selected="selected"` : '')

    displayNotification({
      element: element,
      text: `Option added`,
      classes: ['green'],
      delay: 3000,
    });

    if (uniqueID) uniqueID.value = '';
    if (title) title.value = '';
    if (description) description.value = '';
    if (default_value) default_value.value = '';

    // if (content.innerHTML.includes('width: 10em')) content.innerHTML += '\n<hr class="modal-space">\n';
    content.insertAdjacentHTML('beforeend', html);
  } catch (error) {
    console.error(error);
    displayNotification({
      element: content,
      text: `Error while adding option: ${error.name}`,
      classes: ['red'],
      delay: 3000,
    });
  } finally {
    setTimeout(() => {
      endDownload(element, 'add-option', button_text);
      element.classList.remove('disable');
    }, 400);
  };
};


async function builderSaveSettings(element) {
  if (downloading.includes('update-x2-settings')) return;
  downloading.push('update-x2-settings');

  const button_text = element.innerText;
  startDownload(element);

  const uniqueID = document.getElementById('new___uniqueID');
  const title = document.getElementById('new___title');
  const description = document.getElementById('new___description');
  const default_value = document.getElementById('new___value');


  try {
    // check if new option fields are not empty
    if (
      uniqueID.value ||
      title.value ||
      description.value ||
      default_value.value
    ) {
      displayNotification({
        element: element,
        text: `«New Option» is not added to the list`,
        classes: ['yellow'],
        delay: 3000,
      });
      return;
    };


    // get all options values
    const array = [];
    document.querySelectorAll('.OPTION').forEach(r => {
      const [id, field] = r.id.split('___');

      const obj = {};
      let value = r.value;
      if (field.toLowerCase() == 'uniqueid') value = value.replace(/[^a-z0-9]/gim, '');

      obj[field] = value;


      const find = array.find(r => r.uniqueID == id);
      if (find) {
        if (find.type == 'options' && field == 'options') {
          find[field] = value.split(',').filter(r => r);
          return;
        };


        find[field] = value;
        return;
      };

      array.push(obj);
    });

    // if (array.length == 0) {
    //   displayNotification({
    //     element: element,
    //     text: `Add at least one option`,
    //     classes: ['yellow'],
    //     delay: 3000,
    //   });
    //   return;
    // };


    // update settings in file
    const request = await fetch(`/api/counters/settings/${selectedCounter}?update=yes`, {
      method: "POST",
      body: JSON.stringify(array),
    });
    const json = await request.json();

    if (json.error != null) {
      if (typeof json.error == 'object') {
        try {
          json.error = JSON.stringify(json.error);
        } catch (error) { };
      };

      displayNotification({
        element: element,
        text: `Error while updating settings: ${json.error}`,
        classes: ['red'],
        delay: 3000,
      });

      setTimeout(() => {
        endDownload(element, 'update-x2-settings', button_text);
        element.classList.remove('disable');
      }, 300);
      return;
    };


    displayNotification({
      element: element,
      text: `Settings saved`,
      classes: ['green'],
      delay: 3000,
    });


    isBuilderModal = false;
    closeModal(null);
  } catch (error) {
    console.error(error);
    displayNotification({
      element: element,
      text: `Error while saving builder settings: ${error.name}`,
      classes: ['red'],
      delay: 3000,
    });
  } finally {
    setTimeout(() => {
      endDownload(element, 'update-x2-settings', button_text);
      element.classList.remove('disable');
    }, 400);
  };
};

function removeOption(element) {
  const id = element.attributes.did?.value;


  const elm = document.getElementById(id);
  if (!elm) {
    console.log(id, { element }, elm);
    return;
  };



  elm.remove();
};



search_bar.addEventListener('input', handleInput);
search_bar.addEventListener('keydown', handleInput);


window.addEventListener('click', (event) => {
  const t = event.target;


  if (t.id == 'new___type') {
    document.getElementById('new___options').parentElement.style.display = t.value == 'options' ? '' : 'none';
  };


  if (t?.classList.value.includes('dl-button')) {
    const id = t.attributes.l?.value;

    startDownload(t);
    downloadCounter(t, id);
    return
  };

  if (t?.classList.value.includes('update-button')) {
    const id = t.attributes.l?.value;
    const name = t.attributes.n?.value;
    const author = t.attributes.a?.value;
    const confirmed = confirm(`Update counter «${name} by ${author}»?`);
    if (!confirmed) return;

    startDownload(t);
    downloadCounter(t, id, true);
    return
  };
  if (t?.classList.value.includes(' delete-button')) return deleteCounter(t);
  if (t?.classList.value.includes(' open-button')) return openCounter(t);
  if (t?.classList.value.includes(' open-folder-button')) return openCounter(t);

  if (t?.classList.value.includes(' save-button')) {
    startDownload(t);
    return saveSettings(t);
  };

  if (t?.classList.value.includes(' settings-button')) {
    loadCounterSettings(t);
    return;
  };

  if (t?.classList.value.includes(' settings-builder-button')) {
    startBuilderModal(t);
    return;
  };

  if (t?.classList.value.includes(' add-option-button')) {
    builderNewOption(t);
    return;
  };

  if (t?.classList.value.includes(' cancel-button')) {
    isBuilderModal = false;
    closeModal(null);
    return;
  };

  if (t?.classList.value.includes(' update-settings-button')) {
    startDownload(t);
    return updateCounterSettings(t);
  };

  if (t?.classList.value.includes(' update-x2-settings-button')) {
    return builderSaveSettings(t);
  };

  if (t?.classList.value.includes('update-available')) {
    startUpdate(t);
    return;
  };

  if (t?.classList.value.includes('remove-option-button')) {
    removeOption(t);
    return;
  };

  if (t?.attributes.nf) return copyText(t);


  if (t?.id == 'devMode') {
    document.querySelectorAll('.settings-builder-button').forEach(r => r.classList.toggle('active'));
    return;
  };
});


document.addEventListener('mousedown', function (event) {
  if (event.button !== 0) return;
  closeModal(event);
});


document.addEventListener('keydown', (event) => {
  const key = event.code;

  if (key == 'Escape') {
    closeModal(null);
    return;
  };
});


function renamer(element) {
  const [id, field] = element.id.split('___');

  const newID = (element.value || '').replace(/[^a-z0-9]/gmi, '');


  if (document.getElementById(id)) document.getElementById(id).id = newID;
  if (document.getElementById(`${id}___uniqueID`)) document.getElementById(`${id}___uniqueID`).id = `${newID}___uniqueID`;
  if (document.getElementById(`${id}___type`)) document.getElementById(`${id}___type`).id = `${newID}___type`;
  if (document.getElementById(`${id}___title`)) document.getElementById(`${id}___title`).id = `${newID}___title`;
  if (document.getElementById(`${id}___description`)) document.getElementById(`${id}___description`).id = `${newID}___description`;
  if (document.getElementById(`${id}___options`)) document.getElementById(`${id}___options`).id = `${newID}___options`;
  if (document.getElementById(`${id}___value`)) document.getElementById(`${id}___value`).id = `${newID}___value`;
  if (document.querySelector(`[did=${id}`)) document.querySelector(`[did=${id}`).setAttribute("did", newID);

  element.value = newID;
};

function sanitize(element) {
  const value = (element.value || '').replace(/[^a-z0-9]/gmi, '');

  element.value = value;
};