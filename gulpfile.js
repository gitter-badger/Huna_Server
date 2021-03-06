var gulp = require('gulp'),
    argv = require('yargs').argv,
    cache = require('gulp-cache'),
    concat = require('gulp-concat'),
    del = require('del'),
    gulpif = require('gulp-if'),
    gutil = require('gulp-util')
    notify = require('gulp-notify'),
    plumber = require('gulp-plumber'),
    q = require('q'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace');

var config = require('./package.json');
var settings = config.settings;
    settings.liveReload=false;
    settings.plumberConfig=function(){
      return {'errorHandler': onError};
    };

/**
 * browser-sync task for starting a server. This will open a browser for you. Point multiple browsers / devices to the same url and watch the magic happen.
 * Depends on: watch
 */
gulp.task('browser-sync', ['watch'], function() {
  var browserSync = require('browser-sync');

  // Watch any files in dist/*, reload on change
  gulp.watch([settings.dist + '**']).on('change', function(){browserSync.reload({});notify({ message: 'Reload browser' });});

  return browserSync({
      server: {
          baseDir: settings.dist
      },
      ghostMode: {
        clicks: true,
        location: true,
        forms: true,
        scroll: true
      },
      open: "external",
      injectChanges: true, // inject CSS changes (false force a reload) 
      browser: ["google chrome"],
      scrollProportionally: true, // Sync viewports to TOP position
      scrollThrottle: 50,
    });
});


/**
 * Build and copy all styles, scripts, images and fonts.
 * Depends on: clean
 */
gulp.task('build', ['info', 'clean'], function() {
  gulp.start('styles', 'scripts', 'images', 'copy', 'todo');
});


/**
 * Cleans the `dist` folder and other generated files
 */
gulp.task('clean', ['clear-cache'],  function(cb) {
  del([settings.dist, 'todo.md', 'todo.json'], cb);
});

/**
 * Clears the cache used by gulp-cache
 */
gulp.task('clear-cache', function() {
  // Or, just call this for everything
  cache.clearAll();
});


/**
 * Copies all to dist/
 */
gulp.task('copy', ['copy-fonts', 'copy-template', 'copy-index'], function() {});


/**
 * Task for copying fonts only
 */
gulp.task('copy-fonts', function() {
  var deferred = q.defer();
   // copy all fonts
   setTimeout(function() {
    gulp.src( settings.src + 'fonts/**')
      .pipe(gulp.dest(settings.dist + 'fonts'));
       deferred.resolve();
  }, 1);

  return deferred.promise;
});


/**
 * task for copying templates only
 */
gulp.task('copy-template', function() {
  // copy all html && json
  return gulp.src( [settings.src + 'js/app/**/*.html', settings.src + 'js/app/**/*.json'])
    .pipe(cache(gulp.dest('dist/js/app')));
});

/**
 * Task for copying index page only. Optionally add live reload script to it
 */
gulp.task('copy-index', function() {
   // copy the index.html
   return gulp.src(settings.src + 'index.html')
    .pipe(gulpif(argv.dev, replace(/app.min.js/g, 'app.js')))
    .pipe(gulpif(argv.nohuna, replace('<script src=\'js/huna.min.js\'></script>', '')))
    .pipe(gulpif(settings.liveReload, replace(/(\<\/body\>)/g, "<script>document.write('<script src=\"http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1\"></' + 'script>')</script>$1")))
    .pipe(cache(gulp.dest(settings.dist)));
});


/**
 * Default task.
 * Depends on: build
 */
gulp.task('default', ['build']);


/**
 * Create Javascript documentation
 */
gulp.task('docs-js', ['todo'], function(){
  var gulpDoxx = require('gulp-doxx');

  gulp.src([settings.src + '/js/**/*.js', 'README.md', settings.reports + '/TODO.md'])
    .pipe(gulpDoxx({
      title: config.name,
      urlPrefix: "file:///"+__dirname+settings.reports
    }))
    .pipe(gulp.dest(settings.reports));
});


/**
 * Task to optimize and deploy all images found in folder `src/img/**`. Result is copied to `dist/img`
 */
gulp.task('images', function() {
  var imagemin = require('gulp-imagemin');
  var deferred = q.defer();

  setTimeout(function() {
    gulp.src(settings.src + 'img/**/*')
      .pipe(plumber(settings.plumberConfig()))
      .pipe(cache(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true })))
      .pipe(gulp.dest(settings.dist + 'img'));
    deferred.resolve();
  }, 1);

  return deferred.promise;
});


/**
 * log some info
 */
gulp.task('info',function(){
  // log project details
  gutil.log( gutil.colors.cyan("Running gulp on project "+config.name+" v"+ config.version) );
  gutil.log( gutil.colors.cyan("Author: " + config.author[0].name) );
  gutil.log( gutil.colors.cyan("Email : " + config.author[0].email) );
  gutil.log( gutil.colors.cyan("Site  : " + config.author[0].url) );
  gutil.log( gutil.colors.cyan("Author: " + config.author[1].name) );
  gutil.log( gutil.colors.cyan("Email : " + config.author[1].email) );
  gutil.log( gutil.colors.cyan("Site  : " + config.author[1].url) );
  // log info
  gutil.log("If you have an enhancement or encounter a bug, please report them on", gutil.colors.magenta(config.bugs.url));
});


/**
 * Start the live reload server. Live reload will be triggered when a file in the `dist` folder changes. This will add a live-reload script to the index.html page, which makes it all happen.
 * Depends on: watch
 */
gulp.task('live-reload', ['watch'], function() {
  var livereload = require('gulp-livereload');

  settings.liveReload = true;
  // first, delete the index.html from the dist folder as we will copy it later
  del([settings.dist + 'index.html']);

  // add livereload script to the index.html
  gulp.src([settings.src + 'index.html'])
   .pipe(gulpif(argv.dev, replace(/app.min.js/g, 'app.js')))
   .pipe(gulpif(argv.nohuna, replace('<script src=\'js/huna.min.js\'></script>', '')))
   .pipe(replace(/(\<\/body\>)/g, "<script>document.write('<script src=\"http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1\"></' + 'script>')</script>$1"))
   .pipe(gulp.dest(settings.dist));
   
  // Create LiveReload server
  livereload.listen();

  // Watch any files in dist/*, reload on change
  gulp.watch([settings.dist + '**']).on('change', livereload.changed);
});


/**
 * Task to handle and deploy all javascript, application & vendor
 *
 * Depends on: scripts-app, scripts-vendor
 */
gulp.task('scripts', ['scripts-app','scripts-vendor']);


/**
 * Removes the node_modules
 */
gulp.task('remove',['clean'], function(cb){
  del('node_modules', cb);
});


/**
 * Minifies all javascript found in the `src/js/**` folder. All files will be concatenated into `app.js`.  Minified and non-minified versions are copied to the dist folder.
 * This will also generete sourcemaps for the minified version.
 *
 * Depends on: docs
 */
gulp.task('scripts-app', ['docs-js'], function() {
  var jshint = require('gulp-jshint'),
      ngannotate = require('gulp-ng-annotate'),
      stripDebug = require('gulp-strip-debug'),
      stylish = require('jshint-stylish'),
      sourcemaps = require('gulp-sourcemaps'),
      uglify = require('gulp-uglify');

  // gulpify the huna library
  gulp.src([settings.src + 'js/app/huna.js'])
    .pipe(plumber(settings.plumberConfig()))
    .pipe(ngannotate({gulpWarnings: false}))
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(gulp.dest(settings.dist + 'js'))
    // make minified 
    .pipe(rename({suffix: '.min'}))
    .pipe(gulpif(!argv.dev, stripDebug()))
    .pipe(sourcemaps.init())
    .pipe(gulpif(!argv.dev, uglify()))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(settings.dist + 'js'));

  return gulp.src(['!'+settings.src + 'js/app/huna.js', settings.src + 'js/app/**/*.js'])
    .pipe(plumber(settings.plumberConfig()))
    .pipe(ngannotate({gulpWarnings: false}))
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(concat('app.js'))
    .pipe(gulp.dest(settings.dist + 'js'))
    // make minified 
    .pipe(rename({suffix: '.min'}))
    .pipe(gulpif(!argv.dev, stripDebug()))
    .pipe(sourcemaps.init())
    .pipe(gulpif(!argv.dev, uglify()))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(settings.dist + 'js'));
});


/**
 * Task to handle all vendor specific javasript. All vendor javascript will be copied to the dist directory. Also a concatinated version will be made, available in \dist\js\vendor\vendor.js
 */
gulp.task('scripts-vendor', ['scripts-vendor-maps'], function() {
    // script must be included in the right order. First include angular, then angular-route
  return gulp.src([settings.src + 'js/vendor/*/**/angular.min.js',settings.src + 'js/vendor/**/*.js'])
    .pipe(gulp.dest(settings.dist + 'js/vendor'))
    .pipe(concat('vendor.js'))
    .pipe(gulp.dest(settings.dist + 'js/vendor'));
});


/**
 * Copy all vendor .js.map files to the vendor location
 */
gulp.task('scripts-vendor-maps', function(){
  var flatten = require('gulp-flatten');

  return gulp.src(settings.src + 'js/vendor/**/*.js.map')
  .pipe(flatten())
  .pipe(gulp.dest(settings.dist + 'js/vendor'));
});


/**
 * Task to start a server on port 4000.
 */
gulp.task('server', function(){
  var express = require('express'),
    app = express(), 
    url = require('url'),
    port = argv.port||settings.serverport,
    proxy = require('proxy-middleware');

  app.use(express.static(__dirname + "/dist"));

  if (argv.remote) {
    app.use('/api', proxy(url.parse('http://huna.tuvok.nl:1337/api')));
  } else {
    app.use('/api', proxy(url.parse('http://localhost:1337/api')));
  }

  app.listen(port); 
  gutil.log('Server started. Port', port,"baseDir",__dirname+"/"+settings.dist);
});


/**
 * Task to start a server on port 4000 and used the live reload functionality.
 * Depends on: server, live-reload
 */
gulp.task('start', ['live-reload', 'server'], function(){});


/**
 * Compile Sass into Css and minify it. Minified and non-minified versions are copied to the dist folder.
 * This will also auto prefix vendor specific rules.
 */
gulp.task('styles', function() {
  var autoprefixer = require('gulp-autoprefixer'),
      minifycss = require('gulp-minify-css'),
      sass = require('gulp-sass');

  return gulp.src([settings.src + 'styles/main.scss', settings.src + '/js/vendor/**/c3.min.css'])
    .pipe(plumber(settings.plumberConfig()))
    .pipe(sass({ style: 'expanded' }))
    // .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
    .pipe(gulp.dest(settings.dist + 'css'))
    .pipe(rename({suffix: '.min'}))
    .pipe(minifycss())
    .pipe(gulp.dest(settings.dist + 'css'));
});


/**
 * Output TODO's & FIXME's in markdown and json file as well
 */
gulp.task('todo', function() {
  var todo = require('gulp-todo');
  gulp.src([settings.src + 'js/app/**/*.js',settings.src + 'styles/app/**/*.scss'])
    .pipe(plumber(settings.plumberConfig()))
    .pipe(todo())
    .pipe(gulp.dest(settings.reports)) //output todo.md as markdown
    .pipe(todo.reporter('json', {fileName: 'todo.json'}))
    .pipe(gulp.dest(settings.reports)) //output todo.json as json
});


/**
 * Watches changes to template, Sass, javascript and image files. On change this will run the appropriate task, either: copy styles, scripts or images. 
 */
gulp.task('watch', function() {

  // watch index.html
  gulp.watch(settings.src + 'index.html', ['copy-index']);

  // watch html files
  gulp.watch(settings.src + '**/*.html', ['copy-template']);

  // watch fonts 
  gulp.watch(settings.src + 'fonts/**', ['copy-fonts']);

  // Watch .scss files
  gulp.watch(settings.src + 'styles/**/*.scss', ['styles']);

  // Watch app .js files
  gulp.watch(settings.src + 'js/app/**/*.js', ['scripts-app']);

  // Watch vendor .js files
  gulp.watch(settings.src + 'js/vendor/**/*.js', ['scripts-vendor']);

  // Watch image files
  gulp.watch(settings.src + 'img/**/*', ['images']);
});

function onError(error){
  // TODO log error with gutil
  notify.onError(function (error) {
    return error.message;
  });
  this.emit('end');
}