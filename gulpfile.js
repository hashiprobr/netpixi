import watchify from 'watchify';
import browserify from 'browserify';
import gulp from 'gulp';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import log from 'gulplog';
import sourcemaps from 'gulp-sourcemaps';
import assign from 'lodash.assign';
import babelify from 'babelify';
import uglify from 'gulp-uglify';


const customOpts = {
    entries: ['./index.js'],
};
const opts = assign({}, watchify.args, customOpts);
const b = watchify(browserify(opts));

b.transform(babelify, {
    presets: ['es2015'],
    plugins: ['transform-object-rest-spread'],
    global: true,
});

gulp.task('default', bundle);
b.on('update', bundle);
b.on('log', log.info);


function bundle() {
    return b.bundle()
        .on('error', log.error.bind(log, 'Browserify Error'))
        .pipe(source('netpixi.min.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(uglify())
        .pipe(sourcemaps.write('./', {
            sourceMappingURLPrefix: '/files',
            mapFile: (path) => path.replace('.js.map', '.map'),
         }))
        .pipe(gulp.dest('./netpixi'));
}
