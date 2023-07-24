/* eslint-env browser */

import hotkeys from 'https://cdn.jsdelivr.net/npm/hotkeys-js@3.11.2/+esm';

import { _auth } from './scripts/firebase.js';
import { registerSW, loadCSS, sleep } from './scripts/utilities.js';
import { config } from './scripts/managers.js';
import apps from './constants/apps.js';
import { WindowManager, WindowInstance } from './wm.js';

export default class FlowInstance {
	version = 'v1.0.7-beta';
	wm = new WindowManager();

	#init = false;
	#setup = false;

	constructor() {
		registerSW();
	}

	boot = async () => {
		document.querySelector('.boot').style.opacity = 0;
		setTimeout(() => {
			document.querySelector('.boot').style.pointerEvents = 'none';
		}, 700);

		loadCSS(config.settings.get('theme').url);

		if (!config.css.get()) config.css.set('');
		if (!config.apps.get()) config.apps.set([]);
		if (!config.customApps.get()) config.customApps.set([]);

		_auth.onAuthStateChanged(async (user) => {
			if (this.init || this.setup) parent.window.location.reload();
			if (user) {
				this.apps.register();
				this.hotkeys.register();
				const spotlight = await import('./builtin/modules/spotlight.js');
				await this.bar.add(spotlight.default);

				for (let i = 0; i < config.settings.get('modules').urls.length; i++) {
					const url = config.settings.get('modules').urls[i];
					const module = await import(url);
					await this.bar.add(module.default);
				}

				this.init = true;
				return;
			}
			new WindowInstance({
				title: 'Setup Wizard',
				class: [
					'no-close',
					'no-move',
					'no-close',
					'no-min',
					'no-full',
					'no-resize',
				],
				x: 'center',
				y: 'center',
				height: '650px',
				url: '/builtin/apps/setup.html',
			});
			this.setup = true;
		});
	};

	spotlight = {
		add: (app) => {
			document.querySelector('.app-switcher .apps').append(app);
		},

		toggle: async () => {
			switch (this.spotlight.state) {
				case true:
					document.querySelector('.app-switcher').style.opacity = 1;
					this.bar.items.spotlight.setText('🔎');
					document.querySelector('.app-switcher').style.opacity = 0;
					await sleep(200);
					document.querySelector('.app-switcher').style.display = 'none';
					this.spotlight.state = false;
					break;
				case false:
					this.bar.items.spotlight.setText('❌');
					document.querySelector('.app-switcher').style.opacity = 0;
					document.querySelector('.app-switcher').style.display = 'flex';
					await sleep(200);
					document.querySelector('.app-switcher').style.opacity = 1;
					this.spotlight.state = true;
					break;
			}
		},

		state: false,
	};

	settings = {
		items: {},

		add: (ITEM) => {
			self.logger.debug(JSON.stringify(ITEM));
			if (!config.settings.get(ITEM.SETTING_ID)) {
				const obj = {};
				ITEM.inputs.forEach(({ type, SETTING_INPUT_ID, defaultValue }) => {
					obj[SETTING_INPUT_ID] =
						type == 'textarea' ? defaultValue.split('\n') : defaultValue;
				});
				config.settings.set(ITEM.SETTING_ID, obj);
			}
			this.settings.items[ITEM.SETTING_ID] = ITEM;
		},
	};

	bar = {
		items: {},

		add: (ITEM) => {
			this.bar.items[ITEM.MODULE_ID] = ITEM;
			document
				.querySelector('.bar')
				.append(this.bar.items[ITEM.MODULE_ID].element);
		},
	};

	hotkeys = {
		register: () => {
			hotkeys('alt+space, ctrl+space', (e) => {
				e.preventDefault();
				this.spotlight.toggle();
			});

			hotkeys('esc', (e) => {
				e.preventDefault();
				if (this.spotlight.state == true) this.spotlight.toggle();
			});

			hotkeys('alt+/', (e) => {
				e.preventDefault();
				this.wm.open('settings');
			});
		},
	};

	apps = {
		register: () => {
			for (const [APP_ID, value] of Object.entries(apps())) {
				const appListItem = document.createElement('li');
				appListItem.innerHTML = `<img src="${value.icon}" width="25px"/><p>${value.title}</p>`;
				appListItem.onclick = () => {
					this.wm.open(APP_ID);
					this.spotlight.toggle();
				};

				this.spotlight.add(appListItem);
			}
		},
	};
}
