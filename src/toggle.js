'use strict';

const { addClass, removeClass, EventEmitter } = require('./util')
const Button = require('./button');

class Toggle extends EventEmitter {
    constructor(element) {
        super();
        this._button = new Button(element);
        this._element = element;

        this._button.on('click', () => this.emit('toggle'));
    }

    setRunningState(running) {
        if (running) {
            this.setStarted();
        } else {
            this.setStopped();
        }
    }

    setStarted() {
        addClass(this._element, 'toggle--play');
        this._element.innerText = "Stop";
    }

    setStopped() {
        removeClass(this._element, 'toggle--play');
        this._element.innerText = "Start";
    }
}

module.exports = Toggle;
