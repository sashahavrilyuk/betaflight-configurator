import $ from 'jquery';
import Vue from 'vue';
import GUI, { TABS } from '../gui';
import vueI18n from '../../components/vueI18n';
import CheckingTab from '../../components/tabs/CheckingTab.vue';

const checking = {
    app: null,
};

checking.initialize = function (callback) {
    if (GUI.active_tab !== 'checking') {
        GUI.active_tab = 'checking';
    }

    $('#content').html('<div id="checking-vue-root"></div>');

    this.app = new Vue({
        i18n: vueI18n,
        render: (h) => h(CheckingTab),
    });

    this.app.$mount('#checking-vue-root');

    GUI.content_ready(callback);
};

checking.cleanup = function (callback) {
    if (this.app) {
        this.app.$destroy();
        this.app = null;
    }

    if (callback) {
        callback();
    }
};

TABS.checking = checking;

export { checking };
