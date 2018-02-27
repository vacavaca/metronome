'use strict';

const createAudioContext = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    return new Context();
}

const firstBeatGain = 4;
const gain = 3;

const firstBeatDuration = 0.02;
const beatDuration = 0.03;

const immediateDelay = 0.02

class Metronome {
    constructor(ctx, baseFrequency, tempo, beats = 4) {
        this._ctx = ctx;
        this._baseFrequency = baseFrequency;

        const master = ctx.createGain();
        master.connect(ctx.destination)
        master.gain.value = 1 / Math.max(firstBeatGain, gain);

        this._gain = ctx.createGain()
        this._gain.connect(master);

        this._tempo = tempo;
        this._beats = beats;
        this._queue = [];
        this._running = false;
        this._loopTimeout = null;

        this._saveOscilator(this._createOscilator())
    }

    get tempo() {
        return this._tempo;
    }

    get beats() {
        return this._beats;
    }

    setRithm({ tempo, beats }) {
        const beatsChanged = beats != this._beats;
        this._tempo = tempo;
        this._beats = beats;

        if (this._running) {
            if (beatsChanged) {
                this._queue = [];
                this._loop(1, true);
            } else {
                if (this._queue.length > 0) {
                    const { beat, time } = this._queue[this._queue.length - 1];
                    this._queue = [];
                    this._pushIfEarlier(beat - 1, this._ctx.currentTime, time);
                }
                this._loop();
            }
        }
    }

    start(beat = 1) {
        this._running = true;
        this._queue = [];
        this._loop(beat);
    }

    toggle() {
        if (!this._running) {
            this.start();
        } else {
            this.stop();
        }
    }

    isRunning() {
        return this._running;
    }

    reset() {
        this._queue = [];
        if (this._running) {
            this._loop();
        }
    }

    tick() {
        this._scheduleTick(1, this._ctx.currentTime + immediateDelay, 120)
    }

    stop() {
        this._queue = [];
        this._running = false;
    }

    _loop(beat = 1, immediatelly = true, delay = immediateDelay) {
        if (this._loopTimeout !== null)
            clearTimeout(this._loopTimeout);

        if (!this._running)
            return;

        this._poll();

        if (this._queue.length === 0) {
            if (immediatelly) {
                this._pushImmediatelly(beat, delay);
            } else {
                this._push(beat - 1, this._ctx.currentTime);
            }
        }

        if (this._queue.length > 0 && this._queue.length < 2) {
            const last = this._queue[this._queue.length - 1]
            this._push(last.beat, last.time)
        }

        this._loopTimeout = setTimeout(() => this._loop(), 10);
    }

    _poll() {
        if (this._running && this._queue.length > 0) {
            const offset = this._ctx.currentTime;
            const { beat, time, tempo } = this._queue[this._queue.length - 1]
            if (time - offset < 0.1) {
                this._queue.pop();
                this._scheduleTick(beat, time, tempo);
            }
        }
    }

    _push(prevBeat, prevTime) {
        if (!this._running)
            return;

        const time = prevTime + 60 / this._tempo;
        const beat = 1 + (prevBeat % this._beats);
        this._queue.unshift({ time, beat, tempo: this._tempo })
    }

    _pushIfEarlier(prevBeat, prevTime, nextTime, threshold = 0.3) {
        if (!this._running)
            return;

        const time = prevTime + 60 / this._tempo;
        const beat = 1 + (prevBeat % this._beats);
        if (time + threshold < nextTime) {
            this._queue.unshift({ time, beat, tempo: this._tempo });
        } else {
            this._queue.unshift({ time: nextTime, beat, tempo: this._tempo });
        }
    }

    _pushImmediatelly(beat, delay) {
        this._queue.unshift({ time: this._ctx.currentTime + delay, beat, tempo: this._tempo })
    }

    _scheduleTick(beat, time, tempo) {
        const osc = this._createOscilator();
        const beatDuration = this._getBeatDuration(tempo);
        const tickDuration = this._getTickDuration(beat);

        const duration = Math.min(beatDuration * 0.7, tickDuration);

        this._gain.gain.cancelScheduledValues(0);
        osc.frequency.cancelScheduledValues(0);

        osc.frequency.setValueAtTime(this._getTickFrequency(beat), time - 0.001);
        this._gain.gain.setValueAtTime(0, time - 0.001);
        this._gain.gain.linearRampToValueAtTime(this._getTickGain(), time);
        this._gain.gain.linearRampToValueAtTime(0, time + duration - 0.001);

        osc.start(time - 0.001);
        osc.stop(time + duration - 0.001);
    }

    _getTickFrequency(beat) {
        return beat === 1 ? this._baseFrequency * 2 : this._baseFrequency;
    }

    _getTickGain(beat) {
        return beat === 1 ? firstBeatGain : gain;
    }

    _getTickDuration(beat) {
        return beat === 1 ? firstBeatDuration : beatDuration;
    }

    _getBeatDuration(tempo) {
        return 60 / tempo;
    }

    _createOscilator() {
        const osc = this._ctx.createOscillator();
        osc.connect(this._gain);

        if (this._osc != null) {
            const result = this._osc;
            this._saveOscilator(osc);
            return result;
        } else return osc;
    }

    _saveOscilator(osc) {
        this._osc = osc;
    }
}

module.exports = {
    Metronome, createAudioContext
}
