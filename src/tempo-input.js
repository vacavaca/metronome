'use strict';

const { getTextNodeAtPosition, EventEmitter } = require('./util');

const getTouchPosition = e => {
    const touch = Array.from(e.touches).find(t => t.identifier === 0);
    if (!touch) return null;

    return { x: touch.screenX, y: touch.screenY };
}


class TempoInput extends EventEmitter {
    constructor(element, initial, enableTextInput) {
        super();

        this._element = element;
        this._field = element.querySelector(".tempo-input");
        this._multiplier = element.querySelector('.tempo-multiplier');

        if (enableTextInput) {
            this._field.contentEditable = true;
            this._field.addEventListener('input', e => {
                this._handleInput(this._getCurrentInputValue());
            });
        }

        this._field.addEventListener('focus', () => {
            this._setToSaveSelection();
        });

        this._field.addEventListener('blur', () => {
            this._handleBlur();
        })

        this._field.addEventListener('keydown', e => {
            if (e.keyCode === 13) {
                e.stopPropagation();
                this._handleSet();
            } else if (e.keyCode === 38) {
                e.preventDefault();
                e.stopPropagation();
                this.emit('input', Math.round(this._lastValidValue + 1));
            } else if (e.keyCode === 40) {
                e.preventDefault();
                e.stopPropagation();
                this.emit('input', Math.round(this._lastValidValue - 1));
            }
        });

        this._element.addEventListener('mouseenter', () => {
            this._isAboveElement = true;
        });

        this._element.addEventListener('mouseleave', () => {
            this._isAboveElement = false;
        });

        document.addEventListener('mousewheel', e => {
            if (this._isAboveElement) {
                e.preventDefault();

                this._muteNextBlur = true;
                this._setToNotSaveSelection();
                this._field.blur();
                this.emit('input', Math.round(this._lastValidValue - e.deltaY / 50))
            }
        });

        document.addEventListener('mousedown', e => {
            if (this._isAboveElement) {
                this._handleDragStart(e.pageX, e.pageY);
            }
        });

        document.addEventListener('mousemove', e => {
            if (this._dragStarted !== null) {
                this._muteNextBlur = true;
                this._setToNotSaveSelection();
                this._field.blur();
                this._handleDrag(e.pageX, e.pageY);
            }
        });

        document.addEventListener('mouseup', e => {
            this._handleDragEnd(e.pageX, e.pageY);
        });

        this._element.addEventListener('touchstart', e => {
            e.preventDefault();
            e.stopPropagation();

            this._setToNotSaveSelection();
            this._field.blur();

            const pos = getTouchPosition(e);
            this._handleDragStart(pos.x, pos.y);
        });

        document.addEventListener('touchmove', e => {
            e.preventDefault();
            const pos = getTouchPosition(e);
            this._handleDrag(pos.x, pos.y);
        });

        document.addEventListener('touchend', e => {
            this._handleTouchEnd();
        });

        if (!this._isValid(initial))
            throw new Error("Initial tempo value is invalid");

        this._lastValidValue = initial;
        this._setInputValue(initial);

        this._isAboveElement = false;
        this._resumeSelectionAt = null;
        this._isSaveSelection = true;
        this._dragStarted = null;
    }

    setTempo(tempo) {
        if (this._isValid(tempo)) {
            this._setInputValue(tempo);
            this._lastValidValue = tempo;
        }
    }

    setMultiplier(multiplier) {
        if (multiplier > 1) {
            this._multiplier.innerText = ` x${multiplier}`;
        } else if (multiplier < 1) {
            this._multiplier.innerText = ` /${1 / multiplier}`;
        } else {
            this._multiplier.innerText = '';
        }
    }

    _handleInput(value) {
        if (!this._isValid(value))
            return;

        this._setInputValue(value);
        this._dropSavedSelection();
        this._lastValidValue = value;
    }

    _handleBlur() {
        const value = this._getCurrentInputValue();

        this._dropSavedSelection();
        if (!this._isValid(value)) {
            this._setInputValue(this._lastValidValue, false);
        }
    }

    _handleSet() {
        const value = this._getCurrentInputValue();

        if (this._isValid(value)) {
            this.emit('set', value);
        } else {
            this._setInputValue(this._lastValidValue, false);
        }
        this._field.blur();
    }

    _handleDragStart(x, y) {
        this._dragStarted = { x, y };
    }

    _handleDrag(x, y) {
        if (this._dragStarted === null)
            return;

        const d = this._calcDragDelta(x, y);
        this._dragStarted = { x, y, dragged: true };
        this.emit('input', Math.round(this._lastValidValue + d));
    }

    _handleDragEnd(x, y) {
        if (this._dragStarted === null)
            return;

        const d = this._calcDragDelta(x, y);

        const dragged = this._dragStarted.dragged;
        this._dragStarted = null;
        if (!dragged)
            return;
        this.emit('adjust', Math.round(this._lastValidValue + d));
    }

    _handleTouchEnd() {
        if (this._dragStarted === null)
            return;

        this._dragStarted = null;
        this.emit('adjust', this._lastValidValue);
    }

    _calcDragDelta(x, y) {
        const guide = { x: 0.707, y: -0.707 };
        const delta = { x: x - this._dragStarted.x, y: y - this._dragStarted.y };
        return Math.round((guide.x * delta.x + guide.y * delta.y) * 0.1);
    }

    _isValid(value) {
        if (isNaN(value)) return false;

        return value >= 30 && value <= 600;
    }

    _getCurrentInputValue() {
        return Math.round(+this._field.innerText.replace(/\D/g, ''))
    }

    _setInputValue(v) {
        if (this._isSaveSelection) {
            this._saveSelection();
            this._field.innerText = v;
            this._restoreSelection();
        } else {
            this._dropSavedSelection();
            this._field.innerText = v;
        }
    }

    _saveSelection() {
        const selection = window.getSelection();
        const rangeCount = selection.rangeCount;

        if (rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.setStart(this._field, 0);
            this._resumeSelectionAt = range.toString().length;
        }
    }

    _restoreSelection() {
        if (this._resumeSelectionAt !== null && this._resumeSelectionAt > 0) {
            const selection = window.getSelection();
            const pos = getTextNodeAtPosition(this._field, this._resumeSelectionAt);
            selection.removeAllRanges();
            const range = new Range();
            range.setStart(pos.node, pos.position);
            selection.addRange(range);
        }
    }

    _dropSavedSelection() {
        this._resumeSelectionAt = null;
        this._setToNotSaveSelection();
    }

    _setToSaveSelection() {
        this._isSaveSelection = true;
    }

    _setToNotSaveSelection() {
        this._isSaveSelection = false;
    }
}

module.exports = TempoInput;
