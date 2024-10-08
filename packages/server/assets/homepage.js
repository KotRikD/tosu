import { createApp, ref } from './vue.js';


const queryParams = new URLSearchParams(window.location.search);

const BACKUP_SERVER_IP = document.querySelector('#SERVER_IP')?.value;
const BACKUP_SERVER_PORT = document.querySelector('#SERVER_PORT')?.value;


const downloading = [];
const tab = +(queryParams.get('tab') || 0);


const search_bar = document.querySelector('.search-bar');
let timer;

let isSearching = false;
let isClosingModal = false;
let isBuilderModal = false;


const settingsBuilder = {
  props: {
    folderName: {
      type: String,
      required: true,
    },
    settings: {
      type: Array,
      required: true,
    }
  },
  setup(props) {
    const settings = ref([
      {
        uniqueID: '',
        type: 'text',
        title: '',
        description: '',
        options: [],
        value: '',
      },
    ]);

    for (let i = 0; i < props.settings.length; i++) {
      const setting = props.settings[i];
      if (setting.type == 'options')
        setting.options.push('');

      else if (setting.type == 'commands') {
        for (let o = 0; o < setting.options.length; o++) {
          const option = setting.options[o];
          if (option.type == 'options' && option.values[option.values.length - 1] != '')
            option.values.push('');
        };


        setting.options.push({
          type: "text",
          name: "",
          title: "",
          description: "",
          values: [],
          value: ""
        });

        if (!Array.isArray(setting.value))
          setting.value = [];

        setting.value.push({});
      };


      settings.value.push(setting);
    };


    function highlight(element) {
      element.classList.add('highlight');

      setTimeout(() => {
        element.classList.remove('highlight');
      }, 100);
    };


    async function updateSettings(event) {
      const confirmed = confirm(`Update settings?`);
      if (!confirmed) return;

      const element = event.target;

      downloading.push('update-x2-settings');
      const button_text = element.innerText;
      startDownload(element);


      try {
        const _settings = settings.value.slice(1);
        for (let i = 0; i < _settings.length; i++) {
          const setting = _settings[i];
          if (setting.type == 'options')
            setting.options = setting.options.filter(r => r !== '' && r != null);

          if (setting.type == 'commands') {
            setting.options = setting.options.filter(r => r.name !== '' && r.name != null);
            setting.options.forEach(r => {
              if (r.values) r.values = r.values.filter(r => r !== '' && r != null);
            });
            setting.value = (setting.value || []).filter(r => Object.keys(r).length > 0);
          };

        };


        // update settings in file
        const request = await fetch(`/api/counters/settings/${props.folderName}?update=yes`, {
          method: "POST",
          body: JSON.stringify(_settings),
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


    function sanitize(event) {
      event.target.value = event.target.value.replace(/[^a-z0-9]/gim, '');
    };


    function addCommand(event, ind, ind2) {
      const item = settings.value[ind2];
      const value = item.value[ind];


      const find = item.value.slice(0, item.value.length - 1).find(r => r[item.uniqueCheck] == value[item.uniqueCheck]);
      if (find) {
        displayNotification({
          element: event.target,
          text: `Command already exists`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };


      const items = item.options.filter(r => r.name !== '');
      const required = items.filter(r => r.required == true && r.name !== '' && r.type != 'checkbox');
      if (required.length > 0) {
        for (let i = 0; i < required.length; i++) {
          const option = required[i];
          if (value[option.name]) continue;

          displayNotification({
            element: event.target,
            text: `Command «${option.name}» is required`,
            classes: ['red'],
            delay: 3000,
          });

          return;
        };
      };


      if (items.length == 0) {
        displayNotification({
          element: event.target,
          text: 'Add at least one command option',
          classes: ['red'],
          delay: 3000,
        });

        return;
      };


      item.value.push({});
    };


    function pushOption(event, ind, index) {
      const item = settings.value[index];
      const value = item.options[ind];
      if (value == '') {
        highlight(event.target.parentNode.children[0]);
        return;
      };


      const find = item.options.slice(0, ind).find(r => r.toLowerCase() == value.toLowerCase());
      if (find) {
        highlight(event.target.parentNode.children[0]);

        displayNotification({
          element: event.target,
          text: `Option already exists`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };

      item.options.push('');


      const items = event.target.parentNode.parentNode.children;
      setTimeout(() => items[items.length - 1].children[0].focus(), 100);
    };


    function pushOptionValue(event, ind, ind2, index) {
      const item = settings.value[index].options[ind];
      const value = item.values[ind2];
      if (value == '') {
        highlight(event.target.parentNode.children[0]);
        return;
      };


      const find = item.values.slice(0, ind2).find(r => r.toLowerCase() == value.toLowerCase());
      if (find) {
        highlight(event.target.parentNode.children[0]);

        displayNotification({
          element: event.target,
          text: `Option already exists`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };

      item.values.push('');


      const items = event.target.parentNode.parentNode.children;
      setTimeout(() => items[items.length - 1].children[0].focus(), 100);
    };


    function pushCommandOption(event, ind, index) {
      const item = settings.value[index];
      const value = item.options[ind];
      if (value.name == '') {
        displayNotification({
          element: event.target,
          text: `Specify command name`,
          classes: ['red'],
          delay: 3000,
        });

        return;
      };


      const find = item.options.slice(0, ind).find(r => r.name == value.name);
      if (find) {
        displayNotification({
          element: event.target,
          text: `Command already exists`,
          classes: ['red'],
          delay: 3000,
        });

        return;
      };


      if (value.type == 'options') {
        if (value.values.length <= 0) {
          displayNotification({
            element: event.target,
            text: `Specify at least 2 options`,
            classes: ['red'],
            delay: 3000,
          });
          return;
        };


        if (value.value == '') {
          displayNotification({
            element: event.target,
            text: `Specify default option`,
            classes: ['red'],
            delay: 3000,
          });
          return;
        };
      };


      item.options.push({
        type: "text",
        name: "",
        title: "",
        description: "",
        values: [],
        value: ""
      });
    };


    function updateType(from, event, ind, ind2) {
      const value = event.target.value;
      if (from === '') {
        const item = settings.value[ind];

        if (value == 'checkbox') item.value = item.value === false || item.value === true ? item.value : false;
        else if (value == 'options') {
          if (item.options[item.options.length - 1] != '') item.options.push('');
          item.options = item.options.filter(r => typeof r == 'string');

          item.value = item.options[0] || '';
        }
        else if (value == 'commands') {
          if (item.options[item.options.length - 1]?.name != '')
            item.options.push({
              type: "text",
              name: "",
              title: "",
              description: "",
              values: [],
              value: ""
            });

          item.options = item.options.filter(r => typeof r == 'object');


          item.value = [{}];
        }
        else item.value = '';

        return;
      };


      if (from == 'command') {
        const item = settings.value[ind2].options[ind];

        if (value == 'checkbox') item.value = item.value === false || item.value === true ? item.value : false;
        else if (value == 'options') {
          if (item.values[item.values.length - 1] != '') item.values.push('');
          item.value = item.values[0] || '';
        }
        else item.value = '';

        return;
      };
    };


    function deleteOption(ind, index, force) {
      if (settings.value[index].options[ind] != '' && force != true) return;
      if (force == true) {
        const confirmed = confirm(`Delete option?`);
        if (!confirmed) return;
      };

      settings.value[index].options.splice(ind, 1);
    };


    function deleteOptionValue(ind, ind2, index, force) {
      if (settings.value[index].options[ind].values[ind2] != '' && force != true) return;
      settings.value[index].options[ind].values.splice(ind2, 1);
    };


    function addSetting(event) {
      const item = settings.value[0];
      if (item.uniqueID == '') {
        displayNotification({
          element: event.target,
          text: `Specify unique id`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };


      if (item.title == '') {
        displayNotification({
          element: event.target,
          text: `Specify title`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };

      if (item.value == '' && (item.type != 'checkbox' && item.type != 'password' && item.type != 'textarea' && item.type != 'commands')) {
        let text = `Specify default value`;
        if (item.type == 'button') text = 'Specify url';


        displayNotification({
          element: event.target,
          text: text,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };

      if (item.type == 'checkbox' && item.value == '') item.value = false;


      if (item.type == 'options') {
        const items = item.options.filter(r => r !== '' && r != null);
        if (items.length <= 1) {
          displayNotification({
            element: event.target,
            text: `Specify at least two options to choose`,
            classes: ['red'],
            delay: 3000,
          });
          return;
        };
      };


      if (item.type == 'commands') {
        if (item.options.length == 0) {
          displayNotification({
            element: event.target,
            text: `Specify at least 1 default command`,
            classes: ['red'],
            delay: 3000,
          });
          return;
        };
      };


      if (item.type == 'button') {
        try {
          new URL(item.value);
        } catch (error) {
          console.log(error);

          displayNotification({
            element: event.target,
            text: 'Incorrect url',
            classes: ['red'],
            delay: 3000,
          });
          return;
        };
      };


      const isExists = settings.value.slice(1).find(r => r.uniqueID == item.uniqueID);
      if (isExists) {
        displayNotification({
          element: event.target,
          text: `Setting with this unique id already exists`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };


      downloading.push('add-option');

      const button_text = event.target.innerText;
      startDownload(event.target);

      console.log({
        uniqueID: item.uniqueID,
        type: item.type,
        title: item.title,
        description: item.description,
        options: item.options,
        value: item.value,
      });


      settings.value.push({
        uniqueID: item.uniqueID,
        type: item.type,
        title: item.title,
        description: item.description,
        options: item.options,
        value: item.value,
      });

      item.uniqueID = '';
      item.type = 'text';
      item.title = '';
      item.description = '';
      item.options = [];
      item.value = '';


      setTimeout(() => {
        endDownload(event.target, 'add-option', button_text);
        event.target.classList.remove('disable');

      }, 500);

      displayNotification({
        element: event.target,
        text: `Setting added`,
        classes: ['green'],
        delay: 3000,
      });
    };


    function removeSetting(ind) {
      const confirmed = confirm(`Delete option «${settings.value[ind].uniqueID}»?`);
      if (!confirmed) return;


      settings.value.splice(ind, 1);
    };


    function removeCommand(ind, ind2) {
      const item = settings.value[ind2];
      const confirmed = confirm(`Delete command?`);
      if (!confirmed) return;


      item.value.splice(ind, 1);
    };


    function closeit() {
      isBuilderModal = false;
      closeModal(null, window.builder.unmount);
    };

    return {
      settings,
      folderName: props.folderName,

      updateSettings,

      updateType,

      addSetting,
      addCommand,

      pushOption,
      pushOptionValue,
      pushCommandOption,

      deleteOption,
      deleteOptionValue,

      removeSetting,
      removeCommand,
      sanitize,

      closeit,
    };
  },
  template: `<div class="m-content"><h2 class="ms-title"><span>Settings Builder</span><span>«{{folderName}}»</span></h2><div class="m-scroll settings-container"><div v-for="(i, index) in settings" class="settings-item" :class="{'new-item': index == 0}"><div class="ni-row-1"><div class="si flexer ni-type"><select :disabled="index > 0" @change="updateType('', $event, index)" v-model="i.type"><option value="text">Text</option><option value="color">Color</option><option value="number">Number</option><option value="checkbox">Toggle</option><option value="button">Button link</option><option value="options">Options</option><option value="commands">Commands</option><option value="textarea">Text area</option><option value="password">Secret value</option></select></div><div class="si flexer ni-unique"><input type="text" placeholder="Unique id" @input="sanitize" v-model="i.uniqueID"></div><div class="si flexer ni-title"><input type="text" placeholder="Title" v-model="i.title"></div></div><div class="si flexer ni-description"><textarea placeholder="Description" rows="2" v-model="i.description"></textarea></div><div class="ni-row-3"><div v-if="i.type == 'color'" class="si flexer ni-value"><input type="color" v-model="i.value"></div><label v-else-if="i.type == 'checkbox'" class="si-checkbox"><input type="checkbox" v-model="i.value"><span class="checkmark"></span><span class="status"></span></label><div v-else-if="i.type == 'options'"><div class="ni-options"><div v-for="(o, ind) in i.options" class="si ni-option flexer"><input type="text" placeholder="option name" v-model="i.options[ind]" @change="ind == i.options.length - 1 ? pushOption($event, ind, index) : deleteOption(ind, index)" @keyup.enter="ind == i.options.length - 1 ? pushOption($event, ind, index) : ''"><i v-if="ind == i.options.length - 1" class="icon-plus" @click="pushOption($event, ind, index)"></i><i v-else class="icon-delete" @click="deleteOption(ind, index, true)"></i></div></div><div class="si flexer nid-value"><span>Select default option</span><select v-model="i.value"><option v-for="v in i.options.filter(r=> r !== '')" :value="v" v-text="v"></option></select></div></div><div v-else-if="i.type == 'commands'"><h3>Commands options</h3><p class="ni-p">Define commands options</p><div class="ni-commands"><div v-for="(o, ind) in i.options" class="nic-container"><div class="si nic-content flexer"><label v-if="o.type != 'checkbox'" class="si-checkbox"><input type="checkbox" v-model="o.required"><span class="checkmark"></span><span>required</span></label><select @change="updateType('command', $event, ind, index)" v-model="o.type"><option value="text">Text</option><option value="number">Number</option><option value="checkbox">Toggle</option><option value="options">Options</option></select><input type="text" placeholder="name" v-model="o.name"> <input type="text" placeholder="title" v-model="o.title"> <input type="text" placeholder="description" v-model="o.description"> <input v-if="o.type == 'text'" type="text" placeholder="default value" v-model="o.value"> <input v-else-if="o.type == 'number'" type="number" placeholder="default value" v-model="o.value"><label v-else-if="o.type == 'checkbox'" class="si-checkbox"><input type="checkbox" v-model="o.value"><span class="checkmark"></span><span class="status"></span></label><button v-if="ind == i.options.length - 1" class="button add-option-button flexer" @click="pushCommandOption($event, ind, index)"><span>+</span></button><button v-else class="button remove-option-button flexer" @click="deleteOption(ind, index, true)"><span>-</span></button></div><div v-if="o.type == 'options'" class="nic-options flexer"><div v-for="(v, ind2) in o.values" class="si ni-option flexer"><input type="text" placeholder="option name" v-model="o.values[ind2]" @change="ind2 == o.values.length - 1 ? pushOptionValue($event, ind, ind2, index) : deleteOptionValue(ind, ind2, index)" @keyup.enter="ind2 == o.values.length - 1 ? pushOptionValue($event, ind, ind2, index) : ''"><i v-if="ind2 == o.values.length - 1" class="icon-plus" @click="pushOptionValue($event, ind, ind2, index)"></i><i v-else class="icon-delete" @click="deleteOptionValue(ind,ind2, index, true)"></i></div></div><div v-if="o.type == 'options'" class="si flexer nid-value"><span>Select default option</span><select v-model="o.value"><option v-for="v in o.values.filter(r=> r !== '')" :value="v" v-text="v"></option></select></div><hr></div></div><div class="mtb-1 g05 flexer"><h3>Unique option</h3><select class="fgrow" v-model="i.uniqueCheck"><option v-for="v in i.options.filter(r=> r.name !== '')" :value="v.name" v-text="v.name"></option></select></div><h3>Default commands</h3><div class="ni-dcommands si block"><div v-for="(v, ind) in i.value" class="sc-commands"><div class="scc-item flexer empty"><div v-for="o in i.options.filter(r=> r.name != '')" class="scci-item"><h4 v-text="o.title"></h4><input v-if="o.type == 'text'" class="fgrow" type="text" v-model="v[o.name]"> <input v-else-if="o.type == 'number'" class="fgrow" type="number" v-model="v[o.name]"><label v-else-if="o.type == 'checkbox'" class="si-checkbox fgrow sic-start"><input type="checkbox" v-model="v[o.name]"><span class="checkmark"></span><span class="status"></span></label><select v-else-if="o.type == 'options'" class="fgrow" v-model="v[o.name]"><option v-for="v in o.values" :value="v" v-text="v"></option></select></div></div><div class="si-btns flexer si-btn"><button v-if="ind == i.value.length-1" class="button add-option-button flexer" @click="addCommand($event, ind, index)"><span>Add new command</span></button><button v-else class="button remove-option-button flexer" @click="removeCommand(ind, index)"><span>Remove command</span></button></div><hr></div></div></div><div v-else-if="i.type == 'textarea'" class="si flexer ni-description"><textarea placeholder="Default value" rows="3" v-model="i.value"></textarea></div><div v-else class="si flexer ni-value"><input v-if="i.type == 'text'" type="text" placeholder="Default value" v-model="i.value"> <input v-else-if="i.type == 'button'" type="text" placeholder="Specify url" v-model="i.value"> <input v-else-if="i.type == 'number'" type="number" placeholder="Default number" v-model="i.value"> <input v-else-if="i.type == 'password'" type="password" placeholder="Default secret value" v-model="i.value"></div></div><div class="si-btns flexer si-btn"><button v-if="index == 0" class="button add-option-button flexer" @click="addSetting($event)"><span>Add new setting</span></button><button v-else class="button remove-option-button flexer" @click="removeSetting(index)"><span>Remove setting</span></button></div></div></div><div class="ms-btns flexer si-btn"><button class="button update-x2-settings-button flexer" @click="updateSettings"><span>Update settings</span></button><button class="button cancel-button flexer" @click="closeit"><span>Cancel</span></button></div></div>`
};

const showSettings = {
  props: {
    folderName: {
      type: String,
      required: true,
    },
    settings: {
      type: Array,
      required: true,
    },
    values: {
      type: Array,
      required: true,
    },
  },
  setup(props) {
    const settings = ref([]);
    for (let i = 0; i < props.settings.length; i++) {
      const setting = props.settings[i];
      if (setting.type == "commands") {
        setting.options.forEach(r => {
          if (r.values) r.values = r.values.filter(r => r !== '' && r != null);
        });

        if (!Array.isArray(setting.value)) setting.value = [];
        setting.value.push({});
      };


      console.log(setting.value, props, props.values[setting.uniqueID]);
      if (props.values[setting.uniqueID]) {

        setting.value = props.values[setting.uniqueID];
      }

      settings.value.push(setting);
    };


    function addCommand(event, ind, ind2) {
      const item = settings.value[ind2];
      const value = item.value[ind];


      const find = item.value.slice(0, item.value.length - 1).find(r => r[item.uniqueCheck] == value[item.uniqueCheck]);
      if (find) {
        displayNotification({
          element: event.target,
          text: `Command already exists1`,
          classes: ['red'],
          delay: 3000,
        });
        return;
      };


      const items = item.options.filter(r => r.name !== '');
      const required = items.filter(r => r.required == true && r.name !== '' && r.type != 'checkbox');
      if (required.length > 0) {
        for (let i = 0; i < required.length; i++) {
          const option = required[i];
          if (value[option.name]) continue;

          displayNotification({
            element: event.target,
            text: `Command «${option.name}» is required`,
            classes: ['red'],
            delay: 3000,
          });

          return;
        };
      };


      if (items.length == 0) {
        displayNotification({
          element: event.target,
          text: 'Add at least one command option',
          classes: ['red'],
          delay: 3000,
        });

        return;
      };


      item.value.push({});
    };


    async function updateSettings(event) {
      const confirmed = confirm(`Update settings?`);
      if (!confirmed) return;

      const element = event.target;

      downloading.push('update-settings');
      const button_text = element.innerText;
      startDownload(element);


      try {
        const _settings = JSON.parse(JSON.stringify(settings.value.slice(1)));
        for (let i = 0; i < _settings.length; i++) {
          const setting = _settings[i];
          if (setting.type == 'commands') {
            setting.options = setting.options.filter(r => r.name !== '' && r.name != null);
            setting.options.forEach(r => {
              if (r.values) r.values = r.values.filter(r => r !== '' && r != null);
            });
            setting.value = (setting.value || []).filter(r => Object.keys(r).length > 0);
          };
        };

        const values = _settings.map(r => ({ uniqueID: r.uniqueID, value: r.value }));


        const request = await fetch(`/api/counters/settings/${props.folderName}`, {
          method: "POST",
          body: JSON.stringify(values),
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
            endDownload(element, 'update-settings', button_text);
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
          endDownload(element, 'update-settings', button_text);
          element.classList.remove('disable');
        }, 400);
      };
    };


    function removeCommand(ind, ind2) {
      const item = settings.value[ind2];
      const confirmed = confirm(`Delete command?`);
      if (!confirmed) return;


      item.value.splice(ind, 1);
    };

    function closeit() {
      isBuilderModal = false;
      closeModal(null, window.counter_settings.unmount);
    };


    return {
      settings,
      folderName: props.folderName,
      updateSettings,

      addCommand,
      removeCommand,

      closeit,
    };
  },
  template: `<div class="m-content"><h2 class="ms-title"><span>Settings</span><span>«{{folderName}}»</span></h2><div class="m-scroll settings-container"><div v-for="(i, index) in settings"><div class="si flexer" :class="{ 'block txt-area': i.type == 'textarea', block: i.type == 'commands' }"><div><h4 v-text="i.title"></h4><p v-text="i.description"></p></div><input v-if="i.type == 'text'" class="fgrow" type="text" v-model="i.value"> <input v-else-if="i.type == 'number'" class="fgrow" type="number" v-model="i.value"> <input v-else-if="i.type == 'color'" class="fgrow" type="color" v-model="i.value"> <input v-else-if="i.type == 'password'" class="fgrow" type="password" v-model="i.value"><a v-else-if="i.type == 'button'" class="button open-link-button flexer" :href="i.value" target="_blank"><span>open link</span><i class="icon-link"></i></a><label v-else-if="i.type == 'checkbox'" class="si-checkbox fgrow sic-start"><input type="checkbox" v-model="i.value"><span class="checkmark"></span><span class="status"></span></label><textarea v-else-if="i.type == 'textarea'" v-model="i.value"></textarea><select v-else-if="i.type == 'options'" class="fgrow" v-model="i.value"><option v-for="o in i.options" :value="o" v-text="o"></option></select><div v-else-if="i.type == 'commands'" class="sc-commands"><hr><div v-for="(v, ind) in i.value" class="sc-commands"><div class="scc-item flexer empty"><div v-for="o in i.options.filter(r=> r.name != '')" class="scci-item"><h4 v-text="o.title"></h4><p v-text="o.description"></p><input v-if="o.type == 'text'" class="fgrow" type="text" v-model="v[o.name]"> <input v-else-if="o.type == 'number'" class="fgrow" type="number" v-model="v[o.name]"><label v-else-if="o.type == 'checkbox'" class="si-checkbox fgrow sic-start"><input type="checkbox" v-model="v[o.name]"><span class="checkmark"></span><span class="status"></span></label><select v-else-if="o.type == 'options'" class="fgrow" v-model="v[o.name]"><option v-for="v in o.values" :value="v" v-text="v"></option></select></div></div><div class="si-btns flexer si-btn"><button v-if="ind == i.value.length-1" class="button add-option-button flexer" @click="addCommand($event, ind, index)"><span>Add new command</span></button><button v-else class="button remove-option-button flexer" @click="removeCommand(ind, index)"><span>Remove command</span></button></div><hr></div></div></div></div></div><div class="ms-btns flexer si-btn"><button class="button update-settings-button flexer" @click="updateSettings"><span>Update settings</span></button><button class="button cancel-button flexer" @click="closeit"><span>Cancel</span></button></div></div>`
};


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
      } catch (error) { };
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
  if (update == true) text = `PP Counter updated: ${name} by ${author}<br>Refresh it in obs (if you have one added)`;

  displayNotification({
    element: element.parentElement.parentElement,
    text: text,
    classes: ['green'],
    delay: 5000,
  });

  endDownload(element, id, 'Downloaded');
};

function displayNotification({ element, text, classes, delay }) {
  const div = document.createElement('div');
  // const size = div.getBoundingClientRect();
  div.classList.add('notification');
  div.classList.add('hidden');
  if (Array.isArray(classes)) div.classList.add(...classes);

  const targetRect = element.getBoundingClientRect();
  const bodyRect = document.querySelector('main').getBoundingClientRect();
  const leftOffset = targetRect.left - bodyRect.left;
  // const topOffset = targetRect.top - bodyRect.top;
  // const rightOffset = bodyRect.right - targetRect.right;
  const bottomOffset = bodyRect.bottom - targetRect.bottom;

  const divSize = getSizeOfElement(div);

  div.style.left = leftOffset;
  div.style.bottom = bottomOffset - divSize.height - 5;

  div.innerHTML = text;


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
    success_text = 'Tosu folder opened';
    target = element.parentElement;
  }
  else if (folderName == 'static.exe') {
    success_text = 'Static folder opened';
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
  }, 300);
};

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
      window.location.href = `http://${ip}:${SERVER_PORT.value}${window.location.pathname}${window.location.search}`;
    }, 300);

    element.classList.remove('disable');
    return;
  };

  setTimeout(() => {
    endDownload(element, 'save-settings', 'Saved');
    element.classList.remove('disable');
  }, 300);
};

function displayModal(callback, id, classes) {
  const div = document.createElement('div');
  if (Array.isArray(classes)) div.classList.add(...classes);

  if (id) div.id = id;
  div.classList.add('modal');
  div.classList.add('hidden');

  document.body.style.overflow = 'hidden';

  const wrapper = document.createElement('div');
  wrapper.classList.add('m-content');
  if (typeof callback == 'string') wrapper.innerHTML = callback;

  div.appendChild(wrapper);

  document.body.appendChild(div);
  if (typeof callback == 'function') callback();

  setTimeout(() => {
    div.classList.remove('hidden');
  }, 10);
};

function closeModal(event, callback) {
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
      if (typeof callback == 'function') callback();

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


  displayModal(() => {
    window.counter_settings = createApp(showSettings, {
      folderName,
      settings: Array.isArray(json?.settings) ? json.settings : [],
      values: Array.isArray(json?.values) ? json.values : [],
    });

    window.counter_settings.mount('#showSettings');
  }, 'showSettings');
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


async function startBuilderModal(element) {
  const folderName = decodeURI(element.attributes.n?.value || '');
  let json = '';

  try {
    const download = await fetch(`${window.location.origin}/${folderName}/settings.json`);
    json = await download.json();
  } catch (error) { };


  displayModal(() => {
    window.builder = createApp(settingsBuilder, {
      folderName,
      settings: Array.isArray(json) ? json : [],
    });

    window.builder.mount('#settingsBuilder');
  }, 'settingsBuilder');

  isBuilderModal = true;
};


search_bar.addEventListener('input', handleInput);
search_bar.addEventListener('keydown', handleInput);


window.addEventListener('click', (event) => {
  const t = event.target;

  if (t?.classList.value.includes('dl-button')) {
    const id = t.attributes.l?.value;

    startDownload(t);
    downloadCounter(t, id);
    return;
  };

  if (t?.classList.value.includes('update-button')) {
    const id = t.attributes.l?.value;
    const name = t.attributes.n?.value;
    const author = t.attributes.a?.value;
    const confirmed = confirm(`Update counter «${name} by ${author}»?`);
    if (!confirmed) return;

    startDownload(t);
    downloadCounter(t, id, true);
    return;
  };
  if (t?.classList.value.includes(' delete-button')) return deleteCounter(t);
  if (t?.classList.value.includes(' open-button')) return openCounter(t);
  if (t?.classList.value.includes(' open-folder-button')) return openCounter(t);

  // save tosu settings
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

  if (t?.classList.value.includes('update-available')) {
    startUpdate(t);
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