'use strict';

const { Metronome, createAudioContext } = require('./audio');
const { isMobile, EventEmitter } = require('./util');
const Toggle = require('./toggle');
const Button = require('./button');
const Tap = require('./tap');
const TempoInput = require('./tempo-input');

const desktop = !isMobile();

class State {
    constructor(data) {
        this.data = data;
        this._emitter = new EventEmitter();
    }

    update(data) {
        const keys = Object.keys(data).filter(k => this.data[k] !== data[k]);
        if (keys.length > 0) {
            this.data = { ...this.data, ...data }
            this._emitter.emit('change', keys);
        }
    }

    on(arg, cb) {
        const keys = typeof arg === 'string' ? [arg] : arg;
        this._emitter.on('change', (updated) => {
            let anyUpdated = false;
            for (const k of keys) {
                if (updated.includes(k)) {
                    anyUpdated = true;
                    break;
                }
            }

            if (anyUpdated) {
                cb(this.data);
            }
        });
    }

    onAny(cb) {
        this._emitter.on('change', () => cb(this.data));
    }

    start() {
        this.update({ running: true })
    }

    stop() {
        this.update({ running: false })
    }

    toggle() {
        if (this.data.running) {
            this.stop();
        } else {
            this.start();
        }
    }
}

window.addEventListener('load', () => {
    let ctx
    try {
        ctx = createAudioContext()
    } catch (e) {
        alert('Audio API is not supported in your browser')
        return;
    }

    const state = new State({ tempo: 120, beats: 4, running: false });
    const metronome = new Metronome(ctx, 432 * 2, 120); // to be in resonance with the universe =)
    const toggle = new Toggle(document.getElementById('toggle'));
    const tap = new Tap(document.getElementById("tap"));
    const multipliers = Array.from(document.getElementsByClassName("multiplier"))
        .map(e => new Button(e));
    const tempoInput = new TempoInput(document.querySelector(".tempo"), state.data.tempo, desktop);

    state.on('running', ({ running }) => {
        toggle.setRunningState(running);

        if (running) metronome.start();
        else metronome.stop();
    });

    state.on(['tempo', 'beats'], ({ tempo, beats }) => {
        const displayTempo = Math.round(4 * tempo / beats);
        tempoInput.setTempo(displayTempo);

        metronome.setRithm({ tempo, beats });
    });

    state.on('beats', ({ beats }) => {
        const multiplier = beats / 4;
        tempoInput.setMultiplier(multiplier);
    });

    multipliers.forEach(m => {
        const elem = m.element;
        const multiplier = +elem.dataset.value;

        m.on('click', () => {
            if (multiplier !== 1) {
                if (state.data.tempo * multiplier < 500 && state.data.beats * multiplier >= 1) {
                    const beats = Math.round(state.data.beats * multiplier);
                    state.update({
                        tempo: beats * state.data.tempo / state.data.beats,
                        beats: Math.round(state.data.beats * multiplier)
                    });
                }
            } else {
                state.update({
                    beats: 4,
                    tempo: 4 * state.data.tempo / state.data.beats,
                });
            }
        })
    });

    document.addEventListener('keydown', e => {
        if ([13, 32].includes(e.keyCode)) {
            e.preventDefault();
            tap.tap();
        }
    });

    toggle.on('toggle', () => {
        state.toggle();
    });

    tap.on('tempo', tempo => {
        state.update({ tempo, running: true })
    });

    tap.on('estimate', tempo => {
        state.update({ tempo })
    });

    tap.on('tap', () => {
        state.stop();

        if (desktop) {
            metronome.tick();
        }
    });


    tempoInput.on('input', displayTempo => {
        const tempo = state.data.beats * displayTempo / 4;
        state.update({ tempo });
    });

    tempoInput.on('adjust', displayTempo => {
        const tempo = state.data.beats * displayTempo / 4;
        state.update({ tempo });
    });

    tempoInput.on('set', displayTempo => {
        const tempo = state.data.beats * displayTempo / 4;
        state.update({ tempo, running: true });
    });
})