var gulp = require('gulp')
var browserify = require('browserify')
var watchify = require('watchify')
var source = require('vinyl-source-stream')
var gutil = require('gulp-util')
var _ = require('lodash')
var injector = require('gulp-inject-string')
var fs = require('fs')

var b = watchify(browserify(_.assign({}, watchify.args, { entries: ['./browser.js'], debug: true })));

function bundle() {
    return b.bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('./'));
}

gulp.task('bundle', bundle)
gulp.task('watch', ['bundle'], function () {
    gulp.watch(['./browser.js'], ['bundle'])
})


var jsBundle = fs.readFileSync('./bundle.js').toString()

gulp.task('inject-js', function () {
    return gulp.src('./docs.html')
    .pipe(injector.replace(' src="bundle.js"', ''))
    .pipe(injector.replace('// inject:js', jsBundle))
    .pipe(gulp.dest('./dist'))
})
