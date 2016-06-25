var gulp = require('gulp')
var browserify = require('browserify')
var watchify = require('watchify')
var source = require('vinyl-source-stream')
var gutil = require('gulp-util')
var _ = require('lodash')
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

gulp.task('pkg', ['bundle'], function () {
    var bundleFile = fs.readFileSync('./bundle.js').toString().replace(' src="bundle.js">', '>'+fs.readFileSync(__dirname+'/bundle.js'))
    bundleFile = bundleFile.slice(0, bundleFile.indexOf('//# sourceMappingURL')) // quick hack removing browserify sourcemaps
    return fs.writeFileSync('./bundle.js', bundleFile)
})
