'use strict'

const gulp = require('gulp')
const clean = require('gulp-clean')
const browserify = require('browserify')
const uglify = require('uglify-es')
const uglifyComposer = require('gulp-uglify/composer')
const source = require('vinyl-source-stream')
const buffer = require('vinyl-buffer')
const watchify = require('watchify')
const header = require('gulp-header')

function bundleOpts(debug) {
    return {
        ...watchify.args,
        entries: ['src/index.js'],
        debug: debug,
        sourceType: 'module',
        browserField: false,
        insertGlobals: false,
        detectGlobals: false,
        ignoreMissing: false,
        fullPaths: false
    }   
}

const banner = `\
/**
 * Metronome
 * Copyright (C) 2018 vm
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
`

const minify = uglifyComposer(uglify, console)

function bundle(debug = false) {
    return browserify(bundleOpts(debug)).bundle()
}

const watcher = watchify(browserify(bundleOpts(true)))

function watchBundle() {
    return watcher.bundle()
        .pipe(source('bundle.js'))
        .on('error', err => console.error(err))
        .pipe(buffer())
        .pipe(gulp.dest('dist/'))
}

gulp.task('clean', () => {
    return gulp.src('dist/', { read: false })
        .pipe(clean())
})

gulp.task('build:dev', ['clean'], () => {
    return bundle(true)
        .pipe(source('bundle.js'))
        .on('error', err => console.error(err))
        .pipe(buffer())
        .pipe(gulp.dest('dist/'))
})

gulp.task('build:prod', ['clean'], () => {
    return bundle()
        .pipe(source('bundle.min.js'))
        .pipe(buffer())
        .pipe(minify({
            ie8: true,
            sourceMap: false,
            mangle: { toplevel: false },
            compress: true,
            output: { beautify: false }
        }))
        .pipe(header(banner))
        .pipe(gulp.dest('dist/'))
})

watcher.on('update', watchBundle)
watcher.on('log', console.log)
gulp.task('watch', ['clean'], watchBundle)

gulp.task('default', ['build:prod'])
gulp.task('dev', ['build:dev'])
