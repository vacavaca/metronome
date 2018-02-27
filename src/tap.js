'use strict';

const Button = require('./button');
const { EventEmitter } = require('./util');

const getCurrentOffsetTime = () =>
    Date.now()
    // ('performance' in window ? window.performance.now() : Date.now())

const mean = list =>
    list.length > 0 ? list.reduce((a, v) => a + v, 0) / list.length : null;

const variance = list => {
    const m = mean(list);
    if (m === null)
        return null;

    return list.reduce((a, v) => a + Math.pow(v - m, 2), 0) / list.length;
}

const std = list => {
    const v = variance(list)
    return v != null ? Math.sqrt(v) : null;
}

const intervalToTempo = interval => Math.round(60000 / interval);

const minSampleSize = 4;

class Tap extends EventEmitter {
    constructor(element) {
        super();
        this._element = element;
        this._button = new Button(element);
        this._button.on('click', this._handleTap.bind(this))

        this._tapIntervals = [];
        this._lastMean = null;
        this._lastStd = null;
        this._lastTap = null;

        this._tempo = null;

        this._blurTimeout = null;
    }

    tap () {
        if (this._blurTimeout !== null)
            clearTimeout(this._blurTimeout);
        this._element.focus();
        this._blurTimeout = setTimeout(() => {
            this._element.blur();
        }, 80);

        this._handleTap();  
    }

    _handleTap() {
        const offset = getCurrentOffsetTime();

        if (this._lastTap === null) {
            this._lastTap = offset;
            this.emit('tap');
            return;
        }

        const interval = offset - this._lastTap;

        if (interval > 2000) {
            this._reset();
            this.emit('tap');
            return;
        }

        this._lastTap = offset;

        const { estimation, tempo } = this._calculateTempo(interval);

        if (estimation != null) {
            this.emit('tap');
            this.emit('estimate', estimation);
            return;
        }

        if (tempo == null) {
            this.emit('tap');
            return;
        }

        if (this._tempo === null) {
            this._tempo = tempo;
            this.emit('tempo', tempo);
            return;
        }

        if (Math.abs(this._tempo - tempo) > this._tempo * 0.02) {
            this._tempo = tempo;
            this.emit('tempo', tempo);
            return;
        }
    }

    _calculateTempo(lastInterval) {
        this._tapIntervals.push(lastInterval);

        if (this._tapIntervals.length < minSampleSize)
            return { estimation: intervalToTempo(mean(this._tapIntervals)) };

        const intervalStd = this._lastStd != null ? this._lastStd : std(this._tapIntervals);
        const intervalMean = this._lastMean != null ? this._lastMean : mean(this._tapIntervals);

        if (Math.abs(lastInterval - intervalMean) > intervalStd * 3) {
            this._reset();
            return { estimation: null, tempo: null };
        } else {
            this._tapIntervals = this._tapIntervals
                .slice(Math.max(0, this._tapIntervals.length - minSampleSize * 2))
                .filter(interval => Math.abs(interval - intervalMean) < intervalStd * 3);
        }

        if (this._tapIntervals.length < minSampleSize)
            return { estimation: intervalToTempo(intervalMean) };

        this._lastStd = this._lastStd != null ? std(this._tapIntervals) : intervalStd;
        this._lastMean = this._lastMean != null ? mean(this._tapIntervals) : intervalMean;

        const tempo = Math.round(60000 / intervalMean);

        return { tempo };
    }

    _reset() {
        this._tapIntervals = [];
        this._lastMean = null;
        this._lastStd = null;
        this._lastTap = null;
        this._tempo = null;
    }
}

module.exports = Tap;
