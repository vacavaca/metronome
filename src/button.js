'use strict';

const { EventEmitter } = require('./util');

class Button extends EventEmitter {
    constructor(element) {
        super();
        this._element = element;
        this._element.addEventListener('click', this._handleClick.bind(this))
    }

    get element() {
        return this._element;
    }

    _handleClick(e) {
        this._element.blur();
        this.emit('click', e);
    }
}

module.exports = Button;
